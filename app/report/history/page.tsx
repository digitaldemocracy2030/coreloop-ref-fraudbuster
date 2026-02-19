import { ArrowLeft, Calendar, ChevronRight, History } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ReportHistoryPageProps {
	searchParams: Promise<{ email?: string | string[] | undefined }>;
}

function pickFirstQueryValue(value: string | string[] | undefined): string {
	if (Array.isArray(value)) {
		return value[0]?.trim() ?? "";
	}
	return typeof value === "string" ? value.trim() : "";
}

async function getReportsByEmail(email: string) {
	return prisma.report.findMany({
		where: {
			user: {
				email,
			},
		},
		select: {
			id: true,
			url: true,
			title: true,
			createdAt: true,
			platform: {
				select: {
					id: true,
					name: true,
				},
			},
			status: {
				select: {
					id: true,
					label: true,
				},
			},
		},
		orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
		take: 50,
	});
}

export default async function ReportHistoryPage({
	searchParams,
}: ReportHistoryPageProps) {
	await connection();
	const emailParam = pickFirstQueryValue((await searchParams).email);
	const email = emailParam.toLowerCase();
	const isEmailValid = EMAIL_PATTERN.test(email);
	const reports = isEmailValid ? await getReportsByEmail(email) : [];

	return (
		<div className="container py-12 space-y-8">
			<div className="space-y-3">
				<Link href="/report/new">
					<Button variant="outline" className="gap-2 rounded-xl">
						<ArrowLeft className="h-4 w-4" />
						通報フォームに戻る
					</Button>
				</Link>
				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
						<History className="h-8 w-8 text-primary" />
						自分の通報履歴
					</h1>
					<p className="text-muted-foreground">
						あなたが通報した案件の受付履歴を確認できます。
					</p>
					{isEmailValid ? (
						<p className="text-sm text-muted-foreground">対象: {email}</p>
					) : null}
				</div>
			</div>

			{!isEmailValid ? (
				<Card className="p-8 space-y-4">
					<div className="space-y-1 text-center">
						<p className="font-medium">
							通報時のメールアドレスを入力してください。
						</p>
						<p className="text-sm text-muted-foreground">
							入力したメールアドレスに紐づく履歴を表示します。
						</p>
					</div>
					<form method="get" className="space-y-2">
						<Label htmlFor="historyEmail">メールアドレス</Label>
						<div className="flex flex-col gap-2 sm:flex-row">
							<Input
								id="historyEmail"
								name="email"
								type="email"
								autoComplete="email"
								placeholder="you@example.com"
								defaultValue={emailParam}
								required
							/>
							<Button type="submit" className="sm:w-auto">
								履歴を表示
							</Button>
						</div>
					</form>
					{emailParam ? (
						<p className="text-sm text-destructive text-center">
							メールアドレスの形式を確認してください。
						</p>
					) : null}
				</Card>
			) : reports.length === 0 ? (
				<Card className="p-8 text-center space-y-2">
					<p className="font-medium">通報履歴はまだありません。</p>
					<p className="text-sm text-muted-foreground">
						初回の通報後にここへ表示されます。
					</p>
				</Card>
			) : (
				<div className="grid gap-4">
					{reports.map((report) => (
						<Card
							key={report.id}
							className="group hover:border-primary/20 transition-colors"
						>
							<Link href={`/reports/${report.id}`} prefetch>
								<CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
									<div className="space-y-1 min-w-0">
										<div className="flex items-center gap-1 text-xs text-muted-foreground">
											<Calendar className="h-3 w-3" />
											{formatDate(report.createdAt, "ja-JP") ?? "日付不明"}
										</div>
										<CardTitle className="text-base group-hover:text-primary transition-colors truncate">
											{report.title || "（タイトルなし）"}
										</CardTitle>
									</div>
									<ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
								</CardHeader>
								<CardContent className="space-y-3">
									<p className="text-sm text-muted-foreground break-all line-clamp-2">
										{report.url}
									</p>
									<div className="flex flex-wrap gap-2">
										<Badge variant="secondary">
											{report.platform?.name || "不明なプラットフォーム"}
										</Badge>
										<Badge variant="outline">
											{report.status?.label || "受付済み"}
										</Badge>
									</div>
								</CardContent>
							</Link>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
