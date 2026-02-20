"use client";

import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Lock,
	ShieldAlert,
	ShieldCheck,
	Upload,
	X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

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

type Step = "basic" | "details" | "verify" | "complete";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SCREENSHOT_FILES = 5;
const MAX_SCREENSHOT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_SCREENSHOT_CONTENT_TYPES = new Set(["image/jpeg", "image/png"]);

type ScreenshotAttachment = {
	id: string;
	file: File;
	previewUrl: string;
};

const getInitialFormData = () => ({
	url: "",
	categoryId: "",
	platformId: "",
	title: "",
	description: "",
	email: "",
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

export default function NewReportPage() {
	const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
	const router = useRouter();
	const pathname = usePathname();
	const [step, setStep] = React.useState<Step>("basic");
	const [formData, setFormData] = React.useState(getInitialFormData);
	const [turnstileToken, setTurnstileToken] = React.useState("");
	const [turnstileScriptReady, setTurnstileScriptReady] = React.useState(false);
	const [turnstileWidgetId, setTurnstileWidgetId] = React.useState<
		string | null
	>(null);
	const [loading, setLoading] = React.useState(false);
	const [screenshots, setScreenshots] = React.useState<ScreenshotAttachment[]>(
		[],
	);
	const [isDragActive, setIsDragActive] = React.useState(false);
	const [isUploadingScreenshots, setIsUploadingScreenshots] =
		React.useState(false);
	const formStartedAtRef = React.useRef(Date.now());
	const turnstileContainerRef = React.useRef<HTMLDivElement | null>(null);
	const screenshotFileInputRef = React.useRef<HTMLInputElement | null>(null);
	const screenshotsRef = React.useRef<ScreenshotAttachment[]>([]);
	const previousPathnameRef = React.useRef(pathname);

	const progress = {
		basic: 25,
		details: 50,
		verify: 75,
		complete: 100,
	}[step];
	const email = formData.email.trim().toLowerCase();
	const isEmailValid = EMAIL_PATTERN.test(email);
	const isBasicInfoComplete =
		formData.url.trim().length > 0 &&
		formData.platformId.length > 0 &&
		formData.categoryId.length > 0;

	React.useEffect(() => {
		screenshotsRef.current = screenshots;
	}, [screenshots]);

	React.useEffect(() => {
		return () => {
			for (const screenshot of screenshotsRef.current) {
				URL.revokeObjectURL(screenshot.previewUrl);
			}
		};
	}, []);

	const clearScreenshots = React.useCallback(() => {
		setScreenshots((current) => {
			for (const screenshot of current) {
				URL.revokeObjectURL(screenshot.previewUrl);
			}
			return [];
		});
		if (screenshotFileInputRef.current) {
			screenshotFileInputRef.current.value = "";
		}
	}, []);

	const addScreenshotFiles = React.useCallback(
		(incomingFiles: FileList | File[]) => {
			const files = Array.from(incomingFiles);
			if (files.length === 0) return;

			const availableSlots = MAX_SCREENSHOT_FILES - screenshots.length;
			if (availableSlots <= 0) {
				toast.error("スクリーンショットは最大5枚までです。");
				return;
			}

			const acceptedFiles: File[] = [];
			for (const file of files) {
				if (!ALLOWED_SCREENSHOT_CONTENT_TYPES.has(file.type)) {
					toast.error(`${file.name} は JPG / PNG のみ添付できます。`);
					continue;
				}
				if (file.size <= 0) {
					toast.error(`${file.name} は空のファイルです。`);
					continue;
				}
				if (file.size > MAX_SCREENSHOT_FILE_SIZE_BYTES) {
					toast.error(`${file.name} は5MB以下にしてください。`);
					continue;
				}

				acceptedFiles.push(file);
				if (acceptedFiles.length >= availableSlots) {
					break;
				}
			}

			if (files.length > availableSlots) {
				toast.error("スクリーンショットは最大5枚までです。");
			}
			if (acceptedFiles.length === 0) return;

			const attachments = acceptedFiles.map((file) => ({
				id: `${file.name}-${file.lastModified}-${Math.random()
					.toString(36)
					.slice(2, 10)}`,
				file,
				previewUrl: URL.createObjectURL(file),
			}));

			setScreenshots((current) => [...current, ...attachments]);
		},
		[screenshots.length],
	);

	const removeScreenshot = React.useCallback((id: string) => {
		setScreenshots((current) => {
			const screenshot = current.find((item) => item.id === id);
			if (screenshot) {
				URL.revokeObjectURL(screenshot.previewUrl);
			}
			return current.filter((item) => item.id !== id);
		});
	}, []);

	const handleScreenshotFileInputChange = (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		if (event.target.files) {
			addScreenshotFiles(event.target.files);
		}
		event.target.value = "";
	};

	const handleScreenshotDrop = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragActive(false);
		addScreenshotFiles(event.dataTransfer.files);
	};

	const handleScreenshotDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragActive(true);
	};

	const handleScreenshotDragLeave = () => {
		setIsDragActive(false);
	};

	const uploadScreenshots = React.useCallback(async (): Promise<string[]> => {
		if (screenshots.length === 0) return [];

		const uploadFormData = new FormData();
		for (const screenshot of screenshots) {
			uploadFormData.append("files", screenshot.file, screenshot.file.name);
		}

		const uploadResponse = await fetch("/api/reports/upload-images", {
			method: "POST",
			body: uploadFormData,
		});

		const payload = (await uploadResponse.json().catch(() => null)) as {
			error?: string;
			files?: Array<{
				path?: string;
				publicUrl?: string;
				contentType?: string;
				size?: number;
			}>;
		} | null;

		if (!uploadResponse.ok) {
			throw new Error(
				payload?.error || "スクリーンショットのアップロードに失敗しました。",
			);
		}

		const uploadedUrls = (Array.isArray(payload?.files) ? payload.files : [])
			.map((item) => (typeof item.publicUrl === "string" ? item.publicUrl : ""))
			.filter((value) => value.length > 0);

		if (uploadedUrls.length !== screenshots.length) {
			throw new Error(
				"スクリーンショットのアップロード結果が不足しています。時間を置いて再試行してください。",
			);
		}

		return uploadedUrls;
	}, [screenshots]);

	React.useEffect(() => {
		if (step !== "verify") return;
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
	}, [step, turnstileScriptReady, turnstileSiteKey, turnstileWidgetId]);

	React.useEffect(() => {
		if (step === "verify") return;
		if (!turnstileWidgetId) return;

		const turnstile = (window as WindowWithTurnstile).turnstile;
		if (turnstile) {
			turnstile.remove(turnstileWidgetId);
		}

		setTurnstileWidgetId(null);
		setTurnstileToken("");
	}, [step, turnstileWidgetId]);

	React.useEffect(() => {
		const previousPathname = previousPathnameRef.current;
		if (pathname === "/report/new" && previousPathname !== "/report/new") {
			setStep("basic");
			setFormData(getInitialFormData());
			clearScreenshots();
			setIsDragActive(false);
			setTurnstileToken("");
			setLoading(false);
			setIsUploadingScreenshots(false);
			formStartedAtRef.current = Date.now();
		}
		previousPathnameRef.current = pathname;
	}, [pathname, clearScreenshots]);

	const resetTurnstile = React.useCallback(() => {
		setTurnstileToken("");
		if (!turnstileWidgetId) return;
		const turnstile = (window as WindowWithTurnstile).turnstile;
		if (!turnstile) return;
		turnstile.reset(turnstileWidgetId);
	}, [turnstileWidgetId]);

	const handleSubmit = async () => {
		if (!formData.url.trim()) {
			toast.error("通報対象のURLを入力してください。");
			return;
		}
		if (!formData.platformId) {
			toast.error("プラットフォームを選択してください。");
			return;
		}
		if (!formData.categoryId) {
			toast.error("カテゴリーを選択してください。");
			return;
		}
		if (!email) {
			toast.error("メールアドレスを入力してください。");
			return;
		}
		if (!isEmailValid) {
			toast.error("メールアドレスの形式を確認してください。");
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
		try {
			let screenshotUrls: string[] = [];
			if (screenshots.length > 0) {
				setIsUploadingScreenshots(true);
				screenshotUrls = await uploadScreenshots();
			}

			const response = await fetch("/api/reports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: formData.url.trim(),
					title: formData.title,
					description: formData.description,
					email,
					platformId: formData.platformId,
					categoryId: formData.categoryId,
					formStartedAt: formStartedAtRef.current,
					turnstileToken,
					spamTrap: formData.spamTrap,
					screenshotUrls,
				}),
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

			clearScreenshots();
			setStep("complete");
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
			setIsUploadingScreenshots(false);
		}
	};

	const nextStep = () => {
		if (step === "basic") {
			if (!isBasicInfoComplete) {
				toast.error("URL・プラットフォーム・カテゴリーは必須です。");
				return;
			}
			setStep("details");
			return;
		}
		if (step === "details") {
			setStep("verify");
			return;
		}
		if (step === "verify") {
			handleSubmit();
		}
	};

	const prevStep = () => {
		if (step === "details") setStep("basic");
		else if (step === "verify") setStep("details");
	};

	const resetReportFormState = React.useCallback(() => {
		setStep("basic");
		setFormData(getInitialFormData());
		clearScreenshots();
		setIsDragActive(false);
		setTurnstileToken("");
		setLoading(false);
		setIsUploadingScreenshots(false);
		formStartedAtRef.current = Date.now();
	}, [clearScreenshots]);

	const handleContinueReporting = () => {
		resetReportFormState();
	};

	const handleReturnHome = () => {
		resetReportFormState();
		router.push("/");
	};

	return (
		<div className="container max-w-2xl py-12 space-y-8">
			<Script
				src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
				strategy="afterInteractive"
				onLoad={() => setTurnstileScriptReady(true)}
				onError={() => {
					toast.error("Turnstileの読み込みに失敗しました。");
				}}
			/>

			<div className="space-y-2 text-center">
				<h1 className="text-3xl font-bold tracking-tight">広告を通報する</h1>
				<p className="text-muted-foreground">
					あなたの情報が、誰かの被害を未然に防ぐ力になります。
				</p>
			</div>

			<div className="space-y-4">
				<div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
					<span>
						ステップ{" "}
						{step === "basic"
							? "1"
							: step === "details"
								? "2"
								: step === "verify"
									? "3"
									: "4"}{" "}
						/ 4
					</span>
					<span>{progress}% 完了</span>
				</div>
				<Progress value={progress} className="h-2" />
			</div>

			{step === "basic" && (
				<Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ShieldAlert className="h-5 w-5 text-primary" />
							基本情報を入力
						</CardTitle>
						<CardDescription>
							通報対象のURLやプラットフォームを選択してください。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="url">
								通報対象のURL
								<RequiredAsterisk />
							</Label>
							<Input
								id="url"
								placeholder="https://example.com/login"
								value={formData.url}
								onChange={(e) =>
									setFormData({ ...formData, url: e.target.value })
								}
							/>
							<p className="text-xs text-muted-foreground flex items-center gap-1">
								<AlertCircle className="h-3 w-3" />
								SNSのアカウント名やメールアドレスの場合はその情報を入力してください。
							</p>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>
									プラットフォーム
									<RequiredAsterisk />
								</Label>
								<Select
									value={formData.platformId}
									onValueChange={(v) =>
										setFormData({ ...formData, platformId: v })
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="選択してください" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="1">Facebook</SelectItem>
										<SelectItem value="2">LINE</SelectItem>
										<SelectItem value="3">Instagram</SelectItem>
										<SelectItem value="4">Threads</SelectItem>
										<SelectItem value="8">X</SelectItem>
										<SelectItem value="5">Google</SelectItem>
										<SelectItem value="6">TikTok</SelectItem>
										<SelectItem value="7">その他 (Meta等)</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>
									カテゴリー
									<RequiredAsterisk />
								</Label>
								<Select
									value={formData.categoryId}
									onValueChange={(v) =>
										setFormData({ ...formData, categoryId: v })
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="選択してください" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="8">フィッシング</SelectItem>
										<SelectItem value="5">なりすまし</SelectItem>
										<SelectItem value="2">投資詐欺</SelectItem>
										<SelectItem value="4">求人詐欺</SelectItem>
										<SelectItem value="3">ロマンス詐欺</SelectItem>
										<SelectItem value="1">その他 (製品等)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardContent>
					<CardFooter>
						<Button
							className="w-full h-12 rounded-xl"
							onClick={nextStep}
							disabled={!isBasicInfoComplete}
						>
							次へ進む
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					</CardFooter>
				</Card>
			)}

			{step === "details" && (
				<Card className="animate-in fade-in slide-in-from-right-4 duration-500">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Upload className="h-5 w-5 text-primary" />
							詳細と証拠
						</CardTitle>
						<CardDescription>
							具体的な内容と、証拠となる画像を追加してください。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="title">タイトル (任意)</Label>
							<Input
								id="title"
								placeholder="例：Amazonを装った偽メール"
								value={formData.title}
								onChange={(e) =>
									setFormData({ ...formData, title: e.target.value })
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="description">内容の詳細 (任意)</Label>
							<Textarea
								id="description"
								placeholder="どのような経緯で届いたか、どのような被害が予想されるかなどを詳しく入力してください。"
								className="min-h-[120px]"
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
							/>
						</div>
						<div className="space-y-2">
							<Label>スクリーンショット (任意)</Label>
							<input
								ref={screenshotFileInputRef}
								type="file"
								accept="image/jpeg,image/png"
								multiple
								className="hidden"
								onChange={handleScreenshotFileInputChange}
							/>
							<div
								role="button"
								tabIndex={0}
								onClick={() => screenshotFileInputRef.current?.click()}
								onKeyDown={(event) => {
									if (event.key !== "Enter" && event.key !== " ") return;
									event.preventDefault();
									screenshotFileInputRef.current?.click();
								}}
								onDragOver={handleScreenshotDragOver}
								onDragLeave={handleScreenshotDragLeave}
								onDrop={handleScreenshotDrop}
								className={`border-2 border-dashed rounded-xl p-8 text-center space-y-2 transition-colors cursor-pointer bg-muted/30 ${
									isDragActive ? "border-primary" : "hover:border-primary/50"
								}`}
							>
								<Upload className="h-8 w-8 mx-auto text-muted-foreground" />
								<p className="text-sm font-medium">
									クリックまたはドラッグ＆ドロップで追加
								</p>
								<p className="text-xs text-muted-foreground">
									最大5枚まで（JPG, PNG / 各5MB）
								</p>
							</div>
							{screenshots.length > 0 ? (
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
									{screenshots.map((screenshot, index) => (
										<div
											key={screenshot.id}
											className="relative overflow-hidden rounded-lg border bg-muted/20"
										>
											<img
												src={screenshot.previewUrl}
												alt={`添付スクリーンショット ${index + 1}`}
												className="h-28 w-full object-cover"
											/>
											<button
												type="button"
												onClick={() => removeScreenshot(screenshot.id)}
												className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground hover:text-foreground"
												aria-label={`添付スクリーンショット ${index + 1} を削除`}
											>
												<X className="h-3.5 w-3.5" />
											</button>
										</div>
									))}
								</div>
							) : null}
						</div>
					</CardContent>
					<CardFooter className="flex gap-4">
						<Button
							variant="outline"
							className="h-12 rounded-xl px-8"
							onClick={prevStep}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							戻る
						</Button>
						<Button className="flex-1 h-12 rounded-xl" onClick={nextStep}>
							次へ進む
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					</CardFooter>
				</Card>
			)}

			{step === "verify" && (
				<Card className="animate-in fade-in slide-in-from-right-4 duration-500">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5 text-primary" />
							送信前チェック
						</CardTitle>
						<CardDescription>
							Cloudflare Turnstileでスパム対策を行っています。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8 py-6">
						<div className="space-y-4 text-center">
							<div className="p-4 rounded-xl bg-primary/5 border border-primary/10 inline-block">
								<Lock className="h-8 w-8 text-primary mx-auto mb-2" />
								<p className="text-sm font-medium">Cloudflare Turnstile</p>
							</div>
							<p className="text-sm text-muted-foreground">
								人間による操作かどうかを確認してから送信します。
							</p>
						</div>

						<Separator />

						<div className="space-y-2">
							<Label htmlFor="verifyEmail">
								メールアドレス
								<RequiredAsterisk />
							</Label>
							<Input
								id="verifyEmail"
								type="email"
								autoComplete="email"
								placeholder="you@example.com"
								value={formData.email}
								onChange={(e) =>
									setFormData({ ...formData, email: e.target.value })
								}
							/>
							<p className="text-xs text-muted-foreground"></p>
						</div>

						<div className="space-y-3">
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
								短時間での連続投稿は引き続きサーバー側で制限されます。
							</p>
							{screenshots.length > 0 ? (
								<p className="text-xs text-muted-foreground">
									添付予定のスクリーンショット: {screenshots.length}枚
								</p>
							) : null}
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
								onChange={(e) =>
									setFormData({ ...formData, spamTrap: e.target.value })
								}
							/>
						</div>
					</CardContent>
					<CardFooter className="flex gap-4">
						<Button
							variant="outline"
							className="h-12 rounded-xl px-8"
							onClick={prevStep}
						>
							戻る
						</Button>
						<Button
							className="flex-1 h-12 rounded-xl font-bold text-lg"
							onClick={nextStep}
							disabled={
								loading || !turnstileSiteKey || !turnstileToken || !isEmailValid
							}
						>
							{loading
								? isUploadingScreenshots
									? "登録中..."
									: "送信中..."
								: "通報を完了する"}
						</Button>
					</CardFooter>
				</Card>
			)}

			{step === "complete" && (
				<Card className="text-center py-12 animate-in zoom-in-95 duration-500">
					<CardContent className="space-y-6">
						<div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
							<CheckCircle2 className="h-12 w-12 text-primary" />
						</div>
						<div className="space-y-2">
							<h2 className="text-2xl font-bold">通報を受け付けました</h2>
							<p className="text-muted-foreground">
								ご協力ありがとうございます。
								<br />
								事務局にて内容を確認後、プラットフォームに反映されます。
							</p>
						</div>
						<div className="pt-4 space-y-4">
							<Button
								className="w-full h-12 rounded-xl"
								onClick={handleContinueReporting}
							>
								続けて通報する
							</Button>
							<Button
								variant="outline"
								className="w-full h-12 rounded-xl"
								onClick={handleReturnHome}
							>
								ホームに戻る
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
