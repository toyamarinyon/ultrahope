import type { MetadataRoute } from "next";
import { toAbsoluteCanonical } from "@/lib/util/seo";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				disallow: [
					"/api",
					"/login",
					"/signup",
					"/forgot-password",
					"/reset-password",
					"/home",
					"/settings",
					"/device",
					"/checkout",
				],
				allow: ["/", "/docs", "/pricing", "/models", "/privacy", "/terms"],
			},
		],
		sitemap: toAbsoluteCanonical("/sitemap.xml"),
	};
}
