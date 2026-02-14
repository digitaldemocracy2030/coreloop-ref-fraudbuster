import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-16 items-center justify-between">
				<div className="flex items-center gap-2">
					<Link href="/" className="flex items-center space-x-2">
						<ShieldAlert className="h-6 w-6 text-primary" />
						<span className="inline-block font-bold text-xl tracking-tight">
							AntiFraud
						</span>
					</Link>
					<nav className="hidden md:flex items-center gap-6 ml-6 text-sm font-medium">
						<Link
							href="/"
							className="transition-colors hover:text-foreground/80 text-foreground"
						>
							検索
						</Link>
						<Link
							href="/statistics"
							className="transition-colors hover:text-foreground/80 text-foreground/60"
						>
							統計
						</Link>
						<Link
							href="/announcements"
							className="transition-colors hover:text-foreground/80 text-foreground/60"
						>
							お知らせ
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-4">
					<div className="hidden sm:block">
						<Link href="/report/new">
							<Button variant="default" className="rounded-full px-6">
								通報する
							</Button>
						</Link>
					</div>
					<ModeToggle />
				</div>
			</div>
		</header>
	);
}
