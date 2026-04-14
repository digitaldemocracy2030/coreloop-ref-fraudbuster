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
	areReportLabelCodesInGroup,
	buildSingleReportLabelCodes,
	flattenReportLabelNames,
	REPORT_LABEL_GROUP_CODES,
	type ReportLabelRecord,
	sortReportLabels,
	toUniqueStringArray,
} from "@/lib/report-labels";
import {
	getFixedRiskScoreForVerdict,
	getRecommendedVerdict,
} from "@/lib/report-recommendation";
import {
	getReportStatusMeta,
	getReportVerdictMeta,
	isCompletedReportStatus,
	isReportVerdictCode,
	type ReportVerdictCode,
} from "@/lib/report-metadata";

type AdminReportStatusRouteContext = {
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

function readMultiValues(formData: FormData, fieldName: string) {
	return toUniqueStringArray(
		formData
			.getAll(fieldName)
			.filter((value): value is string => typeof value === "string"),
	);
}

function areStringArraysEqual(left: string[], right: string[]) {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function formatReportLabels(labels: string[]) {
	return labels.join(", ");
}

function buildUpdateTimelineDescription(params: {
	beforeStatusLabel: string;
	afterStatusLabel: string;
	beforeVerdictLabel: string | null;
	afterVerdictLabel: string | null;
	beforeLabels: string[];
	afterLabels: string[];
}) {
	const changes: string[] = [];

	if (params.beforeStatusLabel !== params.afterStatusLabel) {
		changes.push(
			`ステータス: ${params.beforeStatusLabel} → ${params.afterStatusLabel}`,
		);
	}

	if (params.beforeVerdictLabel !== params.afterVerdictLabel) {
		changes.push(
			`判定結果: ${params.beforeVerdictLabel ?? "未設定"} → ${
				params.afterVerdictLabel ?? "未設定"
			}`,
		);
	}

	if (!areStringArraysEqual(params.beforeLabels, params.afterLabels)) {
		changes.push(
			`ラベル: ${
				formatReportLabels(params.beforeLabels) || "なし"
			} → ${formatReportLabels(params.afterLabels) || "なし"}`,
		);
	}

	return changes.join(" / ");
}

function toReportLabelRecord(label: {
	id: number;
	code: string;
	name: string;
	groupCode: string;
	displayOrder: number;
}): ReportLabelRecord {
	return {
		id: label.id,
		code: label.code,
		name: label.name,
		groupCode: label.groupCode,
		displayOrder: label.displayOrder,
	};
}

export async function POST(
	request: NextRequest,
	ctx: AdminReportStatusRouteContext,
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
		const statusId = Number.parseInt(readText(formData, "statusId"), 10);
		const rawVerdict = readText(formData, "verdict");
		let nextVerdict: ReportVerdictCode | null = null;

		const genreCodes = readMultiValues(formData, "genreCodes");
		const impersonationCode = readText(formData, "impersonationCode");
		const mediaCode = readText(formData, "mediaCode");
		const expressionCode = readText(formData, "expressionCode");

		if (!reportId || Number.isNaN(statusId)) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"通報IDまたはステータスが不正です。",
			);
		}
		if (
			!areReportLabelCodesInGroup(genreCodes, REPORT_LABEL_GROUP_CODES.GENRE)
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"ジャンルの値が不正です。",
			);
		}
		if (
			!impersonationCode ||
			!areReportLabelCodesInGroup(
				[impersonationCode],
				REPORT_LABEL_GROUP_CODES.IMPERSONATION,
			)
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"なりすましは必須です。",
			);
		}
		if (
			!mediaCode ||
			!areReportLabelCodesInGroup(
				[mediaCode],
				REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
			)
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"他メディアの値が不正です。",
			);
		}
		if (
			!expressionCode ||
			!areReportLabelCodesInGroup(
				[expressionCode],
				REPORT_LABEL_GROUP_CODES.EXPRESSION,
			)
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"表現の値が不正です。",
			);
		}
		if (rawVerdict.length > 0) {
			if (!isReportVerdictCode(rawVerdict)) {
				return toAdminRedirect(
					request,
					currentPage,
					filters,
					"error",
					"判定結果の値が不正です。",
				);
			}
			nextVerdict = rawVerdict;
		}

		const selectedCodes = buildSingleReportLabelCodes({
			genreCodes,
			impersonationCode,
			mediaCode,
			expressionCode,
		});

		const [report, nextStatus, admin, selectedLabels] = await Promise.all([
			prisma.report.findUnique({
				where: { id: reportId },
				select: {
					id: true,
					statusId: true,
					verdict: true,
					recommendedVerdict: true,
					riskScore: true,
					reportLabels: {
						select: {
							label: {
								select: {
									id: true,
									code: true,
									name: true,
									groupCode: true,
									displayOrder: true,
								},
							},
						},
						orderBy: [
							{ label: { displayOrder: "asc" } },
							{ label: { name: "asc" } },
						],
					},
					status: { select: { label: true, statusCode: true } },
				},
			}),
			prisma.reportStatus.findUnique({
				where: { id: statusId },
				select: { id: true, label: true, statusCode: true },
			}),
			prisma.admin.findUnique({
				where: { email: session.email },
				select: { id: true },
			}),
			prisma.reportLabel.findMany({
				where: {
					code: {
						in: selectedCodes,
					},
				},
				select: {
					id: true,
					code: true,
					name: true,
					groupCode: true,
					displayOrder: true,
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
		if (!nextStatus) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"対象のステータスが見つかりません。",
			);
		}
		if (isCompletedReportStatus(nextStatus.statusCode) && !nextVerdict) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"完了ステータスにする場合は判定結果を選択してください。",
			);
		}
		if (selectedLabels.length !== selectedCodes.length) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"選択されたラベルの一部が見つかりません。",
			);
		}

		const currentLabels = flattenReportLabelNames(
			report.reportLabels.map((item) => toReportLabelRecord(item.label)),
		);

		const result = await prisma.$transaction(async (tx) => {
			const nextLabelRecords = sortReportLabels(
				selectedLabels.map(toReportLabelRecord),
			);
			const nextLabelNames = flattenReportLabelNames(nextLabelRecords);
			const normalizedVerdict = isCompletedReportStatus(nextStatus.statusCode)
				? nextVerdict
				: null;
			const nextRecommendedVerdict = normalizedVerdict
				? null
				: getRecommendedVerdict({
						statusCode: nextStatus.statusCode,
						labels: nextLabelRecords,
					});
			const nextRiskScore = normalizedVerdict
				? getFixedRiskScoreForVerdict(normalizedVerdict)
				: report.verdict
					? 0
					: (report.riskScore ?? 0);

			if (
				report.statusId === nextStatus.id &&
				report.verdict === normalizedVerdict &&
				report.recommendedVerdict === nextRecommendedVerdict &&
				report.riskScore === nextRiskScore &&
				areStringArraysEqual(currentLabels, nextLabelNames)
			) {
				return { changed: false as const };
			}

			const beforeStatusLabel =
				getReportStatusMeta(report.status?.statusCode)?.label ??
				report.status?.label ??
				"未設定";
			const afterStatusLabel =
				getReportStatusMeta(nextStatus.statusCode)?.label ?? nextStatus.label;
			const beforeVerdictLabel =
				getReportVerdictMeta(report.verdict)?.label ?? null;
			const afterVerdictLabel =
				getReportVerdictMeta(normalizedVerdict)?.label ?? null;
			const timelineDescription = buildUpdateTimelineDescription({
				beforeStatusLabel,
				afterStatusLabel,
				beforeVerdictLabel,
				afterVerdictLabel,
				beforeLabels: currentLabels,
				afterLabels: nextLabelNames,
			});

			await tx.report.update({
				where: { id: reportId },
				data: {
					statusId: nextStatus.id,
					verdict: normalizedVerdict,
					recommendedVerdict: nextRecommendedVerdict,
					riskScore: nextRiskScore,
					reportLabels: {
						deleteMany: {},
						create: nextLabelRecords.map((label) => ({
							label: {
								connect: {
									id: label.id,
								},
							},
						})),
					},
					updatedAt: new Date(),
				},
			});

			await tx.reportTimeline.create({
				data: {
					reportId,
					actionLabel: "審査内容更新",
					description: timelineDescription || "審査内容を更新しました。",
					createdBy: admin?.id ?? null,
				},
			});

			return { changed: true as const };
		});

		if (!result.changed) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"notice",
				"変更はありませんでした。",
			);
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
			"通報内容を更新しました。",
		);
	} catch (error) {
		console.error("Failed to update report status:", error);
		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"error",
			"通報内容の更新に失敗しました。",
		);
	}
}
