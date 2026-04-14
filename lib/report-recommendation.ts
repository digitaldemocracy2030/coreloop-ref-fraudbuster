import {
	getReportLabelCodesByGroup,
	type ReportLabelRecord,
} from "./report-labels.ts";
import {
	REPORT_STATUS_CODES,
	REPORT_VERDICT_CODES,
	type ReportVerdictCode,
} from "./report-metadata.ts";

export function getFixedRiskScoreForVerdict(verdict: ReportVerdictCode) {
	switch (verdict) {
		case REPORT_VERDICT_CODES.CONFIRMED_FRAUD:
			return 100;
		case REPORT_VERDICT_CODES.HIGH_RISK:
			return 80;
		case REPORT_VERDICT_CODES.SAFE:
		case REPORT_VERDICT_CODES.UNKNOWN:
			return 0;
	}
}

export function getRecommendedVerdict(params: {
	statusCode: string | null | undefined;
	labels: ReportLabelRecord[];
}) {
	if (params.statusCode !== REPORT_STATUS_CODES.INVESTIGATING) {
		return null;
	}

	const grouped = getReportLabelCodesByGroup(params.labels);
	if (
		grouped.genreCodes.length === 0 ||
		!grouped.impersonationCode ||
		!grouped.mediaCode ||
		!grouped.expressionCode
	) {
		return null;
	}

	if (grouped.impersonationCode === "IMPERSONATION_CELEBRITY_USED") {
		return REPORT_VERDICT_CODES.CONFIRMED_FRAUD;
	}

	if (grouped.mediaCode !== "MEDIA_NONE") {
		return REPORT_VERDICT_CODES.CONFIRMED_FRAUD;
	}

	if (
		grouped.expressionCode === "EXPRESSION_EXAGGERATED" ||
		grouped.expressionCode === "EXPRESSION_VIRUS"
	) {
		return REPORT_VERDICT_CODES.HIGH_RISK;
	}

	return REPORT_VERDICT_CODES.UNKNOWN;
}
