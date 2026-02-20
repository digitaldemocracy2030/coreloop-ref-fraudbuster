import { AlertTriangle, Calendar, CheckCircle2, Clock } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReportShareDialog } from "@/components/report-share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

async function getReportById(id: string) {
	"use cache";
	cacheTag("reports");
	cacheLife({ revalidate: 60 });

	return prisma.report.findUnique({
		where: { id },
		include: {
			platform: true,
			category: true,
			status: true,
			images: {
				select: {
					id: true,
					imageUrl: true,
				},
				take: 1,
				orderBy: { displayOrder: "asc" as const },
			},
			timelines: {
				orderBy: { occurredAt: "asc" as const },
				include: { admin: { select: { name: true } } },
			},
		},
	});
}

interface ReportDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({
	params,
}: ReportDetailPageProps) {
	const { id } = await params;
	await connection();
	const headerStore = await headers();

	const report = await getReportById(id);

	if (!report) {
		notFound();
	}

	const host =
		headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
	const protocol = headerStore.get("x-forwarded-proto") ?? "https";
	const reportPageUrl = host
		? `${protocol}://${host}/reports/${report.id}`
		: `/reports/${report.id}`;

	const shareText = `【注意喚起】${report.title || "通報詳細"} | 詐欺情報共有`;
	const xShareUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({
		text: shareText,
		url: reportPageUrl,
	}).toString()}`;
	const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams(
		{
			u: reportPageUrl,
		},
	).toString()}`;
	const reportFixRequestUrl = `/contact?${new URLSearchParams({
		type: "report-fix-delete",
		reportId: report.id,
	}).toString()}`;

	// Format Risk Score color
	const getRiskColor = (score: number) => {
		if (score >= 80) return "text-destructive";
		if (score >= 50) return "text-orange-500";
		return "text-green-500";
	};
	const riskScore = report.riskScore;
	const shouldMaskRiskScore = riskScore === null || riskScore <= 0;
	const ogpImageUrl = report.images[0]?.imageUrl ?? null;

	return (
		<div className="container py-10 space-y-10">
			{/* Breadcrumbs */}
			<nav className="flex items-center gap-2 text-sm text-muted-foreground">
				<Link href="/" className="hover:text-foreground">
					ホーム
				</Link>
				<span>/</span>
				<span className="text-foreground font-medium truncate max-w-[200px]">
					{report.title || "通報詳細"}
				</span>
			</nav>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
				{/* Left Column: Main Details */}
				<div className="lg:col-span-2 space-y-10">
					{/* Header Info */}
					<section className="space-y-6">
						<div className="flex flex-wrap items-center gap-3">
							<Badge variant="secondary" className="px-3 py-1 text-sm">
								{report.category?.name || "未分類"}
							</Badge>
							<Badge variant="outline" className="px-3 py-1 text-sm">
								{report.platform?.name || "不明なプラットフォーム"}
							</Badge>
							<div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
								<Calendar className="h-4 w-4" />
								<span>
									{formatDate(report.createdAt, "ja-JP") ?? "日付不明"}
								</span>
							</div>
						</div>

						<h1 className="text-3xl font-bold tracking-tight">
							{report.title || "（タイトルなし）"}
						</h1>

						<div className="space-y-2">
							<label className="text-xs font-bold text-muted-foreground uppercase">
								関連画像
							</label>
							{ogpImageUrl ? (
								<div className="overflow-hidden rounded-xl border bg-muted/20">
									<img
										src={ogpImageUrl}
										alt={report.title || report.url}
										loading="lazy"
										referrerPolicy="no-referrer"
										className="h-52 w-full object-cover sm:h-64"
									/>
								</div>
							) : (
								<div className="rounded-lg border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
									画像は登録されていません。
								</div>
							)}
						</div>

						<div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border">
							<div className="flex flex-col items-center justify-center px-4 border-r">
								<span className="text-xs text-muted-foreground uppercase font-semibold">
									リスクスコア
								</span>
								<span
									className={`text-3xl font-black ${
										shouldMaskRiskScore
											? "text-muted-foreground"
											: getRiskColor(riskScore)
									}`}
								>
									{shouldMaskRiskScore ? "-" : riskScore}
								</span>
							</div>
							<div className="flex-1 space-y-1">
								<div className="flex items-center gap-2">
									<CheckCircle2 className="h-5 w-5 text-primary" />
									<span className="font-bold">
										{report.status?.label || "調査中"}
									</span>
								</div>
								<p className="text-sm text-muted-foreground">
									この通報は現在、
									{report.status?.label || "システムによる自動調査"}の状態です。
								</p>
							</div>
						</div>
					</section>

					{/* Description */}
					<section className="space-y-4">
						<h2 className="text-xl font-bold">詳しく見る</h2>
						<div className="p-6 rounded-2xl bg-card border shadow-sm space-y-6">
							<div className="space-y-2">
								<label className="text-xs font-bold text-muted-foreground uppercase">
									対象のURL
								</label>
								<div className="p-3 rounded-lg bg-muted/50 font-mono text-sm break-all">
									{report.url}
								</div>
							</div>
							<div className="space-y-2">
								<label className="text-xs font-bold text-muted-foreground uppercase">
									詳細説明
								</label>
								<p className="leading-relaxed whitespace-pre-wrap">
									{report.description || "説明はありません。"}
								</p>
							</div>
						</div>
					</section>
				</div>

				{/* Right Column: Timeline & Meta */}
				<aside className="space-y-10">
					{/* Investigation Timeline */}
					<Card className="border-primary/10">
						<CardHeader>
							<CardTitle className="text-lg flex items-center gap-2">
								<Clock className="h-5 w-5 text-primary" />
								調査タイムライン
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="relative space-y-8 before:absolute before:inset-0 before:ml-2 before:h-full before:w-1 before:bg-primary/40">
								{report.timelines.length > 0 ? (
									report.timelines.map((item, idx) => {
										const latestIndex = report.timelines.length - 1;
										const isLatest = idx === latestIndex;
										const isCompleted = idx < latestIndex;
										const timelineActionLabel =
											item.actionLabel === "プラットフォームへ通知"
												? "関係各所で審査"
												: item.actionLabel;
										const timelineDescription =
											item.actionLabel === "プラットフォームへ通知"
												? "関係各所と連携し、通報内容の審査を進めています。"
												: item.description;

										return (
											<div
												key={item.id}
												className="relative flex items-start gap-4 pl-8 group"
											>
												<div className="absolute left-0 mt-1.5 h-4 w-4">
													{isLatest ? (
														<span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
													) : null}
													<span
														className={`absolute inset-0 rounded-full border-2 border-background ring-2 ${
															isLatest
																? "bg-primary ring-primary/30"
																: isCompleted
																	? "bg-primary/70 ring-primary/25"
																	: "bg-muted ring-primary/20"
														}`}
													/>
												</div>
												<div className="space-y-1">
													<div className="flex items-center gap-2">
														<p className="text-sm font-bold">
															{timelineActionLabel}
														</p>
														<span className="text-[10px] text-muted-foreground">
															{formatDate(item.occurredAt, "ja-JP") ?? "不明"}
														</span>
													</div>
													<p className="text-xs text-muted-foreground">
														{timelineDescription}
													</p>
													{item.admin && (
														<Badge
															variant="ghost"
															className="px-0 h-auto text-[10px] font-medium text-primary"
														>
															確認担当: {item.admin.name}
														</Badge>
													)}
												</div>
											</div>
										);
									})
								) : (
									<div className="text-sm text-muted-foreground py-4 text-center">
										タイムライン情報はまだありません。
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Actions Widget */}
					<Card>
						<CardContent className="pt-6 space-y-4">
							<ReportShareDialog
								xShareUrl={xShareUrl}
								facebookShareUrl={facebookShareUrl}
							/>
							<Button
								asChild
								variant="outline"
								className="w-full rounded-xl gap-2 h-12 text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20"
							>
								<Link href={reportFixRequestUrl}>
									<AlertTriangle className="h-4 w-4" />
									この通報を修正・削除依頼
								</Link>
							</Button>
							<Separator />
							<div className="flex flex-col gap-2">
								<p className="text-xs text-muted-foreground text-center">
									この情報はユーザーから寄せられたものであり、
									<br />
									正当性を完全に保証するものではありません。
								</p>
							</div>
						</CardContent>
					</Card>
				</aside>
			</div>
		</div>
	);
}
