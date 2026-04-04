import assert from "node:assert/strict";
import test from "node:test";

const {
	buildAdminReportStatusesPath,
	hasActiveAdminReportStatusesFilters,
	parseAdminReportStatusesFilters,
} = await import(new URL("./admin-report-statuses.ts", import.meta.url).href);
const { REPORT_VERDICT_CODES } = await import(
	new URL("./report-metadata.ts", import.meta.url).href
);

test("parses admin report status filters and falls back for invalid values", () => {
	assert.deepEqual(
		parseAdminReportStatusesFilters({
			statusId: ["12", "7", "12"],
			imageFilter: "with",
			labelFilter: "without",
		}),
		{
			statusIds: [12, 7],
			verdictFilter: "all",
			imageFilter: "with",
			labelFilter: "without",
		},
	);

	assert.deepEqual(
		parseAdminReportStatusesFilters({
			statusId: "0",
			imageFilter: "invalid",
			labelFilter: "",
		}),
		{
			statusIds: [],
			verdictFilter: "all",
			imageFilter: "all",
			labelFilter: "all",
		},
	);
});

test("builds an admin report statuses path with active filters only", () => {
	assert.equal(
		buildAdminReportStatusesPath({
			page: 3,
			filters: {
				statusIds: [4, 9],
				verdictFilter: REPORT_VERDICT_CODES.HIGH_RISK,
				imageFilter: "with",
				labelFilter: "all",
			},
			notice: "updated",
		}),
		"/admin/report-statuses?page=3&statusId=4&statusId=9&verdictFilter=HIGH_RISK&imageFilter=with&notice=updated",
	);

	assert.equal(buildAdminReportStatusesPath(), "/admin/report-statuses");
});

test("detects whether any admin report statuses filter is active", () => {
	assert.equal(
		hasActiveAdminReportStatusesFilters({
			statusIds: [],
			verdictFilter: "all",
			imageFilter: "all",
			labelFilter: "all",
		}),
		false,
	);

	assert.equal(
		hasActiveAdminReportStatusesFilters({
			statusIds: [2],
			verdictFilter: "all",
			imageFilter: "with",
			labelFilter: "all",
		}),
		true,
	);
});
