import { connection } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import type {
	StatisticsBreakdownItem,
	StatisticsResponse,
	StatisticsTrendItem,
} from "@/lib/types/api";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

function parseDays(value: string | null): number {
	if (!value) return DEFAULT_DAYS;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) return DEFAULT_DAYS;
	return Math.min(Math.max(parsed, 1), MAX_DAYS);
}

function formatTrendDate(date: Date): string {
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${month}.${day}`;
}

function toDateKey(date: Date): string {
	const normalized = new Date(date);
	normalized.setHours(0, 0, 0, 0);
	return normalized.toISOString().slice(0, 10);
}

/**
 * GET /api/statistics
 * Get aggregated statistics for the dashboard
 */
export async function GET(request: Request) {
	await connection();

	try {
		const { searchParams } = new URL(request.url);
		const days = parseDays(searchParams.get("days"));

		const now = new Date();
		const startDate = new Date(now);
		startDate.setDate(startDate.getDate() - (days - 1));
		startDate.setHours(0, 0, 0, 0);

		const todayStart = new Date(now);
		todayStart.setHours(0, 0, 0, 0);

		const [
			totalReports,
			highRiskReports,
			todayReports,
			statusStatsRaw,
			categoryStatsRaw,
			platformStatsRaw,
			statuses,
			categories,
			platforms,
			trendReports,
		] = await Promise.all([
			prisma.report.count(),
			prisma.report.count({
				where: { riskScore: { gte: 80 } },
			}),
			prisma.report.count({
				where: {
					createdAt: { gte: todayStart },
				},
			}),
			prisma.report.groupBy({
				by: ["statusId"],
				_count: { _all: true },
			}),
			prisma.report.groupBy({
				by: ["categoryId"],
				_count: { _all: true },
			}),
			prisma.report.groupBy({
				by: ["platformId"],
				_count: { _all: true },
			}),
			prisma.reportStatus.findMany({
				select: { id: true, label: true },
			}),
			prisma.fraudCategory.findMany({
				select: { id: true, name: true },
			}),
			prisma.platform.findMany({
				select: { id: true, name: true },
			}),
			prisma.report.findMany({
				where: {
					createdAt: { gte: startDate },
				},
				select: {
					createdAt: true,
				},
			}),
		]);

		const statusLabelMap = new Map(
			statuses.map((item) => [item.id, item.label]),
		);
		const categoryLabelMap = new Map(
			categories.map((item) => [item.id, item.name]),
		);
		const platformLabelMap = new Map(
			platforms.map((item) => [item.id, item.name]),
		);

		const status: StatisticsBreakdownItem[] = statusStatsRaw.map((item) => ({
			id: item.statusId,
			label:
				item.statusId === null
					? "未設定"
					: (statusLabelMap.get(item.statusId) ?? "Unknown"),
			count: item._count._all,
		}));

		const category: StatisticsBreakdownItem[] = categoryStatsRaw.map(
			(item) => ({
				id: item.categoryId,
				label:
					item.categoryId === null
						? "未設定"
						: (categoryLabelMap.get(item.categoryId) ?? "Unknown"),
				count: item._count._all,
			}),
		);

		const platform: StatisticsBreakdownItem[] = platformStatsRaw.map(
			(item) => ({
				id: item.platformId,
				label:
					item.platformId === null
						? "未設定"
						: (platformLabelMap.get(item.platformId) ?? "Unknown"),
				count: item._count._all,
			}),
		);

		const topPlatform =
			platform
				.slice()
				.sort((a, b) => b.count - a.count)
				.find((item) => item.id !== null)?.label ?? null;

		const trendCountMap = new Map<string, number>();
		for (let i = 0; i < days; i += 1) {
			const bucketDate = new Date(startDate);
			bucketDate.setDate(startDate.getDate() + i);
			trendCountMap.set(toDateKey(bucketDate), 0);
		}

		for (const report of trendReports) {
			if (!report.createdAt) continue;
			const dateKey = toDateKey(report.createdAt);
			if (!trendCountMap.has(dateKey)) continue;
			trendCountMap.set(dateKey, (trendCountMap.get(dateKey) ?? 0) + 1);
		}

		const trend: StatisticsTrendItem[] = Array.from(
			trendCountMap.entries(),
		).map(([dateKey, count]) => ({
			date: formatTrendDate(new Date(dateKey)),
			count,
		}));

		const response: StatisticsResponse = {
			summary: {
				totalReports,
				highRiskReports,
				todayReports,
				topPlatform,
			},
			breakdown: {
				status,
				category,
				platform,
			},
			trend,
			updatedAt: now.toISOString(),
		};

		return successResponse(response);
	} catch (error) {
		console.error("Failed to fetch statistics:", error);
		return errorResponse("Internal Server Error");
	}
}
