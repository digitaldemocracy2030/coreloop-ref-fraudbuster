import assert from "node:assert/strict";
import test from "node:test";

const { getFixedRiskScoreForVerdict, getRecommendedVerdict } = await import(
	new URL("./report-recommendation.ts", import.meta.url).href
);
const { REPORT_LABEL_GROUP_CODES } = await import(
	new URL("./report-labels.ts", import.meta.url).href
);
const { REPORT_STATUS_CODES, REPORT_VERDICT_CODES } = await import(
	new URL("./report-metadata.ts", import.meta.url).href
);

const baseLabels = [
	{
		code: "GENRE_INVESTMENT",
		name: "投資系",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 12,
	},
	{
		code: "IMPERSONATION_NONE",
		name: "有名人を使っていない",
		groupCode: REPORT_LABEL_GROUP_CODES.IMPERSONATION,
		displayOrder: 21,
	},
	{
		code: "MEDIA_NONE",
		name: "騙っていない",
		groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
		displayOrder: 34,
	},
	{
		code: "EXPRESSION_NONE",
		name: "誇大表現はない",
		groupCode: REPORT_LABEL_GROUP_CODES.EXPRESSION,
		displayOrder: 42,
	},
];

test("returns null when recommendation conditions are incomplete", () => {
	assert.equal(
		getRecommendedVerdict({
			statusCode: REPORT_STATUS_CODES.INVESTIGATING,
			labels: baseLabels.filter(
				(label) => label.groupCode !== REPORT_LABEL_GROUP_CODES.EXPRESSION,
			),
		}),
		null,
	);
	assert.equal(
		getRecommendedVerdict({
			statusCode: REPORT_STATUS_CODES.PENDING,
			labels: baseLabels,
		}),
		null,
	);
});

test("recommends confirmed fraud for celebrity impersonation and spoofed media", () => {
	assert.equal(
		getRecommendedVerdict({
			statusCode: REPORT_STATUS_CODES.INVESTIGATING,
			labels: baseLabels.map((label) =>
				label.groupCode === REPORT_LABEL_GROUP_CODES.IMPERSONATION
					? {
							...label,
							code: "IMPERSONATION_CELEBRITY_USED",
							name: "有名人を使っている",
						}
					: label,
			),
		}),
		REPORT_VERDICT_CODES.CONFIRMED_FRAUD,
	);
	assert.equal(
		getRecommendedVerdict({
			statusCode: REPORT_STATUS_CODES.INVESTIGATING,
			labels: baseLabels.map((label) =>
				label.groupCode === REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF
					? {
							...label,
							code: "MEDIA_YOMIURI",
							name: "読売新聞",
						}
					: label,
			),
		}),
		REPORT_VERDICT_CODES.CONFIRMED_FRAUD,
	);
});

test("treats exaggerated and virus expressions as high risk", () => {
	assert.equal(
		getRecommendedVerdict({
			statusCode: REPORT_STATUS_CODES.INVESTIGATING,
			labels: baseLabels.map((label) =>
				label.groupCode === REPORT_LABEL_GROUP_CODES.EXPRESSION
					? {
							...label,
							code: "EXPRESSION_EXAGGERATED",
							name: "誇大表現",
						}
					: label,
			),
		}),
		REPORT_VERDICT_CODES.HIGH_RISK,
	);
	assert.equal(
		getRecommendedVerdict({
			statusCode: REPORT_STATUS_CODES.INVESTIGATING,
			labels: baseLabels.map((label) =>
				label.groupCode === REPORT_LABEL_GROUP_CODES.EXPRESSION
					? {
							...label,
							code: "EXPRESSION_VIRUS",
							name: "ウィルス感染",
						}
					: label,
			),
		}),
		REPORT_VERDICT_CODES.HIGH_RISK,
	);
});

test("falls back to unknown when all checks pass without fraud or high-risk signals", () => {
	assert.equal(
		getRecommendedVerdict({
			statusCode: REPORT_STATUS_CODES.INVESTIGATING,
			labels: baseLabels,
		}),
		REPORT_VERDICT_CODES.UNKNOWN,
	);
});

test("maps final verdicts to fixed risk scores", () => {
	assert.equal(
		getFixedRiskScoreForVerdict(REPORT_VERDICT_CODES.CONFIRMED_FRAUD),
		100,
	);
	assert.equal(getFixedRiskScoreForVerdict(REPORT_VERDICT_CODES.HIGH_RISK), 80);
	assert.equal(getFixedRiskScoreForVerdict(REPORT_VERDICT_CODES.SAFE), 0);
	assert.equal(getFixedRiskScoreForVerdict(REPORT_VERDICT_CODES.UNKNOWN), 0);
});
