import { NextResponse, type NextRequest } from "next/server";
import { clearAdminSessionOnResponse } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
	const url = new URL("/admin/login", request.url);
	const response = NextResponse.redirect(url, { status: 303 });
	clearAdminSessionOnResponse(response);
	return response;
}
