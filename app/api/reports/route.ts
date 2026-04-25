import { customAlphabet } from "nanoid";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import {
	badRequestResponse,
	errorResponse,
	getClientIp,
	successResponse,
	verifyTurnstileToken,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getSafeReportImageAbsoluteUrl } from "@/lib/report-image-delivery";
import {
	ReportImageUploadValidationError,
	readReportImageFiles,
	storePreparedReportImages,
	validateAndPrepareReportImages,
} from "@/lib/report-image-ingest";
import {
	cleanupStoredReportImages,
	getReportImageStorageBucket,
	resolveSupabaseProjectOrigin,
	type StoredReportImage,
} from "@/lib/report-image-storage";
import { PUBLIC_REPORT_IMAGE_UPLOAD_LIMITS } from "@/lib/report-image-upload";
import { flattenReportLabelNames } from "@/lib/report-labels";
import { fetchReportLinkPreview } from "@/lib/report-link-preview";
import {
	getReportStatusMeta,
	getReportVerdictMeta,
	isReportStatusCode,
	isReportVerdictCode,
	REPORT_STATUS_CODES,
} from "@/lib/report-metadata";
import { createReportScreenshotJob } from "@/lib/report-screenshot-jobs";
import { mirrorReportPreviewThumbnail } from "@/lib/report-thumbnail-ingest";
import type {
	ReportSortOrder,
	ReportSummary,
	ReportsListResponse,
} from "@/lib/types/api";

function parseOptionalInteger(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) return undefined;
	return parsed;
}

function parseSortOrder(value: string | null): ReportSortOrder {
	return value === "popular" ? "popular" : "newest";
}

type CreateReportSubmission = {
	url: string;
	title: string | null;
	description: string | null;
	platformId: number | undefined;
	turnstileToken: string;
	spamTrap: string;
	formStartedAt: number;
	imageFiles: File[];
};

function getTrimmedFormDataValue(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function getNullableFormDataValue(
	formData: FormData,
	key: string,
): string | null {
	const value = formData.get(key);
	return typeof value === "string" ? value : null;
}

async function parseCreateReportSubmission(
	request: NextRequest,
): Promise<CreateReportSubmission> {
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (contentType.includes("multipart/form-data")) {
		const formData = await request.formData();
		const submittedTitle = getTrimmedFormDataValue(formData, "title");

		return {
			url: getTrimmedFormDataValue(formData, "url"),
			title: submittedTitle.length > 0 ? submittedTitle : null,
			description: getNullableFormDataValue(formData, "description"),
			platformId: parseOptionalInteger(
				getTrimmedFormDataValue(formData, "platformId"),
			),
			turnstileToken: getTrimmedFormDataValue(formData, "turnstileToken"),
			spamTrap: getTrimmedFormDataValue(formData, "spamTrap"),
			formStartedAt: Number(getTrimmedFormDataValue(formData, "formStartedAt")),
			imageFiles: readReportImageFiles(formData, "files", {
				...PUBLIC_REPORT_IMAGE_UPLOAD_LIMITS,
				required: false,
			}),
		};
	}

	const body = await request.json();
	const submittedTitle =
		typeof body.title === "string" ? body.title.trim() : "";

	return {
		url: typeof body.url === "string" ? body.url.trim() : "",
		title: submittedTitle.length > 0 ? submittedTitle : null,
		description: typeof body.description === "string" ? body.description : null,
		platformId:
			typeof body.platformId === "string" || typeof body.platformId === "number"
				? parseOptionalInteger(String(body.platformId))
				: undefined,
		turnstileToken:
			typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "",
		spamTrap: typeof body.spamTrap === "string" ? body.spamTrap.trim() : "",
		formStartedAt:
			typeof body.formStartedAt === "number" ? body.formStartedAt : Number.NaN,
		imageFiles: [],
	};
}

const SUBMISSION_WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 100;
const MIN_FORM_COMPLETION_MS = 4 * 1000;
const rateLimitStore = new Map<string, number[]>();

const createReportId = customAlphabet(
	"0123456789abcdefghijklmnopqrstuvwxyz",
	12,
);

function isPresent<T>(value: T | null): value is T {
	return value !== null;
}

function toReportStatusRef(
	status: {
		id: number;
		statusCode: string;
		label: string;
	} | null,
) {
	if (!status) {
		return null;
	}

	const statusMeta = getReportStatusMeta(status.statusCode);
	return {
		id: status.id,
		code:
			statusMeta && isReportStatusCode(status.statusCode)
				? status.statusCode
				: REPORT_STATUS_CODES.PENDING,
		label: statusMeta?.label ?? status.label,
	};
}

function toReportVerdictRef(verdict: string | null) {
	const verdictMeta = getReportVerdictMeta(verdict);
	if (!verdictMeta || !verdict || !isReportVerdictCode(verdict)) {
		return null;
	}

	return {
		code: verdict,
		label: verdictMeta.label,
	};
}

function toSafeReportResponseImage(
	image: {
		id: string;
		imageUrl: string;
	},
	requestUrl: string,
) {
	const imageUrl = getSafeReportImageAbsoluteUrl(image, requestUrl);
	if (!imageUrl) {
		return null;
	}

	return {
		id: image.id,
		imageUrl,
	};
}

function maybeCleanupRateLimitStore(now: number) {
	if (rateLimitStore.size < 100 || Math.random() > 0.02) return;
	for (const [key, timestamps] of rateLimitStore.entries()) {
		const active = timestamps.filter(
			(timestamp) => now - timestamp < SUBMISSION_WINDOW_MS,
		);
		if (active.length === 0) {
			rateLimitStore.delete(key);
			continue;
		}
		rateLimitStore.set(key, active);
	}
}

function checkAndRecordSubmission(key: string): {
	allowed: boolean;
	retryAfterSeconds?: number;
} {
	const now = Date.now();
	maybeCleanupRateLimitStore(now);

	const timestamps = (rateLimitStore.get(key) ?? []).filter(
		(timestamp) => now - timestamp < SUBMISSION_WINDOW_MS,
	);

	if (timestamps.length >= MAX_SUBMISSIONS_PER_WINDOW) {
		const oldest = timestamps[0];
		return {
			allowed: false,
			retryAfterSeconds: oldest
				? Math.ceil((SUBMISSION_WINDOW_MS - (now - oldest)) / 1000)
				: 60,
		};
	}

	timestamps.push(now);
	rateLimitStore.set(key, timestamps);

	return { allowed: true };
}

/**
 * GET /api/reports
 * List reports with filtering and search
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const query = searchParams.get("q")?.trim() || undefined;
		const cursor = searchParams.get("cursor") || undefined;
		const platformId = parseOptionalInteger(searchParams.get("platformId"));
		const categoryId = parseOptionalInteger(searchParams.get("categoryId"));
		const statusId = parseOptionalInteger(searchParams.get("statusId"));
		const sort = parseSortOrder(searchParams.get("sort"));
		const limitParam = searchParams.get("limit");
		const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 12;
		const take = Number.isNaN(parsedLimit)
			? 12
			: Math.min(Math.max(parsedLimit, 1), 30);

		const orderBy =
			sort === "popular"
				? [{ reportCount: "desc" as const }, { id: "desc" as const }]
				: [{ createdAt: "desc" as const }, { id: "desc" as const }];

		const reports = await prisma.report.findMany({
			where: {
				AND: [
					query
						? {
								OR: [
									{ url: { contains: query, mode: "insensitive" as const } },
									{ title: { contains: query, mode: "insensitive" as const } },
									{
										description: {
											contains: query,
											mode: "insensitive" as const,
										},
									},
								],
							}
						: {},
					platformId ? { platformId } : {},
					categoryId ? { categoryId } : {},
					statusId ? { statusId } : {},
				],
			},
			select: {
				id: true,
				url: true,
				title: true,
				description: true,
				createdAt: true,
				riskScore: true,
				platform: {
					select: {
						id: true,
						name: true,
					},
				},
				category: {
					select: {
						id: true,
						name: true,
					},
				},
				status: {
					select: {
						id: true,
						statusCode: true,
						label: true,
					},
				},
				verdict: true,
				reportLabels: {
					select: {
						label: {
							select: {
								code: true,
								name: true,
								groupCode: true,
								displayOrder: true,
							},
						},
					},
					orderBy: [
						{ label: { displayOrder: "asc" } },
						{ label: { name: "asc" } },
					],
				},
				images: {
					select: {
						id: true,
						imageUrl: true,
					},
					take: 1,
					orderBy: { displayOrder: "asc" as const },
				},
			},
			orderBy,
			take: take + 1,
			...(cursor
				? {
						cursor: { id: cursor },
						skip: 1,
					}
				: {}),
		});

		const hasMore = reports.length > take;
		const items = hasMore ? reports.slice(0, take) : reports;
		const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

		const response: ReportsListResponse = {
			items: items.map(
				(report): ReportSummary => ({
					...report,
					createdAt: report.createdAt?.toISOString() ?? null,
					status: toReportStatusRef(report.status),
					verdict: toReportVerdictRef(report.verdict),
					labels: flattenReportLabelNames(
						report.reportLabels.map((item) => item.label),
					),
					images: report.images
						.map((image) => toSafeReportResponseImage(image, request.url))
						.filter(isPresent),
				}),
			),
			nextCursor,
		};

		return successResponse(response);
	} catch (error) {
		console.error("Failed to fetch reports:", error);
		return errorResponse("Internal Server Error");
	}
}

/**
 * POST /api/reports
 * Create a new report
 */
export async function POST(request: NextRequest) {
	let mirroredThumbnail: StoredReportImage | null = null;
	let uploadedImages: StoredReportImage[] = [];
	let reportCreated = false;
	const bucket = getReportImageStorageBucket();
	const supabaseOrigin = resolveSupabaseProjectOrigin();
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

	try {
		const {
			url,
			title,
			description,
			platformId,
			turnstileToken,
			spamTrap,
			formStartedAt,
			imageFiles,
		} = await parseCreateReportSubmission(request);
		const clientIp = getClientIp(request);
		const userAgent = request.headers.get("user-agent")?.trim() || "unknown";
		const rateLimitKey = clientIp
			? `ip:${clientIp}`
			: `ua:${userAgent.slice(0, 160).toLowerCase()}`;

		if (!url) {
			return badRequestResponse("URL is required");
		}
		if (!platformId) {
			return badRequestResponse("プラットフォームは必須です");
		}

		if (spamTrap) {
			return successResponse({ ignored: true }, 201);
		}

		if (!Number.isFinite(formStartedAt)) {
			return badRequestResponse("送信情報が不足しています");
		}

		if (!turnstileToken) {
			return badRequestResponse("Turnstileトークンが未指定です");
		}
		if (Date.now() - formStartedAt < MIN_FORM_COMPLETION_MS) {
			return errorResponse(
				"送信が速すぎます。内容を確認してから再度お試しください。",
				429,
			);
		}

		const rateLimit = checkAndRecordSubmission(rateLimitKey);
		if (!rateLimit.allowed) {
			return Response.json(
				{ error: "送信回数が多すぎます。時間を空けて再試行してください。" },
				{
					status: 429,
					headers: {
						"Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
					},
				},
			);
		}

		const turnstileResult = await verifyTurnstileToken(
			turnstileToken,
			clientIp,
		);
		if (!turnstileResult.success) {
			console.error(
				"Turnstile verification rejected",
				turnstileResult.errorCodes,
			);
			const isServerMisconfigured =
				turnstileResult.errorCodes.includes("missing-secret-key");
			return errorResponse(
				isServerMisconfigured
					? "スパム対策設定エラーです。管理者へお問い合わせください。"
					: "スパム対策チェックに失敗しました。再試行してください。",
				isServerMisconfigured ? 503 : 403,
			);
		}

		const [impersonationCategory, pendingStatus] = await Promise.all([
			prisma.fraudCategory.findUnique({
				where: { name: "なりすまし" },
				select: { id: true },
			}),
			prisma.reportStatus.findUnique({
				where: { statusCode: REPORT_STATUS_CODES.PENDING },
				select: { id: true },
			}),
		]);
		if (!impersonationCategory) {
			return errorResponse(
				"通報カテゴリの設定が見つかりません。管理者へお問い合わせください。",
				503,
			);
		}
		if (!pendingStatus) {
			return errorResponse(
				"通報ステータスの設定が見つかりません。管理者へお問い合わせください。",
				503,
			);
		}

		const reportId = createReportId();
		if (imageFiles.length > 0) {
			if (!supabaseOrigin || !serviceRoleKey) {
				return errorResponse(
					"画像アップロード設定が不足しています。管理者へお問い合わせください。",
					503,
				);
			}

			const preparedImages = await validateAndPrepareReportImages(
				imageFiles,
				PUBLIC_REPORT_IMAGE_UPLOAD_LIMITS,
			);
			uploadedImages = await storePreparedReportImages({
				files: preparedImages,
				bucket,
				serviceRoleKey,
				supabaseOrigin,
				storagePrefix: `reports/${reportId}/user`,
			});
		}

		const reportPreview = await fetchReportLinkPreview(url);
		if (reportPreview.thumbnailUrl) {
			try {
				mirroredThumbnail = await mirrorReportPreviewThumbnail({
					reportId,
					thumbnailUrl: reportPreview.thumbnailUrl,
				});
			} catch (thumbnailError) {
				console.error(
					"Failed to ingest external report thumbnail:",
					thumbnailError,
				);
			}
		}

		const createdImages = [
			...(mirroredThumbnail
				? [
						{
							imageUrl: mirroredThumbnail.publicUrl,
							displayOrder: 0,
						},
					]
				: []),
			...uploadedImages.map((file, index) => ({
				imageUrl: file.publicUrl,
				displayOrder: index + (mirroredThumbnail ? 1 : 0),
			})),
		];

		const report = await prisma.$transaction(async (tx) => {
			const createdReport = await tx.report.create({
				data: {
					id: reportId,
					url,
					title: reportPreview.title ?? title,
					description,
					platformId,
					categoryId: impersonationCategory.id,
					statusId: pendingStatus.id,
					riskScore: 0,
					reportCount: 1,
					sourceIp: clientIp,
					images:
						createdImages.length > 0
							? {
									createMany: {
										data: createdImages,
									},
								}
							: undefined,
				},
				select: {
					id: true,
					url: true,
					title: true,
					description: true,
					createdAt: true,
					riskScore: true,
					status: {
						select: {
							id: true,
							statusCode: true,
							label: true,
						},
					},
					verdict: true,
					reportLabels: {
						select: {
							label: {
								select: {
									code: true,
									name: true,
									groupCode: true,
									displayOrder: true,
								},
							},
						},
						orderBy: [
							{ label: { displayOrder: "asc" } },
							{ label: { name: "asc" } },
						],
					},
					images: {
						select: {
							id: true,
							imageUrl: true,
						},
						take: 1,
						orderBy: { displayOrder: "asc" as const },
					},
				},
			});

			// Create an initial timeline entry
			await tx.reportTimeline.create({
				data: {
					reportId: createdReport.id,
					actionLabel: "通報受領",
					description: "システムによる自動受付完了",
				},
			});

			await createReportScreenshotJob({
				tx,
				reportId: createdReport.id,
				url,
			});

			return createdReport;
		});
		reportCreated = true;

		try {
			revalidateTag("reports", "max");
			revalidateTag("home-stats", "max");
		} catch (cacheError) {
			console.error("Failed to revalidate cache tags:", cacheError);
		}

		return successResponse(
			{
				...report,
				status: toReportStatusRef(report.status),
				verdict: toReportVerdictRef(report.verdict),
				labels: flattenReportLabelNames(
					report.reportLabels.map((item) => item.label),
				),
				images: report.images
					.map((image) => toSafeReportResponseImage(image, request.url))
					.filter(isPresent),
			},
			201,
		);
	} catch (error) {
		if (error instanceof ReportImageUploadValidationError) {
			return badRequestResponse(error.message);
		}

		const filesToCleanup = [
			...(mirroredThumbnail ? [mirroredThumbnail] : []),
			...uploadedImages,
		];
		if (
			!reportCreated &&
			filesToCleanup.length > 0 &&
			supabaseOrigin &&
			serviceRoleKey
		) {
			await cleanupStoredReportImages({
				files: filesToCleanup,
				bucket,
				serviceRoleKey,
				supabaseOrigin,
			});
		}

		console.error("Failed to create report:", error);
		return errorResponse("Internal Server Error");
	}
}
