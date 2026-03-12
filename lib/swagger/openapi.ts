type OpenApiDocument = {
	openapi: string;
	info: {
		title: string;
		version: string;
		description: string;
	};
	servers: Array<{
		url: string;
		description: string;
	}>;
	tags: Array<{
		name: string;
		description: string;
	}>;
	paths: Record<string, unknown>;
	components: {
		schemas: Record<string, unknown>;
	};
};

const errorResponseSchema = {
	type: "object",
	required: ["error"],
	properties: {
		error: { type: "string" },
		message: { type: "string" },
	},
};

export function createOpenApiDocument(origin: string): OpenApiDocument {
	return {
		openapi: "3.0.3",
		info: {
			title: "AntiFraud API",
			version: "1.0.0",
			description:
				"AntiFraud の公開 API 仕様です。実装は Next.js App Router の Route Handler に対応しています。",
		},
		servers: [
			{
				url: origin,
				description: "Current environment",
			},
		],
		tags: [
			{
				name: "Reports",
				description: "通報データの検索・投稿・詳細取得",
			},
			{
				name: "Statistics",
				description: "ダッシュボード用の集計情報",
			},
		],
		paths: {
			"/api/reports": {
				get: {
					tags: ["Reports"],
					summary: "通報一覧を取得",
					description:
						"キーワード検索、カテゴリ・プラットフォーム・ステータス絞り込み、カーソルページネーションに対応します。",
					parameters: [
						{
							name: "q",
							in: "query",
							schema: { type: "string" },
							description: "検索キーワード",
						},
						{
							name: "cursor",
							in: "query",
							schema: { type: "string" },
							description: "次ページ取得用カーソル",
						},
						{
							name: "platformId",
							in: "query",
							schema: { type: "integer", minimum: 1 },
						},
						{
							name: "categoryId",
							in: "query",
							schema: { type: "integer", minimum: 1 },
						},
						{
							name: "statusId",
							in: "query",
							schema: { type: "integer", minimum: 1 },
						},
						{
							name: "sort",
							in: "query",
							schema: {
								type: "string",
								enum: ["newest", "popular"],
								default: "newest",
							},
						},
						{
							name: "limit",
							in: "query",
							schema: {
								type: "integer",
								minimum: 1,
								maximum: 30,
								default: 12,
							},
						},
					],
					responses: {
						200: {
							description: "通報一覧",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ReportsListResponse" },
								},
							},
						},
						500: {
							description: "Internal Server Error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
					},
				},
				post: {
					tags: ["Reports"],
					summary: "新規通報を投稿",
					description:
						"Turnstile 検証・送信レート制限・リンクプレビュー抽出を実行し、カテゴリを「なりすまし」として通報を作成します。",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CreateReportRequest" },
							},
						},
					},
					responses: {
						201: {
							description: "通報作成成功",
							content: {
								"application/json": {
									schema: {
										oneOf: [
											{
												$ref: "#/components/schemas/ReportCreatedResponse",
											},
											{
												$ref: "#/components/schemas/CreateReportAcceptedResponse",
											},
										],
									},
								},
							},
						},
						400: {
							description: "入力エラー",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
						403: {
							description: "スパム対策検証失敗",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
						429: {
							description: "レート制限",
							headers: {
								"Retry-After": {
									description: "再試行可能になるまでの秒数",
									schema: { type: "string" },
								},
							},
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
						503: {
							description: "Turnstile 設定不備",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
						500: {
							description: "Internal Server Error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
					},
				},
			},
			"/api/reports/{id}": {
				get: {
					tags: ["Reports"],
					summary: "通報詳細を取得",
					parameters: [
						{
							name: "id",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {
						200: {
							description: "通報詳細",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ReportDetailResponse" },
								},
							},
						},
						404: {
							description: "Not Found",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
						500: {
							description: "Internal Server Error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
					},
				},
			},
			"/api/statistics": {
				get: {
					tags: ["Statistics"],
					summary: "統計ダッシュボード情報を取得",
					parameters: [
						{
							name: "days",
							in: "query",
							description:
								"トレンド表示対象の日数。1-90 の範囲でクランプされ、未指定時は 7。",
							schema: {
								type: "integer",
								minimum: 1,
								maximum: 90,
								default: 7,
							},
						},
					],
					responses: {
						200: {
							description: "集計結果",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/StatisticsResponse" },
								},
							},
						},
						500: {
							description: "Internal Server Error",
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ErrorResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				ErrorResponse: errorResponseSchema,
				PlatformRef: {
					type: "object",
					required: ["id", "name"],
					properties: {
						id: { type: "integer" },
						name: { type: "string" },
					},
				},
				CategoryRef: {
					type: "object",
					required: ["id", "name"],
					properties: {
						id: { type: "integer" },
						name: { type: "string" },
					},
				},
				StatusRef: {
					type: "object",
					required: ["id", "label"],
					properties: {
						id: { type: "integer" },
						label: { type: "string" },
					},
				},
				ReportImage: {
					type: "object",
					required: ["id", "imageUrl"],
					properties: {
						id: { type: "string" },
						imageUrl: { type: "string", format: "uri" },
					},
				},
				ReportDetailImage: {
					type: "object",
					required: ["id", "imageUrl", "displayOrder", "createdAt"],
					properties: {
						id: { type: "string" },
						imageUrl: { type: "string", format: "uri" },
						displayOrder: { type: "integer", nullable: true },
						createdAt: {
							type: "string",
							format: "date-time",
							nullable: true,
						},
					},
				},
				ReportTimelineAdmin: {
					type: "object",
					required: ["name"],
					properties: {
						name: { type: "string", nullable: true },
					},
				},
				ReportTimelineItem: {
					type: "object",
					required: ["id", "actionLabel", "description", "occurredAt", "admin"],
					properties: {
						id: { type: "string" },
						actionLabel: { type: "string" },
						description: { type: "string", nullable: true },
						occurredAt: {
							type: "string",
							format: "date-time",
							nullable: true,
						},
						admin: {
							allOf: [{ $ref: "#/components/schemas/ReportTimelineAdmin" }],
							nullable: true,
						},
					},
				},
				ReportSummary: {
					type: "object",
					required: [
						"id",
						"url",
						"title",
						"description",
						"createdAt",
						"riskScore",
						"platform",
						"category",
						"status",
						"images",
					],
					properties: {
						id: { type: "string" },
						url: { type: "string", format: "uri" },
						title: { type: "string", nullable: true },
						description: { type: "string", nullable: true },
						createdAt: {
							type: "string",
							format: "date-time",
							nullable: true,
						},
						riskScore: {
							type: "integer",
							nullable: true,
						},
						platform: {
							allOf: [{ $ref: "#/components/schemas/PlatformRef" }],
							nullable: true,
						},
						category: {
							allOf: [{ $ref: "#/components/schemas/CategoryRef" }],
							nullable: true,
						},
						status: {
							allOf: [{ $ref: "#/components/schemas/StatusRef" }],
							nullable: true,
						},
						images: {
							type: "array",
							items: { $ref: "#/components/schemas/ReportImage" },
						},
					},
				},
				ReportsListResponse: {
					type: "object",
					required: ["items", "nextCursor"],
					properties: {
						items: {
							type: "array",
							items: { $ref: "#/components/schemas/ReportSummary" },
						},
						nextCursor: { type: "string", nullable: true },
					},
				},
				CreateReportRequest: {
					type: "object",
					required: ["url", "platformId", "turnstileToken", "formStartedAt"],
					properties: {
						url: { type: "string", minLength: 1 },
						platformId: { type: "integer", minimum: 1 },
						turnstileToken: { type: "string", minLength: 1 },
						spamTrap: {
							type: "string",
							description: "ボット検知用のハニーポット。空文字を送る想定です。",
						},
						formStartedAt: {
							type: "number",
							description:
								"フォーム表示開始時刻の Unix epoch ミリ秒。送信間隔チェックに利用されます。",
						},
					},
				},
				ReportCreatedResponse: {
					type: "object",
					description:
						"Prisma の report 作成結果。status, images(先頭1件) を含みます。",
					additionalProperties: true,
				},
				CreateReportAcceptedResponse: {
					type: "object",
					required: ["ignored"],
					properties: {
						ignored: { type: "boolean", enum: [true] },
					},
				},
				ReportDetailResponse: {
					type: "object",
					required: [
						"id",
						"url",
						"title",
						"description",
						"createdAt",
						"riskScore",
						"platform",
						"category",
						"status",
						"images",
						"timelines",
					],
					properties: {
						id: { type: "string" },
						url: { type: "string", format: "uri" },
						title: { type: "string", nullable: true },
						description: { type: "string", nullable: true },
						createdAt: {
							type: "string",
							format: "date-time",
							nullable: true,
						},
						riskScore: { type: "integer", nullable: true },
						platform: {
							allOf: [{ $ref: "#/components/schemas/PlatformRef" }],
							nullable: true,
						},
						category: {
							allOf: [{ $ref: "#/components/schemas/CategoryRef" }],
							nullable: true,
						},
						status: {
							allOf: [{ $ref: "#/components/schemas/StatusRef" }],
							nullable: true,
						},
						images: {
							type: "array",
							items: { $ref: "#/components/schemas/ReportDetailImage" },
						},
						timelines: {
							type: "array",
							items: { $ref: "#/components/schemas/ReportTimelineItem" },
						},
					},
				},
				StatisticsBreakdownItem: {
					type: "object",
					required: ["id", "label", "count"],
					properties: {
						id: { type: "integer", nullable: true },
						label: { type: "string" },
						count: { type: "integer", minimum: 0 },
					},
				},
				StatisticsTrendItem: {
					type: "object",
					required: ["date", "count"],
					properties: {
						date: { type: "string", example: "03.01" },
						count: { type: "integer", minimum: 0 },
					},
				},
				StatisticsResponse: {
					type: "object",
					required: ["summary", "breakdown", "trend", "updatedAt"],
					properties: {
						summary: {
							type: "object",
							required: [
								"totalReports",
								"highRiskReports",
								"todayReports",
								"topPlatform",
							],
							properties: {
								totalReports: { type: "integer", minimum: 0 },
								highRiskReports: { type: "integer", minimum: 0 },
								todayReports: { type: "integer", minimum: 0 },
								topPlatform: { type: "string", nullable: true },
							},
						},
						breakdown: {
							type: "object",
							required: ["status", "category", "platform"],
							properties: {
								status: {
									type: "array",
									items: {
										$ref: "#/components/schemas/StatisticsBreakdownItem",
									},
								},
								category: {
									type: "array",
									items: {
										$ref: "#/components/schemas/StatisticsBreakdownItem",
									},
								},
								platform: {
									type: "array",
									items: {
										$ref: "#/components/schemas/StatisticsBreakdownItem",
									},
								},
							},
						},
						trend: {
							type: "array",
							items: { $ref: "#/components/schemas/StatisticsTrendItem" },
						},
						updatedAt: { type: "string", format: "date-time" },
					},
				},
			},
		},
	};
}
