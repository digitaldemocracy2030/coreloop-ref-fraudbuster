import { NextResponse, type NextRequest } from "next/server";
import {
	authenticateAdminCredentials,
	setAdminSessionOnResponse,
} from "@/lib/admin-auth";

function toLoginRedirect(
	request: NextRequest,
	messageType: "error",
	message: string,
): NextResponse {
	const url = new URL("/admin/login", request.url);
	url.searchParams.set(messageType, message);
	return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const email =
			typeof formData.get("email") === "string"
				? String(formData.get("email")).trim()
				: "";
		const password =
			typeof formData.get("password") === "string"
				? String(formData.get("password"))
				: "";

		const result = authenticateAdminCredentials(email, password);
		if (!result.ok) {
			return toLoginRedirect(
				request,
				"error",
				result.error ?? "ログインに失敗しました。",
			);
		}

		const url = new URL("/admin", request.url);
		const response = NextResponse.redirect(url, { status: 303 });
		setAdminSessionOnResponse(response, email.toLowerCase());
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
