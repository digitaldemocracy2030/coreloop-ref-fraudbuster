import { TrendingUp } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";

import { HomeReportsGrid } from "@/components/home-reports-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

async function getCurrentStatus() {
	"use cache";
	cacheTag("reports");
	cacheTag("home-stats");
	cacheLife({ revalidate: 60 });

	const [totalReports, todayReports, categoryStats] = await Promise.all([
		prisma.report.count(),
		prisma.report.count({
			where: {
				createdAt: {
					gte: new Date(new Date().setHours(0, 0, 0, 0)),
				},
			},
		}),
		prisma.fraudCategory.findMany({
			select: {
				name: true,
				_count: {
					select: { reports: true },
				},
			},
			orderBy: {
				reports: {
					_count: "desc",
				},
			},
			take: 3,
		}),
	]);

	const totalWithReports = categoryStats.reduce(
		(acc, cat) => acc + cat._count.reports,
		0,
	);

	const categories = categoryStats.map((cat) => ({
		name: cat.name,
		percentage:
			totalWithReports > 0
				? Math.round((cat._count.reports / totalWithReports) * 100)
				: 0,
	}));

	return {
		totalReports,
		todayReports,
		categories,
	};
}

export default async function Home() {
	await connection();
	const { totalReports, todayReports, categories } = await getCurrentStatus();

	return (
		<div className="flex flex-col gap-12 pb-20">
			{/* Hero Section */}
			<section className="relative overflow-hidden bg-primary/5 py-20 lg:py-32">
				<div className="container relative z-10 grid gap-10 lg:grid-cols-2 lg:items-center">
					<div className="space-y-6 text-center lg:text-left">
						<h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
							あやしいオンライン広告を
							<br className="hidden sm:block" />
							<span className="text-primary italic">通報</span>
						</h1>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0">
							SNSやメッセージアプリの詐欺情報をクラウドソーシングで集めています。
						</p>
						<div className="flex flex-wrap justify-center lg:justify-start gap-3">
							<Link href="/report/new">
								<Button className="rounded-full px-8">通報する</Button>
							</Link>
							<Link href="/statistics">
								<Button variant="outline" className="rounded-full px-8">
									統計を見る
								</Button>
							</Link>
						</div>
					</div>

					<div className="w-full max-w-xl mx-auto lg:mx-0 lg:justify-self-end">
						<CurrentStatusCard
							totalReports={totalReports}
							todayReports={todayReports}
							categories={categories}
						/>
					</div>
				</div>

				{/* Background Decoration */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-30 pointer-events-none">
					<div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary rounded-full blur-[120px]" />
					<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[150px]" />
				</div>
			</section>

			{/* Main Content */}
			<section className="container">
				<HomeReportsGrid />
			</section>
		</div>
	);
}

function CurrentStatusCard({
	totalReports,
	todayReports,
	categories,
}: {
	totalReports: number;
	todayReports: number;
	categories: { name: string; percentage: number }[];
}) {
	const topCategories = categories.slice(0, 3);

	return (
		<Card className="border-primary/10 bg-background/90 shadow-lg backdrop-blur-sm">
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
						<p className="text-2xl font-bold">
							{totalReports.toLocaleString()}
						</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground uppercase tracking-wider">
							本日の新規
						</p>
						<p className="text-2xl font-bold text-primary">
							+{todayReports.toLocaleString()}
						</p>
					</div>
				</div>
				<div className="space-y-3 pt-4 border-t">
					<p className="text-sm font-medium">カテゴリー別（上位3件）</p>
					{topCategories.length > 0 ? (
						topCategories.map((cat, i) => (
							<div key={cat.name} className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">{cat.name}</span>
									<span className="font-medium">{cat.percentage}%</span>
								</div>
								<div className="w-full h-2 bg-muted rounded-full overflow-hidden">
									<div
										className={`h-full ${i === 0 ? "bg-primary" : i === 1 ? "bg-blue-500" : "bg-orange-400"} transition-all duration-1000`}
										style={{ width: `${cat.percentage}%` }}
									/>
								</div>
							</div>
						))
					) : (
						<p className="text-sm text-muted-foreground italic">
							データがありません。
						</p>
					)}
				</div>
				<Link href="/statistics" className="block">
					<Button variant="outline" className="w-full rounded-xl">
						詳細な統計を見る
					</Button>
				</Link>
			</CardContent>
		</Card>
	);
}
