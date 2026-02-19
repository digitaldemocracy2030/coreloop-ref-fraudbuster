"use client";

import { Clock, Mail, MessageSquare, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
	const searchParams = useSearchParams();
	const requestType = searchParams.get("type");
	const reportId = searchParams.get("reportId");

	const presetSubject =
		requestType === "report-fix-delete" ? "通報内容の修正・削除依頼" : "";
	const presetMessage =
		requestType === "report-fix-delete" && reportId
			? `対象通報ID: ${reportId}
依頼内容: （修正 or 削除）
理由: 
修正後の内容（修正依頼の場合）: `
			: "";

	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const lastPresetMessageRef = React.useRef(presetMessage);
	const [formData, setFormData] = React.useState({
		name: "",
		email: "",
		subject: presetSubject,
		message: presetMessage,
	});

	React.useEffect(() => {
		if (requestType !== "report-fix-delete") {
			return;
		}

		setFormData((current) => {
			const nextSubject = current.subject || presetSubject;
			const wasUsingPreviousPreset =
				current.message === lastPresetMessageRef.current;
			const nextMessage =
				current.message === "" || wasUsingPreviousPreset
					? presetMessage
					: current.message;

			if (nextSubject === current.subject && nextMessage === current.message) {
				lastPresetMessageRef.current = presetMessage;
				return current;
			}

			lastPresetMessageRef.current = presetMessage;

			return {
				...current,
				subject: nextSubject,
				message: nextMessage,
			};
		});
	}, [requestType, presetMessage, presetSubject]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!formData.name || !formData.email || !formData.message) {
			toast.error("必須項目を入力してください。");
			return;
		}

		setIsSubmitting(true);
		await new Promise((resolve) => setTimeout(resolve, 700));

		toast.success("お問い合わせを受け付けました。");
		setFormData({
			name: "",
			email: "",
			subject: "",
			message: "",
		});
		setIsSubmitting(false);
	};

	return (
		<div className="container py-12 space-y-10">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">お問い合わせ</h1>
				<p className="text-muted-foreground">
					ご質問やご要望、不具合の報告はこちらからご連絡ください。
				</p>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<MessageSquare className="h-5 w-5 text-primary" />
							お問い合わせフォーム
						</CardTitle>
						<CardDescription>
							内容を確認のうえ、担当者が順次ご連絡します。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-5" onSubmit={handleSubmit}>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="name">お名前</Label>
									<Input
										id="name"
										value={formData.name}
										onChange={(event) =>
											setFormData({ ...formData, name: event.target.value })
										}
										placeholder="山田 太郎"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="email">メールアドレス</Label>
									<Input
										id="email"
										type="email"
										value={formData.email}
										onChange={(event) =>
											setFormData({ ...formData, email: event.target.value })
										}
										placeholder="example@example.com"
										required
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="subject">件名</Label>
								<Input
									id="subject"
									value={formData.subject}
									onChange={(event) =>
										setFormData({ ...formData, subject: event.target.value })
									}
									placeholder="例: 通報ページの使い方について"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="message">お問い合わせ内容</Label>
								<Textarea
									id="message"
									value={formData.message}
									onChange={(event) =>
										setFormData({ ...formData, message: event.target.value })
									}
									placeholder="お問い合わせ内容を入力してください。"
									className="min-h-[160px]"
									required
								/>
							</div>

							<Button
								type="submit"
								className="w-full sm:w-auto rounded-xl"
								disabled={isSubmitting}
							>
								<Send className="mr-2 h-4 w-4" />
								{isSubmitting ? "送信中..." : "送信する"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">サポート情報</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 text-sm">
							<div className="flex items-start gap-2">
								<Mail className="h-4 w-4 mt-0.5 text-primary" />
								<div>
									<p className="font-medium">メール</p>
									<p className="text-muted-foreground">
										support@antifraud.local
									</p>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Clock className="h-4 w-4 mt-0.5 text-primary" />
								<div>
									<p className="font-medium">対応時間</p>
									<p className="text-muted-foreground">
										平日 10:00 - 18:00（土日祝を除く）
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="border-primary/20 bg-primary/5">
						<CardHeader>
							<CardTitle className="text-base">よくある内容</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<Badge variant="secondary">通報内容の修正依頼</Badge>
							<Badge variant="secondary">掲載情報の削除依頼</Badge>
							<Badge variant="secondary">サービス改善の要望</Badge>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
