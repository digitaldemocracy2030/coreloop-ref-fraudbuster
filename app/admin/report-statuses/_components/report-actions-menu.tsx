"use client";

import {
	FilePenLine,
	ImagePlus,
	LoaderCircle,
	MoreHorizontal,
	Trash2,
} from "lucide-react";
import { useCallback, useId, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import type { AdminReportStatusesFilters } from "@/lib/admin-report-statuses";
import {
	getReportLabelCodesByGroup,
	getReportLabelDefinitions,
	REPORT_LABEL_GROUP_CODES,
	type ReportLabelRecord,
} from "@/lib/report-labels";
import {
	getReportStatusMeta,
	getReportVerdictMeta,
	isCompletedReportStatus,
	REPORT_VERDICT_CODES,
	type ReportVerdictCode,
} from "@/lib/report-metadata";
import { ReportImageUploadDialog } from "./report-image-upload-dialog";

type ReportStatusOption = {
	id: number;
	code: string;
	label: string;
};

type ReportActionsMenuProps = {
	reportId: string;
	reportTitle: string | null;
	reportUrl: string;
	currentPage: number;
	filters: AdminReportStatusesFilters;
	existingImageCount: number;
	reportStatuses: ReportStatusOption[];
	selectedStatusId: number | string;
	selectedStatusCode: string | null;
	selectedVerdict: ReportVerdictCode | null;
	selectedLabels: ReportLabelRecord[];
};

type SelectedLabelState = ReturnType<typeof getReportLabelCodesByGroup>;

function FilterReturnFields({
	filters,
}: {
	filters: AdminReportStatusesFilters;
}) {
	return (
		<>
			{filters.statusIds.map((statusId) => (
				<input
					key={statusId}
					type="hidden"
					name="returnStatusId"
					value={statusId}
				/>
			))}
			<input
				type="hidden"
				name="returnImageFilter"
				value={filters.imageFilter}
			/>
			<input
				type="hidden"
				name="returnVerdictFilter"
				value={filters.verdictFilter}
			/>
			{filters.genreCodes.map((genreCode) => (
				<input
					key={genreCode}
					type="hidden"
					name="returnGenre"
					value={genreCode}
				/>
			))}
			<input
				type="hidden"
				name="returnImpersonation"
				value={filters.impersonationCode}
			/>
			<input type="hidden" name="returnMedia" value={filters.mediaCode} />
			<input
				type="hidden"
				name="returnExpression"
				value={filters.expressionCode}
			/>
		</>
	);
}

export function ReportActionsMenu({
	reportId,
	reportTitle,
	reportUrl,
	currentPage,
	filters,
	existingImageCount,
	reportStatuses,
	selectedStatusId,
	selectedStatusCode,
	selectedVerdict,
	selectedLabels,
}: ReportActionsMenuProps) {
	const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
	const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
	const deleteFormId = useId();
	const displayTitle = reportTitle || reportUrl;
	const [statusValue, setStatusValue] = useState(String(selectedStatusId));
	const [verdictValue, setVerdictValue] = useState(selectedVerdict ?? "");
	const [labelState, setLabelState] = useState<SelectedLabelState>(() =>
		getReportLabelCodesByGroup(selectedLabels),
	);
	const selectedStatus = reportStatuses.find(
		(status) => String(status.id) === statusValue,
	);
	const isCompleted = isCompletedReportStatus(selectedStatus?.code);
	const verdictMeta = getReportVerdictMeta(selectedVerdict);
	const statusMeta = getReportStatusMeta(selectedStatusCode);

	const resetManageForm = useCallback(() => {
		setStatusValue(String(selectedStatusId));
		setVerdictValue(selectedVerdict ?? "");
		setLabelState(getReportLabelCodesByGroup(selectedLabels));
		setIsUpdatingStatus(false);
	}, [selectedLabels, selectedStatusId, selectedVerdict]);

	function toggleGenre(code: string, checked: boolean) {
		setLabelState((current) => ({
			...current,
			genreCodes: checked
				? current.genreCodes.includes(
						code as (typeof current.genreCodes)[number],
					)
					? current.genreCodes
					: [...current.genreCodes, code as (typeof current.genreCodes)[number]]
				: current.genreCodes.filter((value) => value !== code),
		}));
	}

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="ml-auto"
						aria-label="操作メニューを開く"
					>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem
						onSelect={(event) => {
							event.preventDefault();
							resetManageForm();
							setIsManageDialogOpen(true);
						}}
					>
						<FilePenLine className="h-4 w-4" />
						審査内容を編集
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={(event) => {
							event.preventDefault();
							setIsImageDialogOpen(true);
						}}
					>
						<ImagePlus className="h-4 w-4" />
						画像を追加
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={(event) => {
							event.preventDefault();
							setIsDeleteDialogOpen(true);
						}}
					>
						<Trash2 className="h-4 w-4" />
						通報を削除
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ReportImageUploadDialog
				reportId={reportId}
				reportTitle={reportTitle}
				reportUrl={reportUrl}
				existingImageCount={existingImageCount}
				open={isImageDialogOpen}
				onOpenChange={setIsImageDialogOpen}
				hideTrigger
			/>

			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>この通報を削除しますか？</AlertDialogTitle>
						<AlertDialogDescription>
							{displayTitle}{" "}
							を削除します。関連する画像とタイムラインも削除され、この操作は元に戻せません。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<form
						id={deleteFormId}
						action={`/api/admin/reports/${reportId}`}
						method="post"
					>
						<input type="hidden" name="page" value={currentPage} />
						<FilterReturnFields filters={filters} />
					</form>
					<AlertDialogFooter>
						<AlertDialogCancel>キャンセル</AlertDialogCancel>
						<AlertDialogAction
							form={deleteFormId}
							type="submit"
							variant="destructive"
						>
							削除する
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={isManageDialogOpen}
				onOpenChange={(nextOpen) => {
					if (!nextOpen && isUpdatingStatus) {
						return;
					}
					if (!nextOpen) {
						resetManageForm();
					}
					setIsManageDialogOpen(nextOpen);
				}}
			>
				<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>通報内容を更新</DialogTitle>
						<DialogDescription>
							4階層ラベル、ステータス、判定結果を更新できます。
						</DialogDescription>
					</DialogHeader>

					<div className="relative min-w-0 space-y-4">
						{isUpdatingStatus ? (
							<div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
								<div className="inline-flex items-center rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm">
									<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
									更新しています...
								</div>
							</div>
						) : null}

						<div className="min-w-0 rounded-lg border bg-muted/30 p-4 text-sm">
							<p className="line-clamp-1 font-medium" title={displayTitle}>
								{displayTitle}
							</p>
							<p
								className="mt-1 truncate text-muted-foreground"
								title={reportUrl}
							>
								{reportUrl}
							</p>
							<div className="mt-3 flex flex-wrap gap-2">
								<span
									className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
										statusMeta?.badgeClassName ??
										"border-border bg-background text-foreground"
									}`}
								>
									{statusMeta?.label ?? "未設定"}
								</span>
								{verdictMeta ? (
									<span
										className={`rounded-full border px-2 py-0.5 text-xs font-medium ${verdictMeta.badgeClassName}`}
									>
										{verdictMeta.label}
									</span>
								) : null}
							</div>
						</div>

						<form
							action={`/api/admin/reports/${reportId}/status`}
							method="post"
							className="space-y-4"
							onSubmit={() => setIsUpdatingStatus(true)}
						>
							<input type="hidden" name="page" value={currentPage} />
							<FilterReturnFields filters={filters} />
							{labelState.genreCodes.map((code) => (
								<input
									key={code}
									type="hidden"
									name="genreCodes"
									value={code}
								/>
							))}
							<input
								type="hidden"
								name="impersonationCode"
								value={labelState.impersonationCode ?? ""}
							/>
							<input
								type="hidden"
								name="mediaCode"
								value={labelState.mediaCode ?? ""}
							/>
							<input
								type="hidden"
								name="expressionCode"
								value={labelState.expressionCode ?? ""}
							/>
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<label
										className="text-sm font-medium"
										htmlFor={`status-${reportId}`}
									>
										ステータス
									</label>
									<NativeSelect
										id={`status-${reportId}`}
										name="statusId"
										value={statusValue}
										onChange={(event) => setStatusValue(event.target.value)}
										className="w-full"
										required
									>
										{reportStatuses.map((status) => (
											<NativeSelectOption key={status.id} value={status.id}>
												{status.label}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</div>
								<div className="space-y-2">
									<label
										className="text-sm font-medium"
										htmlFor={`verdict-${reportId}`}
									>
										判定結果
									</label>
									{isCompleted ? (
										<NativeSelect
											id={`verdict-${reportId}`}
											name="verdict"
											value={verdictValue}
											onChange={(event) => setVerdictValue(event.target.value)}
											className="w-full"
											required
										>
											<NativeSelectOption value="">
												判定結果を選択してください
											</NativeSelectOption>
											{[
												REPORT_VERDICT_CODES.CONFIRMED_FRAUD,
												REPORT_VERDICT_CODES.HIGH_RISK,
												REPORT_VERDICT_CODES.SAFE,
												REPORT_VERDICT_CODES.UNKNOWN,
											].map((verdictCode) => (
												<NativeSelectOption
													key={verdictCode}
													value={verdictCode}
												>
													{getReportVerdictMeta(verdictCode)?.label ??
														verdictCode}
												</NativeSelectOption>
											))}
										</NativeSelect>
									) : (
										<>
											<Input
												id={`verdict-${reportId}`}
												value="完了に変更すると選択できます"
												readOnly
												disabled
											/>
											<input type="hidden" name="verdict" value="" />
										</>
									)}
								</div>
							</div>

							<div className="space-y-4">
								<div className="space-y-2">
									<p className="text-sm font-medium">ジャンル</p>
									<div className="grid gap-2 sm:grid-cols-2">
										{getReportLabelDefinitions(
											REPORT_LABEL_GROUP_CODES.GENRE,
										).map((definition) => {
											const checked = labelState.genreCodes.includes(
												definition.code,
											);
											return (
												<label
													key={definition.code}
													className="flex items-center gap-2 text-sm"
												>
													<input
														type="checkbox"
														checked={checked}
														onChange={(event) =>
															toggleGenre(definition.code, event.target.checked)
														}
														className="h-4 w-4 rounded border-input"
													/>
													<span>{definition.name}</span>
												</label>
											);
										})}
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-3">
									{[
										{
											id: `impersonation-${reportId}`,
											groupCode: REPORT_LABEL_GROUP_CODES.IMPERSONATION,
											label: "なりすまし",
											value: labelState.impersonationCode ?? "",
											onChange: (value: string) =>
												setLabelState((current) => ({
													...current,
													impersonationCode:
														(value as SelectedLabelState["impersonationCode"]) ||
														null,
												})),
										},
										{
											id: `media-${reportId}`,
											groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
											label: "他メディアを騙っている",
											value: labelState.mediaCode ?? "",
											onChange: (value: string) =>
												setLabelState((current) => ({
													...current,
													mediaCode:
														(value as SelectedLabelState["mediaCode"]) || null,
												})),
										},
										{
											id: `expression-${reportId}`,
											groupCode: REPORT_LABEL_GROUP_CODES.EXPRESSION,
											label: "表現",
											value: labelState.expressionCode ?? "",
											onChange: (value: string) =>
												setLabelState((current) => ({
													...current,
													expressionCode:
														(value as SelectedLabelState["expressionCode"]) ||
														null,
												})),
										},
									].map((item) => (
										<div key={item.id} className="space-y-2">
											<label className="text-sm font-medium" htmlFor={item.id}>
												{item.label}
											</label>
											<NativeSelect
												id={item.id}
												value={item.value}
												onChange={(event) => item.onChange(event.target.value)}
												className="w-full"
												required
											>
												<NativeSelectOption value="">
													選択してください
												</NativeSelectOption>
												{getReportLabelDefinitions(item.groupCode).map(
													(definition) => (
														<NativeSelectOption
															key={definition.code}
															value={definition.code}
														>
															{definition.name}
														</NativeSelectOption>
													),
												)}
											</NativeSelect>
										</div>
									))}
								</div>
							</div>

							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsManageDialogOpen(false)}
									disabled={isUpdatingStatus}
								>
									キャンセル
								</Button>
								<Button type="submit" disabled={isUpdatingStatus}>
									{isUpdatingStatus ? (
										<>
											<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
											更新中...
										</>
									) : (
										"更新する"
									)}
								</Button>
							</div>
						</form>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
