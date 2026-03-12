import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { reencodeAndSanitizeImage } from "@/lib/report-image-sanitizer";
import {
	cleanupStoredReportImages,
	type StoredReportImage,
	uploadReportImageToStorage,
} from "@/lib/report-image-storage";
import {
	ALLOWED_REPORT_IMAGE_FORMATS_LABEL,
	type CanonicalImageExtension,
	canonicalizeImageExtension,
	canonicalizeImageMimeType,
	extractFileExtension,
	getCanonicalImageExtensionFromMimeType,
	getCanonicalMimeTypeFromImageExtension,
	isAllowedImageExtension,
	isAllowedImageMimeType,
	MAX_REPORT_IMAGE_FILE_COUNT,
	MAX_REPORT_IMAGE_FILE_SIZE_BYTES,
	normalizeImageMimeType,
} from "@/lib/report-image-upload";

export class ReportImageUploadValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ReportImageUploadValidationError";
	}
}

export type PreparedReportImage = {
	bytes: Buffer;
	contentType: string;
	extension: CanonicalImageExtension;
	size: number;
};

export function readReportImageFiles(
	formData: FormData,
	fieldName = "files",
): File[] {
	const rawFiles = formData.getAll(fieldName);

	if (rawFiles.length === 0) {
		throw new ReportImageUploadValidationError(
			"アップロードする画像を選択してください。",
		);
	}
	if (rawFiles.length > MAX_REPORT_IMAGE_FILE_COUNT) {
		throw new ReportImageUploadValidationError(
			`画像は最大${MAX_REPORT_IMAGE_FILE_COUNT}枚までです。`,
		);
	}

	const files: File[] = [];
	for (const rawFile of rawFiles) {
		if (!(rawFile instanceof File)) {
			throw new ReportImageUploadValidationError("ファイル形式が不正です。");
		}
		files.push(rawFile);
	}

	return files;
}

export async function validateAndPrepareReportImages(
	files: File[],
): Promise<PreparedReportImage[]> {
	const validatedFiles: PreparedReportImage[] = [];

	for (const file of files) {
		const normalizedMimeType = normalizeImageMimeType(file.type);
		const fileExtension = extractFileExtension(file.name);
		const hasAllowedMimeType =
			normalizedMimeType.length > 0 &&
			isAllowedImageMimeType(normalizedMimeType);
		const hasAllowedExtension = isAllowedImageExtension(fileExtension);

		if (!hasAllowedMimeType && !hasAllowedExtension) {
			throw new ReportImageUploadValidationError(
				`${ALLOWED_REPORT_IMAGE_FORMATS_LABEL} のみ添付できます。`,
			);
		}
		if (file.size <= 0) {
			throw new ReportImageUploadValidationError(
				"空のファイルはアップロードできません。",
			);
		}
		if (file.size > MAX_REPORT_IMAGE_FILE_SIZE_BYTES) {
			throw new ReportImageUploadValidationError(
				`各ファイルは${Math.floor(MAX_REPORT_IMAGE_FILE_SIZE_BYTES / 1024 / 1024)}MB以下にしてください。`,
			);
		}

		const rawBuffer = Buffer.from(await file.arrayBuffer());
		const detectedType = await fileTypeFromBuffer(rawBuffer);
		const detectedMimeType = canonicalizeImageMimeType(detectedType?.mime);
		if (!detectedMimeType) {
			throw new ReportImageUploadValidationError(
				`不正なファイル形式です。${ALLOWED_REPORT_IMAGE_FORMATS_LABEL} のみ添付できます。`,
			);
		}

		const detectedExtension = canonicalizeImageExtension(detectedType?.ext);
		const declaredCanonicalMimeType =
			getCanonicalMimeTypeFromImageExtension(fileExtension) ??
			canonicalizeImageMimeType(normalizedMimeType);
		const extension =
			detectedExtension ??
			getCanonicalImageExtensionFromMimeType(declaredCanonicalMimeType) ??
			getCanonicalImageExtensionFromMimeType(detectedMimeType) ??
			"jpg";

		let sanitizedImage: {
			buffer: Buffer;
			contentType: string;
			extension: CanonicalImageExtension;
		};
		try {
			sanitizedImage = await reencodeAndSanitizeImage({
				inputBuffer: rawBuffer,
				targetExtension: extension,
			});
		} catch {
			throw new ReportImageUploadValidationError(
				`${file.name} の画像処理に失敗しました。別の画像で再試行してください。`,
			);
		}

		if (sanitizedImage.buffer.length <= 0) {
			throw new ReportImageUploadValidationError(
				`${file.name} の画像処理結果が不正です。別の画像で再試行してください。`,
			);
		}
		if (sanitizedImage.buffer.length > MAX_REPORT_IMAGE_FILE_SIZE_BYTES) {
			throw new ReportImageUploadValidationError(
				`${file.name} は画像処理後に${Math.floor(
					MAX_REPORT_IMAGE_FILE_SIZE_BYTES / 1024 / 1024,
				)}MBを超えました。別の画像で再試行してください。`,
			);
		}

		validatedFiles.push({
			bytes: sanitizedImage.buffer,
			contentType: sanitizedImage.contentType,
			extension: sanitizedImage.extension,
			size: sanitizedImage.buffer.length,
		});
	}

	return validatedFiles;
}

export async function storePreparedReportImages({
	files,
	bucket,
	serviceRoleKey,
	supabaseOrigin,
	storagePrefix,
}: {
	files: PreparedReportImage[];
	bucket: string;
	serviceRoleKey: string;
	supabaseOrigin: string;
	storagePrefix: string;
}): Promise<StoredReportImage[]> {
	const uploadedFiles: StoredReportImage[] = [];

	try {
		for (const file of files) {
			const fileName = `${randomUUID()}.${file.extension}`;
			const filePath = `${storagePrefix.replace(/\/+$/, "")}/${fileName}`;

			const uploadedFile = await uploadReportImageToStorage({
				bytes: file.bytes,
				size: file.size,
				bucket,
				serviceRoleKey,
				supabaseOrigin,
				filePath,
				contentType: file.contentType,
			});
			uploadedFiles.push(uploadedFile);
		}

		return uploadedFiles;
	} catch (error) {
		await cleanupStoredReportImages({
			files: uploadedFiles,
			bucket,
			serviceRoleKey,
			supabaseOrigin,
		});
		throw error;
	}
}
