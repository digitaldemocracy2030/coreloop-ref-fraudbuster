import { ExternalLink, ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { AdminShell } from "@/app/admin/_components/admin-shell";
import { ReportActionsMenu } from "@/app/admin/report-statuses/_components/report-actions-menu";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { getSafeReportImageProxyPath } from "@/lib/report-image-delivery";

interface AdminReportStatusesPageProps {
	searchParams: Promise<{ notice?: string; error?: string }>;
}

export default async function AdminReportStatusesPage({
	searchParams,
}: AdminReportStatusesPageProps) {
	await connection();
	const session = await requireAdminSession();
	const params = await searchParams;
	const notice = typeof params.notice === "string" ? params.notice : null;
	const error = typeof params.error === "string" ? params.error : null;

	const [reportStatuses, reports] = await Promise.all([
		prisma.reportStatus.findMany({
			orderBy: { id: "asc" },
		}),
		prisma.report.findMany({
			orderBy: { createdAt: "desc" },
			take: 50,
			select: {
				id: true,
				title: true,
				url: true,
				createdAt: true,
				statusId: true,
				_count: {
					select: {
						images: true,
					},
				},
				images: {
					select: {
						id: true,
						imageUrl: true,
						displayOrder: true,
					},
					orderBy: { displayOrder: "asc" },
				},
				status: {
					select: {
						label: true,
					},
				},
			},
		}),
	]);

	return (
		<AdminShell
			email={session.email}
			activeNav="report-statuses"
			title="通報ステータス管理"
			description="各通報のステータス変更、証拠画像の追加、削除を行います。"
			notice={notice}
			error={error}
		>
			<section>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5" />
							通報ステータス一覧
						</CardTitle>
						<CardDescription>
							対象通報のステータス変更、画像追加、削除を行えます。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{reportStatuses.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								利用可能なステータスがありません。
							</p>
						) : null}

						<div className="overflow-x-auto rounded-lg border">
							<table className="w-full text-sm">
								<thead className="bg-muted/40">
									<tr className="border-b">
										<th className="px-3 py-2 text-left font-medium">通報</th>
										<th className="px-3 py-2 text-left font-medium">投稿日</th>
										<th className="px-3 py-2 text-left font-medium">現在</th>
										<th className="px-3 py-2 text-right font-medium">操作</th>
									</tr>
								</thead>
								<tbody>
									{reports.map((report) => {
										const fallbackStatusId = reportStatuses[0]?.id ?? "";
										const selectedStatusId =
											report.statusId ?? fallbackStatusId;
										return (
											<tr key={report.id} className="border-b last:border-0">
												<td className="px-3 py-3 align-top">
													<div className="space-y-1">
														<p className="font-medium">
															{report.title || "（タイトル未設定）"}
														</p>
														<a
															href={report.url}
															target="_blank"
															rel="noreferrer"
															className="inline-flex items-start gap-1 text-xs text-muted-foreground break-all underline-offset-2 hover:text-foreground hover:underline"
														>
															<span>{report.url}</span>
															<ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
														</a>
														<p className="text-xs text-muted-foreground">
															登録画像: {report._count.images}枚
														</p>
													</div>
												</td>
												<td className="px-3 py-3 align-top text-muted-foreground">
													{formatDate(report.createdAt, "ja-JP") ?? "不明"}
												</td>
												<td className="px-3 py-3 align-top">
													{report.status?.label ?? "未設定"}
												</td>
												<td className="px-3 py-3 align-top text-right">
													<ReportActionsMenu
														reportId={report.id}
														reportTitle={report.title}
														reportUrl={report.url}
														existingImageCount={report._count.images}
														currentImages={report.images.map((image) => ({
															id: image.id,
															previewUrl: getSafeReportImageProxyPath(image),
															displayOrder: image.displayOrder ?? null,
														}))}
														reportStatuses={reportStatuses}
														selectedStatusId={selectedStatusId}
													/>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			</section>
		</AdminShell>
	);
}
