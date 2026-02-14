import type { MetadataRoute } from "next";

type CanonicalPublicPage = {
	path: `/${string}` | "/";
	priority: number;
	changeFrequency: NonNullable<
		MetadataRoute.Sitemap[number]["changeFrequency"]
	>;
};

// Keep canonical public pages in one place so sitemap updates are straightforward.
export const canonicalPublicPages = [
	{
		path: "/",
		changeFrequency: "weekly",
		priority: 1,
	},
	{
		path: "/pricing",
		changeFrequency: "weekly",
		priority: 0.9,
	},
	{
		path: "/login",
		changeFrequency: "monthly",
		priority: 0.8,
	},
	{
		path: "/forgot-password",
		changeFrequency: "monthly",
		priority: 0.6,
	},
	{
		path: "/terms",
		changeFrequency: "yearly",
		priority: 0.3,
	},
	{
		path: "/privacy",
		changeFrequency: "yearly",
		priority: 0.3,
	},
] as const satisfies readonly CanonicalPublicPage[];
