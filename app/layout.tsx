import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";

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
		<html lang="ja" suppressHydrationWarning>
			<body className="antialiased min-h-screen flex flex-col">
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
			</body>
		</html>
	);
}
