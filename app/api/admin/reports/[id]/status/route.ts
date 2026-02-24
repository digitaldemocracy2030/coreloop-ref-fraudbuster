import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function toAdminRedirect(
	request: NextRequest,
	messageType: "notice" | "error",
	message: string,
): NextResponse {
	const url = new URL("/admin", request.url);
	url.searchParams.set(messageType, message);
	return NextResponse.redirect(url, { status: 303 });
}

function readText(formData: FormData, fieldName: string): string {
	const value = formData.get(fieldName);
	return typeof value === "string" ? value.trim() : "";
}

export async function POST(
	request: NextRequest,
	ctx: RouteContext<"/api/admin/reports/[id]/status">,
) {
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		const loginUrl = new URL("/admin/login", request.url);
		loginUrl.searchParams.set("error", "再度ログインしてください。");
		return NextResponse.redirect(loginUrl, { status: 303 });
	}

	try {
		const { id: reportId } = await ctx.params;
		const formData = await request.formData();
		const statusId = Number.parseInt(readText(formData, "statusId"), 10);

		if (!reportId || Number.isNaN(statusId)) {
			return toAdminRedirect(
				request,
				"error",
				"通報IDまたはステータスが不正です。",
			);
		}

		const [report, nextStatus, admin] = await Promise.all([
			prisma.report.findUnique({
				where: { id: reportId },
				select: {
					id: true,
					statusId: true,
					status: { select: { label: true } },
				},
			}),
			prisma.reportStatus.findUnique({
				where: { id: statusId },
				select: { id: true, label: true },
			}),
			prisma.admin.findUnique({
				where: { email: session.email },
				select: { id: true },
			}),
		]);

		if (!report) {
			return toAdminRedirect(request, "error", "対象の通報が見つかりません。");
		}
		if (!nextStatus) {
			return toAdminRedirect(
				request,
				"error",
				"対象のステータスが見つかりません。",
			);
		}
		if (report.statusId === nextStatus.id) {
			return toAdminRedirect(
				request,
				"notice",
				"ステータスは変更されていません。",
			);
		}

		const beforeLabel = report.status?.label ?? "未設定";
		await prisma.$transaction([
			prisma.report.update({
				where: { id: reportId },
				data: {
					statusId: nextStatus.id,
					updatedAt: new Date(),
				},
			}),
			prisma.reportTimeline.create({
				data: {
					reportId,
					actionLabel: "ステータス変更",
					description: `${beforeLabel} から ${nextStatus.label} に変更`,
					createdBy: admin?.id ?? null,
				},
			}),
		]);

		revalidateTag("reports", "max");
		revalidateTag("home-stats", "max");
		revalidatePath("/admin");
		revalidatePath(`/reports/${reportId}`);
		return toAdminRedirect(request, "notice", "通報ステータスを更新しました。");
	} catch (error) {
		console.error("Failed to update report status:", error);
		return toAdminRedirect(
			request,
			"error",
			"通報ステータスの更新に失敗しました。",
		);
	}
}
