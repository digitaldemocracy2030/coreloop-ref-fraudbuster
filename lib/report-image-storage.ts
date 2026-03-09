export const DEFAULT_REPORT_IMAGE_STORAGE_BUCKET = "report-screenshots";

export type StoredReportImage = {
	path: string;
	publicUrl: string;
	contentType: string;
	size: number;
};

export function getReportImageStorageBucket(): string {
	return (
		process.env.SUPABASE_REPORT_SCREENSHOT_BUCKET?.trim() ||
		DEFAULT_REPORT_IMAGE_STORAGE_BUCKET
	);
}

export function resolveSupabaseProjectOrigin(): string | null {
	const raw =
		process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
	if (!raw) return null;

	try {
		const parsed = new URL(raw);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			return null;
		}
		return parsed.origin;
	} catch {
		return null;
	}
}

export function buildStorageObjectUrl(
	supabaseOrigin: string,
	bucket: string,
	objectPath: string,
	publicAccess: boolean,
): string {
	const encodedBucket = encodeURIComponent(bucket);
	const encodedObjectPath = objectPath
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
	const basePath = publicAccess
		? `/storage/v1/object/public/${encodedBucket}/${encodedObjectPath}`
		: `/storage/v1/object/${encodedBucket}/${encodedObjectPath}`;
	return new URL(basePath, supabaseOrigin).toString();
}

export function isValidReportImageStorageUrl(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > 2048) return false;

	const supabaseOrigin = resolveSupabaseProjectOrigin();
	if (!supabaseOrigin) return false;

	const bucket = getReportImageStorageBucket();

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			return false;
		}
		if (parsed.origin !== supabaseOrigin) return false;

		const encodedBucket = encodeURIComponent(bucket);
		return (
			parsed.pathname.startsWith(`/storage/v1/object/public/${bucket}/`) ||
			parsed.pathname.startsWith(`/storage/v1/object/public/${encodedBucket}/`)
		);
	} catch {
		return false;
	}
}

export async function readStorageResponseText(
	response: Response,
): Promise<string> {
	try {
		return (await response.text()).slice(0, 500);
	} catch {
		return "";
	}
}

export async function uploadReportImageToStorage({
	bytes,
	size,
	bucket,
	serviceRoleKey,
	supabaseOrigin,
	filePath,
	contentType,
}: {
	bytes: Buffer;
	size: number;
	bucket: string;
	serviceRoleKey: string;
	supabaseOrigin: string;
	filePath: string;
	contentType: string;
}): Promise<StoredReportImage> {
	const uploadUrl = buildStorageObjectUrl(
		supabaseOrigin,
		bucket,
		filePath,
		false,
	);

	const uploadResponse = await fetch(uploadUrl, {
		body: new Blob([Uint8Array.from(bytes)], { type: contentType }),
		method: "POST",
		headers: {
			Authorization: `Bearer ${serviceRoleKey}`,
			apikey: serviceRoleKey,
			"Content-Type": contentType,
			"x-upsert": "false",
			"cache-control": "3600",
		},
		cache: "no-store",
	});

	if (!uploadResponse.ok) {
		const reason = await readStorageResponseText(uploadResponse);
		throw new Error(
			reason || `Storage upload failed with ${uploadResponse.status}`,
		);
	}

	return {
		path: filePath,
		publicUrl: buildStorageObjectUrl(supabaseOrigin, bucket, filePath, true),
		contentType,
		size,
	};
}

export async function cleanupStoredReportImages({
	files,
	bucket,
	serviceRoleKey,
	supabaseOrigin,
}: {
	files: StoredReportImage[];
	bucket: string;
	serviceRoleKey: string;
	supabaseOrigin: string;
}) {
	await Promise.allSettled(
		files.map((file) =>
			fetch(buildStorageObjectUrl(supabaseOrigin, bucket, file.path, false), {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${serviceRoleKey}`,
					apikey: serviceRoleKey,
				},
				cache: "no-store",
			}),
		),
	);
}
