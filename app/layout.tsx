import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteIntroductionModal } from "@/components/site-introduction-modal";
import { ThemeProvider } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";

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
	title: "AntiFraud - ネット詐欺通報・検索プラットフォーム",
	description:
		"SNSやメッセージアプリの詐欺情報をみんなの力で集約し、共有・検索できるプラットフォーム。",
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
						<SiteIntroductionModal />
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
