import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
	cleanupStoredReportImages,
	getReportImageStorageBucket,
	getReportImageStoragePathFromUrl,
	resolveSupabaseProjectOrigin,
} from "@/lib/report-image-storage";

const REPORTS_ADMIN_PATH = "/admin/report-statuses";

type AdminReportImageRouteContext = {
	params: Promise<{ id: string; imageId: string }>;
};

function toAdminRedirect(
	request: NextRequest,
	messageType: "notice" | "error",
	message: string,
): NextResponse {
	const url = new URL(REPORTS_ADMIN_PATH, request.url);
	url.searchParams.set(messageType, message);
	return NextResponse.redirect(url, { status: 303 });
}

export async function POST(
	request: NextRequest,
	ctx: AdminReportImageRouteContext,
) {
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		const loginUrl = new URL("/admin/login", request.url);
		loginUrl.searchParams.set("error", "再度ログインしてください。");
		return NextResponse.redirect(loginUrl, { status: 303 });
	}

	try {
		const { id: reportId, imageId } = await ctx.params;
		if (!reportId || !imageId) {
			return toAdminRedirect(request, "error", "画像IDが不正です。");
		}

		const image = await prisma.reportImage.findFirst({
			where: {
				id: imageId,
				reportId,
			},
			select: {
				id: true,
				imageUrl: true,
			},
		});

		if (!image) {
			return toAdminRedirect(request, "error", "対象の画像が見つかりません。");
		}

		await prisma.$transaction([
			prisma.reportImage.delete({
				where: { id: image.id },
			}),
			prisma.report.update({
				where: { id: reportId },
				data: {
					updatedAt: new Date(),
				},
			}),
		]);

		const storagePath = getReportImageStoragePathFromUrl(image.imageUrl);
		const supabaseOrigin = resolveSupabaseProjectOrigin();
		const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

		if (storagePath && supabaseOrigin && serviceRoleKey) {
			await cleanupStoredReportImages({
				files: [
					{
						path: storagePath,
						publicUrl: image.imageUrl,
						contentType: "",
						size: 0,
					},
				],
				bucket: getReportImageStorageBucket(),
				serviceRoleKey,
				supabaseOrigin,
			});
		}

		revalidateTag("reports", "max");
		revalidatePath(REPORTS_ADMIN_PATH);
		revalidatePath("/admin");
		revalidatePath(`/reports/${reportId}`);

		return toAdminRedirect(request, "notice", "画像を削除しました。");
	} catch (error) {
		console.error("Failed to delete admin report image:", error);
		return toAdminRedirect(request, "error", "画像の削除に失敗しました。");
	}
}
