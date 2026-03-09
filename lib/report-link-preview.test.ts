import assert from "node:assert/strict";
import test from "node:test";

const { fetchReportLinkPreview, fetchSafeExternalImage } = await import(
	new URL("./report-link-preview.ts", import.meta.url).href
);

function createLookupHostname(records: Record<string, string[]>) {
	return async (hostname: string): Promise<string[]> => records[hostname] ?? [];
}

test("follows a safe redirect chain and extracts preview metadata", async () => {
	const fetchCalls: string[] = [];
	const fetchFn: typeof fetch = async (input, init) => {
		const url = String(input);
		fetchCalls.push(url);
		assert.equal(init?.redirect, "manual");

		if (url === "https://public.example/start") {
			return new Response(null, {
				status: 302,
				headers: { location: "/final" },
			});
		}

		if (url === "https://public.example/final") {
			return new Response(
				`<html><head><title>Safe Preview</title><meta property="og:image" content="/thumb.png" /></head></html>`,
				{
					status: 200,
					headers: { "content-type": "text/html; charset=utf-8" },
				},
			);
		}

		assert.fail(`unexpected fetch to ${url}`);
	};
	const preview = await fetchReportLinkPreview("https://public.example/start", {
		lookupHostname: createLookupHostname({
			"public.example": ["93.184.216.34"],
		}),
		fetchFn,
	});

	assert.deepEqual(preview, {
		title: "Safe Preview",
		thumbnailUrl: "https://public.example/thumb.png",
	});
	assert.deepEqual(fetchCalls, [
		"https://public.example/start",
		"https://public.example/final",
	]);
});

test("blocks redirects to an explicit private IP target", async () => {
	const fetchCalls: string[] = [];
	const fetchFn: typeof fetch = async (input) => {
		const url = String(input);
		fetchCalls.push(url);

		if (url === "https://public.example/start") {
			return new Response(null, {
				status: 302,
				headers: { location: "http://127.0.0.1/private" },
			});
		}

		assert.fail(`unexpected fetch to ${url}`);
	};
	const preview = await fetchReportLinkPreview("https://public.example/start", {
		lookupHostname: createLookupHostname({
			"public.example": ["93.184.216.34"],
		}),
		fetchFn,
	});

	assert.deepEqual(preview, {
		title: null,
		thumbnailUrl: null,
	});
	assert.deepEqual(fetchCalls, ["https://public.example/start"]);
});

test("blocks redirects when the next hostname resolves to a private address", async () => {
	const fetchCalls: string[] = [];
	const fetchFn: typeof fetch = async (input) => {
		const url = String(input);
		fetchCalls.push(url);

		if (url === "https://public.example/start") {
			return new Response(null, {
				status: 302,
				headers: { location: "https://redirected.example/private" },
			});
		}

		assert.fail(`unexpected fetch to ${url}`);
	};
	const preview = await fetchReportLinkPreview("https://public.example/start", {
		lookupHostname: createLookupHostname({
			"public.example": ["93.184.216.34"],
			"redirected.example": ["127.0.0.1"],
		}),
		fetchFn,
	});

	assert.deepEqual(preview, {
		title: null,
		thumbnailUrl: null,
	});
	assert.deepEqual(fetchCalls, ["https://public.example/start"]);
});

test("stops after exceeding the redirect hop limit", async () => {
	const fetchCalls: string[] = [];
	const fetchFn: typeof fetch = async (input) => {
		const url = String(input);
		fetchCalls.push(url);
		const hop = Number.parseInt(url.match(/hop-(\d+)$/)?.[1] ?? "", 10);
		assert.equal(Number.isNaN(hop), false);

		return new Response(null, {
			status: 302,
			headers: { location: `/hop-${hop + 1}` },
		});
	};
	const preview = await fetchReportLinkPreview("https://public.example/hop-0", {
		lookupHostname: createLookupHostname({
			"public.example": ["93.184.216.34"],
		}),
		fetchFn,
	});

	assert.deepEqual(preview, {
		title: null,
		thumbnailUrl: null,
	});
	assert.deepEqual(fetchCalls, [
		"https://public.example/hop-0",
		"https://public.example/hop-1",
		"https://public.example/hop-2",
		"https://public.example/hop-3",
		"https://public.example/hop-4",
	]);
});

test("fetchSafeExternalImage follows a safe redirect chain", async () => {
	const fetchCalls: string[] = [];
	const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
	const fetchFn: typeof fetch = async (input, init) => {
		const url = String(input);
		fetchCalls.push(url);
		assert.equal(init?.redirect, "manual");

		if (url === "https://public.example/start.png") {
			return new Response(null, {
				status: 302,
				headers: { location: "/final.png" },
			});
		}

		if (url === "https://public.example/final.png") {
			return new Response(pngBytes, {
				status: 200,
				headers: { "content-type": "image/png" },
			});
		}

		assert.fail(`unexpected fetch to ${url}`);
	};

	const image = await fetchSafeExternalImage(
		"https://public.example/start.png",
		{
			lookupHostname: createLookupHostname({
				"public.example": ["93.184.216.34"],
			}),
			fetchFn,
		},
	);

	assert.ok(image);
	assert.deepEqual(Array.from(image.buffer), Array.from(pngBytes));
	assert.equal(image.contentType, "image/png");
	assert.equal(image.finalUrl, "https://public.example/final.png");
	assert.deepEqual(fetchCalls, [
		"https://public.example/start.png",
		"https://public.example/final.png",
	]);
});

test("fetchSafeExternalImage blocks redirects to private targets", async () => {
	const fetchCalls: string[] = [];
	const fetchFn: typeof fetch = async (input) => {
		const url = String(input);
		fetchCalls.push(url);

		if (url === "https://public.example/start.png") {
			return new Response(null, {
				status: 302,
				headers: { location: "http://127.0.0.1/private.png" },
			});
		}

		assert.fail(`unexpected fetch to ${url}`);
	};

	const image = await fetchSafeExternalImage(
		"https://public.example/start.png",
		{
			lookupHostname: createLookupHostname({
				"public.example": ["93.184.216.34"],
			}),
			fetchFn,
		},
	);

	assert.equal(image, null);
	assert.deepEqual(fetchCalls, ["https://public.example/start.png"]);
});

test("fetchSafeExternalImage rejects non-image responses", async () => {
	const fetchFn: typeof fetch = async () =>
		new Response("<html></html>", {
			status: 200,
			headers: { "content-type": "text/html; charset=utf-8" },
		});

	const image = await fetchSafeExternalImage("https://public.example/file", {
		lookupHostname: createLookupHostname({
			"public.example": ["93.184.216.34"],
		}),
		fetchFn,
	});

	assert.equal(image, null);
});
