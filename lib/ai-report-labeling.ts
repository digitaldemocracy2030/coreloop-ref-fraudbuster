import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI, Type } from "@google/genai";
import type { PrismaClient } from "../app/generated/prisma/client.ts";
import { isValidReportImageStorageUrl } from "./report-image-storage.ts";
import { canonicalizeImageMimeType } from "./report-image-upload.ts";
import {
	areReportLabelCodesInGroup,
	buildSingleReportLabelCodes,
	flattenReportLabelNames,
	getReportLabelDefinitions,
	REPORT_LABEL_DEFINITIONS,
	REPORT_LABEL_GROUP_CODES,
	REPORT_LABEL_GROUP_META,
	REPORT_LABEL_GROUP_ORDER,
	type ReportLabelCode,
	type ReportLabelRecord,
	sortReportLabels,
} from "./report-labels.ts";
import { REPORT_STATUS_CODES } from "./report-metadata.ts";
import {
	getFixedRiskScoreForVerdict,
	getRecommendedVerdict,
} from "./report-recommendation.ts";

export const DEFAULT_AI_LABELING_BATCH_SIZE = 5;
export const MAX_AI_LABELING_BATCH_SIZE = 5;
export const DEFAULT_GEMINI_LABELING_MODEL = "gemini-2.5-flash";
export const REPORT_LABELING_PROMPT_FILE = "prompts/report-labeling.md";

const REPORT_LABELING_ADVISORY_LOCK_NAMESPACE = 5_141_415;
const REPORT_LABELING_ADVISORY_LOCK_KEY = 1;
const DEFAULT_TRANSACTION_TIMEOUT_MS = 120_000;
const MAX_FAILURES_IN_RESPONSE = 20;

type ReportLabelingPrismaClient = Pick<
	PrismaClient,
	"$transaction" | "report" | "reportLabel"
>;

type ReportLabelingTargetReport = {
	id: string;
	title: string | null;
	url: string;
	description: string | null;
	images: {
		id: string;
		imageUrl: string;
	}[];
};

export type AiReportLabelingOutput = {
	genreCodes: ReportLabelCode[];
	impersonationCode: ReportLabelCode;
	mediaCode: ReportLabelCode;
	expressionCode: ReportLabelCode;
	confidence: number;
	rationale: string;
};

export type AiReportLabelingClassifierInput = {
	report: ReportLabelingTargetReport;
	images: AiReportLabelingImageInput[];
	prompt: string;
	labelOptions: string;
};

export type AiReportLabelingClassifier = (
	input: AiReportLabelingClassifierInput,
) => Promise<AiReportLabelingOutput>;

export type AiReportLabelingJobResult = {
	skipped: boolean;
	skipReason: string | null;
	candidateCount: number;
	processedCount: number;
	updatedCount: number;
	failedCount: number;
	updatedReportIds: string[];
	failures: {
		reportId: string;
		reason: string;
	}[];
};

type ReportLabelMasterRecord = {
	id: number;
	code: string;
	name: string;
	groupCode: string;
	displayOrder: number;
};

type AiReportLabelingImageInput = {
	mimeType: string;
	data: string;
};

function toReportLabelRecord(
	label: ReportLabelMasterRecord,
): ReportLabelRecord {
	return {
		id: label.id,
		code: label.code,
		name: label.name,
		groupCode: label.groupCode,
		displayOrder: label.displayOrder,
	};
}

export function parsePositiveIntegerEnv(
	value: string | undefined,
	defaultValue: number,
): number {
	if (!value) return defaultValue;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function getAiReportLabelingBatchSize(): number {
	return Math.min(
		parsePositiveIntegerEnv(
			process.env.AI_LABELING_BATCH_SIZE,
			DEFAULT_AI_LABELING_BATCH_SIZE,
		),
		MAX_AI_LABELING_BATCH_SIZE,
	);
}

export function clampAiReportLabelingBatchSize(value: number): number {
	return Math.min(Math.max(1, Math.floor(value)), MAX_AI_LABELING_BATCH_SIZE);
}

export function getGeminiLabelingModel(): string {
	return (
		process.env.GEMINI_LABELING_MODEL?.trim() || DEFAULT_GEMINI_LABELING_MODEL
	);
}

export function isAuthorizedReportLabelingCronRequest(
	authorizationHeader: string | null,
	cronSecret = process.env.CRON_SECRET,
): boolean {
	const secret = cronSecret?.trim();
	return Boolean(secret) && authorizationHeader === `Bearer ${secret}`;
}

export function buildAiReportLabelingTargetWhere() {
	return {
		status: {
			statusCode: REPORT_STATUS_CODES.INVESTIGATING,
		},
		images: {
			some: {},
		},
		reportLabels: {
			none: {},
		},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fieldName: string): string {
	if (typeof value !== "string") {
		throw new Error(`${fieldName} must be a string`);
	}
	return value.trim();
}

function readConfidence(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new Error("confidence must be a number");
	}
	if (value < 0 || value > 1) {
		throw new Error("confidence must be between 0 and 1");
	}
	return value;
}

function validateUniqueStrings(values: unknown, fieldName: string): string[] {
	if (!Array.isArray(values)) {
		throw new Error(`${fieldName} must be an array`);
	}
	const strings = values.map((value) => readString(value, fieldName));
	if (strings.length === 0) {
		throw new Error(`${fieldName} must include at least one code`);
	}
	if (new Set(strings).size !== strings.length) {
		throw new Error(`${fieldName} must not include duplicate codes`);
	}
	return strings;
}

export function normalizeAiReportLabelingOutput(
	value: unknown,
): AiReportLabelingOutput {
	if (!isRecord(value)) {
		throw new Error("AI labeling output must be an object");
	}

	const genreCodes = validateUniqueStrings(value.genreCodes, "genreCodes");
	const impersonationCode = readString(
		value.impersonationCode,
		"impersonationCode",
	);
	const mediaCode = readString(value.mediaCode, "mediaCode");
	const expressionCode = readString(value.expressionCode, "expressionCode");

	if (!areReportLabelCodesInGroup(genreCodes, REPORT_LABEL_GROUP_CODES.GENRE)) {
		throw new Error("genreCodes contains an unknown genre label");
	}
	if (
		!areReportLabelCodesInGroup(
			[impersonationCode],
			REPORT_LABEL_GROUP_CODES.IMPERSONATION,
		)
	) {
		throw new Error("impersonationCode contains an unknown label");
	}
	if (
		!areReportLabelCodesInGroup(
			[mediaCode],
			REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
		)
	) {
		throw new Error("mediaCode contains an unknown label");
	}
	if (
		!areReportLabelCodesInGroup(
			[expressionCode],
			REPORT_LABEL_GROUP_CODES.EXPRESSION,
		)
	) {
		throw new Error("expressionCode contains an unknown label");
	}

	return {
		genreCodes,
		impersonationCode: impersonationCode as ReportLabelCode,
		mediaCode: mediaCode as ReportLabelCode,
		expressionCode: expressionCode as ReportLabelCode,
		confidence: readConfidence(value.confidence),
		rationale: readString(value.rationale, "rationale").slice(0, 300),
	};
}

export function buildAiReportLabelingUpdate(params: {
	output: AiReportLabelingOutput;
	labelMaster: ReportLabelMasterRecord[];
}) {
	const selectedCodes = buildSingleReportLabelCodes(params.output);
	const labelMasterByCode = new Map(
		params.labelMaster.map((label) => [label.code, label]),
	);
	const selectedLabels = selectedCodes.map((code) =>
		labelMasterByCode.get(code),
	);

	if (selectedLabels.some((label) => !label)) {
		throw new Error("Selected labels are missing from report label master");
	}

	const nextLabelRecords = sortReportLabels(
		selectedLabels.map((label) =>
			toReportLabelRecord(label as ReportLabelMasterRecord),
		),
	);
	const recommendedVerdict = getRecommendedVerdict({
		statusCode: REPORT_STATUS_CODES.INVESTIGATING,
		labels: nextLabelRecords,
	});

	return {
		selectedCodes,
		nextLabelRecords,
		nextLabelNames: flattenReportLabelNames(nextLabelRecords),
		recommendedVerdict,
		riskScore: recommendedVerdict
			? getFixedRiskScoreForVerdict(recommendedVerdict)
			: 0,
	};
}

export function buildReportLabelingPromptContext(prompt: string): string {
	const labelOptions = REPORT_LABEL_GROUP_ORDER.map((groupCode) => {
		const meta = REPORT_LABEL_GROUP_META[groupCode];
		const labels = getReportLabelDefinitions(groupCode)
			.map((definition) => `- ${definition.code}: ${definition.name}`)
			.join("\n");
		return `## ${meta.label}\n${labels}`;
	}).join("\n\n");

	return `${prompt.trim()}\n\n# ラベル候補\n${labelOptions}`;
}

function buildReportInputText(report: ReportLabelingTargetReport): string {
	return [
		"次の通報をラベル付けしてください。",
		`通報ID: ${report.id}`,
		`タイトル: ${report.title?.trim() || "未設定"}`,
		`URL: ${report.url}`,
		`説明: ${report.description?.trim() || "未設定"}`,
	].join("\n");
}

function buildStructuredOutputSchema() {
	const genreCodes = getReportLabelDefinitions(
		REPORT_LABEL_GROUP_CODES.GENRE,
	).map((label) => label.code);
	const impersonationCodes = getReportLabelDefinitions(
		REPORT_LABEL_GROUP_CODES.IMPERSONATION,
	).map((label) => label.code);
	const mediaCodes = getReportLabelDefinitions(
		REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
	).map((label) => label.code);
	const expressionCodes = getReportLabelDefinitions(
		REPORT_LABEL_GROUP_CODES.EXPRESSION,
	).map((label) => label.code);

	return {
		type: Type.OBJECT,
		properties: {
			genreCodes: {
				type: Type.ARRAY,
				items: {
					type: Type.STRING,
					format: "enum",
					enum: genreCodes,
				},
			},
			impersonationCode: {
				type: Type.STRING,
				format: "enum",
				enum: impersonationCodes,
			},
			mediaCode: {
				type: Type.STRING,
				format: "enum",
				enum: mediaCodes,
			},
			expressionCode: {
				type: Type.STRING,
				format: "enum",
				enum: expressionCodes,
			},
			confidence: {
				type: Type.NUMBER,
				minimum: 0,
				maximum: 1,
			},
			rationale: { type: Type.STRING },
		},
		required: [
			"genreCodes",
			"impersonationCode",
			"mediaCode",
			"expressionCode",
			"confidence",
			"rationale",
		],
		additionalProperties: false,
	};
}

export function createGeminiReportLabelingClassifier({
	apiKey = process.env.GEMINI_API_KEY,
	model = getGeminiLabelingModel(),
}: {
	apiKey?: string;
	model?: string;
} = {}): AiReportLabelingClassifier {
	if (!apiKey?.trim()) {
		throw new Error("GEMINI_API_KEY is required for AI report labeling");
	}

	const client = new GoogleGenAI({ apiKey });

	return async ({ report, images, prompt, labelOptions }) => {
		const response = await client.models.generateContent({
			model,
			contents: [
				{
					text: `${prompt}\n\n${labelOptions}\n\n${buildReportInputText(report)}`,
				},
				...images.map((image) => ({
					inlineData: {
						mimeType: image.mimeType,
						data: image.data,
					},
				})),
			],
			config: {
				responseMimeType: "application/json",
				responseSchema: buildStructuredOutputSchema(),
				temperature: 0,
				maxOutputTokens: 600,
			},
		});

		const text = response.text;
		if (!text) {
			throw new Error("Gemini returned an empty labeling response");
		}

		return normalizeAiReportLabelingOutput(JSON.parse(text));
	};
}

async function readPromptFile(): Promise<string> {
	return fs.readFile(
		path.join(process.cwd(), REPORT_LABELING_PROMPT_FILE),
		"utf8",
	);
}

async function resolveUsableImageInputs(report: ReportLabelingTargetReport) {
	const usableImages: AiReportLabelingImageInput[] = [];

	for (const image of report.images) {
		if (!isValidReportImageStorageUrl(image.imageUrl)) {
			continue;
		}

		const response = await fetch(image.imageUrl, {
			cache: "no-store",
			redirect: "error",
		});
		if (!response.ok) {
			continue;
		}
		const mimeType = canonicalizeImageMimeType(
			response.headers.get("content-type"),
		);
		if (!mimeType) {
			continue;
		}

		const data = Buffer.from(await response.arrayBuffer()).toString("base64");
		usableImages.push({ mimeType, data });
	}

	return usableImages;
}

function sanitizeFailureReason(error: unknown) {
	return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function buildTimelineDescription(params: {
	labelNames: string[];
	confidence: number;
	rationale: string;
}) {
	return [
		`ラベル: ${params.labelNames.join(", ")}`,
		`信頼度: ${params.confidence.toFixed(2)}`,
		`理由: ${params.rationale || "未記入"}`,
		`プロンプト: ${REPORT_LABELING_PROMPT_FILE}`,
	].join(" / ");
}

export async function runAiReportLabelingJob({
	prisma,
	classifier = createGeminiReportLabelingClassifier(),
	batchSize = getAiReportLabelingBatchSize(),
	prompt,
}: {
	prisma: ReportLabelingPrismaClient;
	classifier?: AiReportLabelingClassifier;
	batchSize?: number;
	prompt?: string;
}): Promise<AiReportLabelingJobResult> {
	const promptText = prompt ?? (await readPromptFile());
	const labelOptions = buildReportLabelingPromptContext("").trim();

	return prisma.$transaction(
		async (tx) => {
			const lockRows = await tx.$queryRaw<{ locked: boolean }[]>`
				SELECT pg_try_advisory_xact_lock(
					${REPORT_LABELING_ADVISORY_LOCK_NAMESPACE},
					${REPORT_LABELING_ADVISORY_LOCK_KEY}
				) AS locked
			`;
			if (!lockRows[0]?.locked) {
				return {
					skipped: true,
					skipReason: "already_running",
					candidateCount: 0,
					processedCount: 0,
					updatedCount: 0,
					failedCount: 0,
					updatedReportIds: [],
					failures: [],
				};
			}

			const [reports, labelMaster] = await Promise.all([
				tx.report.findMany({
					where: buildAiReportLabelingTargetWhere(),
					orderBy: { createdAt: "asc" },
					take: clampAiReportLabelingBatchSize(batchSize),
					select: {
						id: true,
						title: true,
						url: true,
						description: true,
						images: {
							select: {
								id: true,
								imageUrl: true,
							},
							orderBy: { displayOrder: "asc" },
						},
					},
				}),
				tx.reportLabel.findMany({
					where: {
						code: {
							in: REPORT_LABEL_DEFINITIONS.map((label) => label.code),
						},
					},
					select: {
						id: true,
						code: true,
						name: true,
						groupCode: true,
						displayOrder: true,
					},
				}),
			]);

			const result: AiReportLabelingJobResult = {
				skipped: false,
				skipReason: null,
				candidateCount: reports.length,
				processedCount: 0,
				updatedCount: 0,
				failedCount: 0,
				updatedReportIds: [],
				failures: [],
			};

			for (const report of reports) {
				result.processedCount += 1;

				try {
					const images = await resolveUsableImageInputs(report);
					if (images.length === 0) {
						throw new Error("No usable report images were found");
					}

					const output = await classifier({
						report,
						images,
						prompt: promptText,
						labelOptions,
					});
					const update = buildAiReportLabelingUpdate({
						output,
						labelMaster,
					});
					const lockReportRows = await tx.$queryRaw<{ id: string }[]>`
						SELECT id
						FROM reports
						WHERE id = ${report.id}
							AND NOT EXISTS (
								SELECT 1
								FROM report_label_relations
								WHERE report_id = ${report.id}
							)
						FOR UPDATE
					`;
					if (lockReportRows.length === 0) {
						throw new Error("Report already has labels");
					}

					await tx.report.update({
						where: { id: report.id },
						data: {
							recommendedVerdict: update.recommendedVerdict,
							riskScore: update.riskScore,
							reportLabels: {
								create: update.nextLabelRecords.map((label) => ({
									label: {
										connect: {
											id: label.id,
										},
									},
								})),
							},
							timelines: {
								create: {
									actionLabel: "AIラベル付け",
									description: buildTimelineDescription({
										labelNames: update.nextLabelNames,
										confidence: output.confidence,
										rationale: output.rationale,
									}),
								},
							},
							updatedAt: new Date(),
						},
					});

					result.updatedCount += 1;
					result.updatedReportIds.push(report.id);
				} catch (error) {
					result.failedCount += 1;
					if (result.failures.length < MAX_FAILURES_IN_RESPONSE) {
						result.failures.push({
							reportId: report.id,
							reason: sanitizeFailureReason(error),
						});
					}
				}
			}

			return result;
		},
		{ timeout: DEFAULT_TRANSACTION_TIMEOUT_MS },
	);
}
