import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import {
	ADMIN_REPORT_STATUSES_PATH,
	buildAdminReportStatusesUrl,
	parseAdminReportStatusesFilters,
	parseAdminReportStatusesPage,
} from "@/lib/admin-report-statuses";
import { prisma } from "@/lib/prisma";
import {
	cleanupStoredReportImages,
	getReportImageStorageBucket,
	getReportImageStoragePathFromUrl,
	resolveSupabaseProjectOrigin,
} from "@/lib/report-image-storage";

type AdminReportRouteContext = {
	params: Promise<{ id: string }>;
};

function toAdminRedirect(
	request: NextRequest,
	page: number,
	filters: ReturnType<typeof parseAdminReportStatusesFilters>,
	messageType: "notice" | "error",
	message: string,
): NextResponse {
	const url = buildAdminReportStatusesUrl(request.url, {
		page,
		filters,
		[messageType]: message,
	});
	return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest, ctx: AdminReportRouteContext) {
	const formData = await request.formData();
	const currentPage = parseAdminReportStatusesPage(
		typeof formData.get("page") === "string"
			? String(formData.get("page"))
			: null,
	);
	const filters = parseAdminReportStatusesFilters({
		statusId: formData
			.getAll("returnStatusId")
			.filter((value): value is string => typeof value === "string"),
		verdictFilter:
			typeof formData.get("returnVerdictFilter") === "string"
				? String(formData.get("returnVerdictFilter"))
				: null,
		imageFilter:
			typeof formData.get("returnImageFilter") === "string"
				? String(formData.get("returnImageFilter"))
				: null,
		genre: formData
			.getAll("returnGenre")
			.filter((value): value is string => typeof value === "string"),
		impersonation:
			typeof formData.get("returnImpersonation") === "string"
				? String(formData.get("returnImpersonation"))
				: null,
		media:
			typeof formData.get("returnMedia") === "string"
				? String(formData.get("returnMedia"))
				: null,
		expression:
			typeof formData.get("returnExpression") === "string"
				? String(formData.get("returnExpression"))
				: null,
	});
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		const loginUrl = new URL("/admin/login", request.url);
		loginUrl.searchParams.set("error", "再度ログインしてください。");
		return NextResponse.redirect(loginUrl, { status: 303 });
	}

	try {
		const { id: reportId } = await ctx.params;
		if (!reportId) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"通報IDが不正です。",
			);
		}

		const report = await prisma.report.findUnique({
			where: { id: reportId },
			select: {
				id: true,
				images: {
					select: {
						imageUrl: true,
					},
				},
			},
		});
		if (!report) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"対象の通報が見つかりません。",
			);
		}

		const storageImagePaths = report.images
			.map((image) => getReportImageStoragePathFromUrl(image.imageUrl))
			.filter((path): path is string => Boolean(path));

		await prisma.report.delete({
			where: { id: reportId },
		});

		const supabaseOrigin = resolveSupabaseProjectOrigin();
		const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
		if (storageImagePaths.length > 0 && supabaseOrigin && serviceRoleKey) {
			await cleanupStoredReportImages({
				files: storageImagePaths.map((path) => ({
					path,
					publicUrl: "",
					contentType: "",
					size: 0,
				})),
				bucket: getReportImageStorageBucket(),
				serviceRoleKey,
				supabaseOrigin,
			});
		}

		revalidateTag("reports", "max");
		revalidateTag("home-stats", "max");
		revalidatePath(ADMIN_REPORT_STATUSES_PATH);
		revalidatePath("/admin");
		revalidatePath(`/reports/${reportId}`);
		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"notice",
			"通報を削除しました。",
		);
	} catch (error) {
		console.error("Failed to delete report:", error);
		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"error",
			"通報の削除に失敗しました。",
		);
	}
}
