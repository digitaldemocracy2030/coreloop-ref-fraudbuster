import { Megaphone, MessageSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";
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
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
	await connection();
	const session = await requireAdminSession();

	const [
		announcementCount,
		publishedAnnouncementCount,
		reportCount,
		inquiryCount,
		unreadInquiryCount,
	] = await Promise.all([
		prisma.announcement.count(),
		prisma.announcement.count({ where: { isPublished: true } }),
		prisma.report.count(),
		prisma.inquiry.count(),
		prisma.inquiry.count({ where: { isRead: false } }),
	]);

	return (
		<AdminShell
			email={session.email}
			activeNav="home"
			title="管理画面"
			description="管理機能は用途ごとにページを分けて操作できます。"
		>
			<section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Megaphone className="h-5 w-5" />
							お知らせ管理
						</CardTitle>
						<CardDescription>
							投稿作成と、一覧から選択したお知らせの詳細編集を行います。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-sm text-muted-foreground">
							全{announcementCount}件（公開中 {publishedAnnouncementCount}件）
						</p>
						<Button asChild>
							<Link href="/admin/announcements">お知らせ管理へ移動</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5" />
							通報ステータス管理
						</CardTitle>
						<CardDescription>
							通報ごとのステータスを更新し、詳細画面とタイムラインに反映します。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-sm text-muted-foreground">
							管理対象の通報: {reportCount}件
						</p>
						<Button asChild>
							<Link href="/admin/report-statuses">
								通報ステータス管理へ移動
							</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<MessageSquare className="h-5 w-5" />
							お問い合わせ管理
						</CardTitle>
						<CardDescription>
							ユーザーからのお問い合わせ内容を確認し、既読管理を行います。
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-sm text-muted-foreground">
							全{inquiryCount}件（未読 {unreadInquiryCount}件）
						</p>
						<Button asChild>
							<Link href="/admin/inquiries">お問い合わせ管理へ移動</Link>
						</Button>
					</CardContent>
				</Card>
			</section>
		</AdminShell>
	);
}
