import { type BrowserContext, chromium, type Route } from "playwright";
import { getReportScreenshotNavigationTimeoutMs } from "./report-screenshot-jobs.ts";
import {
	defaultLookupHostname,
	type LookupHostname,
	validatePublicHttpUrl,
} from "./report-url-safety.ts";

const SCREENSHOT_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export class UnsafeReportScreenshotUrlError extends Error {
	constructor(url: string) {
		super(`Screenshot target URL is not safe: ${url}`);
		this.name = "UnsafeReportScreenshotUrlError";
	}
}

async function isSafeRequestUrl(
	value: string,
	lookupHostname: LookupHostname,
): Promise<boolean> {
	try {
		const url = new URL(value);
		return validatePublicHttpUrl(url, lookupHostname);
	} catch {
		return false;
	}
}

async function installSafeNetworkRoutes({
	context,
	lookupHostname,
}: {
	context: BrowserContext;
	lookupHostname: LookupHostname;
}) {
	await context.route("**/*", async (route: Route) => {
		const requestUrl = route.request().url();
		if (!(await isSafeRequestUrl(requestUrl, lookupHostname))) {
			await route.abort();
			return;
		}
		await route.continue();
	});
}

export async function captureReportUrlScreenshot({
	url,
	timeoutMs = getReportScreenshotNavigationTimeoutMs(),
	lookupHostname = defaultLookupHostname,
}: {
	url: string;
	timeoutMs?: number;
	lookupHostname?: LookupHostname;
}): Promise<Buffer> {
	const parsedUrl = new URL(url);
	if (!(await validatePublicHttpUrl(parsedUrl, lookupHostname))) {
		throw new UnsafeReportScreenshotUrlError(url);
	}

	const browser = await chromium.launch({ headless: true });
	try {
		const context = await browser.newContext({
			acceptDownloads: false,
			bypassCSP: false,
			ignoreHTTPSErrors: false,
			javaScriptEnabled: true,
			permissions: [],
			serviceWorkers: "block",
			userAgent: SCREENSHOT_USER_AGENT,
			viewport: { width: 1280, height: 720 },
		});

		try {
			await installSafeNetworkRoutes({ context, lookupHostname });
			const page = await context.newPage();
			page.setDefaultNavigationTimeout(timeoutMs);
			page.setDefaultTimeout(timeoutMs);

			await page.goto(parsedUrl.toString(), {
				waitUntil: "domcontentloaded",
				timeout: timeoutMs,
			});

			try {
				await page.waitForLoadState("networkidle", {
					timeout: Math.min(3_000, timeoutMs),
				});
			} catch {
				// Long-polling or blocked third-party resources should not prevent capture.
			}

			const screenshot = await page.screenshot({
				fullPage: false,
				type: "jpeg",
				quality: 85,
			});
			return Buffer.from(screenshot);
		} finally {
			await context.close();
		}
	} finally {
		await browser.close();
	}
}
