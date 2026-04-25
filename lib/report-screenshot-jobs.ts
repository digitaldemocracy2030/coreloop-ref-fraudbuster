import type { PrismaClient } from "../app/generated/prisma/client.ts";
import {
	cleanupStoredReportImages,
	type StoredReportImage,
} from "./report-image-storage.ts";

export const REPORT_SCREENSHOT_JOB_STATUSES = {
	QUEUED: "QUEUED",
	RUNNING: "RUNNING",
	SUCCEEDED: "SUCCEEDED",
	FAILED: "FAILED",
} as const;

export type ReportScreenshotJobStatus =
	(typeof REPORT_SCREENSHOT_JOB_STATUSES)[keyof typeof REPORT_SCREENSHOT_JOB_STATUSES];

export type ClaimedReportScreenshotJob = {
	id: string;
	reportId: string;
	url: string;
	status: "RUNNING";
	attempts: number;
};

type CreateReportScreenshotJobClient = {
	reportScreenshotJob: {
		create: (args: {
			data: {
				reportId: string;
				url: string;
				status: "QUEUED";
			};
		}) => Promise<unknown>;
	};
};

type ReportScreenshotJobRow = {
	id: string;
	report_id: string;
	url: string;
	status: ReportScreenshotJobStatus;
	attempts: number;
};

export const DEFAULT_REPORT_SCREENSHOT_WORKER_POLL_MS = 5_000;
export const DEFAULT_REPORT_SCREENSHOT_MAX_ATTEMPTS = 3;
export const DEFAULT_REPORT_SCREENSHOT_NAVIGATION_TIMEOUT_MS = 15_000;
const DEFAULT_REPORT_SCREENSHOT_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_ERROR_MESSAGE_LENGTH = 1000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

export function parsePositiveIntegerEnv(
	value: string | undefined,
	defaultValue: number,
): number {
	if (!value) return defaultValue;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function getReportScreenshotWorkerPollMs(): number {
	return parsePositiveIntegerEnv(
		process.env.REPORT_SCREENSHOT_WORKER_POLL_MS,
		DEFAULT_REPORT_SCREENSHOT_WORKER_POLL_MS,
	);
}

export function getReportScreenshotMaxAttempts(): number {
	return parsePositiveIntegerEnv(
		process.env.REPORT_SCREENSHOT_MAX_ATTEMPTS,
		DEFAULT_REPORT_SCREENSHOT_MAX_ATTEMPTS,
	);
}

export function getReportScreenshotNavigationTimeoutMs(): number {
	return parsePositiveIntegerEnv(
		process.env.REPORT_SCREENSHOT_NAVIGATION_TIMEOUT_MS,
		DEFAULT_REPORT_SCREENSHOT_NAVIGATION_TIMEOUT_MS,
	);
}

export function sanitizeReportScreenshotJobError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return (message || "Unknown screenshot job error").slice(
		0,
		MAX_ERROR_MESSAGE_LENGTH,
	);
}

export function getReportScreenshotRetryDelayMs(attempts: number): number {
	const retryIndex = Math.max(0, attempts - 1);
	return Math.min(60_000 * 2 ** retryIndex, MAX_RETRY_DELAY_MS);
}

export async function createReportScreenshotJob({
	tx,
	reportId,
	url,
}: {
	tx: CreateReportScreenshotJobClient;
	reportId: string;
	url: string;
}) {
	await tx.reportScreenshotJob.create({
		data: {
			reportId,
			url,
			status: REPORT_SCREENSHOT_JOB_STATUSES.QUEUED,
		},
	});
}

function mapClaimedJob(
	row: ReportScreenshotJobRow,
): ClaimedReportScreenshotJob {
	return {
		id: row.id,
		reportId: row.report_id,
		url: row.url,
		status: REPORT_SCREENSHOT_JOB_STATUSES.RUNNING,
		attempts: row.attempts,
	};
}

export async function claimNextReportScreenshotJob({
	prisma,
	maxAttempts = getReportScreenshotMaxAttempts(),
	lockTimeoutMs = DEFAULT_REPORT_SCREENSHOT_LOCK_TIMEOUT_MS,
}: {
	prisma: Pick<PrismaClient, "$queryRaw">;
	maxAttempts?: number;
	lockTimeoutMs?: number;
}): Promise<ClaimedReportScreenshotJob | null> {
	const lockTimeoutInterval = `${Math.max(1, lockTimeoutMs)} milliseconds`;
	const rows = await prisma.$queryRaw<ReportScreenshotJobRow[]>`
		UPDATE report_screenshot_jobs
		SET
			status = 'RUNNING'::"ReportScreenshotJobStatus",
			attempts = attempts + 1,
			locked_at = NOW(),
			updated_at = NOW(),
			last_error = NULL
		WHERE id = (
			SELECT id
			FROM report_screenshot_jobs
			WHERE
				attempts < ${maxAttempts}
				AND next_run_at <= NOW()
				AND (
					status = 'QUEUED'::"ReportScreenshotJobStatus"
					OR (
						status = 'RUNNING'::"ReportScreenshotJobStatus"
						AND locked_at < NOW() - (${lockTimeoutInterval}::text)::interval
					)
				)
			ORDER BY next_run_at ASC, created_at ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		RETURNING id, report_id, url, status, attempts
	`;

	const claimed = rows[0];
	return claimed ? mapClaimedJob(claimed) : null;
}

export async function completeReportScreenshotJob({
	prisma,
	job,
	imageUrl,
}: {
	prisma: PrismaClient;
	job: ClaimedReportScreenshotJob;
	imageUrl: string;
}) {
	return prisma.$transaction(async (tx) => {
		const latestDisplayOrder = await tx.reportImage.aggregate({
			where: { reportId: job.reportId },
			_max: { displayOrder: true },
		});
		const nextDisplayOrder = (latestDisplayOrder._max.displayOrder ?? -1) + 1;

		const image = await tx.reportImage.create({
			data: {
				reportId: job.reportId,
				imageUrl,
				displayOrder: nextDisplayOrder,
			},
			select: { id: true },
		});

		await tx.reportScreenshotJob.update({
			where: { id: job.id },
			data: {
				status: REPORT_SCREENSHOT_JOB_STATUSES.SUCCEEDED,
				imageId: image.id,
				completedAt: new Date(),
				lockedAt: null,
				lastError: null,
				updatedAt: new Date(),
			},
		});

		await tx.reportTimeline.create({
			data: {
				reportId: job.reportId,
				actionLabel: "自動スクリーンショット取得",
				description: "通報URLのスクリーンショットを自動保存しました。",
			},
		});

		return image;
	});
}

export async function failReportScreenshotJob({
	prisma,
	job,
	error,
	maxAttempts = getReportScreenshotMaxAttempts(),
	forceFinalFailure = false,
}: {
	prisma: PrismaClient;
	job: ClaimedReportScreenshotJob;
	error: unknown;
	maxAttempts?: number;
	forceFinalFailure?: boolean;
}) {
	const isFinalFailure = forceFinalFailure || job.attempts >= maxAttempts;
	const retryDelayMs = getReportScreenshotRetryDelayMs(job.attempts);

	await prisma.reportScreenshotJob.update({
		where: { id: job.id },
		data: {
			status: isFinalFailure
				? REPORT_SCREENSHOT_JOB_STATUSES.FAILED
				: REPORT_SCREENSHOT_JOB_STATUSES.QUEUED,
			lockedAt: null,
			lastError: sanitizeReportScreenshotJobError(error),
			nextRunAt: isFinalFailure
				? new Date()
				: new Date(Date.now() + retryDelayMs),
			updatedAt: new Date(),
		},
	});
}

export async function cleanupUploadedReportScreenshot({
	uploadedFile,
	bucket,
	serviceRoleKey,
	supabaseOrigin,
}: {
	uploadedFile: StoredReportImage | null;
	bucket: string;
	serviceRoleKey: string;
	supabaseOrigin: string;
}) {
	if (!uploadedFile) return;
	await cleanupStoredReportImages({
		files: [uploadedFile],
		bucket,
		serviceRoleKey,
		supabaseOrigin,
	});
}
