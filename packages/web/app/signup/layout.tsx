import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Sign Up",
	description: "Create your Ultrahope account.",
	path: "/signup",
});

export default function SignupLayout({ children }: { children: ReactNode }) {
	return children;
}
