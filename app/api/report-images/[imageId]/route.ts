import { errorResponse, notFoundResponse } from "@/lib/api-utils";
import { canonicalizeImageMimeType } from "@/lib/report-image-upload";
import { isValidReportImageStorageUrl } from "@/lib/report-image-storage";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/report-images/[imageId]
 * Proxy a stored report image through the app origin.
 */
export async function GET(
	_request: Request,
	ctx: {
		params: Promise<{ imageId: string }>;
	},
) {
	try {
		const { imageId } = await ctx.params;

		const image = await prisma.reportImage.findUnique({
			where: { id: imageId },
			select: {
				imageUrl: true,
			},
		});
		if (!image || !isValidReportImageStorageUrl(image.imageUrl)) {
			return notFoundResponse("Image not found");
		}

		const upstream = await fetch(image.imageUrl, {
			cache: "force-cache",
			redirect: "error",
		});
		if (!upstream.ok || !upstream.body) {
			return notFoundResponse("Image not found");
		}

		const contentType = canonicalizeImageMimeType(
			upstream.headers.get("content-type"),
		);
		if (!contentType) {
			return notFoundResponse("Image not found");
		}

		const headers = new Headers();
		headers.set("Cache-Control", "public, max-age=300, s-maxage=86400");
		headers.set("Content-Type", contentType);
		headers.set("X-Content-Type-Options", "nosniff");

		const contentLength = upstream.headers.get("content-length");
		if (contentLength) {
			headers.set("Content-Length", contentLength);
		}

		return new Response(upstream.body, {
			status: upstream.status,
			headers,
		});
	} catch (error) {
		console.error("Failed to proxy report image:", error);
		return errorResponse("Internal Server Error");
	}
}
