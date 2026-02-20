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
} from "lucide-react";
import { useRouter } from "next/navigation";
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

export default function NewReportPage() {
	const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
	const router = useRouter();
	const [step, setStep] = React.useState<Step>("basic");
	const [formData, setFormData] = React.useState({
		url: "",
		categoryId: "",
		platformId: "",
		title: "",
		description: "",
		email: "",
		spamTrap: "",
	});
	const [turnstileToken, setTurnstileToken] = React.useState("");
	const [turnstileScriptReady, setTurnstileScriptReady] = React.useState(false);
	const [turnstileWidgetId, setTurnstileWidgetId] = React.useState<
		string | null
	>(null);
	const [loading, setLoading] = React.useState(false);
	const formStartedAtRef = React.useRef(Date.now());
	const turnstileContainerRef = React.useRef<HTMLDivElement | null>(null);

	const progress = {
		basic: 25,
		details: 50,
		verify: 75,
		complete: 100,
	}[step];
	const email = formData.email.trim().toLowerCase();
	const isEmailValid = EMAIL_PATTERN.test(email);

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

	const resetTurnstile = React.useCallback(() => {
		setTurnstileToken("");
		if (!turnstileWidgetId) return;
		const turnstile = (window as WindowWithTurnstile).turnstile;
		if (!turnstile) return;
		turnstile.reset(turnstileWidgetId);
	}, [turnstileWidgetId]);

	const handleSubmit = async () => {
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
			const response = await fetch("/api/reports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: formData.url,
					title: formData.title,
					description: formData.description,
					email,
					platformId: formData.platformId,
					categoryId: formData.categoryId,
					formStartedAt: formStartedAtRef.current,
					turnstileToken,
					spamTrap: formData.spamTrap,
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
		}
	};

	const nextStep = () => {
		if (step === "basic") setStep("details");
		else if (step === "details") setStep("verify");
		else if (step === "verify") handleSubmit();
	};

	const prevStep = () => {
		if (step === "details") setStep("basic");
		else if (step === "verify") setStep("details");
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
							<Label htmlFor="url">通報対象のURL (必須)</Label>
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
								<Label>プラットフォーム</Label>
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
										<SelectItem value="5">Google</SelectItem>
										<SelectItem value="6">TikTok</SelectItem>
										<SelectItem value="7">その他 (Meta等)</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>カテゴリー</Label>
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
							disabled={!formData.url}
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
							<Label htmlFor="title">タイトル</Label>
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
							<Label htmlFor="description">内容の詳細</Label>
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
							<div className="border-2 border-dashed rounded-xl p-8 text-center space-y-2 hover:border-primary/50 transition-colors cursor-pointer bg-muted/30">
								<Upload className="h-8 w-8 mx-auto text-muted-foreground" />
								<p className="text-sm font-medium">
									クリックまたはドラッグ＆ドロップで追加
								</p>
								<p className="text-xs text-muted-foreground">
									最大5枚まで（JPG, PNG）
								</p>
							</div>
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
							<Label htmlFor="verifyEmail">連絡用メールアドレス (必須)</Label>
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
							<p className="text-xs text-muted-foreground">
								内容確認のために連絡する場合があります。
							</p>
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
							{loading ? "送信中..." : "通報を完了する"}
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
								onClick={() => router.push("/")}
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
