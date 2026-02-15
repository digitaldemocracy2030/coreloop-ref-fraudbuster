"use client";

import * as React from "react";
import {
	Activity,
	AlertTriangle,
	BarChart3,
	PieChart as PieChartIcon,
	TrendingUp,
} from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import type {
	StatisticsBreakdownItem,
	StatisticsResponse,
} from "@/lib/types/api";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const FALLBACK_TREND_DATA = [
	{ date: "02.08", count: 42 },
	{ date: "02.09", count: 56 },
	{ date: "02.10", count: 48 },
	{ date: "02.11", count: 72 },
	{ date: "02.12", count: 64 },
	{ date: "02.13", count: 88 },
	{ date: "02.14", count: 94 },
];

const CHART_COLORS = [
	"oklch(0.55 0.2 250)",
	"oklch(0.7 0.15 180)",
	"oklch(0.8 0.12 60)",
	"oklch(0.6 0.2 320)",
	"oklch(0.5 0.25 0)",
];

function ChartTooltipStyle() {
	return {
		backgroundColor: "var(--card)",
		borderRadius: "var(--radius)",
		border: "1px solid var(--border)",
	};
}

export default function StatisticsPage() {
	const [stats, setStats] = React.useState<StatisticsResponse | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [hasError, setHasError] = React.useState(false);

	React.useEffect(() => {
		const controller = new AbortController();

		async function fetchStats() {
			try {
				const res = await fetch("/api/statistics?days=7", {
					cache: "no-store",
					signal: controller.signal,
				});
				if (!res.ok) {
					throw new Error(`Failed to fetch statistics: ${res.status}`);
				}

				const data: StatisticsResponse = await res.json();
				setStats(data);
				setHasError(false);
			} catch (error) {
				if (controller.signal.aborted) return;
				console.error("Failed to fetch statistics:", error);
				setHasError(true);
			} finally {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			}
		}

		void fetchStats();
		return () => controller.abort();
	}, []);

	const trendData = stats?.trend.length ? stats.trend : FALLBACK_TREND_DATA;
	const categoryData: StatisticsBreakdownItem[] =
		stats?.breakdown.category ?? [];
	const platformData: StatisticsBreakdownItem[] =
		stats?.breakdown.platform ?? [];
	const statusData: StatisticsBreakdownItem[] = stats?.breakdown.status ?? [];

	const updatedAtLabel = React.useMemo(() => {
		if (!stats?.updatedAt) return "データ未取得";
		const date = new Date(stats.updatedAt);
		if (Number.isNaN(date.getTime())) return "データ未取得";
		return date.toLocaleString("ja-JP");
	}, [stats?.updatedAt]);

	if (loading) {
		return (
			<div className="container py-12 space-y-10">
				<div className="space-y-2">
					<Skeleton className="h-10 w-48" />
					<Skeleton className="h-4 w-96" />
				</div>
				<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-32 w-full rounded-2xl" />
					))}
				</div>
				<Skeleton className="h-[400px] w-full rounded-2xl" />
			</div>
		);
	}

	return (
		<div className="container py-12 space-y-12">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">詐欺トレンド統計</h1>
				<p className="text-muted-foreground">
					プラットフォームに集約された情報を元に、現在のネット詐欺の傾向を可視化しています。
				</p>
			</div>

			{hasError ? (
				<Card className="border-destructive/30 bg-destructive/5">
					<CardContent className="py-6 text-sm text-destructive">
						統計データの取得に失敗しました。時間をおいて再度お試しください。
					</CardContent>
				</Card>
			) : null}

			<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
				<Card className="border-primary/10 bg-primary/5">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs font-bold tracking-wider uppercase">
							累計通報件数
						</CardDescription>
						<CardTitle className="text-3xl font-black">
							{stats?.summary.totalReports.toLocaleString() ?? "0"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-1 text-xs font-bold text-primary">
							<TrendingUp className="h-3 w-3" />
							<span>直近7日を表示中</span>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="text-xs font-bold tracking-wider uppercase">
							本日の通報数
						</CardDescription>
						<CardTitle className="text-3xl font-black">
							{stats?.summary.todayReports ?? 0}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<span>高リスク件数: {stats?.summary.highRiskReports ?? 0}</span>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="text-xs font-bold tracking-wider uppercase">
							要注意プラットフォーム
						</CardDescription>
						<CardTitle className="text-3xl font-black text-destructive">
							{stats?.summary.topPlatform ?? "データなし"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-1 text-xs font-bold text-destructive">
							<AlertTriangle className="h-3 w-3" />
							<span>通報データから自動算出</span>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-5 w-5 text-primary" />
							通報件数の推移
						</CardTitle>
						<CardDescription>過去7日間の日別通報件数</CardDescription>
					</CardHeader>
					<CardContent className="h-[350px]">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={trendData}>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									stroke="oklch(0.9 0.02 240)"
								/>
								<XAxis
									dataKey="date"
									stroke="oklch(0.5 0.05 240)"
									fontSize={12}
									tickLine={false}
									axisLine={false}
								/>
								<YAxis
									stroke="oklch(0.5 0.05 240)"
									fontSize={12}
									tickLine={false}
									axisLine={false}
								/>
								<Tooltip
									contentStyle={ChartTooltipStyle()}
									itemStyle={{ color: "var(--primary)" }}
								/>
								<Line
									type="monotone"
									dataKey="count"
									stroke="var(--primary)"
									strokeWidth={4}
									dot={{
										r: 6,
										fill: "var(--primary)",
										strokeWidth: 2,
										stroke: "var(--card)",
									}}
									activeDot={{ r: 8, strokeWidth: 0 }}
								/>
							</LineChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<PieChartIcon className="h-5 w-5 text-primary" />
							カテゴリー別内訳
						</CardTitle>
					</CardHeader>
					<CardContent className="h-[300px]">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={categoryData}
									cx="50%"
									cy="50%"
									innerRadius={60}
									outerRadius={100}
									paddingAngle={5}
									dataKey="count"
									nameKey="label"
								>
									{categoryData.map((entry, index) => (
										<Cell
											key={`${entry.label}-${entry.id ?? index}`}
											fill={CHART_COLORS[index % CHART_COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip contentStyle={ChartTooltipStyle()} />
								<Legend verticalAlign="bottom" height={36} iconType="circle" />
							</PieChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5 text-primary" />
							プラットフォーム別内訳
						</CardTitle>
					</CardHeader>
					<CardContent className="h-[300px]">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={platformData}>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									stroke="oklch(0.9 0.02 240)"
								/>
								<XAxis
									dataKey="label"
									stroke="oklch(0.5 0.05 240)"
									fontSize={12}
									tickLine={false}
									axisLine={false}
								/>
								<YAxis
									stroke="oklch(0.5 0.05 240)"
									fontSize={12}
									tickLine={false}
									axisLine={false}
								/>
								<Tooltip
									contentStyle={ChartTooltipStyle()}
									cursor={{ fill: "var(--muted)", opacity: 0.4 }}
								/>
								<Bar
									dataKey="count"
									fill="var(--primary)"
									radius={[4, 4, 0, 0]}
									barSize={40}
								/>
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			</div>

			<section className="space-y-6 rounded-3xl bg-muted/30 p-8 lg:p-12">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div className="space-y-1">
						<h2 className="text-2xl font-bold">データについて</h2>
						<p className="text-sm text-muted-foreground">
							統計情報はAPIルート経由で集計し、可視化しています。
						</p>
					</div>
					<Badge
						variant="outline"
						className="h-fit w-fit border-primary/20 bg-background px-4 py-2"
					>
						最終更新: {updatedAtLabel}
					</Badge>
				</div>
				{statusData.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{statusData.map((item) => (
							<Badge
								key={`${item.label}-${item.id ?? "null"}`}
								variant="secondary"
							>
								{item.label}: {item.count}
							</Badge>
						))}
					</div>
				) : null}
			</section>
		</div>
	);
}
