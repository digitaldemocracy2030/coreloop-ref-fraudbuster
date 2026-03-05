"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EditableAnnouncement = {
	id: string;
	title: string;
	content: string;
	isImportant: boolean;
	isPublished: boolean;
	createdAtLabel: string;
};

interface AnnouncementEditDialogProps {
	announcement: EditableAnnouncement | null;
}

export function AnnouncementEditDialog({
	announcement,
}: AnnouncementEditDialogProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const open = Boolean(announcement);

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			return;
		}
		const nextSearchParams = new URLSearchParams(searchParams.toString());
		nextSearchParams.delete("selected");
		const query = nextSearchParams.toString();
		router.push(query ? `${pathname}?${query}` : pathname);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>お知らせを編集</DialogTitle>
					<DialogDescription>
						タイトル・本文・公開状態を変更できます。
					</DialogDescription>
				</DialogHeader>

				{announcement ? (
					<div className="space-y-4">
						<div className="text-xs text-muted-foreground">
							作成日: {announcement.createdAtLabel}
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
									className="min-h-32"
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
										defaultChecked={announcement.isImportant}
									/>
									重要
								</label>
								<label className="inline-flex items-center gap-2">
									<input
										type="checkbox"
										name="isPublished"
										className="h-4 w-4 rounded border-input"
										defaultChecked={announcement.isPublished}
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
				) : null}
			</DialogContent>
		</Dialog>
	);
}
