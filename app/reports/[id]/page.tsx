import { notFound } from "next/navigation";
import {
	ShieldAlert,
	Clock,
	Eye,
	Share2,
	AlertTriangle,
	ExternalLink,
	CheckCircle2,
	Calendar,
} from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";

interface ReportDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({
	params,
}: ReportDetailPageProps) {
	const { id } = await params;

	const report = await prisma.report.findUnique({
		where: { id },
		include: {
			platform: true,
			category: true,
			status: true,
			images: {
				orderBy: { displayOrder: "asc" as const },
			},
				timelines: {
					orderBy: { occurredAt: "asc" as const },
					include: { admin: { select: { name: true } } },
				},
			},
		});

	if (!report) {
		notFound();
	}

	// Format Risk Score color
	const getRiskColor = (score: number) => {
		if (score >= 80) return "text-destructive";
		if (score >= 50) return "text-orange-500";
		return "text-green-500";
	};
	const riskScore = report.riskScore ?? 0;

	return (
		<div className="container py-10 space-y-10">
			{/* Breadcrumbs */}
			<nav className="flex items-center gap-2 text-sm text-muted-foreground">
				<Link href="/" className="hover:text-foreground">
					ホーム
				</Link>
				<span>/</span>
				<Link href="/reports" className="hover:text-foreground">
					案件一覧
				</Link>
				<span>/</span>
				<span className="text-foreground font-medium truncate max-w-[200px]">
					{report.title || "案件詳細"}
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
								<Eye className="h-4 w-4" />
								<span>{report.viewCount} 閲覧</span>
								<Separator orientation="vertical" className="h-4" />
								<Calendar className="h-4 w-4" />
								<span>
									{report.createdAt?.toLocaleDateString("ja-JP") || "日付不明"}
								</span>
							</div>
						</div>

						<h1 className="text-3xl font-bold tracking-tight">
							{report.title || "（タイトルなし）"}
						</h1>

						<div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border">
							<div className="flex flex-col items-center justify-center px-4 border-r">
								<span className="text-xs text-muted-foreground uppercase font-semibold">
									リスクスコア
								</span>
								<span
									className={`text-3xl font-black ${getRiskColor(riskScore)}`}
								>
									{riskScore}
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
									この案件は現在、
									{report.status?.label || "システムによる自動調査"}の状態です。
								</p>
							</div>
						</div>
					</section>

					{/* Image Carousel */}
					{report.images.length > 0 && (
						<section className="space-y-4">
							<h2 className="text-xl font-bold flex items-center gap-2">
								<ShieldAlert className="h-5 w-5 text-primary" />
								証拠のスクリーンショット
							</h2>
							<div className="relative group overflow-hidden rounded-2xl border bg-black/5 dark:bg-white/5">
								<Carousel className="w-full">
									<CarouselContent>
										{report.images.map((image) => (
											<CarouselItem key={image.id}>
												<div className="flex aspect-video items-center justify-center p-0">
													{/* In a real app, use next/image with the actual URL */}
													<div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
														スクリーンショットを表示（URL: {image.imageUrl}）
													</div>
												</div>
											</CarouselItem>
										))}
									</CarouselContent>
									<CarouselPrevious className="left-4 opacity-0 group-hover:opacity-100 transition-opacity" />
									<CarouselNext className="right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
								</Carousel>
							</div>
						</section>
					)}

					{/* Description */}
					<section className="space-y-4">
						<h2 className="text-xl font-bold">詳しく見る</h2>
						<div className="p-6 rounded-2xl bg-card border shadow-sm space-y-6">
							<div className="space-y-2">
								<label className="text-xs font-bold text-muted-foreground uppercase">
									対象のURL
								</label>
								<div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 font-mono text-sm break-all">
									<ExternalLink className="h-4 w-4 shrink-0" />
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
																{item.actionLabel}
															</p>
															<span className="text-[10px] text-muted-foreground">
																{item.occurredAt?.toLocaleDateString("ja-JP") ||
																	"不明"}
															</span>
														</div>
														<p className="text-xs text-muted-foreground">
															{item.description}
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
							<Button className="w-full rounded-xl gap-2 h-12">
								<Share2 className="h-4 w-4" />
								情報をシェアする
							</Button>
							<Button
								variant="outline"
								className="w-full rounded-xl gap-2 h-12 text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20"
							>
								<AlertTriangle className="h-4 w-4" />
								この通報を修正・削除依頼
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
