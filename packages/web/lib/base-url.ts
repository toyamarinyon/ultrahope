function resolveBaseUrl(): string {
	if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
		return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
	}

	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
	}

	const port = process.env.PORT ?? process.env.NEXT_PUBLIC_PORT ?? "3100";
	return `http://localhost:${port}`;
}

export const baseUrl = resolveBaseUrl();
