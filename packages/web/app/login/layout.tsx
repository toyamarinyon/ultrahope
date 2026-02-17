import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Login",
	description: "Sign in to your Ultrahope account.",
	path: "/login",
});

export default function LoginLayout({ children }: { children: ReactNode }) {
	return children;
}
