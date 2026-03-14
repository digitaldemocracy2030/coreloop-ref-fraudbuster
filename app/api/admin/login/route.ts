import { NextResponse, type NextRequest } from "next/server";
import {
	authenticateAdminCredentials,
	setAdminSessionOnResponse,
} from "@/lib/admin-auth";
import { evaluateAdminLoginAttempt } from "@/lib/admin-login-guard";
import { getClientIp } from "@/lib/api-utils";

function toLoginRedirect(
	request: NextRequest,
	messageType: "error",
	message: string,
): NextResponse {
	const url = new URL("/admin/login", request.url);
	url.searchParams.set(messageType, message);
	return NextResponse.redirect(url, { status: 303 });
}

function tooManyRequestsResponse(retryAfterSeconds: number): NextResponse {
	return new NextResponse(
		"ログイン試行回数が上限に達しました。時間を置いて再試行してください。",
		{
			status: 429,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Retry-After": String(retryAfterSeconds),
			},
		},
	);
}

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const adminId =
			typeof formData.get("adminId") === "string"
				? String(formData.get("adminId")).trim()
				: typeof formData.get("email") === "string"
					? String(formData.get("email")).trim()
					: "";
		const password =
			typeof formData.get("password") === "string"
				? String(formData.get("password"))
				: "";
		const clientIp = getClientIp(request);

		const result = evaluateAdminLoginAttempt({
			email: adminId,
			password,
			ip: clientIp,
			authenticate: authenticateAdminCredentials,
		});
		if (result.status === "rate_limited") {
			return tooManyRequestsResponse(result.retryAfterSeconds);
		}
		if (result.status === "invalid") {
			return toLoginRedirect(request, "error", result.error);
		}

		const url = new URL("/admin", request.url);
		const response = NextResponse.redirect(url, { status: 303 });
		setAdminSessionOnResponse(response, result.sessionEmail);
		return response;
	} catch (error) {
		console.error("Admin login failed:", error);
		return toLoginRedirect(
			request,
			"error",
			"ログイン処理中にエラーが発生しました。",
		);
	}
}
