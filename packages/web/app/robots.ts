import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				disallow: ["/login", "/forgot-password", "/reset-password", "/api"],
				allow: ["/", "/pricing", "/privacy", "/terms", "/home"],
			},
		],
		sitemap: "https://ultrahope.dev/sitemap.xml",
	};
}
