import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const GENERIC_LOGIN_ERROR_MESSAGE =
	"メールアドレスまたはパスワードが正しくありません。";
const DEV_FALLBACK_SESSION_SECRET =
	"development-only-admin-session-secret-change-me";

type AdminSessionPayload = {
	email: string;
	exp: number;
};

export type AdminSession = {
	email: string;
};

type AdminSessionCookieOptions = {
	httpOnly: true;
	secure: boolean;
	sameSite: "lax";
	path: "/";
	maxAge: number;
};

function getConfiguredAdminEmail(): string | null {
	const value =
		process.env.ADMIN_LOGIN_EMAIL?.trim() ?? process.env.ADMIN_EMAIL?.trim();
	if (!value) return null;
	return value.toLowerCase();
}

function getConfiguredAdminPassword(): string | null {
	const value =
		process.env.ADMIN_LOGIN_PASSWORD?.trim() ??
		process.env.ADMIN_PASSWORD?.trim();
	if (!value) return null;
	return value;
}

function constantTimeEquals(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	if (leftBuffer.length !== rightBuffer.length) {
		return false;
	}
	return timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveSessionSecret(): string | null {
	const secret = process.env.ADMIN_SESSION_SECRET?.trim();
	if (secret) return secret;
	if (process.env.NODE_ENV !== "production") {
		return DEV_FALLBACK_SESSION_SECRET;
	}
	return null;
}

function getSessionCookieOptions(maxAge: number): AdminSessionCookieOptions {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge,
	};
}

function signTokenPart(encodedPayload: string, secret: string): string {
	return createHmac("sha256", secret)
		.update(encodedPayload)
		.digest("base64url");
}

function createSessionToken(email: string, secret: string): string {
	const payload: AdminSessionPayload = {
		email,
		exp: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
		"base64url",
	);
	const signature = signTokenPart(encodedPayload, secret);
	return `${encodedPayload}.${signature}`;
}

function parseSessionToken(
	token: string,
	secret: string,
): AdminSessionPayload | null {
	const parts = token.split(".");
	if (parts.length !== 2) return null;
	const [encodedPayload, providedSignature] = parts;
	if (!encodedPayload || !providedSignature) return null;

	const expectedSignature = signTokenPart(encodedPayload, secret);
	if (!constantTimeEquals(providedSignature, expectedSignature)) {
		return null;
	}

	try {
		const decodedJson = Buffer.from(encodedPayload, "base64url").toString(
			"utf-8",
		);
		const payload = JSON.parse(decodedJson) as Partial<AdminSessionPayload>;
		if (typeof payload.email !== "string" || !payload.email.trim()) {
			return null;
		}
		if (typeof payload.exp !== "number" || payload.exp <= Date.now()) {
			return null;
		}
		return { email: payload.email, exp: payload.exp };
	} catch {
		return null;
	}
}

export function isAdminLoginConfigured(): boolean {
	return Boolean(getConfiguredAdminEmail() && getConfiguredAdminPassword());
}

export function authenticateAdminCredentials(
	email: string,
	password: string,
): { ok: boolean; error?: string } {
	const configuredEmail = getConfiguredAdminEmail();
	const configuredPassword = getConfiguredAdminPassword();
	if (!configuredEmail || !configuredPassword) {
		return {
			ok: false,
			error:
				"管理者ログインが未設定です。`ADMIN_LOGIN_EMAIL` と `ADMIN_LOGIN_PASSWORD` を設定してください。",
		};
	}

	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail || !password) {
		return { ok: false, error: GENERIC_LOGIN_ERROR_MESSAGE };
	}

	const isEmailValid = constantTimeEquals(normalizedEmail, configuredEmail);
	const isPasswordValid = constantTimeEquals(password, configuredPassword);
	if (!isEmailValid || !isPasswordValid) {
		return { ok: false, error: GENERIC_LOGIN_ERROR_MESSAGE };
	}

	return { ok: true };
}

export async function setAdminSession(email: string): Promise<void> {
	const sessionSecret = resolveSessionSecret();
	if (!sessionSecret) {
		throw new Error("ADMIN_SESSION_SECRET is not set.");
	}

	const cookieStore = await cookies();
	const token = createSessionToken(email.trim().toLowerCase(), sessionSecret);
	cookieStore.set(
		ADMIN_SESSION_COOKIE_NAME,
		token,
		getSessionCookieOptions(ADMIN_SESSION_MAX_AGE_SECONDS),
	);
}

export async function clearAdminSession(): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
}

export function getAdminSessionFromToken(
	token: string | null | undefined,
): AdminSession | null {
	const sessionSecret = resolveSessionSecret();
	if (!sessionSecret || !token) return null;
	const payload = parseSessionToken(token, sessionSecret);
	if (!payload) return null;
	return { email: payload.email };
}

export function getAdminSessionFromRequest(
	request: Pick<NextRequest, "cookies">,
): AdminSession | null {
	return getAdminSessionFromToken(
		request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value,
	);
}

export function setAdminSessionOnResponse(
	response: NextResponse,
	email: string,
): void {
	const sessionSecret = resolveSessionSecret();
	if (!sessionSecret) {
		throw new Error("ADMIN_SESSION_SECRET is not set.");
	}
	const token = createSessionToken(email.trim().toLowerCase(), sessionSecret);
	response.cookies.set(
		ADMIN_SESSION_COOKIE_NAME,
		token,
		getSessionCookieOptions(ADMIN_SESSION_MAX_AGE_SECONDS),
	);
}

export function clearAdminSessionOnResponse(response: NextResponse): void {
	response.cookies.set(
		ADMIN_SESSION_COOKIE_NAME,
		"",
		getSessionCookieOptions(0),
	);
}

export async function getAdminSession(): Promise<AdminSession | null> {
	const cookieStore = await cookies();
	return getAdminSessionFromToken(
		cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value,
	);
}

export async function requireAdminSession(): Promise<AdminSession> {
	const session = await getAdminSession();
	if (!session) {
		redirect("/admin/login");
	}
	return session;
}
