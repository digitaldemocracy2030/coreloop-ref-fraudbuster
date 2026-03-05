import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const ANNOUNCEMENTS_ADMIN_PATH = "/admin/announcements";

function toAdminRedirect(
	request: NextRequest,
	messageType: "notice" | "error",
	message: string,
	options?: { selected?: string },
): NextResponse {
	const url = new URL(ANNOUNCEMENTS_ADMIN_PATH, request.url);
	url.searchParams.set(messageType, message);
	if (options?.selected) {
		url.searchParams.set("selected", options.selected);
	}
	return NextResponse.redirect(url, { status: 303 });
}

function readText(formData: FormData, fieldName: string): string {
	const value = formData.get(fieldName);
	return typeof value === "string" ? value.trim() : "";
}

function readCheckbox(formData: FormData, fieldName: string): boolean {
	return formData.get(fieldName) === "on";
}

export async function POST(
	request: NextRequest,
	ctx: RouteContext<"/api/admin/announcements/[id]">,
) {
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		const loginUrl = new URL("/admin/login", request.url);
		loginUrl.searchParams.set("error", "再度ログインしてください。");
		return NextResponse.redirect(loginUrl, { status: 303 });
	}

	try {
		const { id } = await ctx.params;
		const formData = await request.formData();
		const intent = readText(formData, "intent");

		if (intent === "delete") {
			await prisma.announcement.delete({
				where: { id },
			});
			revalidateTag("announcements", "max");
			revalidatePath(ANNOUNCEMENTS_ADMIN_PATH);
			revalidatePath("/admin");
			return toAdminRedirect(request, "notice", "お知らせを削除しました。");
		}

		const title = readText(formData, "title");
		const content = readText(formData, "content");
		const isImportant = readCheckbox(formData, "isImportant");
		const isPublished = readCheckbox(formData, "isPublished");

		if (!title || !content) {
			return toAdminRedirect(request, "error", "タイトルと本文は必須です。", {
				selected: id,
			});
		}

		const existing = await prisma.announcement.findUnique({
			where: { id },
			select: { id: true, publishedAt: true },
		});
		if (!existing) {
			return toAdminRedirect(
				request,
				"error",
				"対象のお知らせが見つかりません。",
				{ selected: id },
			);
		}

		await prisma.announcement.update({
			where: { id },
			data: {
				title,
				content,
				isImportant,
				isPublished,
				publishedAt: isPublished ? (existing.publishedAt ?? new Date()) : null,
			},
		});

		revalidateTag("announcements", "max");
		revalidatePath(ANNOUNCEMENTS_ADMIN_PATH);
		revalidatePath("/admin");
		return toAdminRedirect(request, "notice", "お知らせを更新しました。", {
			selected: id,
		});
	} catch (error) {
		console.error("Failed to mutate announcement:", error);
		return toAdminRedirect(request, "error", "お知らせの操作に失敗しました。");
	}
}
