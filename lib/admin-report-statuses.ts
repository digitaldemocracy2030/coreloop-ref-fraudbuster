export const ADMIN_REPORT_STATUSES_PATH = "/admin/report-statuses";
export const ADMIN_REPORT_STATUSES_PAGE_SIZE = 20;
export const ADMIN_REPORT_STATUSES_PRESENCE_FILTER_VALUES = [
	"all",
	"with",
	"without",
] as const;
export const ADMIN_REPORT_STATUSES_VERDICT_CODES = [
	"CONFIRMED_FRAUD",
	"HIGH_RISK",
	"SAFE",
	"UNKNOWN",
] as const;
export const ADMIN_REPORT_STATUSES_VERDICT_FILTER_VALUES = [
	"all",
	"none",
] as const;

export type AdminReportStatusesPresenceFilter =
	(typeof ADMIN_REPORT_STATUSES_PRESENCE_FILTER_VALUES)[number];
export type AdminReportStatusesVerdictCode =
	(typeof ADMIN_REPORT_STATUSES_VERDICT_CODES)[number];
export type AdminReportStatusesVerdictFilter =
	| (typeof ADMIN_REPORT_STATUSES_VERDICT_FILTER_VALUES)[number]
	| AdminReportStatusesVerdictCode;

export type AdminReportStatusesFilters = {
	statusIds: number[];
	verdictFilter: AdminReportStatusesVerdictFilter;
	imageFilter: AdminReportStatusesPresenceFilter;
	labelFilter: AdminReportStatusesPresenceFilter;
};

export function parseAdminReportStatusesPage(
	value: string | null | undefined,
): number {
	const page = Number.parseInt(value ?? "", 10);
	return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseAdminReportStatusesStatusIds(
	value: string | string[] | null | undefined,
): number[] {
	const values = Array.isArray(value) ? value : [value];

	return Array.from(
		new Set(
			values
				.map((item) => Number.parseInt(item ?? "", 10))
				.filter((item) => Number.isInteger(item) && item > 0),
		),
	);
}

export function parseAdminReportStatusesPresenceFilter(
	value: string | null | undefined,
): AdminReportStatusesPresenceFilter {
	return value === "with" || value === "without" ? value : "all";
}

export function parseAdminReportStatusesVerdictFilter(
	value: string | null | undefined,
): AdminReportStatusesVerdictFilter {
	if (value === "none") {
		return value;
	}

	return (
		ADMIN_REPORT_STATUSES_VERDICT_CODES.find((code) => code === value) ?? "all"
	);
}

export function parseAdminReportStatusesFilters(values: {
	statusId?: string | string[] | null | undefined;
	verdictFilter?: string | null | undefined;
	imageFilter?: string | null | undefined;
	labelFilter?: string | null | undefined;
}): AdminReportStatusesFilters {
	return {
		statusIds: parseAdminReportStatusesStatusIds(values.statusId),
		verdictFilter: parseAdminReportStatusesVerdictFilter(values.verdictFilter),
		imageFilter: parseAdminReportStatusesPresenceFilter(values.imageFilter),
		labelFilter: parseAdminReportStatusesPresenceFilter(values.labelFilter),
	};
}

export function hasActiveAdminReportStatusesFilters(
	filters: AdminReportStatusesFilters,
): boolean {
	return (
		filters.statusIds.length > 0 ||
		filters.verdictFilter !== "all" ||
		filters.imageFilter !== "all" ||
		filters.labelFilter !== "all"
	);
}

export function buildAdminReportStatusesPath(options?: {
	page?: number;
	notice?: string;
	error?: string;
	filters?: AdminReportStatusesFilters;
}): string {
	const searchParams = new URLSearchParams();
	const page = options?.page ?? 1;
	const filters = options?.filters;

	if (page > 1) {
		searchParams.set("page", String(page));
	}
	for (const statusId of filters?.statusIds ?? []) {
		searchParams.append("statusId", String(statusId));
	}
	if (filters?.verdictFilter && filters.verdictFilter !== "all") {
		searchParams.set("verdictFilter", filters.verdictFilter);
	}
	if (filters?.imageFilter && filters.imageFilter !== "all") {
		searchParams.set("imageFilter", filters.imageFilter);
	}
	if (filters?.labelFilter && filters.labelFilter !== "all") {
		searchParams.set("labelFilter", filters.labelFilter);
	}
	if (options?.notice) {
		searchParams.set("notice", options.notice);
	}
	if (options?.error) {
		searchParams.set("error", options.error);
	}

	const query = searchParams.toString();
	return query
		? `${ADMIN_REPORT_STATUSES_PATH}?${query}`
		: ADMIN_REPORT_STATUSES_PATH;
}

export function buildAdminReportStatusesUrl(
	requestUrl: string,
	options?: {
		page?: number;
		notice?: string;
		error?: string;
		filters?: AdminReportStatusesFilters;
	},
): URL {
	return new URL(buildAdminReportStatusesPath(options), requestUrl);
}
