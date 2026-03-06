import { createHmac, timingSafeEqual } from "node:crypto";
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

export type ReportSessionPayload = {
	sessionId: string;
	iat: number;
};

const DEV_FALLBACK_REPORT_SESSION_SECRET =
	"development-only-report-session-secret-change-me";
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function resolveReportSessionSecret(): string {
	const secret = process.env.REPORT_SESSION_SECRET?.trim();
	if (secret) return secret;
	if (process.env.NODE_ENV !== "production") {
		return DEV_FALLBACK_REPORT_SESSION_SECRET;
	}
	throw new Error("REPORT_SESSION_SECRET is not set.");
}

const SESSION_SECRET = resolveReportSessionSecret();

export function createReportSessionToken(sessionId: string): string {
	const payload: ReportSessionPayload = {
		sessionId,
		iat: Date.now(),
	};
	const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const hmac = createHmac("sha256", SESSION_SECRET);
	hmac.update(payloadStr);
	const signature = hmac.digest("base64url");
	return `${payloadStr}.${signature}`;
}

export function verifyReportSessionToken(
	token: string,
): ReportSessionPayload | null {
	const parts = token.split(".");
	if (parts.length !== 2) return null;

	const [payloadStr, signature] = parts;
	const hmac = createHmac("sha256", SESSION_SECRET);
	hmac.update(payloadStr);
	const expectedSignature = hmac.digest("base64url");

	// Timing safe comparison to prevent timing attacks
	const signatureBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expectedSignature);

	if (signatureBuffer.length !== expectedBuffer.length) return null;
	if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

	try {
		const payload = JSON.parse(
			Buffer.from(payloadStr, "base64url").toString("utf8"),
		) as ReportSessionPayload;

		// Expiry check
		if (Date.now() - payload.iat > TOKEN_EXPIRY_MS) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

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
