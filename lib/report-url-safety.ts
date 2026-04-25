import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export type LookupHostname = (hostname: string) => Promise<string[]>;

const PRIVATE_ADDRESS_BLOCKLIST = (() => {
	const blockList = new BlockList();

	blockList.addSubnet("0.0.0.0", 8, "ipv4");
	blockList.addSubnet("10.0.0.0", 8, "ipv4");
	blockList.addSubnet("100.64.0.0", 10, "ipv4");
	blockList.addSubnet("127.0.0.0", 8, "ipv4");
	blockList.addSubnet("169.254.0.0", 16, "ipv4");
	blockList.addSubnet("172.16.0.0", 12, "ipv4");
	blockList.addSubnet("192.0.0.0", 24, "ipv4");
	blockList.addSubnet("192.0.2.0", 24, "ipv4");
	blockList.addSubnet("192.168.0.0", 16, "ipv4");
	blockList.addSubnet("198.18.0.0", 15, "ipv4");
	blockList.addSubnet("198.51.100.0", 24, "ipv4");
	blockList.addSubnet("203.0.113.0", 24, "ipv4");
	blockList.addSubnet("224.0.0.0", 4, "ipv4");
	blockList.addSubnet("240.0.0.0", 4, "ipv4");

	blockList.addAddress("::", "ipv6");
	blockList.addAddress("::1", "ipv6");
	blockList.addSubnet("fc00::", 7, "ipv6");
	blockList.addSubnet("fe80::", 10, "ipv6");
	blockList.addSubnet("fec0::", 10, "ipv6");
	blockList.addSubnet("ff00::", 8, "ipv6");
	blockList.addSubnet("2001:db8::", 32, "ipv6");

	return blockList;
})();

export function normalizeHostname(hostname: string): string {
	const normalized = hostname.trim().toLowerCase();
	return normalized.endsWith(".") ? normalized.slice(0, -1) : normalized;
}

function getIpFamily(address: string): "ipv4" | "ipv6" | null {
	const normalized = normalizeHostname(address);
	const version = isIP(normalized);
	if (version === 4) return "ipv4";
	if (version === 6) return "ipv6";
	return null;
}

function unwrapMappedIpv4(address: string): string | null {
	const normalized = normalizeHostname(address);
	const match = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
	return match?.[1] ?? null;
}

export function isPrivateIpAddress(address: string): boolean {
	const mappedIpv4 = unwrapMappedIpv4(address);
	if (mappedIpv4) {
		return isPrivateIpAddress(mappedIpv4);
	}

	const family = getIpFamily(address);
	if (!family) return true;
	return PRIVATE_ADDRESS_BLOCKLIST.check(normalizeHostname(address), family);
}

export function isPrivateHostname(hostname: string): boolean {
	const host = normalizeHostname(hostname);
	if (!host) return true;

	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local")
	) {
		return true;
	}

	const family = getIpFamily(host);
	if (family) {
		return isPrivateIpAddress(host);
	}

	return host.includes(":");
}

export async function defaultLookupHostname(
	hostname: string,
): Promise<string[]> {
	const records = await lookup(normalizeHostname(hostname), {
		all: true,
		verbatim: true,
	});
	return records.map((record) => record.address);
}

export async function hostnameResolvesToPublicAddress(
	hostname: string,
	lookupHostname: LookupHostname = defaultLookupHostname,
): Promise<boolean> {
	const normalizedHost = normalizeHostname(hostname);
	if (!normalizedHost) return false;
	if (isPrivateHostname(normalizedHost)) return false;

	const family = getIpFamily(normalizedHost);
	if (family) {
		return !isPrivateIpAddress(normalizedHost);
	}

	try {
		const addresses = await lookupHostname(normalizedHost);
		if (addresses.length === 0) return false;
		return addresses.every((address) => !isPrivateIpAddress(address));
	} catch {
		return false;
	}
}

export function parsePublicHttpUrl(value: string): URL | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
	if (!hasScheme && !trimmed.includes(".")) return null;

	try {
		const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		if (parsed.username || parsed.password) {
			return null;
		}
		if (isPrivateHostname(parsed.hostname)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export async function validatePublicHttpUrl(
	url: URL,
	lookupHostname: LookupHostname = defaultLookupHostname,
): Promise<boolean> {
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return false;
	}
	if (url.username || url.password) {
		return false;
	}
	return hostnameResolvesToPublicAddress(url.hostname, lookupHostname);
}

export async function resolveSafePublicHttpUrl(
	value: string,
	lookupHostname: LookupHostname = defaultLookupHostname,
): Promise<URL | null> {
	const parsed = parsePublicHttpUrl(value);
	if (!parsed) return null;
	const isSafe = await validatePublicHttpUrl(parsed, lookupHostname);
	return isSafe ? parsed : null;
}
