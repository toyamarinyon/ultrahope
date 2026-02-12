import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import {
	AUTO_RECHARGE_AMOUNTS,
	getAutoRechargeSettings,
	MICRODOLLARS_PER_USD,
	updateAutoRechargeSettings,
} from "@/lib/auto-recharge";

const UpdateSchema = z.object({
	enabled: z.boolean(),
	thresholdUsd: z.number().min(0).max(1000),
	amount: z.enum(AUTO_RECHARGE_AMOUNTS.map(String) as ["10", "20"]),
});

function toUserId(id: string): number | null {
	const parsed = Number.parseInt(id, 10);
	if (!Number.isFinite(parsed)) return null;
	return parsed;
}

export async function GET() {
	const auth = getAuth();
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const userId = toUserId(session.user.id);
	if (userId == null) {
		return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
	}

	const settings = await getAutoRechargeSettings(getDb(), userId);
	return NextResponse.json({
		enabled: settings.enabled,
		thresholdUsd: settings.threshold / MICRODOLLARS_PER_USD,
		amount: settings.amount,
	});
}

export async function PUT(request: Request) {
	const auth = getAuth();
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const parsed = UpdateSchema.safeParse(body);
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

	const updated = await updateAutoRechargeSettings(getDb(), userId, {
		enabled: parsed.data.enabled,
		threshold: Math.round(parsed.data.thresholdUsd * MICRODOLLARS_PER_USD),
		amount: Number.parseInt(parsed.data.amount, 10) as 10 | 20,
	});
	if (!updated) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	return NextResponse.json({
		enabled: updated.enabled,
		thresholdUsd: updated.threshold / MICRODOLLARS_PER_USD,
		amount: updated.amount,
	});
}
