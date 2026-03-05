import Link from "next/link";
import { Megaphone } from "lucide-react";
import { connection } from "next/server";

import { AnnouncementEditDialog } from "@/app/admin/announcements/_components/announcement-edit-dialog";
import { AdminShell } from "@/app/admin/_components/admin-shell";
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
import { cn } from "@/lib/utils";

interface AdminAnnouncementsPageProps {
	searchParams: Promise<{ notice?: string; error?: string; selected?: string }>;
}

export default async function AdminAnnouncementsPage({
	searchParams,
}: AdminAnnouncementsPageProps) {
	await connection();
	const session = await requireAdminSession();
	const params = await searchParams;
	const notice = typeof params.notice === "string" ? params.notice : null;
	const error = typeof params.error === "string" ? params.error : null;
	const selectedId =
		typeof params.selected === "string" && params.selected.trim()
			? params.selected
			: null;

	const announcements = await prisma.announcement.findMany({
		orderBy: { createdAt: "desc" },
		take: 100,
	});
	const selectedAnnouncement = selectedId
		? (announcements.find((announcement) => announcement.id === selectedId) ??
			null)
		: null;
	const selectedAnnouncementMissing = Boolean(
		selectedId && !selectedAnnouncement,
	);
	const selectedAnnouncementDialogData = selectedAnnouncement
		? {
				id: selectedAnnouncement.id,
				title: selectedAnnouncement.title,
				content: selectedAnnouncement.content,
				isImportant: Boolean(selectedAnnouncement.isImportant),
				isPublished: Boolean(selectedAnnouncement.isPublished),
				createdAtLabel:
					formatDate(selectedAnnouncement.createdAt, "ja-JP") ?? "不明",
			}
		: null;

	return (
		<AdminShell
			email={session.email}
			activeNav="announcements"
			title="お知らせ管理"
			description="新規投稿と、一覧から選択したお知らせの詳細編集を行います。"
			notice={notice}
			error={error}
		>
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
						<CardTitle>投稿済みのお知らせ一覧</CardTitle>
						<CardDescription>
							編集したいお知らせを選択すると、編集ダイアログが開きます。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{selectedAnnouncementMissing ? (
							<p className="text-sm text-destructive">
								選択されたお知らせが見つかりません。もう一度一覧から選択してください。
							</p>
						) : null}
						{announcements.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								まだお知らせはありません。
							</p>
						) : (
							<ul className="space-y-2">
								{announcements.map((announcement) => {
									const isActive = selectedAnnouncement?.id === announcement.id;
									return (
										<li key={announcement.id}>
											<Link
												href={`/admin/announcements?selected=${announcement.id}`}
												className={cn(
													"block rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50",
													isActive
														? "border-primary bg-primary/5"
														: "border-border",
												)}
											>
												<p className="text-sm font-medium line-clamp-1">
													{announcement.title}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{announcement.isPublished ? "公開中" : "非公開"}{" "}
													・作成日{" "}
													{formatDate(announcement.createdAt, "ja-JP") ??
														"不明"}
												</p>
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</CardContent>
				</Card>
			</section>
			<AnnouncementEditDialog announcement={selectedAnnouncementDialogData} />
		</AdminShell>
	);
}
