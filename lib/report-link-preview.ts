import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const PREVIEW_FETCH_TIMEOUT_MS = 6_000;
const MAX_PREVIEW_CONTENT_LENGTH = 3_000_000;
const MAX_PREVIEW_IMAGE_CONTENT_LENGTH = 5 * 1024 * 1024;
const MAX_PREVIEW_REDIRECTS = 4;
const PREVIEW_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const PRIVATE_ADDRESS_BLOCKLIST = (() => {
	const blockList = new BlockList();

	blockList.addSubnet("0.0.0.0", 8, "ipv4");
	blockList.addSubnet("10.0.0.0", 8, "ipv4");
	blockList.addSubnet("100.64.0.0", 10, "ipv4");
	blockList.addSubnet("127.0.0.0", 8, "ipv4");
	blockList.addSubnet("169.254.0.0", 16, "ipv4");
	blockList.addSubnet("172.16.0.0", 12, "ipv4");
	blockList.addSubnet("192.0.0.0", 24, "ipv4");
	blockList.addSubnet("192.0.2.0", 24, "ipv4");
	blockList.addSubnet("192.168.0.0", 16, "ipv4");
	blockList.addSubnet("198.18.0.0", 15, "ipv4");
	blockList.addSubnet("198.51.100.0", 24, "ipv4");
	blockList.addSubnet("203.0.113.0", 24, "ipv4");
	blockList.addSubnet("224.0.0.0", 4, "ipv4");
	blockList.addSubnet("240.0.0.0", 4, "ipv4");

	blockList.addAddress("::", "ipv6");
	blockList.addAddress("::1", "ipv6");
	blockList.addSubnet("fc00::", 7, "ipv6");
	blockList.addSubnet("fe80::", 10, "ipv6");
	blockList.addSubnet("fec0::", 10, "ipv6");
	blockList.addSubnet("ff00::", 8, "ipv6");
	blockList.addSubnet("2001:db8::", 32, "ipv6");

	return blockList;
})();

export type ReportLinkPreview = {
	title: string | null;
	thumbnailUrl: string | null;
};

type LookupHostname = (hostname: string) => Promise<string[]>;

type PreviewDependencies = {
	fetchFn?: typeof fetch;
	lookupHostname?: LookupHostname;
};

function normalizeHostname(hostname: string): string {
	const normalized = hostname.trim().toLowerCase();
	return normalized.endsWith(".") ? normalized.slice(0, -1) : normalized;
}

function getIpFamily(address: string): "ipv4" | "ipv6" | null {
	const normalized = normalizeHostname(address);
	const version = isIP(normalized);
	if (version === 4) return "ipv4";
	if (version === 6) return "ipv6";
	return null;
}

function unwrapMappedIpv4(address: string): string | null {
	const normalized = normalizeHostname(address);
	const match = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
	return match?.[1] ?? null;
}

function isPrivateIpAddress(address: string): boolean {
	const mappedIpv4 = unwrapMappedIpv4(address);
	if (mappedIpv4) {
		return isPrivateIpAddress(mappedIpv4);
	}

	const family = getIpFamily(address);
	if (!family) return true;
	return PRIVATE_ADDRESS_BLOCKLIST.check(normalizeHostname(address), family);
}

function isPrivateHostname(hostname: string): boolean {
	const host = normalizeHostname(hostname);
	if (!host) return true;

	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local")
	) {
		return true;
	}

	const family = getIpFamily(host);
	if (family) {
		return isPrivateIpAddress(host);
	}

	return host.includes(":");
}

async function defaultLookupHostname(hostname: string): Promise<string[]> {
	const records = await lookup(normalizeHostname(hostname), {
		all: true,
		verbatim: true,
	});
	return records.map((record) => record.address);
}

async function hostnameResolvesToPublicAddress(
	hostname: string,
	lookupHostname: LookupHostname,
): Promise<boolean> {
	const normalizedHost = normalizeHostname(hostname);
	if (!normalizedHost) return false;
	if (isPrivateHostname(normalizedHost)) return false;

	const family = getIpFamily(normalizedHost);
	if (family) {
		return !isPrivateIpAddress(normalizedHost);
	}

	try {
		const addresses = await lookupHostname(normalizedHost);
		if (addresses.length === 0) return false;
		return addresses.every((address) => !isPrivateIpAddress(address));
	} catch {
		return false;
	}
}

async function validatePreviewTargetUrl(
	url: URL,
	lookupHostname: LookupHostname,
): Promise<boolean> {
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return false;
	}
	if (url.username || url.password) {
		return false;
	}
	return hostnameResolvesToPublicAddress(url.hostname, lookupHostname);
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
		if (parsed.username || parsed.password) {
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

function extractAttributeValue(tag: string, attribute: string): string | null {
	const pattern = new RegExp(
		`${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
		"i",
	);
	const match = tag.match(pattern);
	const value = match?.[1] ?? match?.[2] ?? match?.[3];
	return value?.trim() || null;
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

async function readResponseBuffer(
	response: Response,
	maxBytes: number,
): Promise<Buffer | null> {
	if (!response.body) {
		return Buffer.alloc(0);
	}

	const reader = response.body.getReader();
	const chunks: Buffer[] = [];
	let totalBytes = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;

			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel();
				return null;
			}

			chunks.push(Buffer.from(value));
		}

		return Buffer.concat(chunks, totalBytes);
	} catch {
		try {
			await reader.cancel();
		} catch {
			// Ignore cancellation failures.
		}
		return null;
	} finally {
		reader.releaseLock();
	}
}

async function fetchPreviewDocument(
	targetUrl: URL,
	fetchFn: typeof fetch,
	lookupHostname: LookupHostname,
): Promise<{ html: string; finalUrl: URL } | null> {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		PREVIEW_FETCH_TIMEOUT_MS,
	);

	try {
		let currentUrl = targetUrl;

		for (
			let redirectCount = 0;
			redirectCount <= MAX_PREVIEW_REDIRECTS;
			redirectCount += 1
		) {
			if (!(await validatePreviewTargetUrl(currentUrl, lookupHostname))) {
				return null;
			}

			const response = await fetchFn(currentUrl.toString(), {
				method: "GET",
				redirect: "manual",
				signal: controller.signal,
				cache: "no-store",
				headers: {
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
					"User-Agent": PREVIEW_USER_AGENT,
				},
			});

			if (
				response.status >= 300 &&
				response.status < 400 &&
				response.headers.has("location")
			) {
				const location = response.headers.get("location");
				if (!location) return null;

				const redirectedUrl = parsePublicHttpUrl(
					new URL(location, currentUrl).toString(),
				);
				if (!redirectedUrl) return null;

				currentUrl = redirectedUrl;
				continue;
			}

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

			const htmlBuffer = await readResponseBuffer(
				response,
				MAX_PREVIEW_CONTENT_LENGTH,
			);
			if (!htmlBuffer) {
				return null;
			}

			const html = htmlBuffer.toString("utf8");
			const contentType = (
				response.headers.get("content-type") ?? ""
			).toLowerCase();
			const isHtmlByHeader = isHtmlLikeContentType(contentType);
			if (!isHtmlByHeader && !looksLikeHtmlDocument(html)) {
				return null;
			}

			return {
				html,
				finalUrl: currentUrl,
			};
		}

		return null;
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

async function fetchExternalImageResource(
	targetUrl: URL,
	fetchFn: typeof fetch,
	lookupHostname: LookupHostname,
): Promise<{
	buffer: Buffer;
	contentType: string | null;
	finalUrl: URL;
} | null> {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		PREVIEW_FETCH_TIMEOUT_MS,
	);

	try {
		let currentUrl = targetUrl;

		for (
			let redirectCount = 0;
			redirectCount <= MAX_PREVIEW_REDIRECTS;
			redirectCount += 1
		) {
			if (!(await validatePreviewTargetUrl(currentUrl, lookupHostname))) {
				return null;
			}

			const response = await fetchFn(currentUrl.toString(), {
				method: "GET",
				redirect: "manual",
				signal: controller.signal,
				cache: "no-store",
				headers: {
					Accept: "image/*,*/*;q=0.8",
					"Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
					"User-Agent": PREVIEW_USER_AGENT,
				},
			});

			if (
				response.status >= 300 &&
				response.status < 400 &&
				response.headers.has("location")
			) {
				const location = response.headers.get("location");
				if (!location) return null;

				const redirectedUrl = parsePublicHttpUrl(
					new URL(location, currentUrl).toString(),
				);
				if (!redirectedUrl) return null;

				currentUrl = redirectedUrl;
				continue;
			}

			if (!response.ok) return null;

			const contentLength = Number.parseInt(
				response.headers.get("content-length") ?? "",
				10,
			);
			if (
				!Number.isNaN(contentLength) &&
				contentLength > MAX_PREVIEW_IMAGE_CONTENT_LENGTH
			) {
				return null;
			}

			const contentType = (
				response.headers.get("content-type") ?? ""
			).toLowerCase();
			const normalizedContentType =
				contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
			if (
				normalizedContentType &&
				!normalizedContentType.startsWith("image/") &&
				normalizedContentType !== "application/octet-stream"
			) {
				return null;
			}

			const buffer = await readResponseBuffer(
				response,
				MAX_PREVIEW_IMAGE_CONTENT_LENGTH,
			);
			if (!buffer || buffer.length === 0) {
				return null;
			}

			return {
				buffer,
				contentType: normalizedContentType || null,
				finalUrl: currentUrl,
			};
		}

		return null;
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			return null;
		}
		console.error("Failed to fetch report preview image:", error);
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function fetchReportLinkPreview(
	rawUrl: string,
	dependencies: PreviewDependencies = {},
): Promise<ReportLinkPreview> {
	const fetchFn = dependencies.fetchFn ?? fetch;
	const lookupHostname = dependencies.lookupHostname ?? defaultLookupHostname;
	const candidates = buildPreviewCandidateUrls(rawUrl);
	if (candidates.length === 0) {
		return { title: null, thumbnailUrl: null };
	}

	let title: string | null = null;
	let thumbnailUrl: string | null = null;

	for (const candidate of candidates) {
		const previewDocument = await fetchPreviewDocument(
			candidate,
			fetchFn,
			lookupHostname,
		);
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

export async function fetchSafeExternalImage(
	rawUrl: string,
	dependencies: PreviewDependencies = {},
): Promise<{
	buffer: Buffer;
	contentType: string | null;
	finalUrl: string;
} | null> {
	const fetchFn = dependencies.fetchFn ?? fetch;
	const lookupHostname = dependencies.lookupHostname ?? defaultLookupHostname;
	const targetUrl = parsePublicHttpUrl(rawUrl);
	if (!targetUrl) {
		return null;
	}

	const response = await fetchExternalImageResource(
		targetUrl,
		fetchFn,
		lookupHostname,
	);
	if (!response) {
		return null;
	}

	return {
		buffer: response.buffer,
		contentType: response.contentType,
		finalUrl: response.finalUrl.toString(),
	};
}
