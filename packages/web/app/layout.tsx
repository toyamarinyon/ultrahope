import type { Metadata } from "next";
import "./globals.css";
import { Baskervville, Geist } from "next/font/google";
import {
	DEFAULT_DESCRIPTION,
	DEFAULT_SITE_NAME,
	resolveCanonicalOrigin,
} from "@/lib/util/seo";

const geist = Geist({
	subsets: ["latin"],
});
const baskerville = Baskervville({
	subsets: ["latin"],
});

export const metadata: Metadata = {
	metadataBase: new URL(resolveCanonicalOrigin()),
	title: {
		default: DEFAULT_SITE_NAME,
		template: `%s | ${DEFAULT_SITE_NAME}`,
	},
	description: DEFAULT_DESCRIPTION,
	alternates: {
		canonical: "/",
	},
	openGraph: {
		title: DEFAULT_SITE_NAME,
		description: DEFAULT_DESCRIPTION,
		url: "/",
		siteName: DEFAULT_SITE_NAME,
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary",
		title: DEFAULT_SITE_NAME,
		description: DEFAULT_DESCRIPTION,
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={`${geist.className} ${baskerville.className}`}>
			<head></head>
			<body className="font-sans">{children}</body>
		</html>
	);
}
