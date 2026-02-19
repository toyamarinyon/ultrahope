/**
 * Structured log types for auth route monitoring.
 *
 * Referenced by:
 * - packages/web/app/api/auth/[[...all]]/route.ts (emitter)
 * - .agents/skills/checking-auth-health/SKILL.md (consumer)
 */

type AuthLogBase = {
	tag: "auth";
	correlationId: string;
	method: "GET" | "POST";
	action: string;
};

export type AuthRequestLog = AuthLogBase & {
	level: "info";
	event: "request";
};

export type AuthResponseLog = AuthLogBase & {
	level: "info" | "error";
	event: "response";
	status: number;
	duration: number;
};

export type AuthExceptionLog = AuthLogBase & {
	level: "error";
	event: "exception";
	error: string;
	duration: number;
};
