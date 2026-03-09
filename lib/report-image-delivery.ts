import { isValidReportImageStorageUrl } from "@/lib/report-image-storage";

type ReportImageLike = {
	id: string;
	imageUrl: string;
};

export function buildReportImageProxyPath(imageId: string): string {
	return `/api/report-images/${encodeURIComponent(imageId)}`;
}

export function buildAbsoluteReportImageProxyUrl(
	imageId: string,
	requestUrl: string,
): string {
	return new URL(buildReportImageProxyPath(imageId), requestUrl).toString();
}

export function getSafeReportImageProxyPath(
	image: ReportImageLike | null | undefined,
): string | null {
	if (!image || !isValidReportImageStorageUrl(image.imageUrl)) {
		return null;
	}
	return buildReportImageProxyPath(image.id);
}

export function getSafeReportImageAbsoluteUrl(
	image: ReportImageLike | null | undefined,
	requestUrl: string,
): string | null {
	const proxyPath = getSafeReportImageProxyPath(image);
	if (!proxyPath) return null;
	return new URL(proxyPath, requestUrl).toString();
}
