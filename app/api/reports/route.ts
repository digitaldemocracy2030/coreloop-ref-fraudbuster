import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
	ReportsListResponse,
	ReportSortOrder,
	ReportSummary,
} from "@/lib/types/api";
import {
	successResponse,
	errorResponse,
	badRequestResponse,
} from "@/lib/api-utils";

function parseOptionalInteger(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) return undefined;
	return parsed;
}

function parseSortOrder(value: string | null): ReportSortOrder {
	return value === "popular" ? "popular" : "newest";
}

/**
 * GET /api/reports
 * List reports with filtering and search
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const query = searchParams.get("q")?.trim() || undefined;
		const cursor = searchParams.get("cursor") || undefined;
		const platformId = parseOptionalInteger(searchParams.get("platformId"));
		const categoryId = parseOptionalInteger(searchParams.get("categoryId"));
		const statusId = parseOptionalInteger(searchParams.get("statusId"));
		const sort = parseSortOrder(searchParams.get("sort"));
		const limitParam = searchParams.get("limit");
		const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 12;
		const take = Number.isNaN(parsedLimit)
			? 12
			: Math.min(Math.max(parsedLimit, 1), 30);

		const orderBy =
			sort === "popular"
				? [{ viewCount: "desc" as const }, { id: "desc" as const }]
				: [{ createdAt: "desc" as const }, { id: "desc" as const }];

		const reports = await prisma.report.findMany({
			where: {
				AND: [
					query
						? {
								OR: [
									{ url: { contains: query, mode: "insensitive" as const } },
									{ title: { contains: query, mode: "insensitive" as const } },
									{
										description: {
											contains: query,
											mode: "insensitive" as const,
										},
									},
								],
							}
						: {},
					platformId ? { platformId } : {},
					categoryId ? { categoryId } : {},
					statusId ? { statusId } : {},
				],
			},
			select: {
				id: true,
				url: true,
				title: true,
				description: true,
				createdAt: true,
				viewCount: true,
				riskScore: true,
				platform: {
					select: {
						id: true,
						name: true,
					},
				},
				category: {
					select: {
						id: true,
						name: true,
					},
				},
				status: {
					select: {
						id: true,
						label: true,
					},
				},
				images: {
					select: {
						id: true,
						imageUrl: true,
					},
					take: 1,
					orderBy: { displayOrder: "asc" as const },
				},
			},
			orderBy,
			take: take + 1,
			...(cursor
				? {
						cursor: { id: cursor },
						skip: 1,
					}
				: {}),
		});

		const hasMore = reports.length > take;
		const items = hasMore ? reports.slice(0, take) : reports;
		const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

		const response: ReportsListResponse = {
			items: items.map(
				(report): ReportSummary => ({
					...report,
					createdAt: report.createdAt?.toISOString() ?? null,
				}),
			),
			nextCursor,
		};

		return successResponse(response);
	} catch (error) {
		console.error("Failed to fetch reports:", error);
		return errorResponse("Internal Server Error");
	}
}

/**
 * POST /api/reports
 * Create a new report
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { url, title, description, platformId, categoryId } = body;

		if (!url) {
			return badRequestResponse("URL is required");
		}

		// For now, we use a placeholder user ID or create a mock user if none exists
		// In a real app, this would be the authenticated user's ID
		const report = await prisma.report.create({
			data: {
				url,
				title,
				description,
				platformId: platformId ? Number.parseInt(platformId) : undefined,
				categoryId: categoryId ? Number.parseInt(categoryId) : undefined,
				statusId: 1, // Default to first status (usually 'Pending' or 'Investigating')
				riskScore: 0,
				viewCount: 0,
				reportCount: 1,
			},
			include: {
				status: true,
			},
		});

		// Create an initial timeline entry
		await prisma.reportTimeline.create({
			data: {
				reportId: report.id,
				actionLabel: "通報受領",
				description: "システムによる自動受付完了",
			},
		});

		return successResponse(report, 201);
	} catch (error) {
		console.error("Failed to create report:", error);
		return errorResponse("Internal Server Error");
	}
}
