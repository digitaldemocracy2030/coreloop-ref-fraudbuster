"use client";

import { CircleHelp, ExternalLink, Menu, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { OPEN_SITE_INTRODUCTION_MODAL_EVENT } from "@/components/site-introduction-modal";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
	{ href: "/", label: "ホーム" },
	{ href: "/statistics", label: "統計" },
	{ href: "/announcements", label: "お知らせ" },
	{ href: "/contact", label: "お問い合わせ" },
	{
		href: "https://coreloop.dd2030.org/home",
		label: "Project Coreloop公式サイト",
		external: true,
	},
];

export function SiteHeader() {
	const pathname = usePathname();
	const router = useRouter();
	const [isBetaBannerVisible, setIsBetaBannerVisible] = React.useState(true);
	const [isCrowdfundingBannerVisible, setIsCrowdfundingBannerVisible] =
		React.useState(true);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

	const openIntroductionModal = React.useCallback(() => {
		window.dispatchEvent(new Event(OPEN_SITE_INTRODUCTION_MODAL_EVENT));
	}, []);

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
						<span className="inline-flex items-end gap-1 font-bold text-xl tracking-tight">
							<span>{SITE_NAME}</span>
							<span className="text-[0.65em] font-semibold leading-none text-muted-foreground">
								β
							</span>
						</span>
					</Link>
					<nav className="ml-6 hidden items-center gap-6 text-sm font-medium md:flex">
						{NAV_ITEMS.map((item) => (
							<Link
								key={item.href}
								href={item.href}
								prefetch={item.external ? false : true}
								onMouseEnter={
									item.external ? undefined : () => prefetchRoute(item.href)
								}
								onFocus={
									item.external ? undefined : () => prefetchRoute(item.href)
								}
								onTouchStart={
									item.external ? undefined : () => prefetchRoute(item.href)
								}
								target={item.external ? "_blank" : undefined}
								rel={item.external ? "noreferrer" : undefined}
								className={cn(
									"relative inline-flex items-center gap-1 pb-1 transition-colors hover:text-foreground/80 after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-full after:scale-x-0 after:bg-blue-500 after:transition-transform after:duration-200 after:content-['']",
									!item.external && isActive(item.href)
										? "font-bold text-foreground after:scale-x-100"
										: "text-foreground/60",
								)}
							>
								<span>{item.label}</span>
								{item.external ? (
									<ExternalLink className="h-3.5 w-3.5 shrink-0" />
								) : null}
							</Link>
						))}
					</nav>
				</div>
				<div className="flex items-center gap-2 sm:gap-4">
					<div className="hidden sm:block">
						<Link href="/report/new">
							<Button variant="default" className="rounded-full px-6">
								通報する
							</Button>
						</Link>
					</div>
					<ModeToggle />
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="rounded-full"
						aria-label="このサイトについて"
						onClick={openIntroductionModal}
					>
						<CircleHelp className="h-5 w-5" />
					</Button>
					<Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
						<SheetTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="rounded-full md:hidden"
								aria-label="メニューを開く"
							>
								<Menu className="h-5 w-5" />
							</Button>
						</SheetTrigger>
						<SheetContent
							side="right"
							className="w-[min(20rem,calc(100vw-1rem))] gap-0 px-0 [&>button]:top-3.5 [&>button]:right-3.5"
						>
							<SheetHeader className="border-b px-4 py-4 text-left">
								<SheetTitle>メニュー</SheetTitle>
								<SheetDescription>
									主要なページへ移動できます。
								</SheetDescription>
							</SheetHeader>
							<nav className="flex flex-col px-2 py-3">
								{NAV_ITEMS.map((item) => (
									<SheetClose key={item.href} asChild>
										<Link
											href={item.href}
											prefetch={item.external ? false : true}
											onMouseEnter={
												item.external
													? undefined
													: () => prefetchRoute(item.href)
											}
											onFocus={
												item.external
													? undefined
													: () => prefetchRoute(item.href)
											}
											onTouchStart={
												item.external
													? undefined
													: () => prefetchRoute(item.href)
											}
											target={item.external ? "_blank" : undefined}
											rel={item.external ? "noreferrer" : undefined}
											className={cn(
												"inline-flex items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
												!item.external && isActive(item.href)
													? "bg-accent text-foreground"
													: "text-foreground/70",
											)}
										>
											<span>{item.label}</span>
											{item.external ? (
												<ExternalLink className="h-4 w-4 shrink-0" />
											) : null}
										</Link>
									</SheetClose>
								))}
							</nav>
							<div className="mt-auto border-t px-4 pt-5 pb-4">
								<SheetClose asChild>
									<Link href="/report/new">
										<Button className="w-full rounded-full">通報する</Button>
									</Link>
								</SheetClose>
								<Button
									type="button"
									variant="outline"
									className="mt-3 w-full rounded-full"
									onClick={() => {
										setIsMobileMenuOpen(false);
										openIntroductionModal();
									}}
								>
									<CircleHelp className="h-4 w-4" />
									このサイトについて
								</Button>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>
			{isBetaBannerVisible ? (
				<div className="border-t border-amber-300/80 bg-amber-100 text-amber-950">
					<div className="container flex items-start gap-3 py-1 text-sm leading-relaxed sm:items-center">
						<p className="flex-1">
							現在はベータ版（試験運用版）であり、審査や行政連携などのプロセスはまだ動いていません。現時点でできることは、詐欺広告や疑わしいリンクに関する通報の登録のみです。この点をご理解のうえご利用ください。
						</p>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="-mt-0.5 h-8 w-8 shrink-0 rounded-full text-amber-950 hover:bg-amber-200 hover:text-amber-950 sm:mt-0"
							aria-label="ベータ版に関するお知らせを閉じる"
							onClick={() => setIsBetaBannerVisible(false)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>
			) : null}
			{isCrowdfundingBannerVisible ? (
				<div className="border-t border-sky-200/80 bg-sky-50 text-sky-950">
					<div className="container flex items-start gap-3 py-2 text-sm leading-relaxed sm:items-center">
						<div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<p className="font-medium">クラウドファンディング実施中！</p>
							<Link
								href="https://camp-fire.jp/projects/930941/view"
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 font-medium text-sky-700 underline underline-offset-4 transition-colors hover:text-sky-900"
							>
								<span>詳しくはこちら</span>
								<ExternalLink className="h-3.5 w-3.5 shrink-0" />
							</Link>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0 rounded-full text-sky-950 hover:bg-sky-100 hover:text-sky-950"
							aria-label="クラウドファンディングのお知らせを閉じる"
							onClick={() => setIsCrowdfundingBannerVisible(false)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>
			) : null}
		</header>
	);
}
