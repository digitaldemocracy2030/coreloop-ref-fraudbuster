import assert from "node:assert/strict";
import test from "node:test";

const { getReportImageStoragePathFromUrl } = await import(
	new URL("./report-image-storage.ts", import.meta.url).href
);

const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalBucket = process.env.SUPABASE_REPORT_SCREENSHOT_BUCKET;

test.beforeEach(() => {
	process.env.SUPABASE_URL = "https://example.supabase.co";
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
	process.env.SUPABASE_REPORT_SCREENSHOT_BUCKET = "report-screenshots";
});

test.after(() => {
	process.env.SUPABASE_URL = originalSupabaseUrl;
	process.env.NEXT_PUBLIC_SUPABASE_URL = originalPublicSupabaseUrl;
	process.env.SUPABASE_REPORT_SCREENSHOT_BUCKET = originalBucket;
});

test("extracts a storage object path from a public report image url", () => {
	assert.equal(
		getReportImageStoragePathFromUrl(
			"https://example.supabase.co/storage/v1/object/public/report-screenshots/reports/temp/session-1/image%20one.png",
		),
		"reports/temp/session-1/image one.png",
	);
});

test("supports urls with an encoded bucket name", () => {
	process.env.SUPABASE_REPORT_SCREENSHOT_BUCKET = "report screenshots";

	assert.equal(
		getReportImageStoragePathFromUrl(
			"https://example.supabase.co/storage/v1/object/public/report%20screenshots/reports/temp/session-1/image.png",
		),
		"reports/temp/session-1/image.png",
	);
});

test("returns null for external image urls", () => {
	assert.equal(
		getReportImageStoragePathFromUrl(
			"https://cdn.example.com/reports/external-image.png",
		),
		null,
	);
});
