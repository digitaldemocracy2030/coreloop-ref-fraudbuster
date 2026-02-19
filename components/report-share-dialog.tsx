"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

interface ReportShareDialogProps {
	xShareUrl: string;
	facebookShareUrl: string;
}

export function ReportShareDialog({
	xShareUrl,
	facebookShareUrl,
}: ReportShareDialogProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button className="w-full rounded-xl gap-2 h-12">
					<Share2 className="h-4 w-4" />
					情報をシェアする
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>共有先を選択</DialogTitle>
					<DialogDescription>
						通報情報をシェアするSNSを選択してください。
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<Button asChild variant="outline" className="rounded-xl gap-2 h-11">
						<a
							href={xShareUrl}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Xでシェア"
						>
							<Share2 className="h-4 w-4" />X
						</a>
					</Button>
					<Button asChild variant="outline" className="rounded-xl gap-2 h-11">
						<a
							href={facebookShareUrl}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Facebookでシェア"
						>
							<Share2 className="h-4 w-4" />
							Facebook
						</a>
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
