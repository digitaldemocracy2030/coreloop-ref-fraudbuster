import { revalidatePath, revalidateTag } from "next/cache";
import { errorResponse, successResponse } from "@/lib/api-utils";

function isAuthorized(request: Request): boolean {
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
	if (!serviceRoleKey) return false;

	const authorization = request.headers.get("authorization") ?? "";
	return authorization === `Bearer ${serviceRoleKey}`;
}

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return errorResponse("Not Found", 404);
	}

	const body = await request.json().catch(() => null);
	const reportId = typeof body?.reportId === "string" ? body.reportId : "";
	if (!reportId) {
		return errorResponse("reportId is required", 400);
	}

	revalidateTag("reports", "max");
	revalidateTag("home-stats", "max");
	revalidatePath(`/reports/${reportId}`);

	return successResponse({ ok: true });
}
