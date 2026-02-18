import { randomUUID } from "node:crypto";
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import type {
	AuthExceptionLog,
	AuthRequestLog,
	AuthResponseLog,
} from "@/lib/auth-log";

function resolveAuthAction(request: Request): string {
	const url = new URL(request.url);
	const segments = url.pathname.replace(/^\/api\/auth\/?/, "").split("/");
	return segments.filter(Boolean).join("/") || "unknown";
}

async function handleAuthRequest(
	request: Request,
	method: "GET" | "POST",
): Promise<Response> {
	const correlationId = randomUUID();
	const action = resolveAuthAction(request);
	const start = Date.now();

	console.log(
		JSON.stringify({
			level: "info",
			tag: "auth",
			event: "request",
			correlationId,
			method,
			action,
		} satisfies AuthRequestLog),
	);

	try {
		const handler = toNextJsHandler(getAuth());
		const response =
			method === "GET"
				? await handler.GET(request)
				: await handler.POST(request);
		const duration = Date.now() - start;

		const logLevel = response.status >= 400 ? "error" : "info";
		console.log(
			JSON.stringify({
				level: logLevel,
				tag: "auth",
				event: "response",
				correlationId,
				method,
				action,
				status: response.status,
				duration,
			} satisfies AuthResponseLog),
		);

		return response;
	} catch (error) {
		const duration = Date.now() - start;
		console.error(
			JSON.stringify({
				level: "error",
				tag: "auth",
				event: "exception",
				correlationId,
				method,
				action,
				error: error instanceof Error ? error.message : String(error),
				duration,
			} satisfies AuthExceptionLog),
		);
		throw error;
	}
}

export const GET = (request: Request) => handleAuthRequest(request, "GET");
export const POST = (request: Request) => handleAuthRequest(request, "POST");
