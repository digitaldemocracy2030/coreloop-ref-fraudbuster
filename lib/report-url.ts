export function maskReportUrl(url: string) {
	const trimmedUrl = url.trim();

	if (trimmedUrl.length <= 24) {
		return trimmedUrl;
	}

	return `${trimmedUrl.slice(0, 16)}...${trimmedUrl.slice(-8)}`;
}
