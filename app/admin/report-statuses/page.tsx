import { ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { AdminShell } from "@/app/admin/_components/admin-shell";
import { ReportStatusesTable } from "@/app/admin/report-statuses/_components/report-statuses-table";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { requireAdminSession } from "@/lib/admin-auth";
import {
	ADMIN_REPORT_STATUSES_PAGE_SIZE,
	parseAdminReportStatusesFilters,
	parseAdminReportStatusesPage,
} from "@/lib/admin-report-statuses";
import { formatDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { getSafeReportImageProxyPath } from "@/lib/report-image-delivery";
import {
	compareReportStatusCodes,
	REPORT_VERDICT_CODES,
} from "@/lib/report-metadata";

interface AdminReportStatusesPageProps {
	searchParams: Promise<{
		notice?: string;
		error?: string;
		page?: string;
		statusId?: string | string[];
		verdictFilter?: string;
		imageFilter?: string;
		labelFilter?: string;
	}>;
}

export default async function AdminReportStatusesPage({
	searchParams,
}: AdminReportStatusesPageProps) {
	await connection();
	const session = await requireAdminSession();
	const params = await searchParams;
	const notice = typeof params.notice === "string" ? params.notice : null;
	const error = typeof params.error === "string" ? params.error : null;
	const requestedPage = parseAdminReportStatusesPage(params.page);
	const filters = parseAdminReportStatusesFilters({
		statusId: params.statusId,
		verdictFilter: params.verdictFilter,
		imageFilter: params.imageFilter,
		labelFilter: params.labelFilter,
	});
	const reportWhere = {
		...(filters.statusIds.length > 0
			? {
					statusId: {
						in: filters.statusIds,
					},
				}
			: {}),
		...(filters.verdictFilter === "none"
			? {
					verdict: null,
				}
			: filters.verdictFilter !== "all"
				? {
						verdict: filters.verdictFilter,
					}
				: {}),
		...(filters.imageFilter === "with"
			? {
					images: {
						some: {},
					},
				}
			: filters.imageFilter === "without"
				? {
						images: {
							none: {},
						},
					}
				: {}),
		...(filters.labelFilter === "with"
			? {
					reportLabels: {
						some: {},
					},
				}
			: filters.labelFilter === "without"
				? {
						reportLabels: {
							none: {},
						},
					}
				: {}),
	};

	const [reportStatuses, availableLabels, totalReports] = await Promise.all([
		prisma.reportStatus.findMany({
			select: {
				id: true,
				statusCode: true,
				label: true,
			},
		}),
		prisma.reportLabel.findMany({
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
			},
		}),
		prisma.report.count({
			where: reportWhere,
		}),
	]);
	const totalPages = Math.max(
		1,
		Math.ceil(totalReports / ADMIN_REPORT_STATUSES_PAGE_SIZE),
	);
	const currentPage = Math.min(requestedPage, totalPages);
	const reports = await prisma.report.findMany({
		where: reportWhere,
		orderBy: { createdAt: "desc" },
		skip: (currentPage - 1) * ADMIN_REPORT_STATUSES_PAGE_SIZE,
		take: ADMIN_REPORT_STATUSES_PAGE_SIZE,
		select: {
			id: true,
			title: true,
			url: true,
			createdAt: true,
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
			images: {
				select: {
					id: true,
					imageUrl: true,
				},
				orderBy: { displayOrder: "asc" },
				take: 2,
			},
			_count: {
				select: {
					images: true,
				},
			},
			status: {
				select: {
					statusCode: true,
					label: true,
				},
			},
		},
	});
	const sortedReportStatuses = [...reportStatuses].sort((left, right) =>
		compareReportStatusCodes(left.statusCode, right.statusCode),
	);
	const reportStatusOptions = sortedReportStatuses.map((status) => ({
		id: status.id,
		code: status.statusCode,
		label: status.label,
	}));
	const reportRows = reports.map((report) => {
		const imagePreviews = report.images
			.map((image) => ({
				id: image.id,
				previewUrl: getSafeReportImageProxyPath(image),
			}))
			.filter((image): image is { id: string; previewUrl: string } =>
				Boolean(image.previewUrl),
			);
		const remainingImageCount = Math.max(
			0,
			report._count.images - imagePreviews.length,
		);

		return {
			id: report.id,
			title: report.title,
			url: report.url,
			createdAtLabel: formatDate(report.createdAt, "ja-JP") ?? "不明",
			existingImageCount: report._count.images,
			statusId: report.statusId,
			statusCode: report.status?.statusCode ?? null,
			statusLabel: report.status?.label ?? null,
			verdict: report.verdict,
			reportLabels: report.reportLabels.map(({ label }) => ({
				id: label.id,
				name: label.name,
			})),
			imagePreviews,
			remainingImageCount,
		};
	});

	return (
		<AdminShell
			email={session.email}
			activeNav="report-statuses"
			title="通報管理"
			description="各通報のラベル、ステータス、判定結果、証拠画像を管理します。"
			notice={notice}
			error={error}
		>
			<section>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5" />
							通報一覧
						</CardTitle>
						<CardDescription>
							対象通報の内容更新、画像追加、削除を行えます。 最新{" "}
							{ADMIN_REPORT_STATUSES_PAGE_SIZE} 件ごとに表示します。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{reportStatusOptions.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								利用可能なステータスがありません。
							</p>
						) : null}
						<ReportStatusesTable
							key={`${currentPage}-${filters.statusIds.join(",") || "all"}-${filters.verdictFilter}-${filters.imageFilter}-${filters.labelFilter}-${reportRows[0]?.id ?? "empty"}-${reportRows.length}`}
							availableLabels={availableLabels}
							currentPage={currentPage}
							filters={filters}
							reportStatusOptions={reportStatusOptions}
							reportVerdictOptions={[
								{
									value: REPORT_VERDICT_CODES.CONFIRMED_FRAUD,
									label: "詐欺判定",
								},
								{
									value: REPORT_VERDICT_CODES.HIGH_RISK,
									label: "高リスク",
								},
								{
									value: REPORT_VERDICT_CODES.SAFE,
									label: "安全",
								},
								{
									value: REPORT_VERDICT_CODES.UNKNOWN,
									label: "不明",
								},
							]}
							reports={reportRows}
							totalPages={totalPages}
							totalReports={totalReports}
						/>
					</CardContent>
				</Card>
			</section>
		</AdminShell>
	);
}
