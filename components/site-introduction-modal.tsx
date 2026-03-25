"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { SITE_NAME } from "@/lib/site";

export const OPEN_SITE_INTRODUCTION_MODAL_EVENT =
	"open-site-introduction-modal";

export function SiteIntroductionModal() {
	const [open, setOpen] = useState(true);

	useEffect(() => {
		const handleOpenRequest = () => {
			setOpen(true);
		};

		window.addEventListener(
			OPEN_SITE_INTRODUCTION_MODAL_EVENT,
			handleOpenRequest,
		);

		return () => {
			window.removeEventListener(
				OPEN_SITE_INTRODUCTION_MODAL_EVENT,
				handleOpenRequest,
			);
		};
	}, []);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
				<DialogHeader className="text-center">
					<DialogTitle className="text-center">{SITE_NAME}について</DialogTitle>
				</DialogHeader>

				<div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950">
					<p className="font-semibold">【クラウドファンディング実施中】</p>
					<p>
						本プロジェクトでは、サービスの継続・発展に向けたクラウドファンディングを2026年6月5日まで実施しています。開発の背景や私たちの想い、ご支援プランの詳細は下記ページをご覧ください。
					</p>
					<p>
						<Link
							href="https://camp-fire.jp/projects/930941/view"
							target="_blank"
							rel="noreferrer"
							className="font-medium underline underline-offset-4 transition-colors hover:text-sky-700"
						>
							https://camp-fire.jp/projects/930941/view
						</Link>
					</p>
				</div>

				<ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
					<li>
						このサイトはデジタル民主主義2030が開発した、市民が不審な広告を通報し、詐欺広告を社会全体で「見える化」する市民参加型の通報プラットフォームです。台湾の「Fraud
						Buster」を参考に開発しました。
					</li>
					<li>
						詐欺広告と疑わしいリンクを通報できます。ただし、通報しても、すぐに対応されるわけではない点にご留意ください。
					</li>
				</ul>

				<div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
					<p>
						現在はベータ版（試験運用版）です。現時点でできることは、詐欺広告や疑わしいリンクに関する通報の登録のみです。この点をご理解のうえご利用ください。
					</p>
				</div>

				<div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
					<p>
						なお、本システムは、行政が詐欺広告対策を講じるための根拠となる通報データを市民の力で収集・蓄積することを目的としています。現時点では行政機関との直接的な連携は行われていませんが、蓄積されたデータを今後の政策立案や規制議論の基礎資料として活用することを目指しています。特定の個人・法人等に対する訴訟を教唆・支援するものではありません。
					</p>
					<p>
						最終的な削除判断はプラットフォームや行政が行うものであり、本システムはその結果を保証しません。
					</p>
					<p>
						今後の開発構想として、AIによる一次スクリーニングや詐欺広告の自動検知・通報機能の実装を検討しています。
					</p>
				</div>

				<DialogFooter className="flex-row items-center justify-end gap-4">
					<Button className="w-full sm:w-auto" onClick={() => setOpen(false)}>
						閉じる
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
