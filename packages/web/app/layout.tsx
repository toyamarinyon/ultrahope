import type { Metadata } from "next";
import "./globals.css";
import {
	DEFAULT_DESCRIPTION,
	DEFAULT_SITE_NAME,
	resolveCanonicalOrigin,
} from "@/lib/seo";

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
		<html lang="en">
			<head>
				<link rel="preconnect" href="https://api.fontshare.com" />
				<link
					href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
					rel="stylesheet"
				/>
			</head>
			<body>{children}</body>
		</html>
	);
}
