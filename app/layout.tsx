import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";

const siteUrl =
	process.env.NEXT_PUBLIC_SITE_URL ??
	process.env.NEXT_PUBLIC_APP_URL ??
	(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
	"http://localhost:3000";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	display: "swap",
});

const notoSansJP = Noto_Sans_JP({
	subsets: ["latin"],
	variable: "--font-noto-sans-jp",
	display: "swap",
	weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: "AntiFraud - ネット広告詐欺通報・検索プラットフォーム",
	description:
		"SNSやWebサイトの広告詐欺情報をみんなの力で集約し、共有・検索できるプラットフォーム。",
	openGraph: {
		title: "AntiFraud - ネット広告詐欺通報・検索プラットフォーム",
		description:
			"SNSやWebサイトの広告詐欺情報をみんなの力で集約し、共有・検索できるプラットフォーム。",
		type: "website",
		locale: "ja_JP",
		siteName: "AntiFraud",
		images: [
			{
				url: "/ogp.png",
				width: 1200,
				height: 630,
				alt: "AntiFraud - ネット広告詐欺通報・検索プラットフォーム",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "AntiFraud - ネット広告詐欺通報・検索プラットフォーム",
		description:
			"SNSやWebサイトの広告詐欺情報をみんなの力で集約し、共有・検索できるプラットフォーム。",
		images: ["/ogp.png"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="ja"
			suppressHydrationWarning
			className={`${inter.variable} ${notoSansJP.variable}`}
		>
			<body className="antialiased min-h-screen flex flex-col font-sans">
				<Suspense
					fallback={
						<div className="min-h-screen flex flex-col">
							<div className="h-16 border-b px-4 flex items-center">
								<Skeleton className="h-6 w-28" />
							</div>
							<main className="container flex-1 py-10 space-y-6">
								<Skeleton className="h-10 w-2/3" />
								<Skeleton className="h-5 w-1/2" />
								<Skeleton className="h-56 w-full rounded-xl" />
							</main>
						</div>
					}
				>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<SiteHeader />
						<main className="flex-1">{children}</main>
						<SiteFooter />
						<Toaster position="top-center" />
					</ThemeProvider>
				</Suspense>
			</body>
		</html>
	);
}
