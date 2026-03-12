import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
	title: "プライバシーポリシー | AntiFraud",
	description:
		"AntiFraud（ネット詐欺通報・検索プラットフォーム）のプライバシーポリシーです。",
};

type PrivacySection = {
	title: string;
	content: Array<
		| {
				type: "list";
				items: ReactNode[];
		  }
		| {
				type: "group";
				title: string;
				items: ReactNode[];
		  }
		| {
				type: "paragraph";
				body: ReactNode;
		  }
		| {
				type: "nested-list";
				body: ReactNode;
				items: ReactNode[];
		  }
	>;
};

const PRIVACY_SECTIONS: PrivacySection[] = [
	{
		title: "1. 基本方針",
		content: [
			{
				type: "list",
				items: [
					"本サービス運営者は、ネット詐欺に関する通報の受付、審査、掲載、運営および不正利用防止のために必要な範囲で利用者の個人情報を取り扱います。",
					"取得した情報は、個人情報の保護に関する法令その他の関連法令を踏まえ、利用目的の範囲内で適切に取り扱います。",
				],
			},
		],
	},
	{
		title: "2. 取得する情報",
		content: [
			{
				type: "group",
				title: "お客様から直接ご提供いただく情報",
				items: [
					"メールアドレス、通報対象のURL・アカウント名、タイトル、説明文、選択したカテゴリ・プラットフォーム、添付された画像等、本サービスの入力フォームに入力またはアップロードされる一切の情報。",
					"その他、上記に付随して本サービスの利用にあたりお客様が直接提供する一切の情報。",
				],
			},
			{
				type: "group",
				title: "サービス利用に関連して自動的に取得する情報",
				items: [
					"IPアドレス、ユーザーエージェント、リクエスト履歴、レート制限用記録、セッショントークンおよびその利用状況、Cookie情報（`admin_session` 等）、アクセス日時、デバイス・ブラウザ情報、トラフィックデータ。",
					"通報対象URLのプレビュー生成のために取得するリンク先ページのタイトル、サムネイル、メタデータ等。",
					"その他、本サービスの提供、維持、改善およびセキュリティ確保のために自動的に生成または取得される一切の情報。",
				],
			},
			{
				type: "group",
				title: "第三者から取得する場合を含めて当社が適法に取得する情報",
				items: [
					"外部サービス（Cloudflare、Google、Supabase 等）との連携や、法令に基づき第三者から適法に提供される情報。",
					"その他、本プロジェクトの目的達成のために必要となる、上記以外の適法に取得される一切の情報。",
				],
			},
		],
	},
	{
		title: "3. 利用目的",
		content: [
			{
				type: "list",
				items: [
					"通報の受付、審査、掲載、重複確認、ステータス管理、削除・修正依頼への対応のため。",
					"通報者への連絡、重要なお知らせの通知および本人確認が必要な対応のため。",
					"スパム投稿、ボット送信、不正アクセスその他の不正行為の検知、防止および調査のため。",
					"通報対象URLのプレビュー生成、スクリーンショットの保管・配信およびサービス改善のため。",
					"管理画面への認証、監査対応、障害対応およびセキュリティ運用のため。",
				],
			},
			{
				type: "paragraph",
				body: "取得した情報は、以下の目的（これらに付随する目的を含みます）のために利用します。",
			},
			{
				type: "list",
				items: [
					"本サービスの提供・維持：通報の受付、審査、掲載、ステータス管理、本人確認、および重要なお知らせの通知。",
					"サービスの開発・改善：利用状況の分析、プレビュー生成、統計データの作成、および新規機能・サービスの検討。",
					"セキュリティ・不正利用の防止：スパム、ボット、不正アクセス等の検知・調査・対応、および監査・障害対応。",
					"その他：法令遵守、事業承継、研究機関への提供、および本プロジェクトの目的達成のために必要となる一切の業務。",
				],
			},
		],
	},
	{
		title: "4. 公開される情報",
		content: [
			{
				type: "list",
				items: [
					"通報対象のURL、タイトル、説明文、画像、カテゴリ、ステータス、タイムライン情報等、サービス提供に必要な情報は、本サービス上の公開ページやAPIで表示・送信されることがあります。また、本サービスの円滑な運営、セキュリティ確保、または本プロジェクトの目的達成のために必要な範囲で、情報の公開を行う場合があります。",
					"通報者のメールアドレス、IPアドレス、管理者の認証情報は公開しません。ただし、法令に基づく開示請求等がある場合はこの限りではありません。",
					"説明文やスクリーンショットには、必要最小限の情報のみを含め、不要な個人情報や機微情報を記載・添付しないでください。",
				],
			},
		],
	},
	{
		title: "5. 外部サービス等への送信",
		content: [
			{
				type: "list",
				items: [
					<>
						スパム対策（Cloudflare）、利用状況分析（Google Analytics）、データ保管（Supabase）等のため、各サービスの規約に基づき情報が送信されることがあります。その他、本サービスの円滑な運営、セキュリティ確保、または本プロジェクトの目的達成のために必要な範囲で、情報の外部への送信を行う場合があります。
					</>,
					"利用者は、ブラウザ設定による Cookie の無効化または Google が提供するオプトアウト手段により、Google Analytics による情報収集を制限できます。",
				],
			},
		],
	},
	{
		title: "6. 第三者提供および委託",
		content: [
			{
				type: "nested-list",
				body: "法令に基づく場合を除き、取得した個人情報を本人の同意なく第三者に提供しません。ただし、以下の場合には運営者は個人情報を第三者に提供することがあり、利用者はあらかじめこれに同意するものとします。",
				items: [
					"本サービスの目的に必要な範囲で、個人情報を公開または第4項および第5項に記載の方法で公開または送信する場合。",
					"事業承継が行われる場合。",
					"運営者による新たなサービスの検討のために必要な場合、不正利用防止のために必要な場合、調査、研究や分析のために研究機関に提供する場合。",
				],
			},
			{
				type: "list",
				items: [
					"クラウドストレージ、ボット対策その他の運営上必要な業務を外部事業者に委託することがあります。この場合、必要かつ適切な監督を行います。",
				],
			},
		],
	},
	{
		title: "7. 保有期間",
		content: [
			{
				type: "list",
				items: [
					"公開中の通報情報は、サービス提供および不正利用対策に必要な期間保有します。",
					"メールアドレス、IPアドレスその他の非公開情報は、対応履歴、権利保護、法令遵守およびセキュリティ確保に必要な期間保有します。",
				],
			},
		],
	},
	{
		title: "8. 安全管理措置",
		content: [
			{
				type: "list",
				items: [
					"アクセス制御、認証Cookieの保護、署名付きトークン、レート制限、画像の再エンコード・無害化等の安全管理措置を講じます。",
					"安全管理措置の内容は、技術水準や運用状況に応じて継続的に見直します。",
				],
			},
		],
	},
	{
		title: "9. 開示・訂正・削除等の請求",
		content: [
			{
				type: "list",
				items: [
					"本人または正当な権限を有する方から、自己に関する情報の開示、訂正、削除、利用停止、掲載内容の修正・削除等の申出があった場合、法令および当社手続に従って対応します。",
					"通報内容の修正・削除依頼その他の権利行使に関する申出は、本サービス上で案内する窓口からご連絡ください。",
				],
			},
		],
	},
	{
		title: "10. 改定",
		content: [
			{
				type: "list",
				items: [
					"本ポリシーの内容は、法令改正、サービス内容の変更または運用上の必要に応じて改定することがあります。",
					"重要な変更がある場合は、本サービス上で周知します。",
				],
			},
		],
	},
	{
		title: "11. お問い合わせ窓口",
		content: [
			{
				type: "list",
				items: [
					<>
						本ポリシーに関するお問い合わせは、本サービス上で案内するお問い合わせ窓口（
						<a
							href="https://antifraud.dd2030.org/contact"
							className="underline underline-offset-4"
						>
							https://antifraud.dd2030.org/contact
						</a>
						）をご利用ください。
					</>,
				],
			},
		],
	},
];

export default function PrivacyPage() {
	return (
		<div className="container py-12 space-y-8">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">
					プライバシーポリシー
				</h1>
				<p className="text-sm text-muted-foreground">
					最終更新日: 2026年3月12日
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>個人情報保護方針</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6 text-sm leading-7 text-muted-foreground">
					{PRIVACY_SECTIONS.map((section) => (
						<section key={section.title} className="space-y-2">
							<h2 className="text-base font-semibold text-foreground">
								{section.title}
							</h2>
							<div className="space-y-4">
								{section.content.map((block, blockIndex) => {
									if (block.type === "paragraph") {
										return (
											<p key={`${section.title}-${blockIndex}`}>
												{block.body}
											</p>
										);
									}

									if (block.type === "nested-list") {
										return (
											<div key={`${section.title}-${blockIndex}`} className="space-y-2">
												<ul className="list-disc pl-5 space-y-1">
													<li>{block.body}</li>
												</ul>
												<ul className="list-[circle] pl-10 space-y-1">
													{block.items.map((item, index) => (
														<li key={`${section.title}-${blockIndex}-${index}`}>
															{item}
														</li>
													))}
												</ul>
											</div>
										);
									}

									if (block.type === "group") {
										return (
											<div
												key={`${section.title}-${block.title}`}
												className="space-y-2"
											>
												<h3 className="font-medium text-foreground">
													{block.title}
												</h3>
												<ul className="list-disc pl-5 space-y-1">
													{block.items.map((item, index) => (
														<li
															key={`${section.title}-${block.title}-${index}`}
														>
															{item}
														</li>
													))}
												</ul>
											</div>
										);
									}

									return (
										<ul
											key={`${section.title}-${blockIndex}`}
											className="list-disc pl-5 space-y-1"
										>
											{block.items.map((item, index) => (
												<li key={`${section.title}-${blockIndex}-${index}`}>
													{item}
												</li>
											))}
										</ul>
									);
								})}
							</div>
						</section>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
