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
			genre: ["GENRE_INVESTMENT", "GENRE_BEAUTY", "INVALID"],
			impersonation: "IMPERSONATION_NONE",
			media: "MEDIA_YOMIURI",
			expression: "EXPRESSION_EXAGGERATED",
		}),
		{
			statusIds: [12, 7],
			verdictFilter: "all",
			imageFilter: "with",
			genreCodes: [],
			impersonationCode: "IMPERSONATION_NONE",
			mediaCode: "MEDIA_YOMIURI",
			expressionCode: "EXPRESSION_EXAGGERATED",
		},
	);

	assert.deepEqual(
		parseAdminReportStatusesFilters({
			statusId: "0",
			imageFilter: "invalid",
			genre: ["GENRE_INVESTMENT", "GENRE_BEAUTY"],
			impersonation: "INVALID",
			media: "",
			expression: "EXPRESSION_NONE",
		}),
		{
			statusIds: [],
			verdictFilter: "all",
			imageFilter: "all",
			genreCodes: ["GENRE_INVESTMENT", "GENRE_BEAUTY"],
			impersonationCode: "all",
			mediaCode: "all",
			expressionCode: "EXPRESSION_NONE",
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
				genreCodes: ["GENRE_INVESTMENT", "GENRE_BEAUTY"],
				impersonationCode: "IMPERSONATION_NONE",
				mediaCode: "all",
				expressionCode: "EXPRESSION_NONE",
			},
			notice: "updated",
		}),
		"/admin/report-statuses?page=3&statusId=4&statusId=9&verdictFilter=HIGH_RISK&imageFilter=with&genre=GENRE_INVESTMENT&genre=GENRE_BEAUTY&impersonation=IMPERSONATION_NONE&expression=EXPRESSION_NONE&notice=updated",
	);

	assert.equal(buildAdminReportStatusesPath(), "/admin/report-statuses");
});

test("detects whether any admin report statuses filter is active", () => {
	assert.equal(
		hasActiveAdminReportStatusesFilters({
			statusIds: [],
			verdictFilter: "all",
			imageFilter: "all",
			genreCodes: [],
			impersonationCode: "all",
			mediaCode: "all",
			expressionCode: "all",
		}),
		false,
	);

	assert.equal(
		hasActiveAdminReportStatusesFilters({
			statusIds: [2],
			verdictFilter: "all",
			imageFilter: "with",
			genreCodes: [],
			impersonationCode: "all",
			mediaCode: "MEDIA_NONE",
			expressionCode: "all",
		}),
		true,
	);
});
