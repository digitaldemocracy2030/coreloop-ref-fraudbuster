"use client";

import {
	AlertCircle,
	CheckCircle2,
	ImagePlus,
	LoaderCircle,
	ShieldAlert,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ALLOWED_REPORT_IMAGE_FORMATS_LABEL,
	formatReportImageFileSize,
	MAX_PUBLIC_REPORT_IMAGE_FILE_COUNT,
	MAX_PUBLIC_REPORT_IMAGE_FILE_SIZE_BYTES,
	REPORT_IMAGE_INPUT_ACCEPT,
} from "@/lib/report-image-upload";

type TurnstileRenderOptions = {
	sitekey: string;
	callback?: (token: string) => void;
	"expired-callback"?: () => void;
	"error-callback"?: () => void;
	theme?: "light" | "dark" | "auto";
};

type TurnstileApi = {
	render: (
		container: string | HTMLElement,
		options: TurnstileRenderOptions,
	) => string;
	reset: (widgetId?: string) => void;
	remove: (widgetId: string) => void;
};

type WindowWithTurnstile = Window & { turnstile?: TurnstileApi };

type ReportFormProps = {
	platforms: Array<{
		id: number;
		name: string;
	}>;
};

type SelectedReportImage = {
	id: string;
	file: File;
	previewUrl: string;
};

const getInitialFormData = () => ({
	url: "",
	platformId: "",
	spamTrap: "",
});

function RequiredAsterisk() {
	return (
		<>
			<span aria-hidden="true" className="ml-1 text-destructive">
				*
			</span>
			<span className="sr-only">必須</span>
		</>
	);
}

function getSubmissionStatus(elapsedSeconds: number) {
	const elapsedLabel =
		elapsedSeconds > 0
			? `処理開始から約${elapsedSeconds}秒`
			: "処理を開始しました";

	return {
		buttonLabel: "通報を登録中...",
		title: "通報内容を登録しています",
		description:
			"リンク先プレビューや関連情報の処理を行っているため、完了まで少し時間がかかる場合があります。",
		helper: `${elapsedLabel}。ブラウザを閉じたり再読み込みしたりせず、そのままお待ちください。`,
	};
}

export function ReportForm({ platforms }: ReportFormProps) {
	const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
	const [formData, setFormData] = React.useState(getInitialFormData);
	const [turnstileToken, setTurnstileToken] = React.useState("");
	const [turnstileScriptReady, setTurnstileScriptReady] = React.useState(false);
	const [turnstileWidgetId, setTurnstileWidgetId] = React.useState<
		string | null
	>(null);
	const [loading, setLoading] = React.useState(false);
	const [submissionStartedAt, setSubmissionStartedAt] = React.useState<
		number | null
	>(null);
	const [submissionElapsedSeconds, setSubmissionElapsedSeconds] =
		React.useState(0);
	const [submissionSucceeded, setSubmissionSucceeded] = React.useState(false);
	const [selectedImages, setSelectedImages] = React.useState<
		SelectedReportImage[]
	>([]);
	const turnstileContainerRef = React.useRef<HTMLDivElement | null>(null);
	const fileInputRef = React.useRef<HTMLInputElement | null>(null);
	const selectedImagesRef = React.useRef<SelectedReportImage[]>([]);
	const formStartedAtRef = React.useRef(Date.now());

	const isFormComplete =
		formData.url.trim().length > 0 && formData.platformId.length > 0;
	const submissionStatus = getSubmissionStatus(submissionElapsedSeconds);

	React.useEffect(() => {
		if (!loading || submissionStartedAt === null) {
			setSubmissionElapsedSeconds(0);
			return;
		}

		const tick = () => {
			setSubmissionElapsedSeconds(
				Math.max(0, Math.floor((Date.now() - submissionStartedAt) / 1000)),
			);
		};

		tick();
		const intervalId = window.setInterval(tick, 1000);
		return () => {
			window.clearInterval(intervalId);
		};
	}, [loading, submissionStartedAt]);

	React.useEffect(() => {
		if (!turnstileSiteKey) return;
		if (!turnstileScriptReady) return;
		if (turnstileWidgetId) return;
		if (!turnstileContainerRef.current) return;

		const turnstile = (window as WindowWithTurnstile).turnstile;
		if (!turnstile) return;

		const widgetId = turnstile.render(turnstileContainerRef.current, {
			sitekey: turnstileSiteKey,
			theme: "auto",
			callback: (token) => setTurnstileToken(token),
			"expired-callback": () => setTurnstileToken(""),
			"error-callback": () => setTurnstileToken(""),
		});

		setTurnstileWidgetId(widgetId);
	}, [turnstileScriptReady, turnstileSiteKey, turnstileWidgetId]);

	React.useEffect(() => {
		return () => {
			if (!turnstileWidgetId) return;
			const turnstile = (window as WindowWithTurnstile).turnstile;
			if (turnstile) {
				turnstile.remove(turnstileWidgetId);
			}
		};
	}, [turnstileWidgetId]);

	React.useEffect(() => {
		selectedImagesRef.current = selectedImages;
	}, [selectedImages]);

	React.useEffect(() => {
		return () => {
			for (const image of selectedImagesRef.current) {
				URL.revokeObjectURL(image.previewUrl);
			}
		};
	}, []);

	const resetTurnstile = React.useCallback(() => {
		setTurnstileToken("");
		if (!turnstileWidgetId) return;
		const turnstile = (window as WindowWithTurnstile).turnstile;
		if (!turnstile) return;
		turnstile.reset(turnstileWidgetId);
	}, [turnstileWidgetId]);

	const resetSelectedFiles = React.useCallback(() => {
		for (const image of selectedImages) {
			URL.revokeObjectURL(image.previewUrl);
		}
		setSelectedImages([]);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, [selectedImages]);

	const resetForm = React.useCallback(() => {
		setFormData(getInitialFormData());
		resetSelectedFiles();
		setSubmissionSucceeded(true);
		setSubmissionStartedAt(null);
		setLoading(false);
		formStartedAtRef.current = Date.now();
		resetTurnstile();
	}, [resetSelectedFiles, resetTurnstile]);

	const handleFileChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const incomingFiles = Array.from(event.target.files ?? []);
			if (incomingFiles.length === 0) {
				return;
			}

			const remainingSlots =
				MAX_PUBLIC_REPORT_IMAGE_FILE_COUNT - selectedImages.length;
			if (remainingSlots <= 0) {
				event.target.value = "";
				toast.error(
					`画像は最大${MAX_PUBLIC_REPORT_IMAGE_FILE_COUNT}枚まで添付できます。`,
				);
				return;
			}

			let hitLimit = false;
			let oversizedFileName: string | null = null;
			const nextImages: SelectedReportImage[] = [];

			for (const file of incomingFiles) {
				if (file.size > MAX_PUBLIC_REPORT_IMAGE_FILE_SIZE_BYTES) {
					oversizedFileName ??= file.name;
					continue;
				}
				if (nextImages.length >= remainingSlots) {
					hitLimit = true;
					break;
				}
				nextImages.push({
					id: crypto.randomUUID(),
					file,
					previewUrl: URL.createObjectURL(file),
				});
			}

			event.target.value = "";

			if (oversizedFileName) {
				toast.error(
					`${oversizedFileName} は${Math.floor(
						MAX_PUBLIC_REPORT_IMAGE_FILE_SIZE_BYTES / 1024 / 1024,
					)}MB以下にしてください。`,
				);
			}
			if (hitLimit) {
				toast.error(
					`画像は最大${MAX_PUBLIC_REPORT_IMAGE_FILE_COUNT}枚まで添付できます。`,
				);
			}
			if (nextImages.length === 0) {
				return;
			}

			setSubmissionSucceeded(false);
			setSelectedImages((current) => [...current, ...nextImages]);
		},
		[selectedImages],
	);

	const handleRemoveSelectedImage = React.useCallback(
		(imageId: string) => {
			const imageToRemove = selectedImages.find(
				(image) => image.id === imageId,
			);
			if (!imageToRemove) {
				return;
			}

			URL.revokeObjectURL(imageToRemove.previewUrl);
			setSelectedImages((current) =>
				current.filter((image) => image.id !== imageId),
			);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			setSubmissionSucceeded(false);
		},
		[selectedImages],
	);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!formData.url.trim()) {
			toast.error("通報対象のリンクを入力してください。");
			return;
		}
		if (!formData.platformId) {
			toast.error("プラットフォームを選択してください。");
			return;
		}
		if (!turnstileSiteKey) {
			toast.error("Turnstileの設定が未完了です。");
			return;
		}
		if (!turnstileToken) {
			toast.error("スパム対策チェックを完了してください。");
			return;
		}

		setLoading(true);
		setSubmissionStartedAt(Date.now());

		try {
			const requestBody = new FormData();
			requestBody.set("url", formData.url.trim());
			requestBody.set("platformId", formData.platformId);
			requestBody.set("formStartedAt", String(formStartedAtRef.current));
			requestBody.set("turnstileToken", turnstileToken);
			requestBody.set("spamTrap", formData.spamTrap);
			for (const image of selectedImages) {
				requestBody.append("files", image.file);
			}

			const response = await fetch("/api/reports", {
				method: "POST",
				body: requestBody,
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				if (response.status === 400 || response.status === 403) {
					resetTurnstile();
				}
				throw new Error(payload?.error || "送信に失敗しました。");
			}

			resetForm();
			toast.success("通報が完了しました。ご協力ありがとうございます。");
		} catch (error) {
			resetTurnstile();
			toast.error(
				error instanceof Error
					? error.message
					: "送信中にエラーが発生しました。",
			);
			console.error(error);
		} finally {
			setLoading(false);
			setSubmissionStartedAt(null);
		}
	};

	return (
		<div className="container max-w-2xl space-y-8 py-12">
			<Script
				src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
				strategy="afterInteractive"
				onLoad={() => setTurnstileScriptReady(true)}
				onError={() => {
					toast.error("Turnstileの読み込みに失敗しました。");
				}}
			/>

			<h1 className="text-3xl font-bold tracking-tight text-center">
				広告を通報する
			</h1>

			{submissionSucceeded ? (
				<div
					aria-live="polite"
					className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900"
				>
					<div className="flex items-start gap-3">
						<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
						<div className="space-y-1">
							<p className="text-sm font-semibold">通報を受け付けました</p>
							<p className="text-sm">続けて別のリンクも通報できます。</p>
						</div>
					</div>
				</div>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ShieldAlert className="h-5 w-5 text-primary" />
						通報フォーム
					</CardTitle>
					<CardDescription>
						リンクとプラットフォームを入力し、ボットチェック後に送信してください。
					</CardDescription>
				</CardHeader>
				<form onSubmit={handleSubmit}>
					<CardContent className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="url">
								通報対象のリンク
								<RequiredAsterisk />
							</Label>
							<Input
								id="url"
								placeholder="https://example.com/login"
								value={formData.url}
								onChange={(event) => {
									setSubmissionSucceeded(false);
									setFormData((current) => ({
										...current,
										url: event.target.value,
									}));
								}}
							/>
							<p className="flex items-center gap-1 text-xs text-muted-foreground">
								<AlertCircle className="h-3 w-3" />
								投稿、プロフィール、検索結果、誘導先ページなどのリンクを入力してください。
							</p>
						</div>

						<div className="space-y-2">
							<Label>
								プラットフォーム
								<RequiredAsterisk />
							</Label>
							<Select
								value={formData.platformId}
								onValueChange={(value) => {
									setSubmissionSucceeded(false);
									setFormData((current) => ({
										...current,
										platformId: value,
									}));
								}}
								disabled={platforms.length === 0 || loading}
							>
								<SelectTrigger>
									<SelectValue placeholder="選択してください" />
								</SelectTrigger>
								<SelectContent>
									{platforms.map((platform) => (
										<SelectItem key={platform.id} value={String(platform.id)}>
											{platform.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{platforms.length === 0 ? (
								<p className="text-xs text-destructive">
									利用可能なプラットフォームが見つかりません。
								</p>
							) : null}
						</div>

						<div className="space-y-4 rounded-xl border p-4">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<ImagePlus className="h-4 w-4 text-primary" />
									<p className="text-sm font-medium">
										（任意）スクリーンショット等の証拠画像
									</p>
								</div>
								<p className="text-xs text-muted-foreground">
									任意で添付できます。{ALLOWED_REPORT_IMAGE_FORMATS_LABEL}{" "}
									を利用でき、 最大{MAX_PUBLIC_REPORT_IMAGE_FILE_COUNT}枚・各
									{Math.floor(
										MAX_PUBLIC_REPORT_IMAGE_FILE_SIZE_BYTES / 1024 / 1024,
									)}
									MBまでです。
								</p>
								<p className="text-xs text-muted-foreground">
									選択後でも画像ごとに削除でき、追加で選ぶとそのまま候補に追記されます。
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="report-images">添付画像</Label>
								<Input
									id="report-images"
									ref={fileInputRef}
									type="file"
									multiple
									accept={REPORT_IMAGE_INPUT_ACCEPT}
									onChange={handleFileChange}
									disabled={loading}
								/>
							</div>
							{selectedImages.length > 0 ? (
								<div className="rounded-lg border bg-background/70 p-3">
									<div className="flex items-center justify-between gap-3">
										<p className="text-sm font-medium">
											選択中の画像 {selectedImages.length}枚
										</p>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={resetSelectedFiles}
											disabled={loading}
										>
											すべて削除
										</Button>
									</div>
									<div className="mt-3 grid gap-3 sm:grid-cols-2">
										{selectedImages.map((image, index) => (
											<div
												key={image.id}
												className="overflow-hidden rounded-lg border bg-muted/20"
											>
												<Image
													src={image.previewUrl}
													alt={`選択中の証拠画像 ${index + 1}`}
													width={960}
													height={720}
													unoptimized
													className="h-36 w-full object-cover"
												/>
												<div className="space-y-2 p-3">
													<div className="space-y-1">
														<p className="truncate text-sm font-medium">
															{image.file.name}
														</p>
														<p className="text-xs text-muted-foreground">
															{formatReportImageFileSize(image.file.size)}
														</p>
													</div>
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="w-full"
														onClick={() => handleRemoveSelectedImage(image.id)}
														disabled={loading}
													>
														<Trash2 className="mr-2 h-4 w-4" />
														削除
													</Button>
												</div>
											</div>
										))}
									</div>
								</div>
							) : (
								<p className="text-xs text-muted-foreground">
									画像を添付しない場合も、そのまま通報できます。
								</p>
							)}
						</div>

						<div className="space-y-3 rounded-xl border bg-muted/30 p-4">
							<div className="flex items-center gap-2">
								<ShieldCheck className="h-4 w-4 text-primary" />
								<p className="text-sm font-medium">Cloudflare Turnstile</p>
							</div>
							{turnstileSiteKey ? (
								<div
									ref={turnstileContainerRef}
									className="min-h-[70px] flex items-center justify-center"
								/>
							) : (
								<p className="text-sm text-destructive">
									環境変数 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` が未設定です。
								</p>
							)}
							<p className="text-xs text-muted-foreground">
								honeypot、送信速度制限、IP単位レート制限とあわせて不正投稿を抑止しています。
							</p>
						</div>

						<div
							aria-hidden="true"
							className="absolute -left-[9999px] top-auto"
						>
							<Label htmlFor="spamTrap">ウェブサイト</Label>
							<Input
								id="spamTrap"
								tabIndex={-1}
								autoComplete="off"
								value={formData.spamTrap}
								onChange={(event) =>
									setFormData((current) => ({
										...current,
										spamTrap: event.target.value,
									}))
								}
							/>
						</div>
					</CardContent>

					<CardFooter className="flex-col items-stretch gap-4">
						<Button
							type="submit"
							className="h-12 rounded-xl font-bold text-lg"
							disabled={
								loading ||
								!isFormComplete ||
								!turnstileSiteKey ||
								!turnstileToken ||
								platforms.length === 0
							}
						>
							{loading ? submissionStatus.buttonLabel : "通報する"}
						</Button>
						<p className="text-center text-xs leading-5 text-muted-foreground">
							「通報する」をクリックすると、
							<Link
								href="/terms"
								className="mx-1 underline underline-offset-4 transition-colors hover:text-foreground"
							>
								利用規約
							</Link>
							および
							<Link
								href="/privacy"
								className="mx-1 underline underline-offset-4 transition-colors hover:text-foreground"
							>
								プライバシーポリシー
							</Link>
							に同意したものとみなします。
						</p>

						{loading ? (
							<div
								aria-live="polite"
								className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3"
							>
								<div className="flex gap-3">
									<LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
									<div className="space-y-1.5">
										<p className="text-sm font-semibold">
											{submissionStatus.title}
										</p>
										<p className="text-sm text-muted-foreground">
											{submissionStatus.description}
										</p>
										<p className="text-xs text-muted-foreground">
											{submissionStatus.helper}
										</p>
										{submissionElapsedSeconds >= 15 ? (
											<p className="text-xs font-medium text-foreground">
												通常より少し時間がかかっていますが、処理は継続しています。
											</p>
										) : null}
									</div>
								</div>
							</div>
						) : null}
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
