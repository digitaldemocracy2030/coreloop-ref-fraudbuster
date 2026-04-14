export const REPORT_STATUS_CODES = {
	PENDING: "PENDING",
	INVESTIGATING: "INVESTIGATING",
	COMPLETED: "COMPLETED",
} as const;

export type ReportStatusCode =
	(typeof REPORT_STATUS_CODES)[keyof typeof REPORT_STATUS_CODES];

export const REPORT_STATUS_ORDER: ReportStatusCode[] = [
	REPORT_STATUS_CODES.PENDING,
	REPORT_STATUS_CODES.INVESTIGATING,
	REPORT_STATUS_CODES.COMPLETED,
];

export const REPORT_VERDICT_CODES = {
	CONFIRMED_FRAUD: "CONFIRMED_FRAUD",
	HIGH_RISK: "HIGH_RISK",
	SAFE: "SAFE",
	UNKNOWN: "UNKNOWN",
} as const;

export type ReportVerdictCode =
	(typeof REPORT_VERDICT_CODES)[keyof typeof REPORT_VERDICT_CODES];

const REPORT_STATUS_META: Record<
	ReportStatusCode,
	{ label: string; badgeClassName: string }
> = {
	[REPORT_STATUS_CODES.PENDING]: {
		label: "処理待ち",
		badgeClassName:
			"border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200",
	},
	[REPORT_STATUS_CODES.INVESTIGATING]: {
		label: "調査中",
		badgeClassName:
			"border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200",
	},
	[REPORT_STATUS_CODES.COMPLETED]: {
		label: "完了",
		badgeClassName:
			"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
	},
};

const REPORT_VERDICT_META: Record<
	ReportVerdictCode,
	{ label: string; badgeClassName: string }
> = {
	[REPORT_VERDICT_CODES.CONFIRMED_FRAUD]: {
		label: "詐欺判定",
		badgeClassName:
			"border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
	},
	[REPORT_VERDICT_CODES.HIGH_RISK]: {
		label: "高リスク",
		badgeClassName:
			"border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-200",
	},
	[REPORT_VERDICT_CODES.SAFE]: {
		label: "安全",
		badgeClassName:
			"border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200",
	},
	[REPORT_VERDICT_CODES.UNKNOWN]: {
		label: "不明",
		badgeClassName:
			"border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200",
	},
};

export const REPORT_LABEL_BADGE_CLASS_NAME =
	"border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-100";

export function isReportStatusCode(value: string): value is ReportStatusCode {
	return value in REPORT_STATUS_CODES;
}

export function isReportVerdictCode(value: string): value is ReportVerdictCode {
	return value in REPORT_VERDICT_CODES;
}

export function getReportStatusMeta(code: string | null | undefined) {
	if (!code || !isReportStatusCode(code)) {
		return null;
	}

	return REPORT_STATUS_META[code];
}

export function getReportVerdictMeta(code: string | null | undefined) {
	if (!code || !isReportVerdictCode(code)) {
		return null;
	}

	return REPORT_VERDICT_META[code];
}

export function isCompletedReportStatus(code: string | null | undefined) {
	return code === REPORT_STATUS_CODES.COMPLETED;
}

export function compareReportStatusCodes(
	left: string | null | undefined,
	right: string | null | undefined,
) {
	const normalizedLeft = left ?? "";
	const normalizedRight = right ?? "";
	const leftIndex = isReportStatusCode(normalizedLeft)
		? REPORT_STATUS_ORDER.indexOf(normalizedLeft)
		: REPORT_STATUS_ORDER.length;
	const rightIndex = isReportStatusCode(normalizedRight)
		? REPORT_STATUS_ORDER.indexOf(normalizedRight)
		: REPORT_STATUS_ORDER.length;

	return leftIndex - rightIndex;
}
