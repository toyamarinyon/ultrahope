import { auth } from "@/lib/auth";
import { translate } from "@/lib/llm";

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	const { input, target } = body as { input: string; target: string };

	const validTargets = ["vcs-commit-message", "pr-title-body", "pr-intent"];
	if (!validTargets.includes(target)) {
		return Response.json(
			{ error: `Invalid target: ${target}` },
			{ status: 400 },
		);
	}

	const output = await translate(
		input,
		target as "vcs-commit-message" | "pr-title-body" | "pr-intent",
		{ externalCustomerId: session.user.id },
	);
	return Response.json({ output });
}
