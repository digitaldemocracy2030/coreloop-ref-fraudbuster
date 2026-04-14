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
import { getFixedRiskScoreForVerdict } from "@/lib/report-recommendation";
import {
	getReportStatusMeta,
	getReportVerdictMeta,
	REPORT_STATUS_CODES,
} from "@/lib/report-metadata";

type AdminReportRecommendationApproveRouteContext = {
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

function readText(formData: FormData, fieldName: string): string {
	const value = formData.get(fieldName);
	return typeof value === "string" ? value.trim() : "";
}

export async function POST(
	request: NextRequest,
	ctx: AdminReportRecommendationApproveRouteContext,
) {
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		const loginUrl = new URL("/admin/login", request.url);
		loginUrl.searchParams.set("error", "再度ログインしてください。");
		return NextResponse.redirect(loginUrl, { status: 303 });
	}

	const formData = await request.formData();
	const currentPage = parseAdminReportStatusesPage(readText(formData, "page"));
	const filters = parseAdminReportStatusesFilters({
		statusId: formData
			.getAll("returnStatusId")
			.filter((value): value is string => typeof value === "string"),
		verdictFilter: readText(formData, "returnVerdictFilter"),
		imageFilter: readText(formData, "returnImageFilter"),
		genre: formData
			.getAll("returnGenre")
			.filter((value): value is string => typeof value === "string"),
		impersonation: readText(formData, "returnImpersonation"),
		media: readText(formData, "returnMedia"),
		expression: readText(formData, "returnExpression"),
	});

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

		const [completedStatus, admin, report] = await Promise.all([
			prisma.reportStatus.findUnique({
				where: {
					statusCode: REPORT_STATUS_CODES.COMPLETED,
				},
				select: {
					id: true,
					label: true,
					statusCode: true,
				},
			}),
			prisma.admin.findUnique({
				where: { email: session.email },
				select: { id: true },
			}),
			prisma.report.findUnique({
				where: { id: reportId },
				select: {
					id: true,
					statusId: true,
					verdict: true,
					recommendedVerdict: true,
					status: {
						select: {
							label: true,
							statusCode: true,
						},
					},
				},
			}),
		]);

		if (!report) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"対象の通報が見つかりません。",
			);
		}

		if (!completedStatus) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"完了ステータスが見つかりません。",
			);
		}

		if (
			report.status?.statusCode !== REPORT_STATUS_CODES.INVESTIGATING ||
			!report.recommendedVerdict
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"承認できる推奨判定がありません。",
			);
		}

		const approvedVerdict = report.recommendedVerdict;
		const beforeStatusLabel =
			getReportStatusMeta(report.status?.statusCode)?.label ??
			report.status?.label ??
			"未設定";
		const afterStatusLabel =
			getReportStatusMeta(completedStatus.statusCode)?.label ??
			completedStatus.label;
		const recommendedVerdictLabel =
			getReportVerdictMeta(report.recommendedVerdict)?.label ??
			report.recommendedVerdict;

		await prisma.$transaction(async (tx) => {
			await tx.report.update({
				where: { id: reportId },
				data: {
					statusId: completedStatus.id,
					verdict: approvedVerdict,
					recommendedVerdict: null,
					riskScore: getFixedRiskScoreForVerdict(approvedVerdict),
					updatedAt: new Date(),
				},
			});

			await tx.reportTimeline.create({
				data: {
					reportId,
					actionLabel: "推奨判定承認",
					description: `推奨判定: ${recommendedVerdictLabel} を承認し、ステータスを ${beforeStatusLabel} → ${afterStatusLabel} に更新しました。`,
					createdBy: admin?.id ?? null,
				},
			});
		});

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
			"推奨判定を承認しました。",
		);
	} catch (error) {
		console.error("Failed to approve report recommendation:", error);
		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"error",
			"推奨判定の承認に失敗しました。",
		);
	}
}
