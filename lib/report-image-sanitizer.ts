import sharp from "sharp";
import type { CanonicalImageExtension } from "@/lib/report-image-upload";

const MAX_REENCODE_INPUT_PIXELS = 40_000_000;
const JPEG_REENCODE_QUALITY = 85;
const WEBP_REENCODE_QUALITY = 85;

export async function reencodeAndSanitizeImage({
	inputBuffer,
	targetExtension,
}: {
	inputBuffer: Buffer;
	targetExtension: CanonicalImageExtension;
}): Promise<{
	buffer: Buffer;
	contentType: string;
	extension: CanonicalImageExtension;
}> {
	const image = sharp(inputBuffer, {
		animated: true,
		failOn: "error",
		limitInputPixels: MAX_REENCODE_INPUT_PIXELS,
	});
	const normalized = image.rotate();

	if (targetExtension === "jpg") {
		return {
			buffer: await normalized
				.jpeg({ quality: JPEG_REENCODE_QUALITY, mozjpeg: true })
				.toBuffer(),
			contentType: "image/jpeg",
			extension: "jpg",
		};
	}
	if (targetExtension === "png") {
		return {
			buffer: await normalized.png({ compressionLevel: 9 }).toBuffer(),
			contentType: "image/png",
			extension: "png",
		};
	}
	if (targetExtension === "webp") {
		return {
			buffer: await normalized
				.webp({ quality: WEBP_REENCODE_QUALITY })
				.toBuffer(),
			contentType: "image/webp",
			extension: "webp",
		};
	}

	return {
		buffer: await normalized.gif().toBuffer(),
		contentType: "image/gif",
		extension: "gif",
	};
}
