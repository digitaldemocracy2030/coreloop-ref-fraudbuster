import { randomUUID } from "node:crypto";
import {
	badRequestResponse,
	errorResponse,
	successResponse,
} from "@/lib/api-utils";

const MAX_UPLOAD_FILE_COUNT = 5;
const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_STORAGE_BUCKET = "report-screenshots";
const ALLOWED_CONTENT_TYPES = new Map<string, string>([
	["image/jpeg", "jpg"],
	["image/png", "png"],
]);

type UploadedScreenshot = {
	path: string;
	publicUrl: string;
	contentType: string;
	size: number;
};

function resolveSupabaseProjectUrl(): string | null {
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

function createStorageObjectPath(contentType: string): string {
	const extension = ALLOWED_CONTENT_TYPES.get(contentType) ?? "bin";
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");
	const day = String(now.getUTCDate()).padStart(2, "0");
	return `reports/${year}/${month}/${day}/${randomUUID()}.${extension}`;
}

function buildStorageObjectUrl(
	supabaseUrl: string,
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
	return new URL(basePath, supabaseUrl).toString();
}

async function readResponseText(response: Response): Promise<string> {
	try {
		return (await response.text()).slice(0, 500);
	} catch {
		return "";
	}
}

async function uploadToStorage({
	file,
	bucket,
	serviceRoleKey,
	supabaseUrl,
}: {
	file: File;
	bucket: string;
	serviceRoleKey: string;
	supabaseUrl: string;
}): Promise<UploadedScreenshot> {
	const objectPath = createStorageObjectPath(file.type);
	const uploadUrl = buildStorageObjectUrl(
		supabaseUrl,
		bucket,
		objectPath,
		false,
	);

	const uploadResponse = await fetch(uploadUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${serviceRoleKey}`,
			apikey: serviceRoleKey,
			"Content-Type": file.type,
			"x-upsert": "false",
			"cache-control": "3600",
		},
		body: file,
		cache: "no-store",
	});

	if (!uploadResponse.ok) {
		const reason = await readResponseText(uploadResponse);
		throw new Error(
			reason || `Storage upload failed with ${uploadResponse.status}`,
		);
	}

	return {
		path: objectPath,
		publicUrl: buildStorageObjectUrl(supabaseUrl, bucket, objectPath, true),
		contentType: file.type,
		size: file.size,
	};
}

async function cleanupUploadedFiles({
	files,
	bucket,
	serviceRoleKey,
	supabaseUrl,
}: {
	files: UploadedScreenshot[];
	bucket: string;
	serviceRoleKey: string;
	supabaseUrl: string;
}) {
	await Promise.allSettled(
		files.map((file) =>
			fetch(buildStorageObjectUrl(supabaseUrl, bucket, file.path, false), {
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

/**
 * POST /api/reports/upload-images
 * Upload screenshots to Supabase Storage and return public URLs
 */
export async function POST(request: Request) {
	try {
		const supabaseUrl = resolveSupabaseProjectUrl();
		const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
		const bucket =
			process.env.SUPABASE_REPORT_SCREENSHOT_BUCKET?.trim() ||
			DEFAULT_STORAGE_BUCKET;

		if (!supabaseUrl || !serviceRoleKey) {
			return errorResponse(
				"Storageの設定が不足しています。管理者へお問い合わせください。",
				503,
			);
		}

		const formData = await request.formData();
		const rawFiles = formData.getAll("files");

		if (rawFiles.length === 0) {
			return badRequestResponse("アップロードする画像を選択してください。");
		}
		if (rawFiles.length > MAX_UPLOAD_FILE_COUNT) {
			return badRequestResponse("スクリーンショットは最大5枚までです。");
		}

		const files: File[] = [];
		for (const rawFile of rawFiles) {
			if (!(rawFile instanceof File)) {
				return badRequestResponse("ファイル形式が不正です。");
			}
			files.push(rawFile);
		}

		for (const file of files) {
			if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
				return badRequestResponse("JPG または PNG のみ添付できます。");
			}
			if (file.size <= 0) {
				return badRequestResponse("空のファイルはアップロードできません。");
			}
			if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
				return badRequestResponse("各ファイルは5MB以下にしてください。");
			}
		}

		const uploadedFiles: UploadedScreenshot[] = [];
		try {
			for (const file of files) {
				const uploadedFile = await uploadToStorage({
					file,
					bucket,
					serviceRoleKey,
					supabaseUrl,
				});
				uploadedFiles.push(uploadedFile);
			}
		} catch (uploadError) {
			await cleanupUploadedFiles({
				files: uploadedFiles,
				bucket,
				serviceRoleKey,
				supabaseUrl,
			});
			throw uploadError;
		}

		return successResponse({ files: uploadedFiles }, 201);
	} catch (error) {
		console.error("Failed to upload screenshots:", error);
		return errorResponse(
			"スクリーンショットのアップロードに失敗しました。",
			502,
		);
	}
}
