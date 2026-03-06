const IMAGE_MIME_ALIASES = {
	"image/jpeg": "image/jpeg",
	"image/jpg": "image/jpeg",
	"image/pjpeg": "image/jpeg",
	"image/png": "image/png",
	"image/x-png": "image/png",
	"image/apng": "image/png",
	"image/gif": "image/gif",
	"image/webp": "image/webp",
} as const;

const IMAGE_EXTENSION_ALIASES = {
	jpg: "jpg",
	jpeg: "jpg",
	png: "png",
	apng: "png",
	gif: "gif",
	webp: "webp",
} as const;

const CANONICAL_MIME_BY_EXTENSION = {
	jpg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
} as const;

export const MAX_REPORT_IMAGE_FILE_COUNT = 5;
export const MAX_REPORT_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_REPORT_IMAGE_FORMATS_LABEL =
	"JPG / JPEG / PNG / GIF / WEBP";
export const REPORT_IMAGE_INPUT_ACCEPT = [
	"image/jpeg",
	"image/png",
	"image/apng",
	"image/gif",
	"image/webp",
].join(",");

type CanonicalImageMimeType =
	(typeof IMAGE_MIME_ALIASES)[keyof typeof IMAGE_MIME_ALIASES];

export type CanonicalImageExtension =
	(typeof IMAGE_EXTENSION_ALIASES)[keyof typeof IMAGE_EXTENSION_ALIASES];

export function normalizeImageMimeType(
	mimeType: string | null | undefined,
): string {
	return (mimeType ?? "").trim().toLowerCase();
}

export function canonicalizeImageMimeType(
	mimeType: string | null | undefined,
): CanonicalImageMimeType | null {
	const normalizedMimeType = normalizeImageMimeType(mimeType);
	if (!normalizedMimeType) return null;
	return (
		IMAGE_MIME_ALIASES[normalizedMimeType as keyof typeof IMAGE_MIME_ALIASES] ??
		null
	);
}

export function isAllowedImageMimeType(
	mimeType: string | null | undefined,
): boolean {
	return canonicalizeImageMimeType(mimeType) !== null;
}

export function extractFileExtension(fileName: string): string | null {
	const trimmedFileName = fileName.trim();
	const dotIndex = trimmedFileName.lastIndexOf(".");
	if (dotIndex <= 0 || dotIndex === trimmedFileName.length - 1) {
		return null;
	}
	return trimmedFileName.slice(dotIndex + 1).toLowerCase();
}

export function canonicalizeImageExtension(
	extension: string | null | undefined,
): CanonicalImageExtension | null {
	const normalizedExtension = (extension ?? "").trim().toLowerCase();
	if (!normalizedExtension) return null;
	return (
		IMAGE_EXTENSION_ALIASES[
			normalizedExtension as keyof typeof IMAGE_EXTENSION_ALIASES
		] ?? null
	);
}

export function isAllowedImageExtension(
	extension: string | null | undefined,
): boolean {
	return canonicalizeImageExtension(extension) !== null;
}

export function getCanonicalMimeTypeFromImageExtension(
	extension: string | null | undefined,
): CanonicalImageMimeType | null {
	const canonicalExtension = canonicalizeImageExtension(extension);
	if (!canonicalExtension) return null;
	return CANONICAL_MIME_BY_EXTENSION[canonicalExtension];
}

export function getCanonicalImageExtensionFromMimeType(
	mimeType: string | null | undefined,
): CanonicalImageExtension | null {
	const canonicalMimeType = canonicalizeImageMimeType(mimeType);
	if (!canonicalMimeType) return null;

	if (canonicalMimeType === "image/jpeg") return "jpg";
	if (canonicalMimeType === "image/png") return "png";
	if (canonicalMimeType === "image/gif") return "gif";
	if (canonicalMimeType === "image/webp") return "webp";

	return null;
}
