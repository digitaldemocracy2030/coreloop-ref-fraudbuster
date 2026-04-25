import type { PrismaClient } from "../app/generated/prisma/client.ts";
import {
	getReportImageStorageBucket,
	resolveSupabaseProjectOrigin,
	type StoredReportImage,
} from "./report-image-storage.ts";
import {
	captureReportUrlScreenshot,
	UnsafeReportScreenshotUrlError,
} from "./report-screenshot-capture.ts";
import {
	type ClaimedReportScreenshotJob,
	claimNextReportScreenshotJob,
	cleanupUploadedReportScreenshot,
	completeReportScreenshotJob,
	failReportScreenshotJob,
	getReportScreenshotMaxAttempts,
	getReportScreenshotNavigationTimeoutMs,
} from "./report-screenshot-jobs.ts";
import { storeCapturedReportScreenshot } from "./report-screenshot-storage.ts";
import {
	defaultLookupHostname,
	type LookupHostname,
	resolveSafePublicHttpUrl,
} from "./report-url-safety.ts";
import { getSiteUrl } from "./site-url.ts";

export type ReportScreenshotWorkerResult =
	| { processed: false }
	| { processed: true; status: "succeeded"; jobId: string; reportId: string }
	| {
			processed: true;
			status: "failed";
			jobId: string;
			reportId: string;
			error: string;
	  };

type ScreenshotCapture = (args: {
	url: string;
	timeoutMs: number;
	lookupHostname: LookupHostname;
}) => Promise<Buffer>;

type ScreenshotStore = (args: {
	reportId: string;
	screenshotBuffer: Buffer;
}) => Promise<StoredReportImage>;

export class PermanentReportScreenshotJobError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PermanentReportScreenshotJobError";
	}
}

async function tryRevalidateReportScreenshotCaches(reportId: string) {
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
	if (!serviceRoleKey) {
		return;
	}

	try {
		const endpoint = new URL(
			"/api/internal/report-screenshot-revalidate",
			getSiteUrl(),
		);
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${serviceRoleKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ reportId }),
			cache: "no-store",
		});
		if (!response.ok) {
			throw new Error(`Revalidate endpoint returned ${response.status}`);
		}
	} catch (error) {
		console.error("Failed to revalidate report screenshot caches:", error);
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function cleanupUploadedFile(uploadedFile: StoredReportImage | null) {
	const supabaseOrigin = resolveSupabaseProjectOrigin();
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
	if (!uploadedFile || !supabaseOrigin || !serviceRoleKey) return;

	await cleanupUploadedReportScreenshot({
		uploadedFile,
		bucket: getReportImageStorageBucket(),
		serviceRoleKey,
		supabaseOrigin,
	});
}

async function processClaimedReportScreenshotJob({
	prisma,
	job,
	captureScreenshot,
	storeScreenshot,
	lookupHostname,
	maxAttempts,
	timeoutMs,
}: {
	prisma: PrismaClient;
	job: ClaimedReportScreenshotJob;
	captureScreenshot: ScreenshotCapture;
	storeScreenshot: ScreenshotStore;
	lookupHostname: LookupHostname;
	maxAttempts: number;
	timeoutMs: number;
}): Promise<ReportScreenshotWorkerResult> {
	let uploadedFile: StoredReportImage | null = null;

	try {
		const safeUrl = await resolveSafePublicHttpUrl(job.url, lookupHostname);
		if (!safeUrl) {
			throw new PermanentReportScreenshotJobError(
				"Screenshot target URL is not a public HTTP(S) URL.",
			);
		}

		const screenshotBuffer = await captureScreenshot({
			url: safeUrl.toString(),
			timeoutMs,
			lookupHostname,
		});
		uploadedFile = await storeScreenshot({
			reportId: job.reportId,
			screenshotBuffer,
		});
		await completeReportScreenshotJob({
			prisma,
			job,
			imageUrl: uploadedFile.publicUrl,
		});
		await tryRevalidateReportScreenshotCaches(job.reportId);

		return {
			processed: true,
			status: "succeeded",
			jobId: job.id,
			reportId: job.reportId,
		};
	} catch (error) {
		await cleanupUploadedFile(uploadedFile);
		const forceFinalFailure =
			error instanceof PermanentReportScreenshotJobError ||
			error instanceof UnsafeReportScreenshotUrlError;
		await failReportScreenshotJob({
			prisma,
			job,
			error,
			maxAttempts,
			forceFinalFailure,
		});

		return {
			processed: true,
			status: "failed",
			jobId: job.id,
			reportId: job.reportId,
			error: errorMessage(error),
		};
	}
}

export async function processNextReportScreenshotJob({
	prisma,
	captureScreenshot = captureReportUrlScreenshot,
	storeScreenshot = storeCapturedReportScreenshot,
	lookupHostname = defaultLookupHostname,
	maxAttempts = getReportScreenshotMaxAttempts(),
	timeoutMs = getReportScreenshotNavigationTimeoutMs(),
}: {
	prisma: PrismaClient;
	captureScreenshot?: ScreenshotCapture;
	storeScreenshot?: ScreenshotStore;
	lookupHostname?: LookupHostname;
	maxAttempts?: number;
	timeoutMs?: number;
}): Promise<ReportScreenshotWorkerResult> {
	const job = await claimNextReportScreenshotJob({ prisma, maxAttempts });
	if (!job) {
		return { processed: false };
	}

	return processClaimedReportScreenshotJob({
		prisma,
		job,
		captureScreenshot,
		storeScreenshot,
		lookupHostname,
		maxAttempts,
		timeoutMs,
	});
}
