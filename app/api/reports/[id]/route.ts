import { prisma } from "@/lib/prisma";
import {
	successResponse,
	errorResponse,
	notFoundResponse,
} from "@/lib/api-utils";

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
			include: {
				platform: true,
				category: true,
				status: true,
				images: {
					orderBy: { displayOrder: "asc" as const },
				},
				timelines: {
					orderBy: { occurredAt: "desc" as const },
					include: { admin: { select: { name: true } } },
				},
			},
		});

		if (!report) {
			return notFoundResponse("Report not found");
		}

		// Increment view count asynchronously (not blocking the response)
		prisma.report
			.update({
				where: { id },
				data: { viewCount: { increment: 1 } },
			})
			.catch((err: unknown) =>
				console.error("Failed to increment view count:", err),
			);

		return successResponse(report);
	} catch (error) {
		console.error("Failed to fetch report details:", error);
		return errorResponse("Internal Server Error");
	}
}
