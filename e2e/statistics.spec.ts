import { expect, test } from "@playwright/test";

import type { StatisticsResponse } from "../lib/types/api";

const MOCK_STATISTICS: StatisticsResponse = {
	summary: {
		totalReports: 9999,
		highRiskReports: 321,
		todayReports: 42,
		topPlatform: "Instagram",
	},
	breakdown: {
		status: [
			{ id: 1, label: "調査中", count: 120 },
			{ id: 2, label: "詐欺判定", count: 80 },
		],
		category: [
			{ id: 1, label: "フィッシング", count: 140 },
			{ id: 2, label: "なりすまし", count: 60 },
		],
		platform: [
			{ id: 1, label: "Instagram", count: 130 },
			{ id: 2, label: "LINE", count: 70 },
		],
	},
	trend: [
		{ date: "02.09", count: 30 },
		{ date: "02.10", count: 32 },
		{ date: "02.11", count: 35 },
		{ date: "02.12", count: 40 },
		{ date: "02.13", count: 37 },
		{ date: "02.14", count: 45 },
		{ date: "02.15", count: 42 },
	],
	updatedAt: "2026-02-15T10:00:00.000Z",
};

test("renders statistics dashboard with API data", async ({ page }) => {
	await page.route("**/api/statistics**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(MOCK_STATISTICS),
		});
	});

	await page.goto("/statistics");

	await expect(
		page.getByRole("heading", { name: "詐欺トレンド統計" }),
	).toBeVisible();
	await expect(page.getByText("9,999")).toBeVisible();
	await expect(
		page
			.locator("div[data-slot='card-title']")
			.filter({ hasText: "Instagram" }),
	).toBeVisible();
	await expect(page.getByText("調査中: 120")).toBeVisible();
	await expect(page.getByText("最終更新:")).toBeVisible();
});
