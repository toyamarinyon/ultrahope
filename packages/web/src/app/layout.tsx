import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Ultrahope",
	description: "LLM-powered development workflow assistant",
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
