import {
	errorResponse,
	notFoundResponse,
	successResponse,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getSafeReportImageAbsoluteUrl } from "@/lib/report-image-delivery";
import { flattenReportLabelNames } from "@/lib/report-labels";
import {
	getReportStatusMeta,
	getReportVerdictMeta,
	isReportStatusCode,
	isReportVerdictCode,
	REPORT_STATUS_CODES,
} from "@/lib/report-metadata";
import type { ReportDetailResponse } from "@/lib/types/api";

type ReportDetailRouteContext = {
	params: Promise<{ id: string }>;
};

function isPresent<T>(value: T | null): value is T {
	return value !== null;
}

function toReportVerdictRef(verdict: string | null) {
	if (!verdict || !isReportVerdictCode(verdict)) {
		return null;
	}

	return {
		code: verdict,
		label: getReportVerdictMeta(verdict)?.label ?? verdict,
	};
}

/**
 * GET /api/reports/[id]
 * Get detailed report information including images and timeline
 */
export async function GET(_request: Request, ctx: ReportDetailRouteContext) {
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
						statusCode: true,
						label: true,
					},
				},
				verdict: true,
				reportLabels: {
					select: {
						label: {
							select: {
								code: true,
								name: true,
								groupCode: true,
								displayOrder: true,
							},
						},
					},
					orderBy: [
						{ label: { displayOrder: "asc" } },
						{ label: { name: "asc" } },
					],
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
			status: report.status
				? {
						id: report.status.id,
						code: isReportStatusCode(report.status.statusCode)
							? report.status.statusCode
							: REPORT_STATUS_CODES.PENDING,
						label:
							getReportStatusMeta(report.status.statusCode)?.label ??
							report.status.label,
					}
				: null,
			verdict: toReportVerdictRef(report.verdict),
			labels: flattenReportLabelNames(
				report.reportLabels.map((item) => item.label),
			),
			images: report.images
				.map((image) => {
					const imageUrl = getSafeReportImageAbsoluteUrl(image, _request.url);
					if (!imageUrl) {
						return null;
					}

					return {
						id: image.id,
						imageUrl,
						displayOrder: image.displayOrder ?? null,
						createdAt: image.createdAt?.toISOString() ?? null,
					};
				})
				.filter(isPresent),
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
