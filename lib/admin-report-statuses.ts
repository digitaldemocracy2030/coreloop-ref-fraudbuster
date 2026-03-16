export const ADMIN_REPORT_STATUSES_PATH = "/admin/report-statuses";
export const ADMIN_REPORT_STATUSES_PAGE_SIZE = 20;

export function parseAdminReportStatusesPage(
	value: string | null | undefined,
): number {
	const page = Number.parseInt(value ?? "", 10);
	return Number.isInteger(page) && page > 0 ? page : 1;
}

export function buildAdminReportStatusesUrl(
	requestUrl: string,
	options?: {
		page?: number;
		notice?: string;
		error?: string;
	},
): URL {
	const url = new URL(ADMIN_REPORT_STATUSES_PATH, requestUrl);
	const page = options?.page ?? 1;

	if (page > 1) {
		url.searchParams.set("page", String(page));
	}
	if (options?.notice) {
		url.searchParams.set("notice", options.notice);
	}
	if (options?.error) {
		url.searchParams.set("error", options.error);
	}

	return url;
}
