const MAX_FAILURES_BEFORE_COOLDOWN = 5;
const INITIAL_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;
const ENTRY_TTL_MS = 24 * 60 * 60_000;

type AdminLoginAttemptState = {
	failureCount: number;
	blockedUntil: number;
	lastAttemptAt: number;
};

type AdminLoginRateLimitResult = {
	allowed: boolean;
	retryAfterSeconds: number;
};

const attemptStore = new Map<string, AdminLoginAttemptState>();

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function normalizeIp(ip: string | null | undefined): string {
	const value = ip?.trim();
	return value ? value : "unknown";
}

function buildAttemptKey(email: string, ip: string | null | undefined): string {
	return `${normalizeEmail(email)}::${normalizeIp(ip)}`;
}

function getNow(now?: number): number {
	return now ?? Date.now();
}

function getRetryAfterSeconds(blockedUntil: number, now: number): number {
	return Math.max(1, Math.ceil((blockedUntil - now) / 1000));
}

function getCooldownMs(failureCount: number): number {
	const exponent = Math.max(0, failureCount - MAX_FAILURES_BEFORE_COOLDOWN);
	return Math.min(INITIAL_COOLDOWN_MS * 2 ** exponent, MAX_COOLDOWN_MS);
}

function pruneExpiredEntries(now: number): void {
	for (const [key, state] of attemptStore.entries()) {
		if (now - state.lastAttemptAt > ENTRY_TTL_MS && state.blockedUntil <= now) {
			attemptStore.delete(key);
		}
	}
}

export function getAdminLoginRateLimit(
	email: string,
	ip: string | null | undefined,
	now?: number,
): AdminLoginRateLimitResult {
	const currentTime = getNow(now);
	pruneExpiredEntries(currentTime);

	const state = attemptStore.get(buildAttemptKey(email, ip));
	if (!state || state.blockedUntil <= currentTime) {
		return { allowed: true, retryAfterSeconds: 0 };
	}

	return {
		allowed: false,
		retryAfterSeconds: getRetryAfterSeconds(state.blockedUntil, currentTime),
	};
}

export function recordAdminLoginFailure(
	email: string,
	ip: string | null | undefined,
	now?: number,
): AdminLoginRateLimitResult {
	const currentTime = getNow(now);
	pruneExpiredEntries(currentTime);

	const key = buildAttemptKey(email, ip);
	const previousState = attemptStore.get(key);
	const failureCount = (previousState?.failureCount ?? 0) + 1;
	const blockedUntil =
		failureCount >= MAX_FAILURES_BEFORE_COOLDOWN
			? currentTime + getCooldownMs(failureCount)
			: 0;

	attemptStore.set(key, {
		failureCount,
		blockedUntil,
		lastAttemptAt: currentTime,
	});

	if (blockedUntil > currentTime) {
		console.warn("Admin login locked due to repeated failures", {
			email: normalizeEmail(email),
			ip: normalizeIp(ip),
			failureCount,
			retryAfterSeconds: getRetryAfterSeconds(blockedUntil, currentTime),
		});
	} else {
		console.warn("Admin login failed", {
			email: normalizeEmail(email),
			ip: normalizeIp(ip),
			failureCount,
		});
	}

	return getAdminLoginRateLimit(email, ip, currentTime);
}

export function clearAdminLoginFailures(
	email: string,
	ip: string | null | undefined,
): void {
	attemptStore.delete(buildAttemptKey(email, ip));
}

export function resetAdminLoginRateLimitStoreForTests(): void {
	attemptStore.clear();
}
