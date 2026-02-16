"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Clock3, Eye, Search, ShieldAlert } from "lucide-react";

import type {
	ReportsListResponse,
	ReportSortOrder,
	ReportSummary,
} from "@/lib/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_SIZE = 12;

function normalizeResponse(payload: unknown): ReportsListResponse {
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
	const thumbnailUrl = report.images[0]?.imageUrl ?? null;
	const [hasThumbnailError, setHasThumbnailError] = React.useState(false);

	React.useEffect(() => {
		setHasThumbnailError(false);
	}, [thumbnailUrl]);

	return (
		<Link
			href={`/reports/${report.id}`}
			className="block h-full"
			data-testid="report-card"
		>
			<Card className="group h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
				<CardContent className="flex h-full flex-col gap-4 p-5">
					<div className="aspect-video w-full overflow-hidden rounded-xl bg-muted/70">
						{thumbnailUrl && !hasThumbnailError ? (
							<img
								src={thumbnailUrl}
								alt={report.title || report.url}
								loading="lazy"
								referrerPolicy="no-referrer"
								className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
								onError={() => setHasThumbnailError(true)}
							/>
						) : (
							<div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
								<ShieldAlert className="h-5 w-5" />
								<span className="text-xs">サムネイルなし</span>
							</div>
						)}
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
	const [sortOrder, setSortOrder] = React.useState<ReportSortOrder>("newest");
	const [searchInput, setSearchInput] = React.useState("");
	const [debouncedQuery, setDebouncedQuery] = React.useState("");
	const [isLoading, setIsLoading] = React.useState(false);
	const [hasLoadedInitial, setHasLoadedInitial] = React.useState(false);
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
	const sentinelRef = React.useRef<HTMLDivElement | null>(null);
	const isFetchingRef = React.useRef(false);
	const requestVersionRef = React.useRef(0);
	const abortRef = React.useRef<AbortController | null>(null);

	const fetchReports = React.useCallback(
		async ({
			cursor,
			append,
			version,
		}: {
			cursor: string | null;
			append: boolean;
			version: number;
		}) => {
			if (isFetchingRef.current) return;
			isFetchingRef.current = true;
			setIsLoading(true);

			try {
				const controller = new AbortController();
				abortRef.current = controller;
				const params = new URLSearchParams({
					sort: sortOrder,
					limit: String(PAGE_SIZE),
				});
				if (debouncedQuery) {
					params.set("q", debouncedQuery);
				}
				if (cursor) {
					params.set("cursor", cursor);
				}

				const response = await fetch(`/api/reports?${params.toString()}`, {
					cache: "no-store",
					signal: controller.signal,
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch reports: ${response.status}`);
				}

				const payload = normalizeResponse(await response.json());
				if (version !== requestVersionRef.current) return;

				setReports((prev) =>
					append ? [...prev, ...payload.items] : payload.items,
				);
				setNextCursor(payload.nextCursor);
				setErrorMessage(null);
			} catch (error) {
				if (version !== requestVersionRef.current) return;
				if (error instanceof DOMException && error.name === "AbortError") {
					return;
				}

				console.error(error);
				setErrorMessage("通報データの取得に失敗しました。");
			} finally {
				if (version === requestVersionRef.current) {
					isFetchingRef.current = false;
					setIsLoading(false);
					setHasLoadedInitial(true);
				}
			}
		},
		[debouncedQuery, sortOrder],
	);

	const loadFirstPage = React.useCallback(() => {
		const version = requestVersionRef.current + 1;
		requestVersionRef.current = version;
		abortRef.current?.abort();
		isFetchingRef.current = false;
		setReports([]);
		setNextCursor(null);
		setHasLoadedInitial(false);
		setErrorMessage(null);

		void fetchReports({
			cursor: null,
			append: false,
			version,
		});
	}, [fetchReports]);

	React.useEffect(() => {
		const timeout = window.setTimeout(() => {
			setDebouncedQuery(searchInput.trim());
		}, 300);

		return () => window.clearTimeout(timeout);
	}, [searchInput]);

	React.useEffect(() => {
		loadFirstPage();
	}, [loadFirstPage]);

	React.useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	React.useEffect(() => {
		const target = sentinelRef.current;
		if (!target || !nextCursor) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (!entry?.isIntersecting) return;

				void fetchReports({
					cursor: nextCursor,
					append: true,
					version: requestVersionRef.current,
				});
			},
			{
				rootMargin: "320px 0px",
			},
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [nextCursor, fetchReports]);

	return (
		<div className="space-y-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-1">
					<h2 className="text-2xl font-bold tracking-tight">最新の通報</h2>
					<p className="text-sm text-muted-foreground">
						下へスクロールすると自動で読み込みます。
					</p>
				</div>
				<div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
					<Tabs
						value={sortOrder}
						onValueChange={(value) => {
							if (value === "popular" || value === "newest") {
								setSortOrder(value);
							}
						}}
						className="w-fit"
					>
						<TabsList>
							<TabsTrigger value="popular">話題</TabsTrigger>
							<TabsTrigger value="newest">最新</TabsTrigger>
						</TabsList>
					</Tabs>
					<div className="relative w-full sm:w-80">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							data-testid="report-search-input"
							value={searchInput}
							onChange={(event) => setSearchInput(event.target.value)}
							placeholder="URL・タイトル・説明で検索"
							className="pl-9"
						/>
					</div>
				</div>
			</div>

			{!hasLoadedInitial ? (
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
			) : (
				<div className="space-y-6">
					{errorMessage ? (
						<Card>
							<CardContent className="flex flex-col items-center gap-3 py-10 text-center">
								<p className="text-sm text-muted-foreground">{errorMessage}</p>
								<Button onClick={loadFirstPage} variant="outline">
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
									{debouncedQuery
										? "検索条件に一致する通報は見つかりませんでした。"
										: "表示できる通報データがありません。"}
								</p>
							</CardContent>
						</Card>
					) : null}

					{nextCursor ? (
						<div
							ref={sentinelRef}
							className="flex min-h-12 items-center justify-center"
							data-testid="report-scroll-sentinel"
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
			)}
		</div>
	);
}
