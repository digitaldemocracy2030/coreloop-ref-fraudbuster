import assert from "node:assert/strict";
import test from "node:test";

const {
	flattenReportLabelNames,
	getReportLabelCodesByGroup,
	groupReportLabels,
	mergeBulkReportLabelCodes,
	REPORT_LABEL_GROUP_CODES,
} = await import(new URL("./report-labels.ts", import.meta.url).href);

const sampleLabels = [
	{
		code: "MEDIA_YOMIURI",
		name: "読売新聞",
		groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
		displayOrder: 31,
	},
	{
		code: "GENRE_BEAUTY",
		name: "美容系",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 13,
	},
	{
		code: "EXPRESSION_EXAGGERATED",
		name: "誇大表現",
		groupCode: REPORT_LABEL_GROUP_CODES.EXPRESSION,
		displayOrder: 40,
	},
	{
		code: "IMPERSONATION_NONE",
		name: "有名人を使っていない",
		groupCode: REPORT_LABEL_GROUP_CODES.IMPERSONATION,
		displayOrder: 21,
	},
];

test("flattens report labels in display order", () => {
	assert.deepEqual(flattenReportLabelNames(sampleLabels), [
		"美容系",
		"有名人を使っていない",
		"読売新聞",
		"誇大表現",
	]);
});

test("groups selected report labels by taxonomy level", () => {
	const grouped = groupReportLabels(sampleLabels);

	assert.deepEqual(
		grouped.map((group: (typeof grouped)[number]) => ({
			groupCode: group.groupCode,
			labelNames: group.labels.map(
				(item: (typeof sampleLabels)[number]) => item.name,
			),
		})),
		[
			{
				groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
				labelNames: ["美容系"],
			},
			{
				groupCode: REPORT_LABEL_GROUP_CODES.IMPERSONATION,
				labelNames: ["有名人を使っていない"],
			},
			{
				groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
				labelNames: ["読売新聞"],
			},
			{
				groupCode: REPORT_LABEL_GROUP_CODES.EXPRESSION,
				labelNames: ["誇大表現"],
			},
		],
	);
});

test("extracts label codes by group and preserves genre multiplicity", () => {
	assert.deepEqual(getReportLabelCodesByGroup(sampleLabels), {
		genreCodes: ["GENRE_BEAUTY"],
		impersonationCode: "IMPERSONATION_NONE",
		mediaCode: "MEDIA_YOMIURI",
		expressionCode: "EXPRESSION_EXAGGERATED",
	});
});

test("merges bulk updates without touching unchecked groups", () => {
	assert.deepEqual(
		mergeBulkReportLabelCodes(sampleLabels, {
			updateGenres: true,
			clearGenres: false,
			genreCodes: ["GENRE_INVESTMENT", "GENRE_HEALTH"],
			updateImpersonation: false,
			impersonationCode: null,
			updateMedia: true,
			mediaCode: "MEDIA_NONE",
			updateExpression: false,
			expressionCode: null,
		}),
		[
			"GENRE_INVESTMENT",
			"GENRE_HEALTH",
			"IMPERSONATION_NONE",
			"MEDIA_NONE",
			"EXPRESSION_EXAGGERATED",
		],
	);
});
