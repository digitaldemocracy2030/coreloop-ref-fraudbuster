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
import { Textarea } from "@/components/ui/textarea";
import type { AdminReportStatusesFilters } from "@/lib/admin-report-statuses";
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
	availableLabels: Array<{
		id: number;
		name: string;
	}>;
	selectedLabels: Array<{
		id: number;
		name: string;
	}>;
};

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
	availableLabels,
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
	const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>(
		selectedLabels.map((label) => label.id),
	);
	const [newLabelsValue, setNewLabelsValue] = useState("");
	const selectedStatus = reportStatuses.find(
		(status) => String(status.id) === statusValue,
	);
	const isCompleted = isCompletedReportStatus(selectedStatus?.code);
	const verdictMeta = getReportVerdictMeta(selectedVerdict);
	const statusMeta = getReportStatusMeta(selectedStatusCode);

	const resetManageForm = useCallback(() => {
		setStatusValue(String(selectedStatusId));
		setVerdictValue(selectedVerdict ?? "");
		setSelectedLabelIds(selectedLabels.map((label) => label.id));
		setNewLabelsValue("");
		setIsUpdatingStatus(false);
	}, [selectedLabels, selectedStatusId, selectedVerdict]);

	function toggleLabel(labelId: number, checked: boolean) {
		setSelectedLabelIds((current) => {
			if (checked) {
				return current.includes(labelId) ? current : [...current, labelId];
			}

			return current.filter((id) => id !== labelId);
		});
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
						<input
							type="hidden"
							name="returnLabelFilter"
							value={filters.labelFilter}
						/>
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
							ラベル、ステータス、判定結果を更新できます。
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
							<input
								type="hidden"
								name="returnLabelFilter"
								value={filters.labelFilter}
							/>
							{selectedLabelIds.map((labelId) => (
								<input
									key={labelId}
									type="hidden"
									name="selectedLabelIds"
									value={labelId}
								/>
							))}
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
											<NativeSelectOption value={REPORT_VERDICT_CODES.UNKNOWN}>
												不明
											</NativeSelectOption>
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

							<div className="space-y-2">
								<p className="text-sm font-medium">ラベル</p>
								<div className="rounded-lg border p-3">
									{availableLabels.length > 0 ? (
										<div className="grid gap-2 sm:grid-cols-2">
											{availableLabels.map((label) => {
												const checked = selectedLabelIds.includes(label.id);
												return (
													<label
														key={label.id}
														className="flex items-center gap-2 text-sm"
													>
														<input
															type="checkbox"
															checked={checked}
															onChange={(event) =>
																toggleLabel(label.id, event.target.checked)
															}
															className="h-4 w-4 rounded border-input"
														/>
														<span>{label.name}</span>
													</label>
												);
											})}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											選択できるラベルがまだありません。
										</p>
									)}
								</div>
							</div>

							<div className="space-y-2">
								<label
									className="text-sm font-medium"
									htmlFor={`new-labels-${reportId}`}
								>
									新規ラベル追加
								</label>
								<Textarea
									id={`new-labels-${reportId}`}
									name="newLabels"
									value={newLabelsValue}
									onChange={(event) => setNewLabelsValue(event.target.value)}
									placeholder="例: 返金誘導, SNS広告"
									className="min-h-24"
								/>
								<p className="text-xs text-muted-foreground">
									既存ラベルは上から複数選択できます。新しいラベルはカンマまたは改行区切りで追加できます。
								</p>
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
