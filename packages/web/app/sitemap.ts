import type { MetadataRoute } from "next";
import { toAbsoluteCanonical } from "@/lib/seo";
import { canonicalPublicPages } from "@/lib/sitemap-pages";

export default function sitemap(): MetadataRoute.Sitemap {
	const lastModified = new Date();

	return canonicalPublicPages.map((page) => ({
		url: toAbsoluteCanonical(page.path),
		lastModified,
		changeFrequency: page.changeFrequency,
		priority: page.priority,
	}));
}
