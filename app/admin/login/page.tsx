import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAdminSession, isAdminLoginConfigured } from "@/lib/admin-auth";

interface AdminLoginPageProps {
	searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({
	searchParams,
}: AdminLoginPageProps) {
	await connection();
	const session = await getAdminSession();
	if (session) {
		redirect("/admin");
	}

	const params = await searchParams;
	const errorMessage = typeof params.error === "string" ? params.error : null;
	const isConfigured = isAdminLoginConfigured();

	return (
		<div className="container max-w-md py-16 space-y-6">
			<Card>
				<CardHeader className="space-y-3">
					<div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
						<ShieldCheck className="h-5 w-5" />
					</div>
					<div className="space-y-1">
						<CardTitle className="text-2xl">管理者ログイン</CardTitle>
						<CardDescription>
							管理画面にアクセスするにはログインが必要です。
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{errorMessage ? (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{errorMessage}
						</div>
					) : null}

					{!isConfigured ? (
						<div className="rounded-md border border-yellow-600/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
							<div className="flex items-start gap-2">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
								<p>
									環境変数 `ADMIN_LOGIN_EMAIL` と `ADMIN_LOGIN_PASSWORD`
									が未設定です。
								</p>
							</div>
						</div>
					) : null}

					<form action="/api/admin/login" method="post" className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="admin-email" className="text-sm font-medium">
								メールアドレス
							</label>
							<Input
								id="admin-email"
								name="email"
								type="email"
								placeholder="admin@example.com"
								autoComplete="username"
								required
							/>
						</div>
						<div className="space-y-2">
							<label
								htmlFor="admin-password"
								className="text-sm font-medium flex items-center gap-2"
							>
								<LockKeyhole className="h-4 w-4" />
								パスワード
							</label>
							<Input
								id="admin-password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
							/>
						</div>
						<Button type="submit" className="w-full">
							ログイン
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
