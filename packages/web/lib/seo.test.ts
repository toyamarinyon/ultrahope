import { afterEach, describe, expect, it } from "bun:test";
import { metadata as homepageMetadata } from "@/app/page";
import { metadata as pricingMetadata } from "@/app/pricing/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { resolveCanonicalOrigin, toAbsoluteCanonical } from "@/lib/util/seo";
import { canonicalPublicPages } from "@/lib/util/sitemap-pages";

const originalEnv = { ...process.env };

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) {
			delete process.env[key];
		}
	}
	for (const [key, value] of Object.entries(originalEnv)) {
		process.env[key] = value;
	}
});

describe("resolveCanonicalOrigin", () => {
	it("uses production vercel url when in production", () => {
		expect(
			resolveCanonicalOrigin({
				NEXT_PUBLIC_VERCEL_ENV: "production",
				NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "ultrahope.dev",
			}),
		).toBe("https://ultrahope.dev");
	});

	it("uses preview vercel url when not production", () => {
		expect(
			resolveCanonicalOrigin({
				NEXT_PUBLIC_VERCEL_URL: "preview-ultrahope.vercel.app",
			}),
		).toBe("https://preview-ultrahope.vercel.app");
	});

	it("falls back to localhost when vercel env is not set", () => {
		expect(resolveCanonicalOrigin({})).toBe("http://localhost:3000");
	});
});

describe("canonical helpers", () => {
	it("builds absolute canonical urls", () => {
		expect(
			toAbsoluteCanonical("/pricing", {
				NEXT_PUBLIC_VERCEL_ENV: "production",
				NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "ultrahope.dev",
			}),
		).toBe("https://ultrahope.dev/pricing");
	});
});

describe("sitemap and robots", () => {
	it("sitemap only contains canonical public pages", () => {
		process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
		process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = "ultrahope.dev";

		const entries = sitemap();
		const urls = entries.map((entry) => new URL(entry.url).pathname);
		const expected = canonicalPublicPages.map((page) => page.path);

		expect(urls).toEqual(expected);
	});

	it("robots sitemap matches canonical host", () => {
		process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
		process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = "ultrahope.dev";

		const result = robots();
		const sitemapUrl = Array.isArray(result.sitemap)
			? result.sitemap[0]
			: result.sitemap;

		expect(sitemapUrl).toBe("https://ultrahope.dev/sitemap.xml");
	});
});

describe("key page metadata", () => {
	it("homepage metadata includes og title/description", () => {
		const metadata = homepageMetadata as {
			openGraph?: { title?: string; description?: string };
		};
		expect(metadata.openGraph?.title).toBeTruthy();
		expect(metadata.openGraph?.description).toBeTruthy();
	});

	it("pricing metadata includes og title/description", () => {
		const metadata = pricingMetadata as {
			openGraph?: { title?: string; description?: string };
		};
		expect(metadata.openGraph?.title).toBeTruthy();
		expect(metadata.openGraph?.description).toBeTruthy();
	});
});
