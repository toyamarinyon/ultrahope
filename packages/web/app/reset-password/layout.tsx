import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Reset Password",
	description: "Set a new password for your Ultrahope account.",
	path: "/reset-password",
});

export default function ResetPasswordLayout({
	children,
}: {
	children: ReactNode;
}) {
	return children;
}
