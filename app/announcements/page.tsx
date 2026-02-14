import { prisma } from "@/lib/prisma";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";

export default async function AnnouncementsPage() {
	const announcements = await prisma.announcement.findMany({
		include: {
			tags: {
				include: { tag: true },
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return (
		<div className="container py-12 space-y-10">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">お知らせ</h1>
				<p className="text-muted-foreground">
					プラットフォームの更新情報や、詐欺に関する注意喚起を掲載しています。
				</p>
			</div>

			<div className="grid gap-6">
				{announcements.length > 0 ? (
					announcements.map((announcement) => (
						<Card
							key={announcement.id}
							className="group hover:border-primary/20 transition-all"
						>
							<Link href={`/announcements/${announcement.id}`}>
								<CardHeader className="flex flex-row items-center justify-between space-y-0">
									<div className="space-y-1">
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<Calendar className="h-3 w-3" />
											{announcement.createdAt?.toLocaleDateString("ja-JP") ||
												"日付不明"}
										</div>
										<CardTitle className="group-hover:text-primary transition-colors">
											{announcement.title}
										</CardTitle>
									</div>
									<ChevronRight className="h-5 w-5 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<p className="text-sm text-muted-foreground line-clamp-2">
										{announcement.content}
									</p>
									<div className="flex flex-wrap gap-2 mt-4">
										{announcement.tags.map((relation) => (
											<Badge
												key={relation.tagId}
												variant="secondary"
												className="px-2 py-0 text-[10px]"
											>
												{relation.tag.name}
											</Badge>
										))}
									</div>
								</CardContent>
							</Link>
						</Card>
					))
				) : (
					<Card className="p-12 text-center text-muted-foreground">
						現在お知らせはありません。
					</Card>
				)}
			</div>
		</div>
	);
}
