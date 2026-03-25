import { ExternalLink, ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { AdminShell } from "@/app/admin/_components/admin-shell";
import { ReportActionsMenu } from "@/app/admin/report-statuses/_components/report-actions-menu";
import { ReportImagePreviews } from "@/app/admin/report-statuses/_components/report-image-previews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
} from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminSession } from "@/lib/admin-auth";
import {
	ADMIN_REPORT_STATUSES_PAGE_SIZE,
	ADMIN_REPORT_STATUSES_PATH,
	parseAdminReportStatusesPage,
} from "@/lib/admin-report-statuses";
import { formatDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { getSafeReportImageProxyPath } from "@/lib/report-image-delivery";
import {
	compareReportStatusCodes,
	getReportStatusMeta,
	getReportVerdictMeta,
	REPORT_LABEL_BADGE_CLASS_NAME,
	REPORT_VERDICT_CODES,
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

						{reportStatusOptions.length > 0 && reports.length > 0 ? (
							<form
								id="bulk-status-form"
								action="/api/admin/reports/status/bulk"
								method="post"
								className="overflow-hidden rounded-2xl bg-linear-to-br from-muted/35 via-background to-background p-5 shadow-sm ring-1 ring-border/60"
							>
								<input type="hidden" name="page" value={currentPage} />
								<div className="space-y-5">
									<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
										<div className="space-y-1">
											<p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
												Bulk Update
											</p>
											<p className="text-sm font-medium">
												選択した通報を一括更新
											</p>
											<p className="text-xs text-muted-foreground">
												一覧左のチェックボックスで対象を選ぶと、現在のページ内の複数通報をまとめて更新できます。ステータス変更は任意です。ラベルを更新する場合は右側の設定を使います。
											</p>
										</div>
										<div className="inline-flex w-fit items-center rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border/50 backdrop-blur">
											チェックした通報に反映
										</div>
									</div>
									<div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
										<div className="space-y-4 rounded-xl bg-background/80 p-4 ring-1 ring-border/45">
											<div className="space-y-1">
												<p className="text-sm font-medium">審査ステータス</p>
												<p className="text-xs text-muted-foreground">
													進行状況や判定だけをまとめて更新したい場合はこちらを使います。
												</p>
											</div>
											<div className="grid gap-3 sm:grid-cols-2">
												<div className="space-y-2">
													<label
														htmlFor="bulk-status-id"
														className="text-xs font-medium text-muted-foreground"
													>
														変更先ステータス
													</label>
													<NativeSelect
														id="bulk-status-id"
														name="statusId"
														className="w-full bg-background"
														defaultValue=""
													>
														<NativeSelectOption value="">
															ステータスを変更しない
														</NativeSelectOption>
														{reportStatusOptions.map((status) => (
															<NativeSelectOption
																key={status.id}
																value={status.id}
															>
																{status.label}
															</NativeSelectOption>
														))}
													</NativeSelect>
												</div>
												<div className="space-y-2">
													<label
														htmlFor="bulk-verdict"
														className="text-xs font-medium text-muted-foreground"
													>
														判定結果
													</label>
													<NativeSelect
														id="bulk-verdict"
														name="verdict"
														className="w-full bg-background"
														defaultValue=""
													>
														<NativeSelectOption value="">
															完了にする場合のみ選択
														</NativeSelectOption>
														<NativeSelectOption
															value={REPORT_VERDICT_CODES.CONFIRMED_FRAUD}
														>
															詐欺判定
														</NativeSelectOption>
														<NativeSelectOption
															value={REPORT_VERDICT_CODES.HIGH_RISK}
														>
															高リスク
														</NativeSelectOption>
														<NativeSelectOption
															value={REPORT_VERDICT_CODES.SAFE}
														>
															安全
														</NativeSelectOption>
														<NativeSelectOption
															value={REPORT_VERDICT_CODES.UNKNOWN}
														>
															不明
														</NativeSelectOption>
													</NativeSelect>
												</div>
											</div>
										</div>
										<div className="space-y-4 rounded-xl bg-muted/35 p-4 ring-1 ring-border/35">
											<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div className="space-y-1">
													<p className="text-sm font-medium">ラベル設定</p>
													<p className="text-xs text-muted-foreground">
														一括更新を有効にすると、選択したラベルと新規ラベルで対象通報のラベルを上書きします。
													</p>
												</div>
												<label className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 text-sm font-medium ring-1 ring-border/50 backdrop-blur">
													<input
														type="checkbox"
														name="updateLabels"
														value="1"
														className="h-4 w-4 rounded border-input"
													/>
													ラベル更新を有効化
												</label>
											</div>
											<div className="space-y-2">
												<p className="text-xs font-medium text-muted-foreground">
													付与するラベル
												</p>
												{availableLabels.length > 0 ? (
													<div className="flex flex-wrap gap-2">
														{availableLabels.map((label) => (
															<label
																key={label.id}
																className="block cursor-pointer"
															>
																<input
																	type="checkbox"
																	name="selectedLabelIds"
																	value={label.id}
																	className="peer sr-only"
																/>
																<span className="inline-flex min-h-9 items-center rounded-full bg-background/80 px-3 py-2 text-sm text-foreground ring-1 ring-border/45 transition hover:bg-background peer-checked:bg-foreground peer-checked:text-background peer-checked:ring-foreground/20 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
																	{label.name}
																</span>
															</label>
														))}
													</div>
												) : (
													<p className="text-sm text-muted-foreground">
														選択できるラベルがまだありません。
													</p>
												)}
											</div>
											<div className="space-y-2">
												<label
													htmlFor="bulk-new-labels"
													className="text-xs font-medium text-muted-foreground"
												>
													新規ラベル追加
												</label>
												<Textarea
													id="bulk-new-labels"
													name="newLabels"
													placeholder="例: 返金誘導, SNS広告"
													className="min-h-24 resize-none border-0 bg-background/85 shadow-none ring-1 ring-border/40"
												/>
												<p className="text-xs text-muted-foreground">
													何も選ばずに実行すると、対象通報のラベルをすべて外します。
												</p>
											</div>
										</div>
									</div>
									<div className="flex justify-end">
										<Button type="submit" className="min-w-40">
											選択した通報を更新
										</Button>
									</div>
								</div>
							</form>
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
										<th className="w-14 px-3 py-2 text-center font-medium">
											選択
										</th>
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
												colSpan={5}
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
										const imagePreviews = report.images
											.map((image) => ({
												id: image.id,
												previewUrl: getSafeReportImageProxyPath(image),
											}))
											.filter(
												(image): image is { id: string; previewUrl: string } =>
													Boolean(image.previewUrl),
											);
										const remainingImageCount = Math.max(
											0,
											report._count.images - imagePreviews.length,
										);
										const displayTitle = report.title || "（タイトル未設定）";
										return (
											<tr key={report.id} className="border-b last:border-0">
												<td className="px-3 py-3 align-top text-center">
													<input
														type="checkbox"
														name="reportIds"
														value={report.id}
														form="bulk-status-form"
														aria-label={`${displayTitle} を一括更新対象に選択`}
														className="h-4 w-4 rounded border-input align-middle"
													/>
												</td>
												<td className="px-3 py-3 align-top">
													<div className="space-y-2">
														<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
															<div className="min-w-0 flex-1 space-y-1">
																<p className="font-medium">{displayTitle}</p>
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
															</div>
															{report._count.images > 0 ? (
																<ReportImagePreviews
																	title={displayTitle}
																	images={imagePreviews}
																	remainingImageCount={remainingImageCount}
																/>
															) : null}
														</div>
														{report.reportLabels.length > 0 ? (
															<div className="flex flex-wrap gap-2">
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
