"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ReportActionsMenu } from "@/app/admin/report-statuses/_components/report-actions-menu";
import { ReportImagePreviews } from "@/app/admin/report-statuses/_components/report-image-previews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
	ADMIN_REPORT_STATUSES_PAGE_SIZE,
	ADMIN_REPORT_STATUSES_PATH,
} from "@/lib/admin-report-statuses";
import {
	getReportStatusMeta,
	getReportVerdictMeta,
	REPORT_LABEL_BADGE_CLASS_NAME,
	REPORT_VERDICT_CODES,
	type ReportVerdictCode,
} from "@/lib/report-metadata";
import { cn } from "@/lib/utils";

type ReportStatusOption = {
	id: number;
	code: string;
	label: string;
};

type ReportLabel = {
	id: number;
	name: string;
};

type ReportRow = {
	id: string;
	title: string | null;
	url: string;
	createdAtLabel: string;
	existingImageCount: number;
	statusId: number | null;
	statusCode: string | null;
	statusLabel: string | null;
	verdict: ReportVerdictCode | null;
	reportLabels: ReportLabel[];
	imagePreviews: Array<{
		id: string;
		previewUrl: string;
	}>;
	remainingImageCount: number;
};

type ReportStatusesTableProps = {
	availableLabels: ReportLabel[];
	currentPage: number;
	reportStatusOptions: ReportStatusOption[];
	reports: ReportRow[];
	totalPages: number;
	totalReports: number;
};

function buildPageHref(page: number) {
	return page <= 1
		? ADMIN_REPORT_STATUSES_PATH
		: `${ADMIN_REPORT_STATUSES_PATH}?page=${page}`;
}

export function ReportStatusesTable({
	availableLabels,
	currentPage,
	reportStatusOptions,
	reports,
	totalPages,
	totalReports,
}: ReportStatusesTableProps) {
	const [isBulkOpen, setIsBulkOpen] = useState(false);
	const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
	const selectAllRef = useRef<HTMLInputElement | null>(null);
	const allVisibleSelected =
		reports.length > 0 && selectedReportIds.length === reports.length;
	const someVisibleSelected =
		selectedReportIds.length > 0 && selectedReportIds.length < reports.length;

	useEffect(() => {
		if (!selectAllRef.current) {
			return;
		}

		selectAllRef.current.indeterminate = someVisibleSelected;
	}, [someVisibleSelected]);

	function toggleVisibleSelection(checked: boolean) {
		setSelectedReportIds(checked ? reports.map((report) => report.id) : []);
	}

	function toggleReportSelection(reportId: string, checked: boolean) {
		setSelectedReportIds((current) => {
			if (checked) {
				return current.includes(reportId) ? current : [...current, reportId];
			}

			return current.filter((id) => id !== reportId);
		});
	}

	return (
		<>
			{reportStatusOptions.length > 0 && reports.length > 0 ? (
				<form
					id="bulk-status-form"
					action="/api/admin/reports/status/bulk"
					method="post"
					className="overflow-hidden rounded-2xl bg-linear-to-br from-muted/35 via-background to-background p-5 shadow-sm ring-1 ring-border/60"
				>
					<input type="hidden" name="page" value={currentPage} />
					{selectedReportIds.map((reportId) => (
						<input
							key={reportId}
							type="hidden"
							name="reportIds"
							value={reportId}
						/>
					))}
					<Collapsible open={isBulkOpen} onOpenChange={setIsBulkOpen}>
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div className="space-y-1">
								<p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
									Bulk Update
								</p>
								<p className="text-sm font-medium">選択した通報を一括更新</p>
								<p className="text-xs text-muted-foreground">
									一覧左のチェックボックスで対象を選ぶと、現在のページ内の複数通報をまとめて更新できます。ラベルは選択または追加したときだけ上書きされます。
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<div className="inline-flex w-fit items-center rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border/50 backdrop-blur">
									{selectedReportIds.length > 0
										? `${selectedReportIds.length}件を選択中`
										: "対象未選択"}
								</div>
								<CollapsibleTrigger asChild>
									<Button type="button" variant="outline" size="sm">
										<ChevronDown
											className={cn(
												"h-4 w-4 transition-transform",
												isBulkOpen ? "rotate-180" : undefined,
											)}
										/>
									</Button>
								</CollapsibleTrigger>
							</div>
						</div>
						<CollapsibleContent className="space-y-5 overflow-hidden pt-5 data-[state=closed]:hidden">
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
													<NativeSelectOption key={status.id} value={status.id}>
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
												<NativeSelectOption value={REPORT_VERDICT_CODES.SAFE}>
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
												ラベルを選択または追加したときだけ、対象通報のラベルを上書きします。すべて外したい場合は右側の設定を使います。
											</p>
										</div>
										<label className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 text-sm font-medium ring-1 ring-border/50 backdrop-blur">
											<input
												type="checkbox"
												name="clearLabels"
												value="1"
												className="h-4 w-4 rounded border-input"
											/>
											ラベルを空にする
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
											何も追加せずにラベルだけ変更したい場合は、既存ラベルの選択か「ラベルを空にする」を使ってください。
										</p>
									</div>
								</div>
							</div>
							<div className="flex justify-end">
								<Button
									type="submit"
									className="min-w-40"
									disabled={selectedReportIds.length === 0}
								>
									選択した通報を更新
								</Button>
							</div>
						</CollapsibleContent>
					</Collapsible>
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
							<th className="w-20 px-3 py-2 text-center font-medium">
								<div className="flex flex-col items-center gap-1">
									<input
										ref={selectAllRef}
										type="checkbox"
										checked={allVisibleSelected}
										onChange={(event) =>
											toggleVisibleSelection(event.target.checked)
										}
										aria-label="表示中の通報をすべて選択"
										className="h-4 w-4 rounded border-input align-middle"
									/>
								</div>
							</th>
							<th className="px-3 py-2 text-left font-medium">通報</th>
							<th className="px-3 py-2 text-left font-medium">投稿日</th>
							<th className="px-3 py-2 text-left font-medium">審査状況</th>
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
							const selectedStatusId = report.statusId ?? fallbackStatusId;
							const statusMeta = getReportStatusMeta(report.statusCode);
							const verdictMeta = getReportVerdictMeta(report.verdict);
							const displayTitle = report.title || "（タイトル未設定）";
							const isSelected = selectedReportIds.includes(report.id);

							return (
								<tr
									key={report.id}
									className={cn(
										"border-b last:border-0",
										isSelected ? "bg-muted/20" : undefined,
									)}
								>
									<td className="px-3 py-3 align-top text-center">
										<input
											type="checkbox"
											checked={isSelected}
											onChange={(event) =>
												toggleReportSelection(report.id, event.target.checked)
											}
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
														登録画像: {report.existingImageCount}枚
													</p>
												</div>
												{report.existingImageCount > 0 ? (
													<ReportImagePreviews
														title={displayTitle}
														images={report.imagePreviews}
														remainingImageCount={report.remainingImageCount}
													/>
												) : null}
											</div>
											{report.reportLabels.length > 0 ? (
												<div className="flex flex-wrap gap-2">
													{report.reportLabels.map((label) => (
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
										{report.createdAtLabel}
									</td>
									<td className="px-3 py-3 align-top">
										<div className="flex flex-wrap gap-2">
											<Badge
												variant="outline"
												className={statusMeta?.badgeClassName ?? undefined}
											>
												{statusMeta?.label ?? report.statusLabel ?? "未設定"}
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
											existingImageCount={report.existingImageCount}
											currentPage={currentPage}
											reportStatuses={reportStatusOptions}
											selectedStatusId={selectedStatusId}
											selectedStatusCode={report.statusCode}
											selectedVerdict={report.verdict}
											availableLabels={availableLabels}
											selectedLabels={report.reportLabels}
										/>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</>
	);
}
