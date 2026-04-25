import assert from "node:assert/strict";
import test from "node:test";

const {
	isPrivateHostname,
	parsePublicHttpUrl,
	resolveSafePublicHttpUrl,
	validatePublicHttpUrl,
} = await import(new URL("./report-url-safety.ts", import.meta.url).href);

function createLookupHostname(records: Record<string, string[]>) {
	return async (hostname: string): Promise<string[]> => records[hostname] ?? [];
}

test("rejects non-public screenshot target URL shapes before DNS lookup", async () => {
	assert.equal(parsePublicHttpUrl("javascript:alert(1)"), null);
	assert.equal(parsePublicHttpUrl("https://user:pass@example.com"), null);
	assert.equal(parsePublicHttpUrl("http://127.0.0.1/admin"), null);
	assert.equal(parsePublicHttpUrl("http://localhost/admin"), null);
	assert.equal(parsePublicHttpUrl("http://service.local/admin"), null);
	assert.equal(isPrivateHostname("::ffff:127.0.0.1"), true);
});

test("requires DNS resolution to public addresses", async () => {
	const lookupHostname = createLookupHostname({
		"public.example": ["93.184.216.34"],
		"private.example": ["10.0.0.4"],
		"mixed.example": ["93.184.216.34", "127.0.0.1"],
	});

	assert.equal(
		await validatePublicHttpUrl(
			new URL("https://public.example"),
			lookupHostname,
		),
		true,
	);
	assert.equal(
		await resolveSafePublicHttpUrl("https://private.example", lookupHostname),
		null,
	);
	assert.equal(
		await resolveSafePublicHttpUrl("https://mixed.example", lookupHostname),
		null,
	);
});
