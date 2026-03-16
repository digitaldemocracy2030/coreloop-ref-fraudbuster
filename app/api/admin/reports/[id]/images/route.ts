import { revalidatePath, revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { ADMIN_REPORT_STATUSES_PATH } from "@/lib/admin-report-statuses";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import {
	badRequestResponse,
	errorResponse,
	successResponse,
} from "@/lib/api-utils";
import { getSafeReportImageProxyPath } from "@/lib/report-image-delivery";
import { prisma } from "@/lib/prisma";
import {
	ReportImageUploadValidationError,
	readReportImageFiles,
	storePreparedReportImages,
	validateAndPrepareReportImages,
} from "@/lib/report-image-ingest";
import {
	cleanupStoredReportImages,
	getReportImageStorageBucket,
	resolveSupabaseProjectOrigin,
} from "@/lib/report-image-storage";

type AdminReportImagesRouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(
	request: NextRequest,
	ctx: AdminReportImagesRouteContext,
) {
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		return errorResponse("再度ログインしてください。", 401);
	}

	try {
		const { id: reportId } = await ctx.params;
		if (!reportId) {
			return badRequestResponse("通報IDが不正です。");
		}

		const report = await prisma.report.findUnique({
			where: { id: reportId },
			select: {
				id: true,
				images: {
					select: {
						id: true,
						imageUrl: true,
						displayOrder: true,
					},
					orderBy: { displayOrder: "asc" },
				},
			},
		});

		if (!report) {
			return errorResponse("対象の通報が見つかりません。", 404);
		}

		return successResponse({
			images: report.images.map((image) => ({
				id: image.id,
				previewUrl: getSafeReportImageProxyPath(image),
				displayOrder: image.displayOrder ?? null,
			})),
		});
	} catch (error) {
		console.error("Failed to fetch admin report images:", error);
		return errorResponse("画像一覧の取得に失敗しました。", 500);
	}
}

export async function POST(
	request: NextRequest,
	ctx: AdminReportImagesRouteContext,
) {
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		return errorResponse("再度ログインしてください。", 401);
	}

	try {
		const { id: reportId } = await ctx.params;
		if (!reportId) {
			return badRequestResponse("通報IDが不正です。");
		}

		const supabaseOrigin = resolveSupabaseProjectOrigin();
		const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
		const bucket = getReportImageStorageBucket();
		if (!supabaseOrigin || !serviceRoleKey) {
			return errorResponse(
				"Storageの設定が不足しています。管理者へお問い合わせください。",
				503,
			);
		}

		const formData = await request.formData();
		const files = readReportImageFiles(formData);
		const [report, latestDisplayOrder, admin] = await Promise.all([
			prisma.report.findUnique({
				where: { id: reportId },
				select: {
					id: true,
					title: true,
					_count: {
						select: {
							images: true,
						},
					},
				},
			}),
			prisma.reportImage.aggregate({
				where: { reportId },
				_max: {
					displayOrder: true,
				},
			}),
			prisma.admin.findUnique({
				where: { email: session.email },
				select: { id: true, name: true },
			}),
		]);

		if (!report) {
			return errorResponse("対象の通報が見つかりません。", 404);
		}

		const preparedFiles = await validateAndPrepareReportImages(files);
		const uploadedFiles = await storePreparedReportImages({
			files: preparedFiles,
			bucket,
			serviceRoleKey,
			supabaseOrigin,
			storagePrefix: `reports/${reportId}/admin`,
		});

		try {
			const nextDisplayOrder =
				(latestDisplayOrder._max.displayOrder ?? report._count.images - 1) + 1;
			const nextTotalImages = report._count.images + uploadedFiles.length;

			await prisma.$transaction([
				prisma.report.update({
					where: { id: reportId },
					data: {
						updatedAt: new Date(),
						images: {
							createMany: {
								data: uploadedFiles.map((file, index) => ({
									imageUrl: file.publicUrl,
									displayOrder: nextDisplayOrder + index,
								})),
							},
						},
					},
				}),
				prisma.reportTimeline.create({
					data: {
						reportId,
						actionLabel: "証拠画像追加",
						description: `${uploadedFiles.length}枚の画像を追加`,
						createdBy: admin?.id ?? null,
					},
				}),
			]);

			revalidateTag("reports", "max");
			revalidatePath(ADMIN_REPORT_STATUSES_PATH);
			revalidatePath("/admin");
			revalidatePath(`/reports/${reportId}`);

			return successResponse(
				{
					uploadedCount: uploadedFiles.length,
					totalImageCount: nextTotalImages,
					reportTitle: report.title,
					adminName: admin?.name ?? null,
				},
				201,
			);
		} catch (databaseError) {
			await cleanupStoredReportImages({
				files: uploadedFiles,
				bucket,
				serviceRoleKey,
				supabaseOrigin,
			});
			throw databaseError;
		}
	} catch (error) {
		if (error instanceof ReportImageUploadValidationError) {
			return badRequestResponse(error.message);
		}

		console.error("Failed to upload admin report images:", error);
		return errorResponse("画像のアップロードに失敗しました。", 502);
	}
}
