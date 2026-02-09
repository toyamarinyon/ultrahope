import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getAuth, getPolarClient } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";

export async function POST(request: NextRequest) {
	const auth = getAuth();
	const polarClient = getPolarClient();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	const { subscriptionId, targetProductId } = body;

	if (!subscriptionId || !targetProductId) {
		return NextResponse.json(
			{ error: "subscriptionId and targetProductId are required" },
			{ status: 400 },
		);
	}

	try {
		const checkout = await polarClient.checkouts.create({
			products: [targetProductId],
			subscriptionId: subscriptionId,
			successUrl: `${baseUrl}/checkout/success?checkout_id={CHECKOUT_ID}&upgraded=true`,
		});

		return NextResponse.json({
			success: true,
			url: checkout.url,
		});
	} catch (error) {
		console.error(
			"[subscription/upgrade] Failed to create upgrade checkout:",
			error,
		);
		return NextResponse.json(
			{ error: "Failed to create upgrade checkout" },
			{ status: 500 },
		);
	}
}
