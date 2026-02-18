"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const HIDE_MODAL_STORAGE_KEY = "hide-site-introduction-modal";

export function SiteIntroductionModal() {
	const [open, setOpen] = useState(() => {
		if (typeof window === "undefined") {
			return false;
		}
		return localStorage.getItem(HIDE_MODAL_STORAGE_KEY) !== "true";
	});
	const [doNotShowAgain, setDoNotShowAgain] = useState(false);

	const persistPreference = (hideModal: boolean) => {
		if (hideModal) {
			localStorage.setItem(HIDE_MODAL_STORAGE_KEY, "true");
			return;
		}

		localStorage.removeItem(HIDE_MODAL_STORAGE_KEY);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			persistPreference(doNotShowAgain);
		}
		setOpen(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader className="text-center">
					<DialogTitle className="text-center">このサイトについて</DialogTitle>
				</DialogHeader>

				<ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground leading-relaxed">
					<li>このサイトはProject Coreloopの一環で開発されたものです。</li>
					<li>本サイトはリファレンス実装です。</li>
					<li>詐欺広告と疑わしいリンクを通報できます。</li>
					<li>
						通報しても、すぐに対応されるわけではない点にご留意ください。
					</li>
					<li>DD2030で開発されています。</li>
				</ul>

				<DialogFooter className="flex-row items-center justify-end gap-4">
					<div className="flex items-center gap-2">
						<Checkbox
							id="hide-site-introduction-modal"
							checked={doNotShowAgain}
							onCheckedChange={(checked) => setDoNotShowAgain(checked === true)}
						/>
						<Label htmlFor="hide-site-introduction-modal">
							次からは表示しない
						</Label>
					</div>
					<Button onClick={() => handleOpenChange(false)}>閉じる</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
