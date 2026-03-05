export type ReportSortOrder = "newest" | "popular";

export type ReportSummary = {
	id: string;
	url: string;
	title: string | null;
	description: string | null;
	createdAt: string | null;
	riskScore: number | null;
	platform: {
		id: number;
		name: string;
	} | null;
	category: {
		id: number;
		name: string;
	} | null;
	status: {
		id: number;
		label: string;
	} | null;
	images: Array<{
		id: string;
		imageUrl: string;
	}>;
};

export type ReportsListResponse = {
	items: ReportSummary[];
	nextCursor: string | null;
};

export type ReportDetailImage = {
	id: string;
	imageUrl: string;
	displayOrder: number | null;
	createdAt: string | null;
};

export type ReportTimelineItem = {
	id: string;
	actionLabel: string;
	description: string | null;
	occurredAt: string | null;
	admin: {
		name: string | null;
	} | null;
};

export type ReportDetailResponse = {
	id: string;
	url: string;
	title: string | null;
	description: string | null;
	createdAt: string | null;
	riskScore: number | null;
	platform: {
		id: number;
		name: string;
	} | null;
	category: {
		id: number;
		name: string;
	} | null;
	status: {
		id: number;
		label: string;
	} | null;
	images: ReportDetailImage[];
	timelines: ReportTimelineItem[];
};

export type StatisticsBreakdownItem = {
	id: number | null;
	label: string;
	count: number;
};

export type StatisticsTrendItem = {
	date: string;
	count: number;
};

export type StatisticsResponse = {
	summary: {
		totalReports: number;
		highRiskReports: number;
		todayReports: number;
		topPlatform: string | null;
	};
	breakdown: {
		status: StatisticsBreakdownItem[];
		category: StatisticsBreakdownItem[];
		platform: StatisticsBreakdownItem[];
	};
	trend: StatisticsTrendItem[];
	updatedAt: string;
};
