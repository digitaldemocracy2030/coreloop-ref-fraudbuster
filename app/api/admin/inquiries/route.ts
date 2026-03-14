import { type NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		await requireAdminSession();

		const inquiries = await prisma.inquiry.findMany({
			orderBy: {
				createdAt: "desc",
			},
		});

		return NextResponse.json(inquiries);
	} catch (error) {
		console.error("Fetch inquiries error:", error);
		return NextResponse.json(
			{ error: "お問い合わせの取得中にエラーが発生しました。" },
			{ status: 500 },
		);
	}
}

export async function PATCH(request: NextRequest) {
	try {
		await requireAdminSession();
		const body = await request.json();
		const { id, isRead } = body;

		if (!id) {
			return NextResponse.json(
				{ error: "IDが指定されていません。" },
				{ status: 400 },
			);
		}

		await prisma.inquiry.update({
			where: { id },
			data: { isRead },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Update inquiry error:", error);
		return NextResponse.json(
			{ error: "ステータスの更新中にエラーが発生しました。" },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	try {
		await requireAdminSession();
		const body = await request.json();
		const { id } = body;

		if (!id) {
			return NextResponse.json(
				{ error: "IDが指定されていません。" },
				{ status: 400 },
			);
		}

		const inquiry = await prisma.inquiry.findUnique({
			where: { id },
			select: { isRead: true },
		});

		if (!inquiry) {
			return NextResponse.json(
				{ error: "お問い合わせが見つかりません。" },
				{ status: 404 },
			);
		}

		if (!inquiry.isRead) {
			return NextResponse.json(
				{ error: "未対応のお問い合わせは削除できません。" },
				{ status: 400 },
			);
		}

		await prisma.inquiry.delete({
			where: { id },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Delete inquiry error:", error);
		return NextResponse.json(
			{ error: "お問い合わせの削除中にエラーが発生しました。" },
			{ status: 500 },
		);
	}
}
