"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Clock3, Eye, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

const PAGE_SIZE = 12;

type ReportSummary = {
	id: string;
	url: string;
	title: string | null;
	description: string | null;
	createdAt: string | null;
	viewCount: number | null;
	riskScore: number | null;
	platform: {
		id: number;
		name: string;
	} | null;
	category: {
		id: number;
		name: string;
	} | null;
	status: {
		id: number;
		label: string;
	} | null;
	images: Array<{
		id: string;
		imageUrl: string;
	}>;
};

type ReportsResponse = {
	items: ReportSummary[];
	nextCursor: string | null;
};

function normalizeResponse(payload: unknown): ReportsResponse {
	if (Array.isArray(payload)) {
		return { items: payload as ReportSummary[], nextCursor: null };
	}

	if (payload && typeof payload === "object") {
		const data = payload as { items?: unknown; nextCursor?: unknown };
		return {
			items: Array.isArray(data.items) ? (data.items as ReportSummary[]) : [],
			nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
		};
	}

	return { items: [], nextCursor: null };
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

function formatDate(value: string | null) {
	if (!value) return "日付不明";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "日付不明" : dateFormatter.format(date);
}

function riskStyle(score: number | null) {
	if (score === null) {
		return "bg-muted text-muted-foreground border-border";
	}
	if (score >= 80) {
		return "bg-destructive/10 text-destructive border-destructive/20";
	}
	if (score >= 50) {
		return "bg-orange-500/10 text-orange-600 border-orange-500/20";
	}
	return "bg-green-500/10 text-green-700 border-green-500/20";
}

function ReportSummaryCard({ report }: { report: ReportSummary }) {
	return (
		<Link href={`/reports/${report.id}`} className="block h-full">
			<Card className="group h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
				<CardContent className="flex h-full flex-col gap-4 p-5">
					<div className="aspect-video w-full overflow-hidden rounded-xl bg-muted/70">
						<div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
							<ShieldAlert className="h-5 w-5" />
							<span className="text-xs">通報画像</span>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary">
							{report.category?.name || "未分類"}
						</Badge>
						<Badge variant="outline">
							{report.platform?.name || "不明なプラットフォーム"}
						</Badge>
						{report.status?.label ? (
							<Badge variant="outline">{report.status.label}</Badge>
						) : null}
						<span className="ml-auto text-xs text-muted-foreground">
							{formatDate(report.createdAt)}
						</span>
					</div>

					<div className="space-y-2">
						<h3 className="line-clamp-2 text-base font-bold leading-tight group-hover:text-primary">
							{report.title || "（タイトルなし）"}
						</h3>
						<p className="line-clamp-3 text-sm text-muted-foreground">
							{report.description || report.url}
						</p>
					</div>

					<div className="mt-auto flex items-center justify-between gap-3 pt-2">
						<div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
							<Eye className="h-3.5 w-3.5" />
							<span>{report.viewCount ?? 0} 閲覧</span>
						</div>
						<div
							className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${riskStyle(report.riskScore)}`}
						>
							<AlertTriangle className="h-3.5 w-3.5" />
							<span>リスク {report.riskScore ?? 0}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

export function HomeReportsGrid() {
	const [reports, setReports] = React.useState<ReportSummary[]>([]);
	const [nextCursor, setNextCursor] = React.useState<string | null>(null);
	const [isLoading, setIsLoading] = React.useState(false);
	const [hasLoadedInitial, setHasLoadedInitial] = React.useState(false);
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
	const sentinelRef = React.useRef<HTMLDivElement | null>(null);
	const isFetchingRef = React.useRef(false);

	const fetchReports = React.useCallback(async (cursor: string | null) => {
		if (isFetchingRef.current) return;
		isFetchingRef.current = true;
		setIsLoading(true);

		try {
			const params = new URLSearchParams({
				sort: "newest",
				limit: String(PAGE_SIZE),
			});
			if (cursor) {
				params.set("cursor", cursor);
			}

			const response = await fetch(`/api/reports?${params.toString()}`, {
				cache: "no-store",
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch reports: ${response.status}`);
			}

			const payload = normalizeResponse(await response.json());
			setReports((prev) =>
				cursor ? [...prev, ...payload.items] : payload.items,
			);
			setNextCursor(payload.nextCursor);
			setErrorMessage(null);
		} catch (error) {
			console.error(error);
			setErrorMessage("通報データの取得に失敗しました。");
		} finally {
			isFetchingRef.current = false;
			setIsLoading(false);
			setHasLoadedInitial(true);
		}
	}, []);

	React.useEffect(() => {
		void fetchReports(null);
	}, [fetchReports]);

	React.useEffect(() => {
		const target = sentinelRef.current;
		if (!target || !nextCursor) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (entry?.isIntersecting) {
					void fetchReports(nextCursor);
				}
			},
			{
				rootMargin: "320px 0px",
			},
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [nextCursor, fetchReports]);

	if (!hasLoadedInitial) {
		return (
			<div className="space-y-6">
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 6 }).map((_, index) => (
						<Card key={`skeleton-${index}`}>
							<CardContent className="space-y-4 p-5">
								<Skeleton className="aspect-video w-full rounded-xl" />
								<Skeleton className="h-5 w-2/3" />
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-5/6" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{errorMessage ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-3 py-10 text-center">
						<p className="text-sm text-muted-foreground">{errorMessage}</p>
						<Button onClick={() => void fetchReports(null)} variant="outline">
							再読み込み
						</Button>
					</CardContent>
				</Card>
			) : null}

			{reports.length > 0 ? (
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
					{reports.map((report) => (
						<ReportSummaryCard key={report.id} report={report} />
					))}
				</div>
			) : !errorMessage ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-3 py-10 text-center">
						<Clock3 className="h-5 w-5 text-muted-foreground" />
						<p className="text-sm text-muted-foreground">
							表示できる通報データがありません。
						</p>
					</CardContent>
				</Card>
			) : null}

			{nextCursor ? (
				<div
					ref={sentinelRef}
					className="flex min-h-12 items-center justify-center"
				>
					{isLoading ? (
						<div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
							<Spinner className="size-4" />
							読み込み中...
						</div>
					) : (
						<span className="text-xs text-muted-foreground">
							スクロールで続きを読み込み
						</span>
					)}
				</div>
			) : reports.length > 0 ? (
				<p className="text-center text-xs text-muted-foreground">
					すべての通報を表示しました。
				</p>
			) : null}
		</div>
	);
}
