import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function SiteFooter() {
	return (
		<footer className="border-t bg-muted/30">
			<div className="container py-12 md:py-16">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8">
					<div className="md:col-span-2 space-y-4">
						<div className="flex items-center space-x-2">
							<ShieldAlert className="h-6 w-6 text-primary" />
							<span className="font-bold text-xl tracking-tight">
								AntiFraud
							</span>
						</div>
						<p className="text-sm text-muted-foreground max-w-xs">
							一般市民からの情報を集約し、共有・検索できるプラットフォームを構築することで、ネット詐欺の被害を未然に防ぐことを目指しています。
						</p>
					</div>
					<div className="space-y-4">
						<h4 className="font-semibold">リンク</h4>
						<ul className="space-y-2 text-sm">
							<li>
								<Link
									href="/"
									className="text-muted-foreground hover:text-foreground"
								>
									ホーム
								</Link>
							</li>
							<li>
								<Link
									href="/statistics"
									className="text-muted-foreground hover:text-foreground"
								>
									統計
								</Link>
							</li>
							<li>
								<Link
									href="/announcements"
									className="text-muted-foreground hover:text-foreground"
								>
									お知らせ
								</Link>
							</li>
						</ul>
					</div>
					<div className="space-y-4">
						<h4 className="font-semibold">サポート</h4>
						<ul className="space-y-2 text-sm">
							<li>
								<Link
									href="/terms"
									className="text-muted-foreground hover:text-foreground"
								>
									利用規約
								</Link>
							</li>
							<li>
								<Link
									href="/privacy"
									className="text-muted-foreground hover:text-foreground"
								>
									プライバシーポリシー
								</Link>
							</li>
							<li>
								<Link
									href="/contact"
									className="text-muted-foreground hover:text-foreground"
								>
									お問い合わせ
								</Link>
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
					<p>© 2026 Anti-Fraud Crowdsourcing Platform. All rights reserved.</p>
				</div>
			</div>
		</footer>
	);
}
