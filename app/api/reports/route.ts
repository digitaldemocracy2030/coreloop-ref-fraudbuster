import { isIP } from "node:net";
import { customAlphabet } from "nanoid";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import {
	badRequestResponse,
	errorResponse,
	successResponse,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
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

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const SUBMISSION_WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const MIN_SUBMISSION_INTERVAL_MS = 10 * 1000;
const MIN_FORM_COMPLETION_MS = 6 * 1000;
const rateLimitStore = new Map<string, number[]>();
const PREVIEW_FETCH_TIMEOUT_MS = 6_000;
const MAX_PREVIEW_CONTENT_LENGTH = 3_000_000;
const PREVIEW_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const TURNSTILE_VERIFY_ENDPOINT =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_SCREENSHOT_COUNT = 5;
const REPORT_SCREENSHOT_BUCKET =
	process.env.SUPABASE_REPORT_SCREENSHOT_BUCKET?.trim() || "report-screenshots";
const SUPABASE_PROJECT_URL =
	process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const createReportId = customAlphabet(
	"0123456789abcdefghijklmnopqrstuvwxyz",
	12,
);

type TurnstileVerificationResult = {
	success: boolean;
	errorCodes: string[];
};

type ReportLinkPreview = {
	title: string | null;
	thumbnailUrl: string | null;
};

function resolveOrigin(value: string): string | null {
	if (!value) return null;
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			return null;
		}
		return parsed.origin;
	} catch {
		return null;
	}
}

const SUPABASE_PROJECT_ORIGIN = resolveOrigin(SUPABASE_PROJECT_URL);

function isValidScreenshotPublicUrl(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > 2048) return false;
	if (!SUPABASE_PROJECT_ORIGIN) return false;

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			return false;
		}
		if (parsed.origin !== SUPABASE_PROJECT_ORIGIN) return false;

		const encodedBucket = encodeURIComponent(REPORT_SCREENSHOT_BUCKET);
		return (
			parsed.pathname.startsWith(
				`/storage/v1/object/public/${REPORT_SCREENSHOT_BUCKET}/`,
			) ||
			parsed.pathname.startsWith(`/storage/v1/object/public/${encodedBucket}/`)
		);
	} catch {
		return false;
	}
}

function normalizeIp(value: string | null): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (isIP(trimmed)) return trimmed;

	const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
	if (ipv4WithPort && isIP(ipv4WithPort[1])) {
		return ipv4WithPort[1];
	}

	const ipv6WithPort = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
	if (ipv6WithPort && isIP(ipv6WithPort[1])) {
		return ipv6WithPort[1];
	}

	return null;
}

function getClientIp(request: NextRequest): string | null {
	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		const first = forwardedFor.split(",")[0] ?? "";
		const normalized = normalizeIp(first);
		if (normalized) return normalized;
	}

	return normalizeIp(request.headers.get("x-real-ip"));
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
	const lastSubmission = timestamps[timestamps.length - 1];

	if (lastSubmission && now - lastSubmission < MIN_SUBMISSION_INTERVAL_MS) {
		return {
			allowed: false,
			retryAfterSeconds: Math.ceil(
				(MIN_SUBMISSION_INTERVAL_MS - (now - lastSubmission)) / 1000,
			),
		};
	}

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

async function verifyTurnstileToken(
	token: string,
	clientIp: string | null,
): Promise<TurnstileVerificationResult> {
	const secretKey = process.env.TURNSTILE_SECRET_KEY;
	if (!secretKey) {
		console.error("TURNSTILE_SECRET_KEY is not set");
		return { success: false, errorCodes: ["missing-secret-key"] };
	}

	const body = new URLSearchParams({
		secret: secretKey,
		response: token,
	});
	if (clientIp) {
		body.set("remoteip", clientIp);
	}

	try {
		const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
			cache: "no-store",
		});

		if (!response.ok) {
			return { success: false, errorCodes: ["turnstile-http-error"] };
		}

		const payload = (await response.json()) as {
			success?: boolean;
			"error-codes"?: string[];
		};

		return {
			success: payload.success === true,
			errorCodes: Array.isArray(payload["error-codes"])
				? payload["error-codes"]
				: [],
		};
	} catch (error) {
		console.error("Turnstile verification failed:", error);
		return { success: false, errorCodes: ["turnstile-request-failed"] };
	}
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
		const octets = ipv4Match
			.slice(1)
			.map((value) => Number.parseInt(value, 10));
		if (
			octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)
		) {
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

function hasExplicitScheme(value: string): boolean {
	return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value.trim());
}

function isHtmlLikeContentType(contentType: string): boolean {
	const normalized = contentType.toLowerCase();
	return (
		normalized.includes("text/html") ||
		normalized.includes("application/xhtml+xml")
	);
}

function looksLikeHtmlDocument(html: string): boolean {
	const headChunk = html.slice(0, 10_000);
	return /<(html|head|title|meta)\b/i.test(headChunk);
}

function buildPreviewCandidateUrls(rawUrl: string): URL[] {
	const primary = parsePublicHttpUrl(rawUrl);
	if (!primary) return [];

	const candidates = [primary];
	if (!hasExplicitScheme(rawUrl) && primary.protocol === "https:") {
		try {
			const httpFallback = new URL(primary.toString());
			httpFallback.protocol = "http:";
			candidates.push(httpFallback);
		} catch {
			// Ignore malformed fallback URL and continue with the primary candidate only.
		}
	}

	return candidates;
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

function decodeHtmlEntities(value: string): string {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">");
}

function normalizeTitle(value: string): string | null {
	const decoded = decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
	if (!decoded) return null;
	return decoded.slice(0, 255);
}

function extractTitleFromHtml(html: string): string | null {
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
			key !== "og:title" &&
			key !== "twitter:title" &&
			key !== "twitter:text:title" &&
			key !== "title"
		) {
			continue;
		}

		const content = extractAttributeValue(tag, "content");
		if (!content) continue;

		const normalized = normalizeTitle(content);
		if (normalized) return normalized;
	}

	const titleTagMatch = headChunk.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
	if (!titleTagMatch?.[1]) return null;

	return normalizeTitle(titleTagMatch[1]);
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
			key !== "og:image:secure_url" &&
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
			rel
				.split(/\s+/)
				.some((item) => item === "icon" || item === "apple-touch-icon");
		if (!isImageRel) continue;

		const href = extractAttributeValue(tag, "href");
		if (!href) continue;

		const resolved = resolveThumbnailUrl(href, pageUrl);
		if (resolved) return resolved;
	}

	return null;
}

async function fetchPreviewDocument(
	targetUrl: URL,
): Promise<{ html: string; finalUrl: URL } | null> {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		PREVIEW_FETCH_TIMEOUT_MS,
	);

	try {
		const response = await fetch(targetUrl.toString(), {
			method: "GET",
			redirect: "follow",
			signal: controller.signal,
			cache: "no-store",
			headers: {
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
				"User-Agent": PREVIEW_USER_AGENT,
			},
		});

		if (!response.ok) return null;

		const contentLength = Number.parseInt(
			response.headers.get("content-length") ?? "",
			10,
		);
		if (
			!Number.isNaN(contentLength) &&
			contentLength > MAX_PREVIEW_CONTENT_LENGTH
		) {
			return null;
		}

		const html = await response.text();
		const contentType = (
			response.headers.get("content-type") ?? ""
		).toLowerCase();
		const isHtmlByHeader = isHtmlLikeContentType(contentType);
		if (!isHtmlByHeader && !looksLikeHtmlDocument(html)) {
			return null;
		}

		return {
			html,
			finalUrl: parsePublicHttpUrl(response.url) ?? targetUrl,
		};
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			return null;
		}
		console.error("Failed to fetch report preview document:", error);
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
}

async function fetchReportLinkPreview(
	rawUrl: string,
): Promise<ReportLinkPreview> {
	const candidates = buildPreviewCandidateUrls(rawUrl);
	if (candidates.length === 0) {
		return { title: null, thumbnailUrl: null };
	}

	let title: string | null = null;
	let thumbnailUrl: string | null = null;

	for (const candidate of candidates) {
		const previewDocument = await fetchPreviewDocument(candidate);
		if (!previewDocument) continue;

		title ??= extractTitleFromHtml(previewDocument.html);
		thumbnailUrl ??= extractThumbnailFromHtml(
			previewDocument.html,
			previewDocument.finalUrl,
		);

		if (title && thumbnailUrl) break;
	}

	return { title, thumbnailUrl };
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
		const submittedTitle =
			typeof body.title === "string" ? body.title.trim() : "";
		const title = submittedTitle.length > 0 ? submittedTitle : null;
		const description =
			typeof body.description === "string" ? body.description : null;
		const email =
			typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
		const platformId =
			typeof body.platformId === "string" || typeof body.platformId === "number"
				? parseOptionalInteger(String(body.platformId))
				: undefined;
		const categoryId =
			typeof body.categoryId === "string" || typeof body.categoryId === "number"
				? parseOptionalInteger(String(body.categoryId))
				: undefined;
		const turnstileToken =
			typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";
		const spamTrap =
			typeof body.spamTrap === "string" ? body.spamTrap.trim() : "";
		const formStartedAt =
			typeof body.formStartedAt === "number" ? body.formStartedAt : Number.NaN;
		const rawScreenshotUrls = body.screenshotUrls;
		if (
			typeof rawScreenshotUrls !== "undefined" &&
			!Array.isArray(rawScreenshotUrls)
		) {
			return badRequestResponse("スクリーンショット情報が不正です");
		}
		const normalizedScreenshotUrls: string[] = [];
		for (const screenshotUrl of rawScreenshotUrls ?? []) {
			if (typeof screenshotUrl !== "string") {
				return badRequestResponse("スクリーンショット情報が不正です");
			}
			const trimmedScreenshotUrl = screenshotUrl.trim();
			if (!trimmedScreenshotUrl) {
				return badRequestResponse("スクリーンショット情報が不正です");
			}
			normalizedScreenshotUrls.push(trimmedScreenshotUrl);
		}
		const screenshotUrls = Array.from(new Set(normalizedScreenshotUrls));
		if (screenshotUrls.length > MAX_SCREENSHOT_COUNT) {
			return badRequestResponse("スクリーンショットは最大5枚までです");
		}
		if (
			screenshotUrls.some(
				(screenshotUrl) => !isValidScreenshotPublicUrl(screenshotUrl),
			)
		) {
			return badRequestResponse("スクリーンショットURLが不正です");
		}
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
		if (!categoryId) {
			return badRequestResponse("カテゴリーは必須です");
		}
		if (!email) {
			return badRequestResponse("メールアドレスは必須です");
		}
		if (!isValidEmail(email)) {
			return badRequestResponse("メールアドレスの形式が不正です");
		}

		if (spamTrap) {
			return successResponse({ ignored: true }, 201);
		}

		if (!turnstileToken) {
			return badRequestResponse("Turnstileトークンが未指定です");
		}

		if (!Number.isFinite(formStartedAt)) {
			return badRequestResponse("送信情報が不足しています");
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

		const reportPreview = await fetchReportLinkPreview(url);
		const reportImageUrls = Array.from(
			new Set([
				...screenshotUrls,
				...(reportPreview.thumbnailUrl ? [reportPreview.thumbnailUrl] : []),
			]),
		);
		const user = await prisma.user.upsert({
			where: { email },
			update: { lastLoginAt: new Date() },
			create: { email, lastLoginAt: new Date() },
		});

		const report = await prisma.report.create({
			data: {
				id: createReportId(),
				userId: user.id,
				url,
				title: reportPreview.title ?? title,
				description,
				platformId,
				categoryId,
				statusId: 1, // Default to first status (usually 'Pending' or 'Investigating')
				riskScore: 0,
				reportCount: 1,
				sourceIp: clientIp,
				images:
					reportImageUrls.length > 0
						? {
								create: reportImageUrls.map((imageUrl, index) => ({
									imageUrl,
									displayOrder: index,
								})),
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

		try {
			revalidateTag("reports", "max");
			revalidateTag("home-stats", "max");
		} catch (cacheError) {
			console.error("Failed to revalidate cache tags:", cacheError);
		}

		return successResponse(report, 201);
	} catch (error) {
		console.error("Failed to create report:", error);
		return errorResponse("Internal Server Error");
	}
}
