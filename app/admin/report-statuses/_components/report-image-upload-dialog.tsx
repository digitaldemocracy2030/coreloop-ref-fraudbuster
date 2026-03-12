"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

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
	MAX_REPORT_IMAGE_FILE_COUNT,
	MAX_REPORT_IMAGE_FILE_SIZE_BYTES,
	REPORT_IMAGE_INPUT_ACCEPT,
} from "@/lib/report-image-upload";

type ReportImageUploadDialogProps = {
	reportId: string;
	reportTitle: string | null;
	reportUrl: string;
	existingImageCount: number;
};

type UploadResponse = {
	error?: string;
	uploadedCount?: number;
	totalImageCount?: number;
};

function formatFileSize(bytes: number): string {
	if (bytes < 1024 * 1024) {
		return `${Math.max(1, Math.round(bytes / 1024))}KB`;
	}

	return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function ReportImageUploadDialog({
	reportId,
	reportTitle,
	reportUrl,
	existingImageCount,
}: ReportImageUploadDialogProps) {
	const router = useRouter();
	const [open, setOpen] = React.useState(false);
	const [files, setFiles] = React.useState<File[]>([]);
	const [isUploading, setIsUploading] = React.useState(false);
	const [isRefreshing, startTransition] = React.useTransition();
	const isPending = isUploading || isRefreshing;
	const displayTitle = reportTitle?.trim() || "（タイトル未設定）";
	const inputId = `report-image-upload-${reportId}`;

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
		[isPending, resetSelection],
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
		[existingImageCount, files, reportId, resetSelection, router],
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button type="button" size="sm" variant="outline">
					<ImagePlus className="mr-2 h-4 w-4" />
					画像を追加
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>通報画像を追加</DialogTitle>
					<DialogDescription>
						対象の通報にスクリーンショットなどの画像を追加します。
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="rounded-lg border bg-muted/30 p-4 text-sm">
						<p className="font-medium">{displayTitle}</p>
						<p className="mt-1 break-all text-xs text-muted-foreground">
							{reportUrl}
						</p>
						<p className="mt-3 text-xs text-muted-foreground">
							現在の登録画像: {existingImageCount}枚
						</p>
					</div>

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
											{formatFileSize(file.size)}
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
			</DialogContent>
		</Dialog>
	);
}
