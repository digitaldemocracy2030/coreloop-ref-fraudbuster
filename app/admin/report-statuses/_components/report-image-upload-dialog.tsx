"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	ALLOWED_REPORT_IMAGE_FORMATS_LABEL,
	formatReportImageFileSize,
	MAX_REPORT_IMAGE_FILE_COUNT,
	MAX_REPORT_IMAGE_FILE_SIZE_BYTES,
	REPORT_IMAGE_INPUT_ACCEPT,
} from "@/lib/report-image-upload";

type ReportImageUploadDialogProps = {
	reportId: string;
	reportTitle: string | null;
	reportUrl: string;
	currentPage: number;
	existingImageCount: number;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	hideTrigger?: boolean;
};

type UploadResponse = {
	error?: string;
	uploadedCount?: number;
	totalImageCount?: number;
};

type CurrentImagesResponse = {
	images?: Array<{
		id: string;
		previewUrl: string | null;
		displayOrder: number | null;
	}>;
	error?: string;
};

export function ReportImageUploadDialog({
	reportId,
	reportTitle,
	reportUrl,
	currentPage,
	existingImageCount,
	open: openProp,
	onOpenChange,
	hideTrigger = false,
}: ReportImageUploadDialogProps) {
	const router = useRouter();
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
	const [files, setFiles] = React.useState<File[]>([]);
	const [isUploading, setIsUploading] = React.useState(false);
	const [isLoadingImages, setIsLoadingImages] = React.useState(false);
	const [hasLoadedImages, setHasLoadedImages] = React.useState(false);
	const [currentImages, setCurrentImages] = React.useState<
		NonNullable<CurrentImagesResponse["images"]>
	>([]);
	const [isRefreshing, startTransition] = React.useTransition();
	const isPending = isUploading || isRefreshing;
	const displayTitle = reportTitle?.trim() || "（タイトル未設定）";
	const inputId = `report-image-upload-${reportId}`;
	const open = openProp ?? uncontrolledOpen;

	const setOpen = React.useCallback(
		(nextOpen: boolean) => {
			if (openProp === undefined) {
				setUncontrolledOpen(nextOpen);
			}

			onOpenChange?.(nextOpen);
		},
		[onOpenChange, openProp],
	);

	React.useEffect(() => {
		if (!open || hasLoadedImages) {
			return;
		}

		let cancelled = false;
		const abortController = new AbortController();

		async function loadCurrentImages() {
			setIsLoadingImages(true);

			try {
				const response = await fetch(`/api/admin/reports/${reportId}/images`, {
					cache: "no-store",
					signal: abortController.signal,
				});
				const payload = (await response
					.json()
					.catch(() => null)) as CurrentImagesResponse | null;

				if (!response.ok) {
					if (response.status === 401) {
						router.push("/admin/login");
						return;
					}

					throw new Error(payload?.error || "画像一覧の取得に失敗しました。");
				}

				if (!cancelled) {
					setCurrentImages(payload?.images ?? []);
					setHasLoadedImages(true);
				}
			} catch (error) {
				if (abortController.signal.aborted || cancelled) {
					return;
				}

				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "画像一覧の取得に失敗しました。",
				);
			} finally {
				if (!cancelled) {
					setIsLoadingImages(false);
				}
			}
		}

		void loadCurrentImages();

		return () => {
			cancelled = true;
			abortController.abort();
		};
	}, [hasLoadedImages, open, reportId, router]);

	const resetSelection = React.useCallback(() => {
		setFiles([]);
	}, []);

	const handleOpenChange = React.useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && isPending) {
				return;
			}

			setOpen(nextOpen);
			if (!nextOpen) {
				resetSelection();
			}
		},
		[isPending, resetSelection, setOpen],
	);

	const handleFileChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const selectedFiles = Array.from(event.target.files ?? []).slice(
				0,
				MAX_REPORT_IMAGE_FILE_COUNT,
			);
			setFiles(selectedFiles);
		},
		[],
	);

	const handleSubmit = React.useCallback(
		async (event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();

			if (files.length === 0) {
				toast.error("アップロードする画像を選択してください。");
				return;
			}

			const formData = new FormData();
			for (const file of files) {
				formData.append("files", file);
			}

			setIsUploading(true);

			try {
				const response = await fetch(`/api/admin/reports/${reportId}/images`, {
					method: "POST",
					body: formData,
				});
				const payload = (await response
					.json()
					.catch(() => null)) as UploadResponse | null;

				if (!response.ok) {
					if (response.status === 401) {
						router.push("/admin/login");
					}
					throw new Error(
						payload?.error || "画像のアップロードに失敗しました。",
					);
				}

				const uploadedCount = payload?.uploadedCount ?? files.length;
				const totalImageCount =
					payload?.totalImageCount ?? existingImageCount + uploadedCount;

				toast.success(
					`${uploadedCount}枚の画像を追加しました。現在の登録画像は${totalImageCount}枚です。`,
				);
				resetSelection();
				setOpen(false);
				startTransition(() => {
					router.refresh();
				});
			} catch (error) {
				console.error(error);
				toast.error(
					error instanceof Error
						? error.message
						: "画像のアップロードに失敗しました。",
				);
			} finally {
				setIsUploading(false);
			}
		},
		[existingImageCount, files, reportId, resetSelection, router, setOpen],
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{hideTrigger ? null : (
				<DialogTrigger asChild>
					<Button type="button" size="sm" variant="outline">
						<ImagePlus className="mr-2 h-4 w-4" />
						画像を追加
					</Button>
				</DialogTrigger>
			)}
			<DialogContent>
				<DialogHeader>
					<DialogTitle>通報画像を追加</DialogTitle>
					<DialogDescription>
						対象の通報にスクリーンショットなどの画像を追加します。
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-lg border bg-muted/30 p-4 text-sm">
						<p className="font-medium">{displayTitle}</p>
						<p className="mt-1 break-all text-xs text-muted-foreground">
							{reportUrl}
						</p>
						<p className="mt-3 text-xs text-muted-foreground">
							現在の登録画像: {existingImageCount}枚
						</p>
					</div>

					<div className="space-y-3">
						<div className="flex items-center justify-between gap-3">
							<p className="text-sm font-medium">現在の証拠画像</p>
							<p className="text-xs text-muted-foreground">
								不要になった画像は個別に削除できます。
							</p>
						</div>
						{isLoadingImages ? (
							<div className="flex items-center justify-center rounded-lg border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
								<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
								画像を読み込んでいます...
							</div>
						) : currentImages.length > 0 ? (
							<div className="grid gap-3 sm:grid-cols-2">
								{currentImages.map((image, index) => (
									<div
										key={image.id}
										className="rounded-lg border bg-muted/20 p-3"
									>
										<div className="overflow-hidden rounded-md border bg-muted/40">
											{image.previewUrl ? (
												<Image
													src={image.previewUrl}
													alt={`${displayTitle} の証拠画像 ${index + 1}`}
													width={960}
													height={720}
													className="h-36 w-full object-cover"
												/>
											) : (
												<div className="flex h-36 items-center justify-center px-4 text-center text-xs text-muted-foreground">
													この画像はプレビューできませんが、削除は可能です。
												</div>
											)}
										</div>
										<div className="mt-3 flex items-center justify-between gap-3">
											<p className="text-xs text-muted-foreground">
												画像{" "}
												{image.displayOrder !== null
													? image.displayOrder + 1
													: index + 1}
											</p>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button type="button" size="sm" variant="destructive">
														<Trash2 className="mr-2 h-4 w-4" />
														削除
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent size="sm">
													<AlertDialogHeader>
														<AlertDialogTitle>
															この画像を削除しますか？
														</AlertDialogTitle>
														<AlertDialogDescription>
															削除した画像は公開側の通報詳細からも非表示になります。この操作は元に戻せません。
														</AlertDialogDescription>
													</AlertDialogHeader>
													<form
														id={`delete-report-image-${image.id}`}
														action={`/api/admin/reports/${reportId}/images/${image.id}`}
														method="post"
													>
														<input
															type="hidden"
															name="page"
															value={currentPage}
														/>
													</form>
													<AlertDialogFooter>
														<AlertDialogCancel>キャンセル</AlertDialogCancel>
														<AlertDialogAction
															form={`delete-report-image-${image.id}`}
															type="submit"
															variant="destructive"
														>
															削除する
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
								証拠画像が追加されたらここに表示されます。下のフォームからスクリーンショットなどを追加すると、この欄で確認と削除ができます。
							</div>
						)}
					</div>

					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor={inputId}>アップロードする画像</Label>
							<Input
								id={inputId}
								type="file"
								multiple
								accept={REPORT_IMAGE_INPUT_ACCEPT}
								onChange={handleFileChange}
								disabled={isPending}
							/>
							<p className="text-xs text-muted-foreground">
								{ALLOWED_REPORT_IMAGE_FORMATS_LABEL}{" "}
								を利用できます。1回の送信は最大
								{MAX_REPORT_IMAGE_FILE_COUNT}枚、各ファイルは
								{Math.floor(MAX_REPORT_IMAGE_FILE_SIZE_BYTES / 1024 / 1024)}
								MB以下です。追加した画像は公開側の通報詳細にも表示されます。
							</p>
						</div>

						{files.length > 0 ? (
							<div className="rounded-lg border p-3">
								<p className="text-sm font-medium">
									選択中の画像 {files.length}枚
								</p>
								<div className="mt-2 space-y-2">
									{files.map((file) => (
										<div
											key={`${file.name}-${file.lastModified}`}
											className="flex items-center justify-between gap-3 text-sm"
										>
											<span className="truncate">{file.name}</span>
											<span className="shrink-0 text-xs text-muted-foreground">
												{formatReportImageFileSize(file.size)}
											</span>
										</div>
									))}
								</div>
							</div>
						) : null}

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => handleOpenChange(false)}
								disabled={isPending}
							>
								キャンセル
							</Button>
							<Button type="submit" disabled={isPending || files.length === 0}>
								{isUploading ? (
									<>
										<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
										アップロード中...
									</>
								) : (
									"画像を追加"
								)}
							</Button>
						</DialogFooter>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
