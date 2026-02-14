import { Search, ShieldAlert, TrendingUp, Clock, Star } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";

export default async function Home() {
	// In a real app, these would be fetched from the API
	// For the initial render, we can use some dummy data or fetch from our API
	// Since this is a Server Component, we can fetch directly or use a mock.

	return (
		<div className="flex flex-col gap-12 pb-20">
			{/* Hero Section */}
			<section className="relative overflow-hidden bg-primary/5 py-20 lg:py-32">
				<div className="container relative z-10 flex flex-col items-center text-center space-y-8">
					<div className="space-y-4 max-w-3xl">
						<Badge
							variant="outline"
							className="px-4 py-1 border-primary/20 bg-primary/5 text-primary"
						>
							ネット詐欺から身を守る
						</Badge>
						<h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
							あやしいURLや
							<br className="sm:hidden" />
							アカウントを
							<span className="text-primary italic">検索・通報</span>
						</h1>
						<p className="text-lg text-muted-foreground md:px-20">
							SNSやメッセージアプリの詐欺情報をクラウドソーシングで集めています。
							被害に遭う前に、情報をチェックしましょう。
						</p>
					</div>

					<div className="w-full max-w-2xl relative">
						<div className="relative flex items-center">
							<Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
							<Input
								placeholder="URL、電話番号、ユーザー、キーワードで検索..."
								className="h-14 pl-12 pr-32 rounded-full shadow-lg border-primary/20 focus-visible:ring-primary/20"
							/>
							<Button className="absolute right-1.5 h-11 rounded-full px-8">
								検索
							</Button>
						</div>
						<div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
							<span>急上昇キーワード:</span>
							<Link
								href="/search?q=当選"
								className="hover:underline text-foreground/80"
							>
								#当選
							</Link>
							<Link
								href="/search?q=Amazon"
								className="hover:underline text-foreground/80"
							>
								#Amazon
							</Link>
							<Link
								href="/search?q=給付金"
								className="hover:underline text-foreground/80"
							>
								#給付金
							</Link>
						</div>
					</div>
				</div>

				{/* Background Decoration */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-30 pointer-events-none">
					<div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary rounded-full blur-[120px]" />
					<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[150px]" />
				</div>
			</section>

			{/* Main Content */}
			<div className="container grid grid-cols-1 lg:grid-cols-3 gap-12">
				<div className="lg:col-span-2 space-y-10">
					{/* Banner Carousel */}
					<section>
						<Carousel className="w-full">
							<CarouselContent>
								{[1, 2, 3].map((i) => (
									<CarouselItem key={i}>
										<div className="p-1">
											<Card className="overflow-hidden border-none bg-gradient-to-r from-primary/10 to-blue-500/10 h-48 sm:h-64 flex items-center justify-center">
												<div className="text-center p-6">
													<h3 className="text-2xl font-bold mb-2">
														フィッシング詐欺にご注意
													</h3>
													<p className="text-muted-foreground">
														公的機関を装ったメールやSMSが増加しています。
													</p>
												</div>
											</Card>
										</div>
									</CarouselItem>
								))}
							</CarouselContent>
							<CarouselPrevious className="left-4" />
							<CarouselNext className="right-4" />
						</Carousel>
					</section>

					{/* Feed Tabs */}
					<section>
						<Tabs defaultValue="recent" className="w-full">
							<div className="flex items-center justify-between mb-6">
								<TabsList className="bg-muted/50 p-1 rounded-xl">
									<TabsTrigger value="recent" className="rounded-lg gap-2">
										<Clock className="h-4 w-4" />
										最新の通報
									</TabsTrigger>
									<TabsTrigger value="popular" className="rounded-lg gap-2">
										<TrendingUp className="h-4 w-4" />
										注目の案件
									</TabsTrigger>
								</TabsList>
								<Link
									href="/reports"
									className="text-sm font-medium text-primary hover:underline"
								>
									すべて見る
								</Link>
							</div>

							<TabsContent value="recent" className="space-y-4">
								{[1, 2, 3, 4, 5].map((i) => (
									<ReportCard key={i} />
								))}
							</TabsContent>

							<TabsContent value="popular" className="space-y-4">
								{[1, 2, 3].map((i) => (
									<ReportCard key={i} highlighted />
								))}
							</TabsContent>
						</Tabs>
					</section>
				</div>

				{/* Sidebar */}
				<aside className="space-y-10">
					{/* Activity Widget */}
					<Card className="border-primary/10 bg-primary/5">
						<CardHeader>
							<CardTitle className="text-lg flex items-center gap-2">
								<TrendingUp className="h-5 w-5 text-primary" />
								現在の状況
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										合計通報件数
									</p>
									<p className="text-2xl font-bold">1,248</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										本日の新規
									</p>
									<p className="text-2xl font-bold text-primary">+24</p>
								</div>
							</div>
							<div className="space-y-3 pt-4 border-t">
								<p className="text-sm font-medium">カテゴリー別</p>
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">フィッシング</span>
										<span className="font-medium">42%</span>
									</div>
									<div className="w-full h-2 bg-muted rounded-full overflow-hidden">
										<div className="h-full bg-primary w-[42%]" />
									</div>
								</div>
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">なりすまし</span>
										<span className="font-medium">28%</span>
									</div>
									<div className="w-full h-2 bg-muted rounded-full overflow-hidden">
										<div className="h-full bg-blue-500 w-[28%]" />
									</div>
								</div>
							</div>
							<Link href="/statistics" className="block">
								<Button variant="outline" className="w-full rounded-xl">
									詳細な統計を見る
								</Button>
							</Link>
						</CardContent>
					</Card>

					{/* Announcement Widget */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg flex items-center justify-between">
								お知らせ
								<Link
									href="/announcements"
									className="text-xs font-normal text-primary hover:underline"
								>
									一覧
								</Link>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="flex flex-col gap-1 text-sm border-b pb-3 last:border-0 last:pb-0"
								>
									<p className="text-xs text-muted-foreground">2026.02.14</p>
									<Link
										href={`/announcements/${i}`}
										className="font-medium hover:text-primary transition-colors"
									>
										システムメンテナンスのお知らせ
									</Link>
								</div>
							))}
						</CardContent>
					</Card>
				</aside>
			</div>
		</div>
	);
}

function ReportCard({ highlighted = false }: { highlighted?: boolean }) {
	return (
		<Card
			className={`group transition-all hover:shadow-md ${highlighted ? "border-primary/20 bg-primary/5" : ""}`}
		>
			<Link href="/reports/1">
				<div className="flex flex-col sm:flex-row p-4 gap-4">
					<div className="w-full sm:w-32 h-32 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
						<ShieldAlert className="h-8 w-8 text-muted-foreground/50" />
					</div>
					<div className="flex-1 space-y-2">
						<div className="flex items-center gap-2">
							<Badge variant="secondary" className="hover:bg-secondary">
								フィッシング
							</Badge>
							<Badge variant="outline">Amazon</Badge>
							<span className="text-xs text-muted-foreground ml-auto">
								2時間前
							</span>
						</div>
						<h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
							Amazonを騙る偽のログインメールが届きました。
						</h3>
						<p className="text-sm text-muted-foreground line-clamp-2">
							URL: https://amazon-secure-login.jp-login.support/...
							アカウント情報の更新を求める内容です。
						</p>
						<div className="flex items-center gap-4 pt-2">
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<TrendingUp className="h-3 w-3" />
								<span>閲覧数: 42</span>
							</div>
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Star className="h-3 w-3" />
								<span>注目の疑い: Aリト</span>
							</div>
						</div>
					</div>
				</div>
			</Link>
		</Card>
	);
}
