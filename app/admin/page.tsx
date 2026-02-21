import { Megaphone, ShieldCheck } from "lucide-react";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminSession } from "@/lib/admin-auth";
import { formatDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

interface AdminPageProps {
	searchParams: Promise<{ notice?: string; error?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
	await connection();
	const session = await requireAdminSession();
	const params = await searchParams;
	const notice = typeof params.notice === "string" ? params.notice : null;
	const error = typeof params.error === "string" ? params.error : null;

	const [announcements, reportStatuses, reports] = await Promise.all([
		prisma.announcement.findMany({
			orderBy: { createdAt: "desc" },
			take: 20,
		}),
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
		<div className="container py-10 space-y-8">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-2">
					<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
						<ShieldCheck className="h-4 w-4" />
						管理者専用
					</div>
					<h1 className="text-3xl font-bold tracking-tight">管理画面</h1>
					<p className="text-sm text-muted-foreground">
						ログイン中: {session.email}
					</p>
				</div>
				<form action="/api/admin/logout" method="post">
					<Button type="submit" variant="outline">
						ログアウト
					</Button>
				</form>
			</header>

			{notice ? (
				<div className="rounded-lg border border-green-600/30 bg-green-500/10 px-4 py-3 text-sm text-green-900 dark:text-green-200">
					{notice}
				</div>
			) : null}
			{error ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</div>
			) : null}

			<section className="space-y-4">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Megaphone className="h-5 w-5" />
							お知らせを新規投稿
						</CardTitle>
						<CardDescription>
							公開設定をオンにすると、お知らせ一覧に表示されます。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							action="/api/admin/announcements"
							method="post"
							className="space-y-4"
						>
							<div className="space-y-2">
								<label
									htmlFor="new-announcement-title"
									className="text-sm font-medium"
								>
									タイトル
								</label>
								<Input
									id="new-announcement-title"
									name="title"
									placeholder="例: 新しい詐欺傾向に関する注意喚起"
									required
								/>
							</div>
							<div className="space-y-2">
								<label
									htmlFor="new-announcement-content"
									className="text-sm font-medium"
								>
									本文
								</label>
								<Textarea
									id="new-announcement-content"
									name="content"
									className="min-h-32"
									placeholder="本文を入力してください"
									required
								/>
							</div>
							<div className="flex flex-wrap items-center gap-6 text-sm">
								<label className="inline-flex items-center gap-2">
									<input
										type="checkbox"
										name="isImportant"
										className="h-4 w-4 rounded border-input"
									/>
									重要
								</label>
								<label className="inline-flex items-center gap-2">
									<input
										type="checkbox"
										name="isPublished"
										className="h-4 w-4 rounded border-input"
										defaultChecked
									/>
									公開する
								</label>
							</div>
							<Button type="submit">投稿を作成</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>投稿済みのお知らせ</CardTitle>
						<CardDescription>
							タイトル・本文・公開状態を編集、または削除できます。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{announcements.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								まだお知らせはありません。
							</p>
						) : (
							announcements.map((announcement) => (
								<div
									key={announcement.id}
									className="rounded-lg border p-4 space-y-3"
								>
									<div className="text-xs text-muted-foreground">
										作成日:{" "}
										{formatDate(announcement.createdAt, "ja-JP") ?? "不明"}
									</div>

									<form
										action={`/api/admin/announcements/${announcement.id}`}
										method="post"
										className="space-y-3"
									>
										<input type="hidden" name="intent" value="update" />
										<div className="space-y-2">
											<label
												htmlFor={`announcement-title-${announcement.id}`}
												className="text-sm font-medium"
											>
												タイトル
											</label>
											<Input
												id={`announcement-title-${announcement.id}`}
												name="title"
												defaultValue={announcement.title}
												required
											/>
										</div>
										<div className="space-y-2">
											<label
												htmlFor={`announcement-content-${announcement.id}`}
												className="text-sm font-medium"
											>
												本文
											</label>
											<Textarea
												id={`announcement-content-${announcement.id}`}
												name="content"
												className="min-h-24"
												defaultValue={announcement.content}
												required
											/>
										</div>
										<div className="flex flex-wrap items-center gap-6 text-sm">
											<label className="inline-flex items-center gap-2">
												<input
													type="checkbox"
													name="isImportant"
													className="h-4 w-4 rounded border-input"
													defaultChecked={Boolean(announcement.isImportant)}
												/>
												重要
											</label>
											<label className="inline-flex items-center gap-2">
												<input
													type="checkbox"
													name="isPublished"
													className="h-4 w-4 rounded border-input"
													defaultChecked={Boolean(announcement.isPublished)}
												/>
												公開する
											</label>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button type="submit" size="sm">
												更新
											</Button>
										</div>
									</form>

									<form
										action={`/api/admin/announcements/${announcement.id}`}
										method="post"
									>
										<input type="hidden" name="intent" value="delete" />
										<Button type="submit" size="sm" variant="destructive">
											削除
										</Button>
									</form>
								</div>
							))
						)}
					</CardContent>
				</Card>
			</section>

			<section>
				<Card>
					<CardHeader>
						<CardTitle>通報ステータス管理</CardTitle>
						<CardDescription>
							各通報のステータスを変更すると、詳細画面の表示とタイムラインが更新されます。
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
		</div>
	);
}
