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
		const { id: reportId } = await ctx.params;
		const statusId = Number.parseInt(readText(formData, "statusId"), 10);
		const rawVerdict = readText(formData, "verdict");
		let nextVerdict: ReportVerdictCode | null = null;
		const selectedLabelIds = formData
			.getAll("selectedLabelIds")
			.map((value) =>
				typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN,
			)
			.filter((value) => Number.isInteger(value) && value > 0);
		const parsedNewLabels = parseReportLabels(readText(formData, "newLabels"));
		const labelsError = validateReportLabels(parsedNewLabels);

		if (!reportId || Number.isNaN(statusId)) {
			return toAdminRedirect(
				request,
				currentPage,
				filters,
				"error",
				"通報IDまたはステータスが不正です。",
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
		const [report, nextStatus, admin, existingSelectedLabels] =
			await Promise.all([
				prisma.report.findUnique({
					where: { id: reportId },
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
				selectedLabelIds.length > 0
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

		if (existingSelectedLabels.length !== selectedLabelIds.length) {
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
		const currentLabels = report.reportLabels.map((item) => item.label.name);

		const result = await prisma.$transaction(async (tx) => {
			const createdLabels =
				trulyNewLabels.length > 0
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

			const allLabels = [...existingSelectedLabels, ...createdLabels].sort(
				(a, b) => a.name.localeCompare(b.name, "ja"),
			);
			const nextLabelNames = allLabels.map((label) => label.name);
			const normalizedVerdict = isCompletedReportStatus(nextStatus.statusCode)
				? nextVerdict
				: null;

			if (
				report.statusId === nextStatus.id &&
				report.verdict === normalizedVerdict &&
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
					reportLabels: {
						deleteMany: {},
						create: allLabels.map((label) => ({
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
					actionLabel: isCompletedReportStatus(nextStatus.statusCode)
						? "判定済み"
						: "内容更新",
					description: timelineDescription,
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
		revalidatePath("/");
		revalidatePath(`/reports/${reportId}`);
		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"notice",
			"通報情報を更新しました。",
		);
	} catch (error) {
		console.error("Failed to update report status:", error);
		return toAdminRedirect(
			request,
			currentPage,
			filters,
			"error",
			"通報情報の更新に失敗しました。",
		);
	}
}
