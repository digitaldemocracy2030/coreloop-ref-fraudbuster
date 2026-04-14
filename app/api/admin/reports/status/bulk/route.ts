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
	flattenReportLabelNames,
	mergeBulkReportLabelCodes,
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

function getUniqueReportIds(formData: FormData) {
	return Array.from(
		new Set(
			formData
				.getAll("reportIds")
				.map((value) => (typeof value === "string" ? value.trim() : ""))
				.filter(Boolean),
		),
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

function buildTimelineDescription(params: {
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

function buildActionLabel(params: {
	statusChanged: boolean;
	labelsChanged: boolean;
	afterStatusCode: string | null;
}) {
	if (params.statusChanged && isCompletedReportStatus(params.afterStatusCode)) {
		return "判定済み";
	}

	if (params.statusChanged && params.labelsChanged) {
		return "内容一括更新";
	}

	if (params.statusChanged) {
		return "ステータス一括更新";
	}

	return "ラベル一括更新";
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

export async function POST(request: NextRequest) {
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
		const reportIds = getUniqueReportIds(formData);
		const rawStatusId = readText(formData, "statusId");
		const statusId =
			rawStatusId.length > 0 ? Number.parseInt(rawStatusId, 10) : null;
		const rawVerdict = readText(formData, "verdict");
		const updateGenres = formData.get("updateGenres") === "1";
		const clearGenres = formData.get("clearGenres") === "1";
		const updateImpersonation = formData.get("updateImpersonation") === "1";
		const updateMedia = formData.get("updateMedia") === "1";
		const updateExpression = formData.get("updateExpression") === "1";
		const genreCodes = readMultiValues(formData, "genreCodes");
		const impersonationCode = readText(formData, "impersonationCode");
		const mediaCode = readText(formData, "mediaCode");
		const expressionCode = readText(formData, "expressionCode");
		const updateLabels =
			updateGenres || updateImpersonation || updateMedia || updateExpression;
		let nextVerdict: ReportVerdictCode | null = null;

		if (reportIds.length === 0) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"更新対象の通報が不正です。",
			);
		}

		if (statusId !== null && Number.isNaN(statusId)) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"変更先ステータスが不正です。",
			);
		}

		if (statusId === null && !updateLabels) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"ステータスまたはラベルの更新内容を指定してください。",
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
		if (updateGenres && !clearGenres && genreCodes.length === 0) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"ジャンルを更新する場合は選択するか、空にするを指定してください。",
			);
		}
		if (
			updateImpersonation &&
			(!impersonationCode ||
				!areReportLabelCodesInGroup(
					[impersonationCode],
					REPORT_LABEL_GROUP_CODES.IMPERSONATION,
				))
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"なりすましを更新する場合は1件選択してください。",
			);
		}
		if (
			updateMedia &&
			(!mediaCode ||
				!areReportLabelCodesInGroup(
					[mediaCode],
					REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
				))
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"他メディアを更新する場合は1件選択してください。",
			);
		}
		if (
			updateExpression &&
			(!expressionCode ||
				!areReportLabelCodesInGroup(
					[expressionCode],
					REPORT_LABEL_GROUP_CODES.EXPRESSION,
				))
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"表現を更新する場合は1件選択してください。",
			);
		}

		if (statusId === null && rawVerdict.length > 0) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"判定結果を変更する場合は、変更先ステータスも選択してください。",
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

		const [nextStatus, admin, reports, labelMaster] = await Promise.all([
			statusId !== null
				? prisma.reportStatus.findUnique({
						where: { id: statusId },
						select: { id: true, label: true, statusCode: true },
					})
				: Promise.resolve(null),
			prisma.admin.findUnique({
				where: { email: session.email },
				select: { id: true },
			}),
			prisma.report.findMany({
				where: {
					id: {
						in: reportIds,
					},
				},
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
					status: {
						select: {
							label: true,
							statusCode: true,
						},
					},
				},
			}),
			prisma.reportLabel.findMany({
				select: {
					id: true,
					code: true,
					name: true,
					groupCode: true,
					displayOrder: true,
				},
			}),
		]);

		if (statusId !== null && !nextStatus) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"対象のステータスが見つかりません。",
			);
		}

		if (
			nextStatus &&
			isCompletedReportStatus(nextStatus.statusCode) &&
			!nextVerdict
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"完了ステータスにする場合は判定結果を選択してください。",
			);
		}

		if (reports.length !== reportIds.length) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"選択された通報の一部が見つかりません。",
			);
		}

		const labelMasterByCode = new Map(
			labelMaster.map((label) => [label.code, toReportLabelRecord(label)]),
		);

		const requestedCodes = [
			...genreCodes,
			...(updateImpersonation && impersonationCode ? [impersonationCode] : []),
			...(updateMedia && mediaCode ? [mediaCode] : []),
			...(updateExpression && expressionCode ? [expressionCode] : []),
		];
		if (requestedCodes.some((code) => !labelMasterByCode.has(code))) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"選択されたラベルの一部が見つかりません。",
			);
		}

		const result = await prisma.$transaction(
			async (tx) => {
				const updatedAt = new Date();
				const changedReports = reports
					.map((report) => {
						const currentLabelRecords = report.reportLabels.map((item) =>
							toReportLabelRecord(item.label),
						);
						const currentLabelNames =
							flattenReportLabelNames(currentLabelRecords);
						const nextCodes = updateLabels
							? mergeBulkReportLabelCodes(currentLabelRecords, {
									updateGenres,
									clearGenres,
									genreCodes,
									updateImpersonation,
									impersonationCode: impersonationCode || null,
									updateMedia,
									mediaCode: mediaCode || null,
									updateExpression,
									expressionCode: expressionCode || null,
								})
							: currentLabelRecords.map((label) => label.code);
						const nextLabelRecords = sortReportLabels(
							nextCodes
								.map((code) => labelMasterByCode.get(code))
								.filter((label): label is ReportLabelRecord => Boolean(label)),
						);
						const nextLabelNames = flattenReportLabelNames(nextLabelRecords);
						const nextStatusCode =
							nextStatus?.statusCode ?? report.status?.statusCode ?? null;
						const normalizedVerdict =
							nextStatus && isCompletedReportStatus(nextStatus.statusCode)
								? nextVerdict
								: nextStatus
									? null
									: report.verdict;
						const nextRecommendedVerdict = normalizedVerdict
							? null
							: getRecommendedVerdict({
									statusCode: nextStatusCode,
									labels: nextLabelRecords,
								});
						const nextRiskScore = normalizedVerdict
							? getFixedRiskScoreForVerdict(normalizedVerdict)
							: report.verdict
								? 0
								: (report.riskScore ?? 0);
						const statusChanged =
							(nextStatus !== null && report.statusId !== nextStatus.id) ||
							report.verdict !== normalizedVerdict;
						const labelsChanged = !areStringArraysEqual(
							currentLabelNames,
							nextLabelNames,
						);
						const recommendationChanged =
							report.recommendedVerdict !== nextRecommendedVerdict;
						const riskScoreChanged = report.riskScore !== nextRiskScore;

						return {
							report,
							currentLabelNames,
							nextLabelRecords,
							nextLabelNames,
							normalizedVerdict,
							nextRecommendedVerdict,
							nextRiskScore,
							statusChanged,
							labelsChanged,
							recommendationChanged,
							riskScoreChanged,
						};
					})
					.filter(
						(entry) =>
							entry.statusChanged ||
							entry.labelsChanged ||
							entry.recommendationChanged ||
							entry.riskScoreChanged,
					);

				if (changedReports.length === 0) {
					return { changedReportIds: [] as string[] };
				}

				const timelineEntries = changedReports.map((entry) => {
					const afterStatusCode =
						nextStatus?.statusCode ?? entry.report.status?.statusCode ?? null;
					const afterStatusLabel = nextStatus
						? (getReportStatusMeta(nextStatus.statusCode)?.label ??
							nextStatus.label)
						: (getReportStatusMeta(entry.report.status?.statusCode)?.label ??
							entry.report.status?.label ??
							"未設定");
					const beforeStatusLabel =
						getReportStatusMeta(entry.report.status?.statusCode)?.label ??
						entry.report.status?.label ??
						"未設定";
					const beforeVerdictLabel =
						getReportVerdictMeta(entry.report.verdict)?.label ?? null;
					const afterVerdictLabel =
						getReportVerdictMeta(entry.normalizedVerdict)?.label ?? null;

					return {
						reportId: entry.report.id,
						actionLabel: buildActionLabel({
							statusChanged: entry.statusChanged,
							labelsChanged: entry.labelsChanged,
							afterStatusCode,
						}),
						description: buildTimelineDescription({
							beforeStatusLabel,
							afterStatusLabel,
							beforeVerdictLabel,
							afterVerdictLabel,
							beforeLabels: entry.currentLabelNames,
							afterLabels: entry.nextLabelNames,
						}),
						createdBy: admin?.id ?? null,
					};
				});

				for (const entry of changedReports) {
					await tx.report.update({
						where: {
							id: entry.report.id,
						},
						data: {
							...(nextStatus
								? {
										statusId: nextStatus.id,
										verdict: entry.normalizedVerdict,
									}
								: {
										verdict: entry.normalizedVerdict,
									}),
							recommendedVerdict: entry.nextRecommendedVerdict,
							riskScore: entry.nextRiskScore,
							...(updateLabels
								? {
										reportLabels: {
											deleteMany: {},
											create: entry.nextLabelRecords.map((label) => ({
												label: {
													connect: {
														id: label.id,
													},
												},
											})),
										},
									}
								: {}),
							updatedAt,
						},
					});
				}

				await tx.reportTimeline.createMany({
					data: timelineEntries,
				});

				return {
					changedReportIds: changedReports.map((entry) => entry.report.id),
				};
			},
			{ timeout: 20_000 },
		);

		if (result.changedReportIds.length === 0) {
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
		for (const reportId of result.changedReportIds) {
			revalidatePath(`/reports/${reportId}`);
		}

		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"notice",
			`${result.changedReportIds.length}件の通報を更新しました。`,
		);
	} catch (error) {
		console.error("Failed to bulk update reports:", error);
		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"error",
			"通報の一括更新に失敗しました。",
		);
	}
}
