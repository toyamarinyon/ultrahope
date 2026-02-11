import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import {
	deleteUserByEmail,
	requireAccountDeletionEnvVars,
} from "@/lib/account-deletion";

const RequestSchema = z.object({
	confirmEmail: z.string().email(),
});

export async function POST(request: Request) {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const parsed = RequestSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 },
		);
	}

	if (parsed.data.confirmEmail !== session.user.email) {
		return NextResponse.json(
			{ error: "Confirmation email does not match current account." },
			{ status: 400 },
		);
	}

	try {
		requireAccountDeletionEnvVars();
		const report = await deleteUserByEmail({
			email: session.user.email,
			mode: "execute",
		});

		if (!report.userFound) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (report.summary.fatalFailure) {
			return NextResponse.json(
				{ error: "Account deletion failed", report },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			ok: true,
			externalFailures: report.summary.externalFailures,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Account deletion failed",
			},
			{ status: 500 },
		);
	}
}
