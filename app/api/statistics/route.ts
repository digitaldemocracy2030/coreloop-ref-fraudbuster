import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";

/**
 * GET /api/statistics
 * Get aggregated statistics for the dashboard
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const days = searchParams.get("days")
			? Number.parseInt(searchParams.get("days")!)
			: 30;

		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		// Try to fetch from daily_statistics if available
		const dailyStats = await prisma.dailyStatistics.findMany({
			where: {
				date: {
					gte: startDate,
				},
			},
			orderBy: { date: "asc" as const },
		});

		if (dailyStats.length > 0) {
			return successResponse(dailyStats);
		}

		// Fallback: Real-time aggregation (simplified for demo/reference)
		// in a real app, this should be pre-calculated or cached
		const totalReports = await prisma.report.count();
		const statusStats = await prisma.report.groupBy({
			by: ["statusId"],
			_count: { _all: true },
		});

		const categoryStats = await prisma.report.groupBy({
			by: ["categoryId"],
			_count: { _all: true },
		});

		const platformStats = await prisma.report.groupBy({
			by: ["platformId"],
			_count: { _all: true },
		});

		// Fetch status/category/platform labels for the fallback response
		const [statuses, categories, platforms] = await Promise.all([
			prisma.reportStatus.findMany(),
			prisma.fraudCategory.findMany(),
			prisma.platform.findMany(),
		]);

		return successResponse({
			summary: {
				totalReports,
				// ... other summary fields
			},
			breakdown: {
				status: statusStats.map(
					(s: { statusId: number | null; _count: { _all: number } }) => ({
						...s,
						label:
							statuses.find(
								(st: { id: number; label: string }) => st.id === s.statusId,
							)?.label || "Unknown",
					}),
				),
				category: categoryStats.map(
					(c: { categoryId: number | null; _count: { _all: number } }) => ({
						...c,
						label:
							categories.find(
								(ca: { id: number; name: string }) => ca.id === c.categoryId,
							)?.name || "Unknown",
					}),
				),
				platform: platformStats.map(
					(p: { platformId: number | null; _count: { _all: number } }) => ({
						...p,
						label:
							platforms.find(
								(pl: { id: number; name: string }) => pl.id === p.platformId,
							)?.name || "Unknown",
					}),
				),
			},
		});
	} catch (error) {
		console.error("Failed to fetch statistics:", error);
		return errorResponse("Internal Server Error");
	}
}
