import assert from "node:assert/strict";
import test from "node:test";

const { evaluateAdminLoginAttempt } = await import(
	new URL("./admin-login-guard.ts", import.meta.url).href
);
const {
	getAdminLoginRateLimit,
	recordAdminLoginFailure,
	resetAdminLoginRateLimitStoreForTests,
} = await import(new URL("./admin-login-rate-limit.ts", import.meta.url).href);

test.beforeEach(() => {
	resetAdminLoginRateLimitStoreForTests();
});

test.after(() => {
	resetAdminLoginRateLimitStoreForTests();
});

test("locks the account after repeated failures and returns retry metadata", () => {
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const result = recordAdminLoginFailure(
			"admin@example.com",
			"203.0.113.10",
			1_000 + attempt,
		);
		assert.equal(result.allowed, true);
		assert.equal(result.retryAfterSeconds, 0);
	}

	const locked = recordAdminLoginFailure(
		"admin@example.com",
		"203.0.113.10",
		2_000,
	);

	assert.equal(locked.allowed, false);
	assert.equal(locked.retryAfterSeconds, 60);
	assert.deepEqual(
		getAdminLoginRateLimit("admin@example.com", "203.0.113.10", 2_001),
		{
			allowed: false,
			retryAfterSeconds: 60,
		},
	);
});

test("rejects even correct credentials while cooldown is active", () => {
	const ip = "203.0.113.10";

	for (let attempt = 0; attempt < 5; attempt += 1) {
		evaluateAdminLoginAttempt({
			email: "admin@example.com",
			password: "wrong-password",
			ip,
			authenticate: () => ({
				ok: false,
				error: "メールアドレスまたはパスワードが正しくありません。",
			}),
		});
	}

	const blockedAttempt = evaluateAdminLoginAttempt({
		email: "admin@example.com",
		password: "correct-password",
		ip,
		authenticate: () => ({ ok: true }),
	});

	assert.deepEqual(blockedAttempt, {
		status: "rate_limited",
		retryAfterSeconds: 60,
	});
});
