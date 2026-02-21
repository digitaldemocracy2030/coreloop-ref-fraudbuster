import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function toAdminRedirect(
	request: NextRequest,
	messageType: "notice" | "error",
	message: string,
): NextResponse {
	const url = new URL("/admin", request.url);
	url.searchParams.set(messageType, message);
	return NextResponse.redirect(url, { status: 303 });
}

function readText(formData: FormData, fieldName: string): string {
	const value = formData.get(fieldName);
	return typeof value === "string" ? value.trim() : "";
}

function readCheckbox(formData: FormData, fieldName: string): boolean {
	return formData.get(fieldName) === "on";
}

export async function POST(request: NextRequest) {
	const session = getAdminSessionFromRequest(request);
	if (!session) {
		const loginUrl = new URL("/admin/login", request.url);
		loginUrl.searchParams.set("error", "再度ログインしてください。");
		return NextResponse.redirect(loginUrl, { status: 303 });
	}

	try {
		const formData = await request.formData();
		const title = readText(formData, "title");
		const content = readText(formData, "content");
		const isImportant = readCheckbox(formData, "isImportant");
		const isPublished = readCheckbox(formData, "isPublished");

		if (!title || !content) {
			return toAdminRedirect(request, "error", "タイトルと本文は必須です。");
		}

		const admin = await prisma.admin.findUnique({
			where: { email: session.email },
			select: { id: true },
		});

		await prisma.announcement.create({
			data: {
				title,
				content,
				isImportant,
				isPublished,
				publishedAt: isPublished ? new Date() : null,
				createdBy: admin?.id ?? null,
			},
		});

		revalidateTag("announcements", "max");
		revalidatePath("/admin");
		return toAdminRedirect(request, "notice", "お知らせを作成しました。");
	} catch (error) {
		console.error("Failed to create announcement:", error);
		return toAdminRedirect(request, "error", "お知らせの作成に失敗しました。");
	}
}
