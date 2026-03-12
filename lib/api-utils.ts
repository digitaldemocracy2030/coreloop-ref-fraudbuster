import { NextResponse } from "next/server";

export type ApiErrorResponse = {
	error: string;
	message?: string;
};

export function successResponse<T>(data: T, status = 200) {
	return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 500) {
	return NextResponse.json({ error: message }, { status });
}

export function badRequestResponse(message = "Bad Request") {
	return errorResponse(message, 400);
}

export function notFoundResponse(message = "Not Found") {
	return errorResponse(message, 404);
}

export type TurnstileVerificationResult = {
	success: boolean;
	errorCodes: string[];
};

export function normalizeIp(value: string | null): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	// NextRequest headers might sometimes contain standard IPs
	const isIP = (ip: string) =>
		/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/.test(ip) ||
		/^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$/.test(ip) ||
		/^([0-9a-fA-F]{1,4}:){1,7}:/.test(ip);

	if (isIP(trimmed)) return trimmed;

	const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
	if (ipv4WithPort && isIP(ipv4WithPort[1])) {
		return ipv4WithPort[1];
	}

	const ipv6WithPort = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
	if (ipv6WithPort && isIP(ipv6WithPort[1])) {
		return ipv6WithPort[1];
	}

	return null;
}

export function getClientIp(request: {
	headers: { get: (name: string) => string | null };
}): string | null {
	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		const first = forwardedFor.split(",")[0] ?? "";
		const normalized = normalizeIp(first);
		if (normalized) return normalized;
	}

	return normalizeIp(request.headers.get("x-real-ip"));
}

const TURNSTILE_VERIFY_ENDPOINT =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
	token: string,
	clientIp: string | null,
): Promise<TurnstileVerificationResult> {
	const secretKey = process.env.TURNSTILE_SECRET_KEY;
	if (!secretKey) {
		console.error("TURNSTILE_SECRET_KEY is not set");
		return { success: false, errorCodes: ["missing-secret-key"] };
	}

	const body = new URLSearchParams({
		secret: secretKey,
		response: token,
	});
	if (clientIp) {
		body.set("remoteip", clientIp);
	}

	try {
		const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
			cache: "no-store",
		});

		if (!response.ok) {
			return { success: false, errorCodes: ["turnstile-http-error"] };
		}

		const payload = (await response.json()) as {
			success?: boolean;
			"error-codes"?: string[];
		};

		return {
			success: payload.success === true,
			errorCodes: Array.isArray(payload["error-codes"])
				? payload["error-codes"]
				: [],
		};
	} catch (error) {
		console.error("Turnstile verification failed:", error);
		return { success: false, errorCodes: ["turnstile-request-failed"] };
	}
}
