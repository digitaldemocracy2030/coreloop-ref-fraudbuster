import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import {
	cleanupStoredReportImages,
	getReportImageStorageBucket,
	getReportImageStoragePathFromUrl,
	resolveSupabaseProjectOrigin,
} from "@/lib/report-image-storage";
import { prisma } from "@/lib/prisma";

const REPORTS_ADMIN_PATH = "/admin/report-statuses";

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
	ctx: RouteContext<"/api/admin/reports/[id]">,
) {
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		const loginUrl = new URL("/admin/login", request.url);
		loginUrl.searchParams.set("error", "再度ログインしてください。");
		return NextResponse.redirect(loginUrl, { status: 303 });
	}

	try {
		const { id: reportId } = await ctx.params;
		if (!reportId) {
			return toAdminRedirect(request, "error", "通報IDが不正です。");
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
			return toAdminRedirect(request, "error", "対象の通報が見つかりません。");
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
		revalidatePath(REPORTS_ADMIN_PATH);
		revalidatePath("/admin");
		revalidatePath(`/reports/${reportId}`);
		return toAdminRedirect(request, "notice", "通報を削除しました。");
	} catch (error) {
		console.error("Failed to delete report:", error);
		return toAdminRedirect(request, "error", "通報の削除に失敗しました。");
	}
}
