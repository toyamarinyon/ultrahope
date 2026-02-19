import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildNoIndexMetadata } from "@/lib/util/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Device Authorization",
	description: "Authorize CLI devices for your Ultrahope account.",
	path: "/device",
});

export default function DeviceLayout({ children }: { children: ReactNode }) {
	return children;
}
