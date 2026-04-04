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
	getReportStatusMeta,
	getReportVerdictMeta,
	isCompletedReportStatus,
	isReportVerdictCode,
	MAX_REPORT_LABEL_COUNT,
	normalizeReportLabel,
	parseReportLabels,
	type ReportVerdictCode,
	validateReportLabels,
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
		labelFilter: readText(formData, "returnLabelFilter"),
	});

	try {
		const reportIds = getUniqueReportIds(formData);
		const rawStatusId = readText(formData, "statusId");
		const statusId =
			rawStatusId.length > 0 ? Number.parseInt(rawStatusId, 10) : null;
		const rawVerdict = readText(formData, "verdict");
		const forceLabelUpdate = formData.get("updateLabels") === "1";
		const clearLabels = formData.get("clearLabels") === "1";
		let nextVerdict: ReportVerdictCode | null = null;
		const selectedLabelIds = formData
			.getAll("selectedLabelIds")
			.map((value) =>
				typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN,
			)
			.filter((value) => Number.isInteger(value) && value > 0);
		const parsedNewLabels = parseReportLabels(readText(formData, "newLabels"));
		const labelsError = validateReportLabels(parsedNewLabels);
		const updateLabels =
			forceLabelUpdate ||
			clearLabels ||
			selectedLabelIds.length > 0 ||
			parsedNewLabels.length > 0;

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

		if (labelsError) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				labelsError,
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

		const [nextStatus, admin, reports, existingSelectedLabels] =
			await Promise.all([
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
						reportLabels: {
							select: {
								label: {
									select: {
										id: true,
										name: true,
									},
								},
							},
							orderBy: {
								label: {
									name: "asc",
								},
							},
						},
						status: {
							select: {
								label: true,
								statusCode: true,
							},
						},
					},
				}),
				updateLabels && selectedLabelIds.length > 0
					? prisma.reportLabel.findMany({
							where: {
								id: {
									in: selectedLabelIds,
								},
							},
							select: {
								id: true,
								name: true,
							},
						})
					: Promise.resolve([]),
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

		if (
			updateLabels &&
			existingSelectedLabels.length !== selectedLabelIds.length
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"選択されたラベルの一部が見つかりません。",
			);
		}

		const selectedLabelNameSet = new Set(
			existingSelectedLabels.map((label) => normalizeReportLabel(label.name)),
		);
		const trulyNewLabels = parsedNewLabels.filter(
			(label) => !selectedLabelNameSet.has(label),
		);
		if (
			updateLabels &&
			existingSelectedLabels.length + trulyNewLabels.length >
				MAX_REPORT_LABEL_COUNT
		) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				`ラベルは最大${MAX_REPORT_LABEL_COUNT}個まで設定できます。`,
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

		const result = await prisma.$transaction(
			async (tx) => {
				const createdLabels =
					updateLabels && trulyNewLabels.length > 0
						? await Promise.all(
								trulyNewLabels.map((name) =>
									tx.reportLabel.upsert({
										where: { name },
										update: {},
										create: { name },
										select: { id: true, name: true },
									}),
								),
							)
						: [];
				const nextLabels = updateLabels
					? [...existingSelectedLabels, ...createdLabels].sort((a, b) =>
							a.name.localeCompare(b.name, "ja"),
						)
					: [];
				const nextLabelNames = nextLabels.map((label) => label.name);
				const updatedAt = new Date();
				const changedReports = reports.filter((report) => {
					const currentLabelNames = report.reportLabels.map(
						(item) => item.label.name,
					);
					const normalizedVerdict =
						nextStatus && isCompletedReportStatus(nextStatus.statusCode)
							? nextVerdict
							: nextStatus
								? null
								: report.verdict;

					return (
						(nextStatus !== null &&
							(report.statusId !== nextStatus.id ||
								report.verdict !== normalizedVerdict)) ||
						(updateLabels &&
							!areStringArraysEqual(currentLabelNames, nextLabelNames))
					);
				});

				if (changedReports.length === 0) {
					return { changedReports: [] as typeof reports };
				}

				const timelineEntries = changedReports.map((report) => {
					const currentLabelNames = report.reportLabels.map(
						(item) => item.label.name,
					);
					const afterStatusCode =
						nextStatus?.statusCode ?? report.status?.statusCode ?? null;
					const afterStatusLabel = nextStatus
						? (getReportStatusMeta(nextStatus.statusCode)?.label ??
							nextStatus.label)
						: (getReportStatusMeta(report.status?.statusCode)?.label ??
							report.status?.label ??
							"未設定");
					const afterVerdict =
						nextStatus && isCompletedReportStatus(nextStatus.statusCode)
							? nextVerdict
							: nextStatus
								? null
								: report.verdict;
					const beforeStatusLabel =
						getReportStatusMeta(report.status?.statusCode)?.label ??
						report.status?.label ??
						"未設定";
					const beforeVerdictLabel =
						getReportVerdictMeta(report.verdict)?.label ?? null;
					const afterVerdictLabel =
						getReportVerdictMeta(afterVerdict)?.label ?? null;
					const afterLabels = updateLabels
						? nextLabels
						: report.reportLabels.map((item) => item.label);
					const afterLabelNames = afterLabels.map((label) => label.name);
					const statusChanged =
						(nextStatus !== null && report.statusId !== nextStatus.id) ||
						report.verdict !== afterVerdict;
					const labelsChanged = !areStringArraysEqual(
						currentLabelNames,
						afterLabelNames,
					);

					return {
						reportId: report.id,
						actionLabel: buildActionLabel({
							statusChanged,
							labelsChanged,
							afterStatusCode,
						}),
						description: buildTimelineDescription({
							beforeStatusLabel,
							afterStatusLabel,
							beforeVerdictLabel,
							afterVerdictLabel,
							beforeLabels: currentLabelNames,
							afterLabels: afterLabelNames,
						}),
						createdBy: admin?.id ?? null,
					};
				});

				if (updateLabels) {
					for (const report of changedReports) {
						const afterVerdict =
							nextStatus && isCompletedReportStatus(nextStatus.statusCode)
								? nextVerdict
								: nextStatus
									? null
									: report.verdict;

						await tx.report.update({
							where: { id: report.id },
							data: {
								...(nextStatus
									? {
											statusId: nextStatus.id,
											verdict: afterVerdict,
										}
									: {}),
								reportLabels: {
									deleteMany: {},
									create: nextLabels.map((label) => ({
										label: {
											connect: {
												id: label.id,
											},
										},
									})),
								},
								updatedAt,
							},
						});
					}
				} else if (nextStatus) {
					const normalizedVerdict = isCompletedReportStatus(
						nextStatus.statusCode,
					)
						? nextVerdict
						: null;

					await tx.report.updateMany({
						where: {
							id: {
								in: changedReports.map((report) => report.id),
							},
						},
						data: {
							statusId: nextStatus.id,
							verdict: normalizedVerdict,
							updatedAt,
						},
					});
				}

				await tx.reportTimeline.createMany({
					data: timelineEntries,
				});

				return { changedReports };
			},
			{ timeout: 20_000 },
		);

		if (result.changedReports.length === 0) {
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
		revalidatePath("/");
		for (const report of result.changedReports) {
			revalidatePath(`/reports/${report.id}`);
		}

		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"notice",
			`${result.changedReports.length}件の通報を更新しました。`,
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
