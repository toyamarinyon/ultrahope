import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Forgot Password",
	description: "Request a password reset email for your Ultrahope account.",
	path: "/forgot-password",
});

export default function ForgotPasswordLayout({
	children,
}: {
	children: ReactNode;
}) {
	return children;
}
