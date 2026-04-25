import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../app/generated/prisma/client.ts";

const { processNextReportScreenshotJob } = await import(
	new URL("./report-screenshot-worker.ts", import.meta.url).href
);

type JobUpdateArgs = {
	where: { id: string };
	data: {
		status: string;
		lockedAt: null;
		lastError: string;
		nextRunAt: Date;
		updatedAt: Date;
	};
};

function createLookupHostname(records: Record<string, string[]>) {
	return async (hostname: string): Promise<string[]> => records[hostname] ?? [];
}

function restoreEnvValue(key: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[key];
		return;
	}
	process.env[key] = value;
}

function createClaimingPrisma({
	transaction,
	onJobUpdate,
}: {
	transaction: (
		callback: (tx: unknown) => Promise<unknown>,
	) => Promise<unknown>;
	onJobUpdate?: (args: unknown) => void;
}) {
	return {
		$queryRaw: async () => [
			{
				id: "job-1",
				report_id: "report-1",
				url: "https://public.example",
				status: "RUNNING",
				attempts: 1,
			},
		],
		$transaction: transaction,
		reportScreenshotJob: {
			update: async (args: unknown) => {
				onJobUpdate?.(args);
				return {};
			},
		},
	} as unknown as PrismaClient;
}

test("processes a claimed screenshot job and stores the resulting image", async () => {
	const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	delete process.env.SUPABASE_SERVICE_ROLE_KEY;
	const calls: string[] = [];
	const prisma = createClaimingPrisma({
		transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({
				reportImage: {
					aggregate: async () => ({ _max: { displayOrder: 2 } }),
					create: async (args: { data: { displayOrder: number } }) => {
						assert.equal(args.data.displayOrder, 3);
						calls.push("image:create");
						return { id: "image-1" };
					},
				},
				reportScreenshotJob: {
					update: async (args: {
						data: { status: string; imageId: string };
					}) => {
						assert.equal(args.data.status, "SUCCEEDED");
						assert.equal(args.data.imageId, "image-1");
						calls.push("job:succeeded");
						return {};
					},
				},
				reportTimeline: {
					create: async () => {
						calls.push("timeline:create");
						return {};
					},
				},
			}),
	});

	try {
		const result = await processNextReportScreenshotJob({
			prisma,
			lookupHostname: createLookupHostname({
				"public.example": ["93.184.216.34"],
			}),
			captureScreenshot: async () => Buffer.from("screenshot"),
			storeScreenshot: async () => ({
				path: "reports/report-1/auto-screenshot/image.jpg",
				publicUrl: "https://storage.example/report-1/image.jpg",
				contentType: "image/jpeg",
				size: 10,
			}),
			maxAttempts: 3,
			timeoutMs: 1000,
		});

		assert.deepEqual(result, {
			processed: true,
			status: "succeeded",
			jobId: "job-1",
			reportId: "report-1",
		});
		assert.deepEqual(calls, [
			"image:create",
			"job:succeeded",
			"timeline:create",
		]);
	} finally {
		restoreEnvValue("SUPABASE_SERVICE_ROLE_KEY", originalServiceRoleKey);
	}
});

test("cleans up an uploaded screenshot when database registration fails", async () => {
	const originalFetch = globalThis.fetch;
	const originalSupabaseUrl = process.env.SUPABASE_URL;
	const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const deletedUrls: string[] = [];
	let failedJobUpdate: JobUpdateArgs | null = null;

	process.env.SUPABASE_URL = "https://supabase.example";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		deletedUrls.push(String(input));
		return new Response(null, { status: 200 });
	}) as typeof fetch;

	try {
		const prisma = createClaimingPrisma({
			transaction: async () => {
				throw new Error("database write failed");
			},
			onJobUpdate: (args) => {
				failedJobUpdate = args as NonNullable<typeof failedJobUpdate>;
			},
		});

		const result = await processNextReportScreenshotJob({
			prisma,
			lookupHostname: createLookupHostname({
				"public.example": ["93.184.216.34"],
			}),
			captureScreenshot: async () => Buffer.from("screenshot"),
			storeScreenshot: async () => ({
				path: "reports/report-1/auto-screenshot/image.jpg",
				publicUrl:
					"https://supabase.example/storage/v1/object/public/report-screenshots/reports/report-1/auto-screenshot/image.jpg",
				contentType: "image/jpeg",
				size: 10,
			}),
			maxAttempts: 3,
			timeoutMs: 1000,
		});

		assert.equal(result.processed, true);
		assert.equal(result.status, "failed");
		assert.deepEqual(deletedUrls, [
			"https://supabase.example/storage/v1/object/report-screenshots/reports/report-1/auto-screenshot/image.jpg",
		]);
		assert.ok(failedJobUpdate);
		const update = failedJobUpdate as JobUpdateArgs;
		assert.deepEqual(
			{
				...update,
				data: {
					...update.data,
					nextRunAt: update.data.nextRunAt instanceof Date,
					updatedAt: update.data.updatedAt instanceof Date,
				},
			},
			{
				where: { id: "job-1" },
				data: {
					status: "QUEUED",
					lockedAt: null,
					lastError: "database write failed",
					nextRunAt: true,
					updatedAt: true,
				},
			},
		);
	} finally {
		globalThis.fetch = originalFetch;
		restoreEnvValue("SUPABASE_URL", originalSupabaseUrl);
		restoreEnvValue("SUPABASE_SERVICE_ROLE_KEY", originalServiceRoleKey);
	}
});
