"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CheckCircle2, Circle, Eye, MessageSquare, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { AdminShell } from "@/app/admin/_components/admin-shell";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
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
	const [deletingInquiryId, setDeletingInquiryId] = React.useState<
		string | null
	>(null);

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

	const deleteInquiry = async (id: string) => {
		try {
			setDeletingInquiryId(id);
			const response = await fetch("/api/admin/inquiries", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id }),
			});
			const payload = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;

			if (!response.ok) {
				throw new Error(payload?.error || "お問い合わせの削除に失敗しました");
			}

			setInquiries((prev) => prev.filter((item) => item.id !== id));
			toast.success("対応完了済みのお問い合わせを削除しました");
		} catch (error) {
			console.error(error);
			toast.error(
				error instanceof Error
					? error.message
					: "お問い合わせの削除に失敗しました",
			);
		} finally {
			setDeletingInquiryId(null);
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
							<Table className="table-fixed">
								<TableHeader>
									<TableRow>
										<TableHead className="w-[72px]">状況</TableHead>
										<TableHead className="w-[132px]">日時</TableHead>
										<TableHead className="w-[180px]">お名前 / メール</TableHead>
										<TableHead>件名 / 内容</TableHead>
										<TableHead className="w-[116px] text-right">操作</TableHead>
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
											<TableCell className="min-w-0">
												<div className="truncate font-medium">
													{inquiry.name}
												</div>
												<div className="truncate text-xs text-muted-foreground">
													{inquiry.email}
												</div>
											</TableCell>
											<TableCell className="min-w-0 whitespace-normal">
												<div className="mb-1 truncate font-medium">
													{inquiry.subject || "(件名なし)"}
												</div>
												<div className="line-clamp-1 text-sm text-muted-foreground">
													{inquiry.message}
												</div>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Dialog>
														<DialogTrigger asChild>
															<Button
																variant="outline"
																size="icon-sm"
																aria-label="詳細を表示"
																title="詳細を表示"
															>
																<Eye className="h-4 w-4" />
															</Button>
														</DialogTrigger>
														<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
															<DialogHeader>
																<DialogTitle>お問い合わせ詳細</DialogTitle>
																<DialogDescription>
																	受信したお問い合わせの内容を確認できます。
																</DialogDescription>
															</DialogHeader>
															<div className="space-y-5">
																<div className="grid gap-4 rounded-md border bg-muted/30 p-4 sm:grid-cols-2">
																	<div>
																		<div className="text-xs font-medium text-muted-foreground">
																			日時
																		</div>
																		<div className="mt-1 text-sm">
																			{format(
																				new Date(inquiry.createdAt),
																				"yyyy/MM/dd HH:mm",
																				{ locale: ja },
																			)}
																		</div>
																	</div>
																	<div>
																		<div className="text-xs font-medium text-muted-foreground">
																			状況
																		</div>
																		<div className="mt-1">
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
																		</div>
																	</div>
																	<div>
																		<div className="text-xs font-medium text-muted-foreground">
																			お名前
																		</div>
																		<div className="mt-1 break-words text-sm">
																			{inquiry.name}
																		</div>
																	</div>
																	<div>
																		<div className="text-xs font-medium text-muted-foreground">
																			メール
																		</div>
																		<div className="mt-1 break-all text-sm">
																			{inquiry.email}
																		</div>
																	</div>
																</div>
																<div>
																	<div className="text-xs font-medium text-muted-foreground">
																		件名
																	</div>
																	<div className="mt-1 break-words text-sm font-medium">
																		{inquiry.subject || "(件名なし)"}
																	</div>
																</div>
																<div>
																	<div className="text-xs font-medium text-muted-foreground">
																		内容
																	</div>
																	<div className="mt-2 max-h-[50dvh] overflow-y-auto rounded-md border bg-background p-4 text-sm leading-6 whitespace-pre-wrap break-words">
																		{inquiry.message}
																	</div>
																</div>
															</div>
														</DialogContent>
													</Dialog>
													<Button
														variant="ghost"
														size="icon-sm"
														onClick={() =>
															toggleReadStatus(inquiry.id, inquiry.isRead)
														}
														aria-label={
															inquiry.isRead ? "未読にする" : "既読にする"
														}
														title={inquiry.isRead ? "未読にする" : "既読にする"}
													>
														{inquiry.isRead ? (
															<Circle className="h-4 w-4" />
														) : (
															<CheckCircle2 className="h-4 w-4" />
														)}
													</Button>
													{inquiry.isRead ? (
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	variant="destructive"
																	size="icon-sm"
																	disabled={deletingInquiryId === inquiry.id}
																	aria-label="削除"
																	title="削除"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent size="sm">
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		このお問い合わせを削除しますか？
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		対応完了として既読になっているお問い合わせのみ削除できます。この操作は元に戻せません。
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>
																		キャンセル
																	</AlertDialogCancel>
																	<AlertDialogAction
																		onClick={() => deleteInquiry(inquiry.id)}
																		variant="destructive"
																	>
																		削除する
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													) : null}
												</div>
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
