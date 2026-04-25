import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../app/generated/prisma/client.ts";

const {
	claimNextReportScreenshotJob,
	getReportScreenshotRetryDelayMs,
	parsePositiveIntegerEnv,
	sanitizeReportScreenshotJobError,
} = await import(new URL("./report-screenshot-jobs.ts", import.meta.url).href);

test("parses positive integer env values with a safe default", () => {
	assert.equal(parsePositiveIntegerEnv("2500", 5000), 2500);
	assert.equal(parsePositiveIntegerEnv("0", 5000), 5000);
	assert.equal(parsePositiveIntegerEnv("-1", 5000), 5000);
	assert.equal(parsePositiveIntegerEnv("abc", 5000), 5000);
	assert.equal(parsePositiveIntegerEnv(undefined, 5000), 5000);
});

test("calculates bounded retry delays from the current attempt count", () => {
	assert.equal(getReportScreenshotRetryDelayMs(1), 60_000);
	assert.equal(getReportScreenshotRetryDelayMs(2), 120_000);
	assert.equal(getReportScreenshotRetryDelayMs(10), 15 * 60 * 1000);
});

test("sanitizes long job errors before storing them", () => {
	const message = sanitizeReportScreenshotJobError(new Error("x".repeat(1200)));
	assert.equal(message.length, 1000);
});

test("claims the next screenshot job using a skip-locked update", async () => {
	let renderedSql = "";
	const prisma = {
		$queryRaw: async (strings: TemplateStringsArray) => {
			renderedSql = strings.join("?");
			return [
				{
					id: "job-1",
					report_id: "report-1",
					url: "https://public.example",
					status: "RUNNING",
					attempts: 1,
				},
			];
		},
	} as unknown as Pick<PrismaClient, "$queryRaw">;

	const job = await claimNextReportScreenshotJob({
		prisma,
		maxAttempts: 3,
		lockTimeoutMs: 1000,
	});

	assert.deepEqual(job, {
		id: "job-1",
		reportId: "report-1",
		url: "https://public.example",
		status: "RUNNING",
		attempts: 1,
	});
	assert.match(renderedSql, /FOR UPDATE SKIP LOCKED/);
	assert.match(renderedSql, /attempts = attempts \+ 1/);
});
