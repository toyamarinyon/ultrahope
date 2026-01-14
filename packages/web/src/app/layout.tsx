import type { Metadata } from "next";

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
			<body>{children}</body>
		</html>
	);
}
