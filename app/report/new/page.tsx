"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
	ShieldAlert,
	ArrowRight,
	ArrowLeft,
	CheckCircle2,
	Upload,
	Smartphone,
	AlertCircle,
	Lock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Separator } from "@/components/ui/separator";

type Step = "basic" | "details" | "verify" | "complete";

export default function NewReportPage() {
	const router = useRouter();
	const [step, setStep] = React.useState<Step>("basic");
	const [formData, setFormData] = React.useState({
		url: "",
		categoryId: "",
		platformId: "",
		title: "",
		description: "",
		phone: "",
		otp: "",
	});
	const [loading, setLoading] = React.useState(false);

	const progress = {
		basic: 25,
		details: 50,
		verify: 75,
		complete: 100,
	}[step];

	// Mock submission
	const handleSubmit = async () => {
		setLoading(true);
		try {
			// In a real app, this would call our POST /api/reports endpoint
			const response = await fetch("/api/reports", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: formData.url,
					title: formData.title,
					description: formData.description,
					platformId: formData.platformId,
					categoryId: formData.categoryId,
				}),
			});

			if (!response.ok) throw new Error("Failed to submit");

			setStep("complete");
			toast.success("通報が完了しました。ご協力ありがとうございます。");
		} catch (error) {
			toast.error("送信中にエラーが発生しました。");
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
			<div className="space-y-2 text-center">
				<h1 className="text-3xl font-bold tracking-tight">
					詐欺情報を共有する
				</h1>
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
								SNSのアカウント名や電話番号の場合はその情報を入力してください。
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
										<SelectItem value="1">Twitter (X)</SelectItem>
										<SelectItem value="2">Instagram</SelectItem>
										<SelectItem value="3">LINE</SelectItem>
										<SelectItem value="4">Facebook</SelectItem>
										<SelectItem value="5">その他</SelectItem>
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
										<SelectItem value="1">フィッシング詐欺</SelectItem>
										<SelectItem value="2">なりすまし</SelectItem>
										<SelectItem value="3">当選詐欺</SelectItem>
										<SelectItem value="4">投資詐欺</SelectItem>
										<SelectItem value="5">その他</SelectItem>
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
							<Smartphone className="h-5 w-5 text-primary" />
							本人確認
						</CardTitle>
						<CardDescription>
							スパム防止のため、SMSによる本人確認を行っています。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8 py-6 text-center">
						<div className="space-y-4">
							<div className="p-4 rounded-xl bg-primary/5 border border-primary/10 inline-block">
								<Lock className="h-8 w-8 text-primary mx-auto mb-2" />
								<p className="text-sm font-medium">電話番号による認証</p>
							</div>
							<div className="space-y-2 max-w-[240px] mx-auto">
								<Label htmlFor="phone">携帯電話番号</Label>
								<Input
									id="phone"
									placeholder="090-0000-0000"
									className="text-center text-lg tracking-widest"
									value={formData.phone}
									onChange={(e) =>
										setFormData({ ...formData, phone: e.target.value })
									}
								/>
							</div>
							<Button variant="secondary" size="sm" className="rounded-full">
								認証コードを送信
							</Button>
						</div>

						<Separator />

						<div className="space-y-4">
							<Label>認証コードを入力</Label>
							<div className="flex justify-center">
								<InputOTP
									maxLength={6}
									value={formData.otp}
									onChange={(v) => setFormData({ ...formData, otp: v })}
								>
									<InputOTPGroup>
										<InputOTPSlot index={0} />
										<InputOTPSlot index={1} />
										<InputOTPSlot index={2} />
										<InputOTPSlot index={3} />
										<InputOTPSlot index={4} />
										<InputOTPSlot index={5} />
									</InputOTPGroup>
								</InputOTP>
							</div>
							<p className="text-xs text-muted-foreground underline cursor-pointer">
								コードが届かない場合はこちら
							</p>
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
							disabled={formData.otp.length < 6 || loading}
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
							<Button
								variant="ghost"
								className="w-full text-muted-foreground"
								onClick={() => router.push("/reports")}
							>
								自分の通報履歴を確認する
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
