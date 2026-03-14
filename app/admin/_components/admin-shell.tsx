import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

const ADMIN_NAV_ITEMS = [
	{ id: "home", href: "/admin", label: "管理トップ" },
	{ id: "announcements", href: "/admin/announcements", label: "お知らせ管理" },
	{
		id: "report-statuses",
		href: "/admin/report-statuses",
		label: "通報ステータス管理",
	},
	{ id: "inquiries", href: "/admin/inquiries", label: "お問い合わせ管理" },
] as const;

export type AdminNavItemId = (typeof ADMIN_NAV_ITEMS)[number]["id"];

interface AdminShellProps {
	email: string;
	activeNav: AdminNavItemId;
	title: string;
	description: string;
	children: ReactNode;
	notice?: string | null;
	error?: string | null;
}

export function AdminShell({
	email,
	activeNav,
	title,
	description,
	children,
	notice,
	error,
}: AdminShellProps) {
	return (
		<div className="container py-10 space-y-8">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-2">
					<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
						<ShieldCheck className="h-4 w-4" />
						管理者専用
					</div>
					<h1 className="text-3xl font-bold tracking-tight">{title}</h1>
					<p className="text-sm text-muted-foreground">{description}</p>
					<p className="text-sm text-muted-foreground">
						ログイン中の管理者ID: {email}
					</p>
				</div>
				<form action="/api/admin/logout" method="post">
					<Button type="submit" variant="outline">
						ログアウト
					</Button>
				</form>
			</header>

			<nav className="flex flex-wrap gap-2">
				{ADMIN_NAV_ITEMS.map((item) => (
					<Button
						key={item.id}
						asChild
						size="sm"
						variant={item.id === activeNav ? "default" : "outline"}
					>
						<Link href={item.href}>{item.label}</Link>
					</Button>
				))}
			</nav>

			{notice ? (
				<div className="rounded-lg border border-green-600/30 bg-green-500/10 px-4 py-3 text-sm text-green-900 dark:text-green-200">
					{notice}
				</div>
			) : null}
			{error ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</div>
			) : null}

			{children}
		</div>
	);
}
