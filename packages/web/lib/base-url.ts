type BaseUrlEnv = Record<string, string | undefined>;

function logResolution(trace: {
	source: string;
	nextPublicVercelEnv?: string;
	nextPublicVercelProjectProductionUrl?: string;
	nextPublicVercelUrl?: string;
	port: string;
	fallback?: string;
	result: string;
}) {
	console.log("[base-url] resolveBaseUrl", JSON.stringify(trace));
}

export function resolveBaseUrl(env: BaseUrlEnv = process.env): string {
	if (env.NEXT_PUBLIC_VERCEL_ENV === "production") {
		const result = `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
		logResolution({
			source: "production",
			nextPublicVercelEnv: env.NEXT_PUBLIC_VERCEL_ENV,
			nextPublicVercelProjectProductionUrl:
				env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
			port: env.PORT ?? env.NEXT_PUBLIC_PORT ?? "3000",
			result,
		});
		return result;
	}

	if (env.NEXT_PUBLIC_VERCEL_URL) {
		const result = `https://${env.NEXT_PUBLIC_VERCEL_URL}`;
		logResolution({
			source: "preview",
			nextPublicVercelEnv: env.NEXT_PUBLIC_VERCEL_ENV,
			nextPublicVercelUrl: env.NEXT_PUBLIC_VERCEL_URL,
			port: env.PORT ?? env.NEXT_PUBLIC_PORT ?? "3000",
			result,
		});
		return result;
	}

	const port = env.PORT ?? env.NEXT_PUBLIC_PORT ?? "3000";
	const result = `http://localhost:${port}`;
	logResolution({
		source: "localhost-fallback",
		nextPublicVercelEnv: env.NEXT_PUBLIC_VERCEL_ENV,
		port,
		fallback: "localhost",
		result,
	});
	return result;
}

export const baseUrl = resolveBaseUrl();
