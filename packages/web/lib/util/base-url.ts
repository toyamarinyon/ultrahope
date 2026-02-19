type BaseUrlEnv = Record<string, string | undefined>;

export function resolveBaseUrl(env: BaseUrlEnv = process.env): string {
	if (env.NEXT_PUBLIC_VERCEL_ENV === "production") {
		return `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
	}

	if (env.NEXT_PUBLIC_VERCEL_URL) {
		return `https://${env.NEXT_PUBLIC_VERCEL_URL}`;
	}

	const port = env.PORT ?? env.NEXT_PUBLIC_PORT ?? "3000";
	return `http://localhost:${port}`;
}

export const baseUrl = resolveBaseUrl({
	NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
	NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
		process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
	NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
	NEXT_PUBLIC_PORT: process.env.NEXT_PUBLIC_PORT,
});
