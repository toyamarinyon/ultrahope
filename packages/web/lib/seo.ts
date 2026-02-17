import type { Metadata } from "next";
import { resolveBaseUrl } from "./base-url";

type CanonicalEnv = Record<string, string | undefined>;

export const DEFAULT_SITE_NAME = "Ultrahope";
export const DEFAULT_DESCRIPTION =
	"The decision pipe for AI-native software development. One command in. Proposals out. Human decision stays in the loop.";

export function resolveCanonicalOrigin(
	env: CanonicalEnv = process.env,
): string {
	return resolveBaseUrl(env);
}

export function toAbsoluteCanonical(
	path: string,
	env: CanonicalEnv = process.env,
): string {
	const origin = resolveCanonicalOrigin(env);
	return new URL(path, `${origin}/`).toString();
}

export function buildNoIndexMetadata(input: {
	title: string;
	description: string;
	path?: string;
}): Metadata {
	return {
		title: input.title,
		description: input.description,
		alternates: input.path
			? {
					canonical: input.path,
				}
			: undefined,
		robots: {
			index: false,
			follow: false,
			googleBot: {
				index: false,
				follow: false,
			},
		},
		openGraph: {
			title: input.title,
			description: input.description,
			url: input.path ? toAbsoluteCanonical(input.path) : undefined,
			siteName: DEFAULT_SITE_NAME,
			type: "website",
		},
		twitter: {
			card: "summary",
			title: input.title,
			description: input.description,
		},
	};
}
