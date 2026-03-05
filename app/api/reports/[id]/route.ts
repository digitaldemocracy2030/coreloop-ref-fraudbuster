import {
	errorResponse,
	notFoundResponse,
	successResponse,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import type { ReportDetailResponse } from "@/lib/types/api";

/**
 * GET /api/reports/[id]
 * Get detailed report information including images and timeline
 */
export async function GET(
	_request: Request,
	ctx: RouteContext<"/api/reports/[id]">,
) {
	try {
		const { id } = await ctx.params;

		const report = await prisma.report.findUnique({
			where: { id },
			select: {
				id: true,
				url: true,
				title: true,
				description: true,
				createdAt: true,
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
						displayOrder: true,
						createdAt: true,
					},
					orderBy: { displayOrder: "asc" as const },
				},
				timelines: {
					orderBy: { occurredAt: "desc" as const },
					select: {
						id: true,
						actionLabel: true,
						description: true,
						occurredAt: true,
						admin: { select: { name: true } },
					},
				},
			},
		});

		if (!report) {
			return notFoundResponse("Report not found");
		}

		const response: ReportDetailResponse = {
			id: report.id,
			url: report.url,
			title: report.title,
			description: report.description,
			createdAt: report.createdAt?.toISOString() ?? null,
			riskScore: report.riskScore,
			platform: report.platform,
			category: report.category,
			status: report.status,
			images: report.images.map((image) => ({
				id: image.id,
				imageUrl: image.imageUrl,
				displayOrder: image.displayOrder ?? null,
				createdAt: image.createdAt?.toISOString() ?? null,
			})),
			timelines: report.timelines.map((timeline) => ({
				id: timeline.id,
				actionLabel: timeline.actionLabel,
				description: timeline.description,
				occurredAt: timeline.occurredAt?.toISOString() ?? null,
				admin: timeline.admin
					? {
							name: timeline.admin.name ?? null,
						}
					: null,
			})),
		};

		return successResponse(response);
	} catch (error) {
		console.error("Failed to fetch report details:", error);
		return errorResponse("Internal Server Error");
	}
}
