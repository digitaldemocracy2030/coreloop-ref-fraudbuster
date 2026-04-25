import { prisma } from "../lib/prisma.ts";
import { getReportScreenshotWorkerPollMs } from "../lib/report-screenshot-jobs.ts";
import { processNextReportScreenshotJob } from "../lib/report-screenshot-worker.ts";

const runOnce = process.argv.includes("--once");
let shouldStop = false;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestStop(signal: NodeJS.Signals) {
	console.log(
		`Received ${signal}; stopping screenshot worker after current job.`,
	);
	shouldStop = true;
}

process.on("SIGINT", requestStop);
process.on("SIGTERM", requestStop);

async function runWorker() {
	const pollMs = getReportScreenshotWorkerPollMs();

	do {
		const result = await processNextReportScreenshotJob({ prisma });
		if (result.processed) {
			if (result.status === "succeeded") {
				console.log(
					`Screenshot job succeeded: job=${result.jobId} report=${result.reportId}`,
				);
			} else {
				console.error(
					`Screenshot job failed: job=${result.jobId} report=${result.reportId} error=${result.error}`,
				);
			}
			continue;
		}

		if (!runOnce) {
			await sleep(pollMs);
		}
	} while (!runOnce && !shouldStop);
}

try {
	await runWorker();
} finally {
	await prisma.$disconnect();
}
