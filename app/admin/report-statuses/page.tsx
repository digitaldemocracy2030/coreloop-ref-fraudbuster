import { ShieldCheck } from "lucide-react";
import { connection } from "next/server";

import { AdminShell } from "@/app/admin/_components/admin-shell";
import { Button } from "@/components/ui/button";
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
			description="各通報のステータスを変更し、詳細画面の表示とタイムラインに反映します。"
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
							対象通報を選び、ステータスを変更してください。
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
										<th className="px-3 py-2 text-left font-medium">変更</th>
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
														<p className="text-xs text-muted-foreground break-all">
															{report.url}
														</p>
													</div>
												</td>
												<td className="px-3 py-3 align-top text-muted-foreground">
													{formatDate(report.createdAt, "ja-JP") ?? "不明"}
												</td>
												<td className="px-3 py-3 align-top">
													{report.status?.label ?? "未設定"}
												</td>
												<td className="px-3 py-3 align-top">
													<form
														action={`/api/admin/reports/${report.id}/status`}
														method="post"
														className="flex items-center gap-2"
													>
														<select
															name="statusId"
															className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
															defaultValue={String(selectedStatusId)}
															required
															disabled={reportStatuses.length === 0}
														>
															{reportStatuses.map((status) => (
																<option key={status.id} value={status.id}>
																	{status.label}
																</option>
															))}
														</select>
														<Button
															type="submit"
															size="sm"
															disabled={reportStatuses.length === 0}
														>
															更新
														</Button>
													</form>
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
