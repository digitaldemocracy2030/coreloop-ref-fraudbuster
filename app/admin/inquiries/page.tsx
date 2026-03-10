"use client";

import { CheckCircle2, Circle, MessageSquare } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { AdminShell } from "@/app/admin/_components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface Inquiry {
	id: string;
	name: string;
	email: string;
	subject: string | null;
	message: string;
	isRead: boolean;
	createdAt: string;
}

export default function AdminInquiriesPage() {
	const [inquiries, setInquiries] = React.useState<Inquiry[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);
	const [email, setEmail] = React.useState("");

	const fetchInquiries = React.useCallback(async () => {
		try {
			const response = await fetch("/api/admin/inquiries");
			if (!response.ok) throw new Error("データの取得に失敗しました");
			const data = await response.json();
			setInquiries(data);
		} catch (error) {
			console.error(error);
			toast.error("お問い合わせの取得に失敗しました");
		} finally {
			setIsLoading(false);
		}
	}, []);

	React.useEffect(() => {
		fetchInquiries();
		// Get session email from parent or just fetch it here if needed.
		// For simplicity, we can assume the user is logged in if they reach here.
		// Actually AdminShell takes email as prop.
		fetch("/api/reports/session")
			.then((res) => res.json())
			.then((data) => setEmail(data.email || "admin@example.com"));
	}, [fetchInquiries]);

	const toggleReadStatus = async (id: string, currentStatus: boolean) => {
		try {
			const response = await fetch("/api/admin/inquiries", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, isRead: !currentStatus }),
			});

			if (!response.ok) throw new Error("更新に失敗しました");

			setInquiries((prev) =>
				prev.map((item) =>
					item.id === id ? { ...item, isRead: !currentStatus } : item,
				),
			);
			toast.success(currentStatus ? "未読に戻しました" : "既読にしました");
		} catch (error) {
			console.error(error);
			toast.error("ステータスの更新に失敗しました");
		}
	};

	return (
		<AdminShell
			email={email}
			activeNav="inquiries"
			title="お問い合わせ管理"
			description="ユーザーからのお問い合わせ一覧を確認し、対応状況を管理できます。"
		>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5" />
						お問い合わせ一覧
					</CardTitle>
					<CardDescription>
						受信したお問い合わせを最新順に表示しています。
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="py-10 text-center text-muted-foreground">
							読み込み中...
						</div>
					) : inquiries.length === 0 ? (
						<div className="py-10 text-center text-muted-foreground">
							お問い合わせはありません
						</div>
					) : (
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[100px]">状況</TableHead>
										<TableHead className="w-[180px]">日時</TableHead>
										<TableHead className="w-[180px]">お名前 / メール</TableHead>
										<TableHead>件名 / 内容</TableHead>
										<TableHead className="text-right">操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{inquiries.map((inquiry) => (
										<TableRow
											key={inquiry.id}
											className={inquiry.isRead ? "bg-muted/30" : ""}
										>
											<TableCell>
												{inquiry.isRead ? (
													<Badge
														variant="outline"
														className="text-muted-foreground"
													>
														既読
													</Badge>
												) : (
													<Badge variant="default">未読</Badge>
												)}
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{format(
													new Date(inquiry.createdAt),
													"yyyy/MM/dd HH:mm",
													{ locale: ja },
												)}
											</TableCell>
											<TableCell>
												<div className="font-medium">{inquiry.name}</div>
												<div className="text-xs text-muted-foreground">
													{inquiry.email}
												</div>
											</TableCell>
											<TableCell>
												<div className="font-medium mb-1">
													{inquiry.subject || "(件名なし)"}
												</div>
												<div className="text-sm text-balance line-clamp-2 whitespace-pre-wrap">
													{inquiry.message}
												</div>
											</TableCell>
											<TableCell className="text-right">
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														toggleReadStatus(inquiry.id, inquiry.isRead)
													}
												>
													{inquiry.isRead ? (
														<>
															<Circle className="mr-2 h-4 w-4" />
															未読にする
														</>
													) : (
														<>
															<CheckCircle2 className="mr-2 h-4 w-4" />
															既読にする
														</>
													)}
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</AdminShell>
	);
}
