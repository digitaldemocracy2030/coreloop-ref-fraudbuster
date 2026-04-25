import { randomUUID } from "node:crypto";
import { reencodeAndSanitizeImage } from "./report-image-sanitizer.ts";
import {
	getReportImageStorageBucket,
	resolveSupabaseProjectOrigin,
	type StoredReportImage,
	uploadReportImageToStorage,
} from "./report-image-storage.ts";
import { MAX_REPORT_IMAGE_FILE_SIZE_BYTES } from "./report-image-upload.ts";

export class ReportScreenshotStorageConfigurationError extends Error {
	constructor() {
		super("Screenshot storage is not configured.");
		this.name = "ReportScreenshotStorageConfigurationError";
	}
}

export async function storeCapturedReportScreenshot({
	reportId,
	screenshotBuffer,
}: {
	reportId: string;
	screenshotBuffer: Buffer;
}): Promise<StoredReportImage> {
	const supabaseOrigin = resolveSupabaseProjectOrigin();
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
	if (!supabaseOrigin || !serviceRoleKey) {
		throw new ReportScreenshotStorageConfigurationError();
	}

	const sanitizedImage = await reencodeAndSanitizeImage({
		inputBuffer: screenshotBuffer,
		targetExtension: "jpg",
	});
	if (
		sanitizedImage.buffer.length <= 0 ||
		sanitizedImage.buffer.length > MAX_REPORT_IMAGE_FILE_SIZE_BYTES
	) {
		throw new Error("Captured screenshot is too large to store.");
	}

	const bucket = getReportImageStorageBucket();
	const filePath = `reports/${reportId}/auto-screenshot/${randomUUID()}.${sanitizedImage.extension}`;

	return uploadReportImageToStorage({
		bytes: sanitizedImage.buffer,
		size: sanitizedImage.buffer.length,
		bucket,
		serviceRoleKey,
		supabaseOrigin,
		filePath,
		contentType: sanitizedImage.contentType,
	});
}
