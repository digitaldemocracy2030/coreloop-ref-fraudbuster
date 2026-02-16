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

function extractAttributeValue(tag: string, attribute: string): string | null {
	const pattern = new RegExp(
		`${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
		"i",
	);
	const match = tag.match(pattern);
	const value = match?.[1] ?? match?.[2] ?? match?.[3];
	return value?.trim() || null;
}

function isPrivateHostname(hostname: string): boolean {
	const host = hostname.toLowerCase();

	if (
		host === "localhost" ||
		host === "127.0.0.1" ||
		host === "::1" ||
		host === "0.0.0.0" ||
		host.endsWith(".local")
	) {
		return true;
	}
	if (host.includes(":")) {
		return true;
	}

	const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (ipv4Match) {
		const octets = ipv4Match.slice(1).map((value) => Number.parseInt(value, 10));
		if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
			return true;
		}

		const [a, b] = octets;
		if (a === 10 || a === 127 || a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
	}

	return false;
}

function parsePublicHttpUrl(value: string): URL | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
	if (!hasScheme && !trimmed.includes(".")) return null;

	try {
		const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		if (isPrivateHostname(parsed.hostname)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function resolveThumbnailUrl(candidate: string, baseUrl: URL): string | null {
	try {
		const normalized = new URL(candidate.replaceAll("&amp;", "&"), baseUrl);
		if (normalized.protocol !== "http:" && normalized.protocol !== "https:") {
			return null;
		}
		if (isPrivateHostname(normalized.hostname)) {
			return null;
		}
		return normalized.toString();
	} catch {
		return null;
	}
}

function extractThumbnailFromHtml(html: string, pageUrl: URL): string | null {
	const headChunk = html.slice(0, 250_000);

	const metaTagPattern = /<meta\b[^>]*>/gi;
	const metaTags = headChunk.match(metaTagPattern) ?? [];
	for (const tag of metaTags) {
		const key = (
			extractAttributeValue(tag, "property") ??
			extractAttributeValue(tag, "name") ??
			""
		).toLowerCase();
		if (
			key !== "og:image" &&
			key !== "og:image:url" &&
			key !== "twitter:image" &&
			key !== "twitter:image:src"
		) {
			continue;
		}

		const content = extractAttributeValue(tag, "content");
		if (!content) continue;

		const resolved = resolveThumbnailUrl(content, pageUrl);
		if (resolved) return resolved;
	}

	const linkTagPattern = /<link\b[^>]*>/gi;
	const linkTags = headChunk.match(linkTagPattern) ?? [];
	for (const tag of linkTags) {
		const rel = (extractAttributeValue(tag, "rel") ?? "").toLowerCase();
		if (!rel) continue;

		const isImageRel =
			rel.includes("image_src") ||
			rel.split(/\s+/).some((item) => item === "icon" || item === "apple-touch-icon");
		if (!isImageRel) continue;

		const href = extractAttributeValue(tag, "href");
		if (!href) continue;

		const resolved = resolveThumbnailUrl(href, pageUrl);
		if (resolved) return resolved;
	}

	return null;
}

async function fetchReportThumbnailUrl(rawUrl: string): Promise<string | null> {
	const targetUrl = parsePublicHttpUrl(rawUrl);
	if (!targetUrl) return null;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 3500);

	try {
		const response = await fetch(targetUrl.toString(), {
			method: "GET",
			redirect: "follow",
			signal: controller.signal,
			cache: "no-store",
			headers: {
				Accept: "text/html,application/xhtml+xml",
				"User-Agent": "AntiFraudBot/1.0 (+https://antifraud.local)",
			},
		});

		if (!response.ok) return null;
		const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
		if (!contentType.includes("text/html")) return null;
		const contentLength = Number.parseInt(
			response.headers.get("content-length") ?? "",
			10,
		);
		if (!Number.isNaN(contentLength) && contentLength > 1_500_000) return null;

		const html = await response.text();
		const finalUrl = parsePublicHttpUrl(response.url) ?? targetUrl;
		return extractThumbnailFromHtml(html, finalUrl);
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			return null;
		}
		console.error("Failed to fetch report thumbnail:", error);
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
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
		const url = typeof body.url === "string" ? body.url.trim() : "";
		const title = typeof body.title === "string" ? body.title : null;
		const description =
			typeof body.description === "string" ? body.description : null;
		const platformId =
			typeof body.platformId === "string" || typeof body.platformId === "number"
				? String(body.platformId)
				: null;
		const categoryId =
			typeof body.categoryId === "string" || typeof body.categoryId === "number"
				? String(body.categoryId)
				: null;

		if (!url) {
			return badRequestResponse("URL is required");
		}

		const thumbnailUrl = await fetchReportThumbnailUrl(url);

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
				images: thumbnailUrl
					? {
							create: {
								imageUrl: thumbnailUrl,
								displayOrder: 0,
							},
						}
					: undefined,
			},
			include: {
				status: true,
				images: {
					select: {
						id: true,
						imageUrl: true,
					},
					take: 1,
					orderBy: { displayOrder: "asc" as const },
				},
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
