"use client";

import * as React from "react";
import {
	TrendingUp,
	TrendingDown,
	AlertTriangle,
	Activity,
	Calendar,
	PieChart as PieChartIcon,
	BarChart3,
} from "lucide-react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	BarChart,
	Bar,
	Legend,
} from "recharts";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Mock data for initial render or fallback
const MOCK_TIME_DATA = [
	{ date: "02.08", count: 42 },
	{ date: "02.09", count: 56 },
	{ date: "02.10", count: 48 },
	{ date: "02.11", count: 72 },
	{ date: "02.12", count: 64 },
	{ date: "02.13", count: 88 },
	{ date: "02.14", count: 94 },
];

const COLORS = [
	"oklch(0.55 0.2 250)",
	"oklch(0.7 0.15 180)",
	"oklch(0.8 0.12 60)",
	"oklch(0.6 0.2 320)",
	"oklch(0.5 0.25 0)",
];

export default function StatisticsPage() {
	const [stats, setStats] = React.useState<any>(null);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchStats() {
			try {
				const res = await fetch("/api/statistics");
				const data = await res.json();
				setStats(data);
			} catch (error) {
				console.error("Failed to fetch statistics:", error);
			} finally {
				setLoading(false);
			}
		}
		fetchStats();
	}, []);

	if (loading) {
		return (
			<div className="container py-12 space-y-10">
				<div className="space-y-2">
					<Skeleton className="h-10 w-48" />
					<Skeleton className="h-4 w-96" />
				</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
			{/* Header */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">詐欺トレンド統計</h1>
				<p className="text-muted-foreground">
					プラットフォームに集約された情報を元に、現在のネット詐欺の傾向を可視化しています。
				</p>
			</div>

			{/* Summary Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card className="border-primary/10 bg-primary/5">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs uppercase tracking-wider font-bold">
							累計通報件数
						</CardDescription>
						<CardTitle className="text-3xl font-black">
							{stats?.summary?.totalReports?.toLocaleString() || "1,248"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-1 text-xs text-primary font-bold">
							<TrendingUp className="h-3 w-3" />
							<span>先月比 +12%</span>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="text-xs uppercase tracking-wider font-bold">
							本日の通報数
						</CardDescription>
						<CardTitle className="text-3xl font-black">+24</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<span>平均 18.5件/日</span>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="text-xs uppercase tracking-wider font-bold">
							要注意プラットフォーム
						</CardDescription>
						<CardTitle className="text-3xl font-black text-destructive">
							Instagram
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-1 text-xs text-destructive font-bold">
							<AlertTriangle className="h-3 w-3" />
							<span>なりすましが急増中</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Main Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
				{/* Time Series */}
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
							<LineChart data={MOCK_TIME_DATA}>
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
									contentStyle={{
										backgroundColor: "var(--card)",
										borderRadius: "var(--radius)",
										border: "1px solid var(--border)",
									}}
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

				{/* Breakdown: Category */}
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
									data={stats?.breakdown?.category || []}
									cx="50%"
									cy="50%"
									innerRadius={60}
									outerRadius={100}
									paddingAngle={5}
									dataKey="_count._all"
									nameKey="label"
								>
									{(stats?.breakdown?.category || []).map(
										(entry: any, index: number) => (
											<Cell
												key={`cell-${index}`}
												fill={COLORS[index % COLORS.length]}
											/>
										),
									)}
								</Pie>
								<Tooltip
									contentStyle={{
										backgroundColor: "var(--card)",
										borderRadius: "var(--radius)",
										border: "1px solid var(--border)",
									}}
								/>
								<Legend verticalAlign="bottom" height={36} iconType="circle" />
							</PieChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>

				{/* Breakdown: Platform */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5 text-primary" />
							プラットフォーム別内訳
						</CardTitle>
					</CardHeader>
					<CardContent className="h-[300px]">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={stats?.breakdown?.platform || []}>
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
									contentStyle={{
										backgroundColor: "var(--card)",
										borderRadius: "var(--radius)",
										border: "1px solid var(--border)",
									}}
									cursor={{ fill: "var(--muted)", opacity: 0.4 }}
								/>
								<Bar
									dataKey="_count._all"
									fill="var(--primary)"
									radius={[4, 4, 0, 0]}
									barSize={40}
								/>
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			</div>

			<section className="bg-muted/30 rounded-3xl p-8 lg:p-12 space-y-6">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div className="space-y-1">
						<h2 className="text-2xl font-bold">データについて</h2>
						<p className="text-muted-foreground text-sm">
							統計情報は毎日深夜に更新されます。情報の集約により、詐欺のパターンを早期に発見することを目指しています。
						</p>
					</div>
					<Badge
						variant="outline"
						className="w-fit h-fit px-4 py-2 bg-background border-primary/20"
					>
						最終更新: 2026.02.14 00:00:00
					</Badge>
				</div>
			</section>
		</div>
	);
}
