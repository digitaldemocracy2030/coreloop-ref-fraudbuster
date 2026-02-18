import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteIntroductionModal } from "@/components/site-introduction-modal";
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
		"SNSやメッセージアプリの詐欺情報をクラウドソーシングで集約し、共有・検索できるプラットフォーム。",
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
			</body>
		</html>
	);
}
