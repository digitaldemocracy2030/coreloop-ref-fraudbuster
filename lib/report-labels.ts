export const REPORT_LABEL_GROUP_CODES = {
	GENRE: "GENRE",
	IMPERSONATION: "IMPERSONATION",
	MEDIA_SPOOF: "MEDIA_SPOOF",
	EXPRESSION: "EXPRESSION",
} as const;

export type ReportLabelGroupCode =
	(typeof REPORT_LABEL_GROUP_CODES)[keyof typeof REPORT_LABEL_GROUP_CODES];

export const REPORT_LABEL_GROUP_ORDER: ReportLabelGroupCode[] = [
	REPORT_LABEL_GROUP_CODES.GENRE,
	REPORT_LABEL_GROUP_CODES.IMPERSONATION,
	REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
	REPORT_LABEL_GROUP_CODES.EXPRESSION,
];

export const REPORT_LABEL_GROUP_META: Record<
	ReportLabelGroupCode,
	{ label: string; allowMultiple: boolean }
> = {
	[REPORT_LABEL_GROUP_CODES.GENRE]: {
		label: "ジャンル",
		allowMultiple: true,
	},
	[REPORT_LABEL_GROUP_CODES.IMPERSONATION]: {
		label: "なりすまし",
		allowMultiple: false,
	},
	[REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF]: {
		label: "他メディアを騙っている",
		allowMultiple: false,
	},
	[REPORT_LABEL_GROUP_CODES.EXPRESSION]: {
		label: "表現",
		allowMultiple: false,
	},
};

export const REPORT_LABEL_DEFINITIONS = [
	{
		code: "GENRE_ONLINE_CASINO",
		name: "オンラインカジノ",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 10,
	},
	{
		code: "GENRE_ONLINE_SHOPPING",
		name: "オンラインショッピング",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 11,
	},
	{
		code: "GENRE_INVESTMENT",
		name: "投資系",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 12,
	},
	{
		code: "GENRE_BEAUTY",
		name: "美容系",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 13,
	},
	{
		code: "GENRE_HEALTH",
		name: "健康系",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 14,
	},
	{
		code: "GENRE_ADULT",
		name: "性的広告",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 15,
	},
	{
		code: "GENRE_ROMANCE",
		name: "デート（ロマンス）",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 16,
	},
	{
		code: "GENRE_HIGH_PAYING_JOB",
		name: "高額バイト",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 17,
	},
	{
		code: "GENRE_CONSUMER_FINANCE",
		name: "消費者金融",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 18,
	},
	{
		code: "GENRE_OTHER",
		name: "その他（動物・宗教）",
		groupCode: REPORT_LABEL_GROUP_CODES.GENRE,
		displayOrder: 19,
	},
	{
		code: "IMPERSONATION_CELEBRITY_USED",
		name: "有名人を使っている",
		groupCode: REPORT_LABEL_GROUP_CODES.IMPERSONATION,
		displayOrder: 20,
	},
	{
		code: "IMPERSONATION_NONE",
		name: "有名人を使っていない",
		groupCode: REPORT_LABEL_GROUP_CODES.IMPERSONATION,
		displayOrder: 21,
	},
	{
		code: "MEDIA_NHK",
		name: "NHK",
		groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
		displayOrder: 30,
	},
	{
		code: "MEDIA_YOMIURI",
		name: "読売新聞",
		groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
		displayOrder: 31,
	},
	{
		code: "MEDIA_YAHOO_SHOPPING",
		name: "Yahoo!ショッピング",
		groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
		displayOrder: 32,
	},
	{
		code: "MEDIA_AMAZON",
		name: "amazon",
		groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
		displayOrder: 33,
	},
	{
		code: "MEDIA_NONE",
		name: "騙っていない",
		groupCode: REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF,
		displayOrder: 34,
	},
	{
		code: "EXPRESSION_EXAGGERATED",
		name: "誇大表現",
		groupCode: REPORT_LABEL_GROUP_CODES.EXPRESSION,
		displayOrder: 40,
	},
	{
		code: "EXPRESSION_VIRUS",
		name: "ウィルス感染",
		groupCode: REPORT_LABEL_GROUP_CODES.EXPRESSION,
		displayOrder: 41,
	},
	{
		code: "EXPRESSION_NONE",
		name: "誇大表現はない",
		groupCode: REPORT_LABEL_GROUP_CODES.EXPRESSION,
		displayOrder: 42,
	},
] as const;

export type ReportLabelCode = (typeof REPORT_LABEL_DEFINITIONS)[number]["code"];
export type ReportLabelDefinition = (typeof REPORT_LABEL_DEFINITIONS)[number];

export type ReportLabelRecord = {
	id?: number;
	code: string;
	name: string;
	groupCode: string;
	displayOrder: number | null;
};

const reportLabelDefinitionByCode = new Map(
	REPORT_LABEL_DEFINITIONS.map((definition) => [definition.code, definition]),
);

const reportLabelDefinitionsByGroup = REPORT_LABEL_GROUP_ORDER.reduce(
	(accumulator, groupCode) => {
		accumulator[groupCode] = REPORT_LABEL_DEFINITIONS.filter(
			(definition) => definition.groupCode === groupCode,
		);
		return accumulator;
	},
	{} as Record<ReportLabelGroupCode, readonly ReportLabelDefinition[]>,
);

export const REPORT_LABEL_CODES_BY_GROUP = REPORT_LABEL_GROUP_ORDER.reduce(
	(accumulator, groupCode) => {
		accumulator[groupCode] = new Set(
			reportLabelDefinitionsByGroup[groupCode].map(
				(definition) => definition.code,
			),
		);
		return accumulator;
	},
	{} as Record<ReportLabelGroupCode, ReadonlySet<ReportLabelCode>>,
);

export function getReportLabelDefinitions(groupCode?: ReportLabelGroupCode) {
	return groupCode
		? reportLabelDefinitionsByGroup[groupCode]
		: REPORT_LABEL_DEFINITIONS;
}

export function getReportLabelDefinition(code: string) {
	return reportLabelDefinitionByCode.get(code as ReportLabelCode) ?? null;
}

export function isReportLabelCode(value: string): value is ReportLabelCode {
	return reportLabelDefinitionByCode.has(value as ReportLabelCode);
}

export function isReportLabelCodeInGroup(
	value: string,
	groupCode: ReportLabelGroupCode,
): value is ReportLabelCode {
	return REPORT_LABEL_CODES_BY_GROUP[groupCode].has(value as ReportLabelCode);
}

export function areReportLabelCodesInGroup(
	values: string[],
	groupCode: ReportLabelGroupCode,
): values is ReportLabelCode[] {
	return values.every((value) => isReportLabelCodeInGroup(value, groupCode));
}

export function toUniqueStringArray(values: string[]) {
	return Array.from(
		new Set(values.map((value) => value.trim()).filter(Boolean)),
	);
}

function getSortKey(
	label: Pick<ReportLabelRecord, "code" | "displayOrder" | "name">,
) {
	const definition = getReportLabelDefinition(label.code);
	return {
		displayOrder:
			label.displayOrder ?? definition?.displayOrder ?? Number.MAX_SAFE_INTEGER,
		name: label.name,
	};
}

export function sortReportLabels<T extends ReportLabelRecord>(labels: T[]) {
	return [...labels].sort((left, right) => {
		const leftKey = getSortKey(left);
		const rightKey = getSortKey(right);
		return (
			leftKey.displayOrder - rightKey.displayOrder ||
			leftKey.name.localeCompare(rightKey.name, "ja")
		);
	});
}

export function flattenReportLabelNames(labels: ReportLabelRecord[]) {
	return sortReportLabels(labels).map((label) => label.name);
}

export function groupReportLabels<T extends ReportLabelRecord>(labels: T[]) {
	const sorted = sortReportLabels(labels);
	return REPORT_LABEL_GROUP_ORDER.map((groupCode) => ({
		groupCode,
		label: REPORT_LABEL_GROUP_META[groupCode].label,
		labels: sorted.filter((item) => item.groupCode === groupCode),
	}));
}

export function getReportLabelCodesByGroup(labels: ReportLabelRecord[]) {
	const grouped = {
		genreCodes: [] as ReportLabelCode[],
		impersonationCode: null as ReportLabelCode | null,
		mediaCode: null as ReportLabelCode | null,
		expressionCode: null as ReportLabelCode | null,
	};

	for (const label of sortReportLabels(labels)) {
		if (isReportLabelCodeInGroup(label.code, REPORT_LABEL_GROUP_CODES.GENRE)) {
			grouped.genreCodes.push(label.code);
			continue;
		}
		if (
			!grouped.impersonationCode &&
			isReportLabelCodeInGroup(
				label.code,
				REPORT_LABEL_GROUP_CODES.IMPERSONATION,
			)
		) {
			grouped.impersonationCode = label.code;
			continue;
		}
		if (
			!grouped.mediaCode &&
			isReportLabelCodeInGroup(label.code, REPORT_LABEL_GROUP_CODES.MEDIA_SPOOF)
		) {
			grouped.mediaCode = label.code;
			continue;
		}
		if (
			!grouped.expressionCode &&
			isReportLabelCodeInGroup(label.code, REPORT_LABEL_GROUP_CODES.EXPRESSION)
		) {
			grouped.expressionCode = label.code;
		}
	}

	return grouped;
}

export function buildSingleReportLabelCodes(selection: {
	genreCodes: string[];
	impersonationCode: string;
	mediaCode: string;
	expressionCode: string;
}) {
	return [
		...selection.genreCodes,
		selection.impersonationCode,
		selection.mediaCode,
		selection.expressionCode,
	];
}

export function mergeBulkReportLabelCodes(
	currentLabels: ReportLabelRecord[],
	update: {
		updateGenres: boolean;
		clearGenres: boolean;
		genreCodes: string[];
		updateImpersonation: boolean;
		impersonationCode: string | null;
		updateMedia: boolean;
		mediaCode: string | null;
		updateExpression: boolean;
		expressionCode: string | null;
	},
) {
	const grouped = getReportLabelCodesByGroup(currentLabels);

	return [
		...(update.updateGenres
			? update.clearGenres
				? []
				: update.genreCodes
			: grouped.genreCodes),
		...(update.updateImpersonation && update.impersonationCode
			? [update.impersonationCode]
			: grouped.impersonationCode
				? [grouped.impersonationCode]
				: []),
		...(update.updateMedia && update.mediaCode
			? [update.mediaCode]
			: grouped.mediaCode
				? [grouped.mediaCode]
				: []),
		...(update.updateExpression && update.expressionCode
			? [update.expressionCode]
			: grouped.expressionCode
				? [grouped.expressionCode]
				: []),
	];
}
