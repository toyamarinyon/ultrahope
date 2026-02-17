import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing-home";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Home",
	description: "Signed-in dashboard entry point for Ultrahope users.",
	path: "/home",
});

export default function HomePage() {
	return <MarketingHome />;
}
