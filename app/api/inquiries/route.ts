import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { name, email, subject, message } = body;

		if (!name || !email || !message) {
			return NextResponse.json(
				{ error: "必須項目が不足しています。" },
				{ status: 400 },
			);
		}

		const inquiry = await prisma.inquiry.create({
			data: {
				name,
				email,
				subject: subject || null,
				message,
			},
		});

		return NextResponse.json({ success: true, id: inquiry.id });
	} catch (error) {
		console.error("Inquiry submission error:", error);
		return NextResponse.json(
			{ error: "お問い合わせの送信中にエラーが発生しました。" },
			{ status: 500 },
		);
	}
}
