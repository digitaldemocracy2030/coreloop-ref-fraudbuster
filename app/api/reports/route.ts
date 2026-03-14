import { customAlphabet } from "nanoid";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import {
	badRequestResponse,
	errorResponse,
	successResponse,
	getClientIp,
	verifyTurnstileToken,
} from "@/lib/api-utils";
import { getSafeReportImageAbsoluteUrl } from "@/lib/report-image-delivery";
import {
	cleanupStoredReportImages,
	getReportImageStorageBucket,
	resolveSupabaseProjectOrigin,
	type StoredReportImage,
} from "@/lib/report-image-storage";
import { prisma } from "@/lib/prisma";
import { fetchReportLinkPreview } from "@/lib/report-link-preview";
import { mirrorReportPreviewThumbnail } from "@/lib/report-thumbnail-ingest";
import type {
	ReportSortOrder,
	ReportSummary,
	ReportsListResponse,
} from "@/lib/types/api";

function parseOptionalInteger(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) return undefined;
	return parsed;
}

function parseSortOrder(value: string | null): ReportSortOrder {
	return value === "popular" ? "popular" : "newest";
}

const SUBMISSION_WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 100;
const MIN_FORM_COMPLETION_MS = 4 * 1000;
const rateLimitStore = new Map<string, number[]>();

const createReportId = customAlphabet(
	"0123456789abcdefghijklmnopqrstuvwxyz",
	12,
);

function isPresent<T>(value: T | null): value is T {
	return value !== null;
}

function toSafeReportResponseImage(
	image: {
		id: string;
		imageUrl: string;
	},
	requestUrl: string,
) {
	const imageUrl = getSafeReportImageAbsoluteUrl(image, requestUrl);
	if (!imageUrl) {
		return null;
	}

	return {
		id: image.id,
		imageUrl,
	};
}

function maybeCleanupRateLimitStore(now: number) {
	if (rateLimitStore.size < 100 || Math.random() > 0.02) return;
	for (const [key, timestamps] of rateLimitStore.entries()) {
		const active = timestamps.filter(
			(timestamp) => now - timestamp < SUBMISSION_WINDOW_MS,
		);
		if (active.length === 0) {
			rateLimitStore.delete(key);
			continue;
		}
		rateLimitStore.set(key, active);
	}
}

function checkAndRecordSubmission(key: string): {
	allowed: boolean;
	retryAfterSeconds?: number;
} {
	const now = Date.now();
	maybeCleanupRateLimitStore(now);

	const timestamps = (rateLimitStore.get(key) ?? []).filter(
		(timestamp) => now - timestamp < SUBMISSION_WINDOW_MS,
	);

	if (timestamps.length >= MAX_SUBMISSIONS_PER_WINDOW) {
		const oldest = timestamps[0];
		return {
			allowed: false,
			retryAfterSeconds: oldest
				? Math.ceil((SUBMISSION_WINDOW_MS - (now - oldest)) / 1000)
				: 60,
		};
	}

	timestamps.push(now);
	rateLimitStore.set(key, timestamps);

	return { allowed: true };
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
				? [{ reportCount: "desc" as const }, { id: "desc" as const }]
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
					images: report.images
						.map((image) => toSafeReportResponseImage(image, request.url))
						.filter(isPresent),
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
	let mirroredThumbnail: StoredReportImage | null = null;
	let reportCreated = false;

	try {
		const body = await request.json();
		const url = typeof body.url === "string" ? body.url.trim() : "";
		const submittedTitle =
			typeof body.title === "string" ? body.title.trim() : "";
		const title = submittedTitle.length > 0 ? submittedTitle : null;
		const description =
			typeof body.description === "string" ? body.description : null;
		const platformId =
			typeof body.platformId === "string" || typeof body.platformId === "number"
				? parseOptionalInteger(String(body.platformId))
				: undefined;
		const turnstileToken =
			typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";
		const spamTrap =
			typeof body.spamTrap === "string" ? body.spamTrap.trim() : "";
		const formStartedAt =
			typeof body.formStartedAt === "number" ? body.formStartedAt : Number.NaN;
		const clientIp = getClientIp(request);
		const userAgent = request.headers.get("user-agent")?.trim() || "unknown";
		const rateLimitKey = clientIp
			? `ip:${clientIp}`
			: `ua:${userAgent.slice(0, 160).toLowerCase()}`;

		if (!url) {
			return badRequestResponse("URL is required");
		}
		if (!platformId) {
			return badRequestResponse("プラットフォームは必須です");
		}

		if (spamTrap) {
			return successResponse({ ignored: true }, 201);
		}

		if (!Number.isFinite(formStartedAt)) {
			return badRequestResponse("送信情報が不足しています");
		}

		if (!turnstileToken) {
			return badRequestResponse("Turnstileトークンが未指定です");
		}
		if (Date.now() - formStartedAt < MIN_FORM_COMPLETION_MS) {
			return errorResponse(
				"送信が速すぎます。内容を確認してから再度お試しください。",
				429,
			);
		}

		const rateLimit = checkAndRecordSubmission(rateLimitKey);
		if (!rateLimit.allowed) {
			return Response.json(
				{ error: "送信回数が多すぎます。時間を空けて再試行してください。" },
				{
					status: 429,
					headers: {
						"Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
					},
				},
			);
		}

		const turnstileResult = await verifyTurnstileToken(
			turnstileToken,
			clientIp,
		);
		if (!turnstileResult.success) {
			console.error(
				"Turnstile verification rejected",
				turnstileResult.errorCodes,
			);
			const isServerMisconfigured =
				turnstileResult.errorCodes.includes("missing-secret-key");
			return errorResponse(
				isServerMisconfigured
					? "スパム対策設定エラーです。管理者へお問い合わせください。"
					: "スパム対策チェックに失敗しました。再試行してください。",
				isServerMisconfigured ? 503 : 403,
			);
		}

		const impersonationCategory = await prisma.fraudCategory.findUnique({
			where: { name: "なりすまし" },
			select: { id: true },
		});
		if (!impersonationCategory) {
			return errorResponse(
				"通報カテゴリの設定が見つかりません。管理者へお問い合わせください。",
				503,
			);
		}

		const reportId = createReportId();
		const reportPreview = await fetchReportLinkPreview(url);
		if (reportPreview.thumbnailUrl) {
			try {
				mirroredThumbnail = await mirrorReportPreviewThumbnail({
					reportId,
					thumbnailUrl: reportPreview.thumbnailUrl,
				});
			} catch (thumbnailError) {
				console.error(
					"Failed to ingest external report thumbnail:",
					thumbnailError,
				);
			}
		}

		const report = await prisma.report.create({
			data: {
				id: reportId,
				url,
				title: reportPreview.title ?? title,
				description,
				platformId,
				categoryId: impersonationCategory.id,
				statusId: 1, // Default to first status (usually 'Pending' or 'Investigating')
				riskScore: 0,
				reportCount: 1,
				sourceIp: clientIp,
				images: mirroredThumbnail
					? {
							create: [
								{
									imageUrl: mirroredThumbnail.publicUrl,
									displayOrder: 0,
								},
							],
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
		reportCreated = true;

		// Create an initial timeline entry
		await prisma.reportTimeline.create({
			data: {
				reportId: report.id,
				actionLabel: "通報受領",
				description: "システムによる自動受付完了",
			},
		});

		try {
			revalidateTag("reports", "max");
			revalidateTag("home-stats", "max");
		} catch (cacheError) {
			console.error("Failed to revalidate cache tags:", cacheError);
		}

		return successResponse(
			{
				...report,
				images: report.images
					.map((image) => toSafeReportResponseImage(image, request.url))
					.filter(isPresent),
			},
			201,
		);
	} catch (error) {
		if (mirroredThumbnail && !reportCreated) {
			const supabaseOrigin = resolveSupabaseProjectOrigin();
			const serviceRoleKey =
				process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

			if (supabaseOrigin && serviceRoleKey) {
				await cleanupStoredReportImages({
					files: [mirroredThumbnail],
					bucket: getReportImageStorageBucket(),
					serviceRoleKey,
					supabaseOrigin,
				});
			}
		}

		console.error("Failed to create report:", error);
		return errorResponse("Internal Server Error");
	}
}
