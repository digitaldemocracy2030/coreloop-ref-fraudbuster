"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
	{ href: "/", label: "ホーム" },
	{ href: "/statistics", label: "統計" },
	{ href: "/announcements", label: "お知らせ" },
];

export function SiteHeader() {
	const pathname = usePathname();
	const router = useRouter();

	const isActive = (href: string) => {
		if (href === "/") return pathname === "/";
		return pathname.startsWith(href);
	};

	const prefetchRoute = React.useCallback(
		(href: string) => {
			router.prefetch(href);
		},
		[router],
	);

	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="container flex h-16 items-center justify-between">
				<div className="flex items-center gap-2">
					<Link href="/" className="flex items-center space-x-2">
						<ShieldAlert className="h-6 w-6 text-primary" />
						<span className="inline-block font-bold text-xl tracking-tight">
							AntiFraud
						</span>
					</Link>
					<nav className="ml-6 hidden items-center gap-6 text-sm font-medium md:flex">
						{NAV_ITEMS.map((item) => (
							<Link
								key={item.href}
								href={item.href}
								prefetch
								onMouseEnter={() => prefetchRoute(item.href)}
								onFocus={() => prefetchRoute(item.href)}
								onTouchStart={() => prefetchRoute(item.href)}
								className={cn(
									"relative pb-1 transition-colors hover:text-foreground/80 after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-full after:scale-x-0 after:bg-blue-500 after:transition-transform after:duration-200 after:content-['']",
									isActive(item.href)
										? "font-bold text-foreground after:scale-x-100"
										: "text-foreground/60",
								)}
							>
								{item.label}
							</Link>
						))}
					</nav>
				</div>
				<div className="flex items-center gap-4">
					<div className="hidden sm:flex items-center gap-2">
						<Link href="/report/new">
							<Button variant="default" className="rounded-full px-6">
								通報する
							</Button>
						</Link>
						<Link href="/report/history">
							<Button variant="outline" className="rounded-full px-6">
								履歴を見る
							</Button>
						</Link>
					</div>
					<ModeToggle />
				</div>
			</div>
		</header>
	);
}
