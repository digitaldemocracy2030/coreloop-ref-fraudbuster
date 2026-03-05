import { customAlphabet } from "nanoid";
import { createReportSessionToken, successResponse } from "@/lib/api-utils";

// 読みやすく、かつ衝突しにくいIDを生成
const nanoid = customAlphabet("6789BCDFGHJKLMNPQRSTVWXYZ", 12);

export async function POST() {
	const sessionId = nanoid();
	const token = createReportSessionToken(sessionId);

	return successResponse({
		token,
		sessionId, // フロントエンドでの表示やデバッグ用（検証は署名付きtokenで行う）
	});
}
