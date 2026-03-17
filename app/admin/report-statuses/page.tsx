import { ExternalLink, ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { AdminShell } from "@/app/admin/_components/admin-shell";
import { ReportActionsMenu } from "@/app/admin/report-statuses/_components/report-actions-menu";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
} from "@/components/ui/pagination";
import {
	ADMIN_REPORT_STATUSES_PAGE_SIZE,
	ADMIN_REPORT_STATUSES_PATH,
	parseAdminReportStatusesPage,
} from "@/lib/admin-report-statuses";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
	compareReportStatusCodes,
	getReportStatusMeta,
	getReportVerdictMeta,
	REPORT_LABEL_BADGE_CLASS_NAME,
} from "@/lib/report-metadata";

interface AdminReportStatusesPageProps {
	searchParams: Promise<{ notice?: string; error?: string; page?: string }>;
}

function buildPageHref(page: number) {
	return page <= 1
		? ADMIN_REPORT_STATUSES_PATH
		: `${ADMIN_REPORT_STATUSES_PATH}?page=${page}`;
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
		prisma.report.count(),
	]);
	const totalPages = Math.max(
		1,
		Math.ceil(totalReports / ADMIN_REPORT_STATUSES_PAGE_SIZE),
	);
	const currentPage = Math.min(requestedPage, totalPages);
	const reports = await prisma.report.findMany({
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

						<div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
							<p>全 {totalReports} 件中</p>
							<p>
								{totalReports === 0
									? "0件"
									: `${(currentPage - 1) * ADMIN_REPORT_STATUSES_PAGE_SIZE + 1}-${
											(currentPage - 1) * ADMIN_REPORT_STATUSES_PAGE_SIZE +
											reports.length
										}件を表示`}
							</p>
						</div>

						{totalPages > 1 ? (
							<Pagination>
								<PaginationContent>
									<PaginationItem>
										{currentPage > 1 ? (
											<PaginationLink
												href={buildPageHref(currentPage - 1)}
												size="default"
											>
												前へ
											</PaginationLink>
										) : (
											<span className="inline-flex h-9 items-center rounded-md px-3 text-muted-foreground">
												前へ
											</span>
										)}
									</PaginationItem>
									<PaginationItem>
										<PaginationLink href={buildPageHref(currentPage)} isActive>
											{currentPage}
										</PaginationLink>
									</PaginationItem>
									{currentPage < totalPages ? (
										<PaginationItem>
											<PaginationLink href={buildPageHref(currentPage + 1)}>
												{currentPage + 1}
											</PaginationLink>
										</PaginationItem>
									) : null}
									{currentPage + 1 < totalPages ? (
										<PaginationItem>
											<PaginationLink href={buildPageHref(totalPages)}>
												{totalPages}
											</PaginationLink>
										</PaginationItem>
									) : null}
									<PaginationItem>
										{currentPage < totalPages ? (
											<PaginationLink
												href={buildPageHref(currentPage + 1)}
												size="default"
											>
												次へ
											</PaginationLink>
										) : (
											<span className="inline-flex h-9 items-center rounded-md px-3 text-muted-foreground">
												次へ
											</span>
										)}
									</PaginationItem>
								</PaginationContent>
							</Pagination>
						) : null}

						<div className="overflow-x-auto rounded-lg border">
							<table className="w-full text-sm">
								<thead className="bg-muted/40">
									<tr className="border-b">
										<th className="px-3 py-2 text-left font-medium">通報</th>
										<th className="px-3 py-2 text-left font-medium">投稿日</th>
										<th className="px-3 py-2 text-left font-medium">
											審査状況
										</th>
										<th className="px-3 py-2 text-right font-medium">操作</th>
									</tr>
								</thead>
								<tbody>
									{reports.length === 0 ? (
										<tr>
											<td
												colSpan={4}
												className="px-3 py-8 text-center text-muted-foreground"
											>
												通報はまだありません。
											</td>
										</tr>
									) : null}
									{reports.map((report) => {
										const fallbackStatusId = reportStatusOptions[0]?.id ?? "";
										const selectedStatusId =
											report.statusId ?? fallbackStatusId;
										const statusMeta = getReportStatusMeta(
											report.status?.statusCode,
										);
										const verdictMeta = getReportVerdictMeta(report.verdict);
										return (
											<tr key={report.id} className="border-b last:border-0">
												<td className="px-3 py-3 align-top">
													<div className="space-y-1">
														<p className="font-medium">
															{report.title || "（タイトル未設定）"}
														</p>
														<a
															href={report.url}
															target="_blank"
															rel="noreferrer"
															className="inline-flex items-start gap-1 text-xs text-muted-foreground break-all underline-offset-2 hover:text-foreground hover:underline"
														>
															<span>{report.url}</span>
															<ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
														</a>
														<p className="text-xs text-muted-foreground">
															登録画像: {report._count.images}枚
														</p>
														{report.reportLabels.length > 0 ? (
															<div className="flex flex-wrap gap-2 pt-1">
																{report.reportLabels.map(({ label }) => (
																	<Badge
																		key={label.id}
																		variant="outline"
																		className={REPORT_LABEL_BADGE_CLASS_NAME}
																	>
																		{label.name}
																	</Badge>
																))}
															</div>
														) : null}
													</div>
												</td>
												<td className="px-3 py-3 align-top text-muted-foreground">
													{formatDate(report.createdAt, "ja-JP") ?? "不明"}
												</td>
												<td className="px-3 py-3 align-top">
													<div className="flex flex-wrap gap-2">
														<Badge
															variant="outline"
															className={
																statusMeta?.badgeClassName ?? undefined
															}
														>
															{statusMeta?.label ??
																report.status?.label ??
																"未設定"}
														</Badge>
														{verdictMeta ? (
															<Badge
																variant="outline"
																className={verdictMeta.badgeClassName}
															>
																{verdictMeta.label}
															</Badge>
														) : null}
													</div>
												</td>
												<td className="px-3 py-3 align-top text-right">
													<ReportActionsMenu
														reportId={report.id}
														reportTitle={report.title}
														reportUrl={report.url}
														existingImageCount={report._count.images}
														currentPage={currentPage}
														reportStatuses={reportStatusOptions}
														selectedStatusId={selectedStatusId}
														selectedStatusCode={
															report.status?.statusCode ?? null
														}
														selectedVerdict={report.verdict}
														availableLabels={availableLabels}
														selectedLabels={report.reportLabels.map(
															({ label }) => ({
																id: label.id,
																name: label.name,
															}),
														)}
													/>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			</section>
		</AdminShell>
	);
}
