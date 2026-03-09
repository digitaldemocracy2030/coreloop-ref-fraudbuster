import {
	clearAdminLoginFailures,
	getAdminLoginRateLimit,
	recordAdminLoginFailure,
} from "./admin-login-rate-limit.ts";

type AdminAuthenticatorResult = {
	ok: boolean;
	error?: string;
};

type AdminAuthenticator = (
	email: string,
	password: string,
) => AdminAuthenticatorResult;

export type AdminLoginAttemptResult =
	| { status: "success"; sessionEmail: string }
	| { status: "invalid"; error: string }
	| { status: "rate_limited"; retryAfterSeconds: number };

type EvaluateAdminLoginAttemptOptions = {
	email: string;
	password: string;
	ip: string | null;
	authenticate: AdminAuthenticator;
};

export function evaluateAdminLoginAttempt({
	email,
	password,
	ip,
	authenticate,
}: EvaluateAdminLoginAttemptOptions): AdminLoginAttemptResult {
	const rateLimit = getAdminLoginRateLimit(email, ip);
	if (!rateLimit.allowed) {
		console.warn("Admin login rejected during cooldown", {
			email: email.trim().toLowerCase(),
			ip: ip?.trim() || "unknown",
			retryAfterSeconds: rateLimit.retryAfterSeconds,
		});
		return {
			status: "rate_limited",
			retryAfterSeconds: rateLimit.retryAfterSeconds,
		};
	}

	const result = authenticate(email, password);
	if (!result.ok) {
		const failedRateLimit = recordAdminLoginFailure(email, ip);
		if (!failedRateLimit.allowed) {
			return {
				status: "rate_limited",
				retryAfterSeconds: failedRateLimit.retryAfterSeconds,
			};
		}
		return {
			status: "invalid",
			error: result.error ?? "ログインに失敗しました。",
		};
	}

	clearAdminLoginFailures(email, ip);
	return {
		status: "success",
		sessionEmail: email.trim().toLowerCase(),
	};
}
