import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import {
	AUTO_RECHARGE_AMOUNTS,
	createCreditCheckout,
} from "@/lib/auto-recharge";

const BodySchema = z.object({
	amount: z.enum(AUTO_RECHARGE_AMOUNTS.map(String) as ["10", "20"]),
});

function toUserId(id: string): number | null {
	const parsed = Number.parseInt(id, 10);
	if (!Number.isFinite(parsed)) return null;
	return parsed;
}

export async function POST(request: Request) {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const parsed = BodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 },
		);
	}

	const userId = toUserId(session.user.id);
	if (userId == null) {
		return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
	}

	try {
		const amount = Number.parseInt(parsed.data.amount, 10) as 10 | 20;
		const checkout = await createCreditCheckout(userId, amount);
		if (!checkout) {
			return NextResponse.json(
				{
					error:
						"Credit checkout product is not configured. Set POLAR_PRODUCT_CREDIT_10_ID and POLAR_PRODUCT_CREDIT_20_ID.",
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({ url: checkout.url });
	} catch (error) {
		console.error(
			"[billing/credits/checkout] Failed to create checkout:",
			error,
		);
		return NextResponse.json(
			{ error: "Failed to create checkout." },
			{ status: 500 },
		);
	}
}
