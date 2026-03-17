import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

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
	title: SITE_TITLE,
	description: SITE_DESCRIPTION,
	openGraph: {
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		type: "website",
		locale: "ja_JP",
		siteName: SITE_NAME,
		images: [
			{
				url: "/ogp.png",
				width: 1200,
				height: 630,
				alt: SITE_TITLE,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
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
						defaultTheme="light"
						enableSystem
						disableTransitionOnChange
					>
						<SiteHeader />
						<main className="flex-1">
							{children}
							<Analytics />
						</main>
						<SiteFooter />
						<Toaster position="top-center" />
					</ThemeProvider>
				</Suspense>
			</body>
		</html>
	);
}
