import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import {
	canonicalizeImageMimeType,
	getCanonicalImageExtensionFromMimeType,
	MAX_REPORT_IMAGE_FILE_SIZE_BYTES,
} from "@/lib/report-image-upload";
import { reencodeAndSanitizeImage } from "@/lib/report-image-sanitizer";
import {
	getReportImageStorageBucket,
	resolveSupabaseProjectOrigin,
	type StoredReportImage,
	uploadReportImageToStorage,
} from "@/lib/report-image-storage";
import { fetchSafeExternalImage } from "@/lib/report-link-preview";

export async function mirrorReportPreviewThumbnail({
	reportId,
	thumbnailUrl,
}: {
	reportId: string;
	thumbnailUrl: string;
}): Promise<StoredReportImage | null> {
	const supabaseOrigin = resolveSupabaseProjectOrigin();
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
	if (!supabaseOrigin || !serviceRoleKey) {
		return null;
	}

	const fetchedImage = await fetchSafeExternalImage(thumbnailUrl);
	if (!fetchedImage) {
		return null;
	}

	const detectedType = await fileTypeFromBuffer(fetchedImage.buffer);
	const detectedMimeType =
		canonicalizeImageMimeType(detectedType?.mime) ??
		canonicalizeImageMimeType(fetchedImage.contentType);
	if (!detectedMimeType) {
		return null;
	}

	const targetExtension =
		getCanonicalImageExtensionFromMimeType(detectedMimeType);
	if (!targetExtension) {
		return null;
	}

	let sanitizedImage: Awaited<ReturnType<typeof reencodeAndSanitizeImage>>;
	try {
		sanitizedImage = await reencodeAndSanitizeImage({
			inputBuffer: fetchedImage.buffer,
			targetExtension,
		});
	} catch {
		return null;
	}

	if (
		sanitizedImage.buffer.length <= 0 ||
		sanitizedImage.buffer.length > MAX_REPORT_IMAGE_FILE_SIZE_BYTES
	) {
		return null;
	}

	const bucket = getReportImageStorageBucket();
	const filePath = `reports/preview/${reportId}/${randomUUID()}.${sanitizedImage.extension}`;

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
