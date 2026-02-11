import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth, getPolarClient } from "@/lib/auth";

export async function POST() {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const freeProductId = process.env.POLAR_PRODUCT_FREE_ID;
	if (!freeProductId) {
		return NextResponse.json(
			{ error: "Free product is not configured." },
			{ status: 500 },
		);
	}

	const userId = String(session.user.id);
	const proProductId = process.env.POLAR_PRODUCT_PRO_ID;
	const founderProductId = process.env.POLAR_PRODUCT_FOUNDER_ID;
	const paidProductIds = [proProductId, founderProductId].filter(
		(productId): productId is string => productId != null,
	);

	if (paidProductIds.length === 0) {
		return NextResponse.json(
			{ error: "Pro product is not configured." },
			{ status: 500 },
		);
	}

	try {
		const polarClient = getPolarClient();
		const customerState = await polarClient.customers.getStateExternal({
			externalId: userId,
		});

		const paidSubscriptions = customerState.activeSubscriptions.filter((sub) =>
			paidProductIds.includes(sub.productId),
		);

		if (paidSubscriptions.length === 0) {
			return NextResponse.json(
				{ error: "You do not have an active Pro subscription." },
				{ status: 400 },
			);
		}

		await Promise.all(
			paidSubscriptions.map((subscription) =>
				polarClient.subscriptions.revoke({ id: subscription.id }),
			),
		);

		const hasFreeSubscription = customerState.activeSubscriptions.some(
			(sub) => sub.productId === freeProductId,
		);
		if (!hasFreeSubscription) {
			await polarClient.subscriptions.create({
				productId: freeProductId,
				externalCustomerId: userId,
			});
		}

		return NextResponse.json({
			success: true,
			message: "Downgraded to Free plan.",
		});
	} catch (error) {
		console.error("[subscription/downgrade] Failed to downgrade plan:", error);
		return NextResponse.json(
			{ error: "Failed to downgrade plan." },
			{ status: 500 },
		);
	}
}
