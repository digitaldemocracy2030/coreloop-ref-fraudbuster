import { ArrowLeft, Calendar, Megaphone, User } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

async function getAnnouncementById(id: string) {
	"use cache";
	cacheTag("announcements");
	cacheLife({ revalidate: 300 });

	return prisma.announcement.findUnique({
		where: { id },
		include: {
			tags: {
				include: { tag: true },
			},
			admin: {
				select: { name: true },
			},
		},
	});
}

interface AnnouncementDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function AnnouncementDetailPage({
	params,
}: AnnouncementDetailPageProps) {
	const { id } = await params;
	await connection();

	const announcement = await getAnnouncementById(id);

	if (!announcement) {
		notFound();
	}

	const displayDate = announcement.publishedAt ?? announcement.createdAt;

	return (
		<div className="container py-12 space-y-8">
			<nav className="flex items-center gap-2 text-sm text-muted-foreground">
				<Link href="/" className="hover:text-foreground">
					ホーム
				</Link>
				<span>/</span>
				<Link href="/announcements" className="hover:text-foreground">
					お知らせ
				</Link>
				<span>/</span>
				<span className="text-foreground font-medium truncate max-w-[240px]">
					{announcement.title}
				</span>
			</nav>

			<div className="space-y-4">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="outline" className="gap-1">
						<Megaphone className="h-3 w-3" />
						お知らせ
					</Badge>
					{announcement.isImportant ? (
						<Badge className="bg-destructive/90 text-destructive-foreground">
							重要
						</Badge>
					) : null}
				</div>
				<h1 className="text-3xl font-bold tracking-tight">
					{announcement.title}
				</h1>
				<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
					<div className="flex items-center gap-1">
						<Calendar className="h-4 w-4" />
						<span>
							{formatDate(displayDate, "ja-JP", {
								year: "numeric",
								month: "long",
								day: "numeric",
							}) ?? "日付不明"}
						</span>
					</div>
					{announcement.admin?.name ? (
						<div className="flex items-center gap-1">
							<User className="h-4 w-4" />
							<span>{announcement.admin.name}</span>
						</div>
					) : null}
				</div>
				{announcement.tags.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{announcement.tags.map((relation) => (
							<Badge key={relation.tagId} variant="secondary">
								{relation.tag.name}
							</Badge>
						))}
					</div>
				) : null}
			</div>

			<Card>
				<CardHeader>
					<CardTitle></CardTitle>
				</CardHeader>
				<CardContent>
					<div className="leading-relaxed whitespace-pre-wrap">
						{announcement.content}
					</div>
				</CardContent>
			</Card>

			<div>
				<Link href="/announcements">
					<Button variant="outline" className="gap-2 rounded-xl">
						<ArrowLeft className="h-4 w-4" />
						お知らせ一覧へ戻る
					</Button>
				</Link>
			</div>
		</div>
	);
}
