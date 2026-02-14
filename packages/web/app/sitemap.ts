import type { MetadataRoute } from "next";
import { canonicalPublicPages } from "@/lib/sitemap-pages";

const DEFAULT_CANONICAL_ORIGIN = "https://ultrahope.dev";

function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

function resolveSitemapOrigin(): string {
	const configuredSiteUrl =
		process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
	if (configuredSiteUrl) {
		return trimTrailingSlash(configuredSiteUrl);
	}

	if (
		process.env.NEXT_PUBLIC_VERCEL_ENV === "production" &&
		process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
	) {
		return trimTrailingSlash(
			`https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`,
		);
	}

	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return trimTrailingSlash(`https://${process.env.NEXT_PUBLIC_VERCEL_URL}`);
	}

	return DEFAULT_CANONICAL_ORIGIN;
}

function toAbsoluteUrl(origin: string, path: string): string {
	return new URL(path, `${origin}/`).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
	const origin = resolveSitemapOrigin();
	const lastModified = new Date();

	return canonicalPublicPages.map((page) => ({
		url: toAbsoluteUrl(origin, page.path),
		lastModified,
		changeFrequency: page.changeFrequency,
		priority: page.priority,
	}));
}
