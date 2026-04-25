import assert from "node:assert/strict";
import test from "node:test";

const {
	buildAiReportLabelingTargetWhere,
	buildAiReportLabelingUpdate,
	clampAiReportLabelingBatchSize,
	getAiReportLabelingBatchSize,
	isAuthorizedReportLabelingCronRequest,
	normalizeAiReportLabelingOutput,
	parsePositiveIntegerEnv,
} = await import(new URL("./ai-report-labeling.ts", import.meta.url).href);
const { REPORT_LABEL_DEFINITIONS, REPORT_LABEL_GROUP_CODES } = await import(
	new URL("./report-labels.ts", import.meta.url).href
);
const { REPORT_STATUS_CODES, REPORT_VERDICT_CODES } = await import(
	new URL("./report-metadata.ts", import.meta.url).href
);

const labelMaster = REPORT_LABEL_DEFINITIONS.map(
	(label: (typeof REPORT_LABEL_DEFINITIONS)[number], index: number) => ({
		id: index + 1,
		code: label.code,
		name: label.name,
		groupCode: label.groupCode,
		displayOrder: label.displayOrder,
	}),
);

test("builds the cron target filter for investigating reports with images and no labels", () => {
	assert.deepEqual(buildAiReportLabelingTargetWhere(), {
		status: {
			statusCode: REPORT_STATUS_CODES.INVESTIGATING,
		},
		images: {
			some: {},
		},
		reportLabels: {
			none: {},
		},
	});
});

test("authorizes cron requests only when the bearer secret matches", () => {
	assert.equal(
		isAuthorizedReportLabelingCronRequest(
			"Bearer secret-value",
			"secret-value",
		),
		true,
	);
	assert.equal(
		isAuthorizedReportLabelingCronRequest("Bearer wrong", "secret-value"),
		false,
	);
	assert.equal(
		isAuthorizedReportLabelingCronRequest(null, "secret-value"),
		false,
	);
	assert.equal(
		isAuthorizedReportLabelingCronRequest("Bearer secret-value", ""),
		false,
	);
});

test("parses positive batch size env values with a safe default", () => {
	assert.equal(parsePositiveIntegerEnv("5", 20), 5);
	assert.equal(parsePositiveIntegerEnv("0", 20), 20);
	assert.equal(parsePositiveIntegerEnv("-1", 20), 20);
	assert.equal(parsePositiveIntegerEnv("abc", 20), 20);
	assert.equal(parsePositiveIntegerEnv(undefined, 20), 20);
	assert.equal(clampAiReportLabelingBatchSize(100), 5);
	assert.equal(clampAiReportLabelingBatchSize(0), 1);

	const previousValue = process.env.AI_LABELING_BATCH_SIZE;
	process.env.AI_LABELING_BATCH_SIZE = "100";
	try {
		assert.equal(getAiReportLabelingBatchSize(), 5);
	} finally {
		if (previousValue === undefined) {
			delete process.env.AI_LABELING_BATCH_SIZE;
		} else {
			process.env.AI_LABELING_BATCH_SIZE = previousValue;
		}
	}
});

test("normalizes valid AI output and rejects unknown or duplicate labels", () => {
	assert.deepEqual(
		normalizeAiReportLabelingOutput({
			genreCodes: ["GENRE_INVESTMENT"],
			impersonationCode: "IMPERSONATION_CELEBRITY_USED",
			mediaCode: "MEDIA_NONE",
			expressionCode: "EXPRESSION_EXAGGERATED",
			confidence: 0.82,
			rationale: "有名人の画像と利益訴求が見える",
		}),
		{
			genreCodes: ["GENRE_INVESTMENT"],
			impersonationCode: "IMPERSONATION_CELEBRITY_USED",
			mediaCode: "MEDIA_NONE",
			expressionCode: "EXPRESSION_EXAGGERATED",
			confidence: 0.82,
			rationale: "有名人の画像と利益訴求が見える",
		},
	);

	assert.throws(
		() =>
			normalizeAiReportLabelingOutput({
				genreCodes: ["GENRE_INVESTMENT", "GENRE_INVESTMENT"],
				impersonationCode: "IMPERSONATION_NONE",
				mediaCode: "MEDIA_NONE",
				expressionCode: "EXPRESSION_NONE",
				confidence: 0.5,
				rationale: "duplicate",
			}),
		/duplicate/,
	);
	assert.throws(
		() =>
			normalizeAiReportLabelingOutput({
				genreCodes: ["MEDIA_NONE"],
				impersonationCode: "IMPERSONATION_NONE",
				mediaCode: "MEDIA_NONE",
				expressionCode: "EXPRESSION_NONE",
				confidence: 0.5,
				rationale: "wrong group",
			}),
		/genre/,
	);
	assert.throws(
		() =>
			normalizeAiReportLabelingOutput({
				genreCodes: ["GENRE_INVESTMENT"],
				impersonationCode: "IMPERSONATION_NONE",
				mediaCode: "MEDIA_NONE",
				expressionCode: "EXPRESSION_NONE",
				confidence: 1.5,
				rationale: "bad confidence",
			}),
		/confidence/,
	);
});

test("builds label updates and derives recommended verdict and risk score", () => {
	const update = buildAiReportLabelingUpdate({
		labelMaster,
		output: {
			genreCodes: ["GENRE_INVESTMENT"],
			impersonationCode: "IMPERSONATION_NONE",
			mediaCode: "MEDIA_NHK",
			expressionCode: "EXPRESSION_NONE",
			confidence: 0.91,
			rationale: "NHK風の表示がある",
		},
	});

	assert.deepEqual(update.selectedCodes, [
		"GENRE_INVESTMENT",
		"IMPERSONATION_NONE",
		"MEDIA_NHK",
		"EXPRESSION_NONE",
	]);
	assert.equal(update.recommendedVerdict, REPORT_VERDICT_CODES.CONFIRMED_FRAUD);
	assert.equal(update.riskScore, 100);
	assert.deepEqual(
		update.nextLabelRecords.map(
			(label: { groupCode: string }) => label.groupCode,
		),
		[
			REPORT_LABEL_GROUP_CODES.GENRE,
			REPORT_LABEL_GROUP_CODES.IMPERSONATION,
			REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
			REPORT_LABEL_GROUP_CODES.EXPRESSION,
		],
	);
});
