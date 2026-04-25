import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import {
	isAuthorizedReportLabelingCronRequest,
	runAiReportLabelingJob,
} from "@/lib/ai-report-labeling";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
	if (
		!isAuthorizedReportLabelingCronRequest(request.headers.get("authorization"))
	) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const result = await runAiReportLabelingJob({ prisma });

		if (result.updatedReportIds.length > 0) {
			revalidateTag("reports", "max");
			revalidateTag("home-stats", "max");
			revalidatePath("/admin/report-statuses");
			revalidatePath("/admin");
			for (const reportId of result.updatedReportIds) {
				revalidatePath(`/reports/${reportId}`);
			}
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error("Failed to run AI report labeling cron:", error);
		return NextResponse.json(
			{ error: "AI report labeling failed" },
			{ status: 500 },
		);
	}
}
