import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAuth } from "@/lib/auth/auth";
import { getAuthenticatedUserEntitlement } from "@/lib/billing/entitlement";
import { buildNoIndexMetadata } from "@/lib/util/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Device Authorization",
	description: "Authorize CLI devices for your Ultrahope account.",
	path: "/device",
});

export default async function DeviceLayout({
	children,
}: {
	children: ReactNode;
}) {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (session) {
		const isAnonymous =
			"isAnonymous" in session.user && session.user.isAnonymous === true;
		if (!isAnonymous) {
			const entitlement = await getAuthenticatedUserEntitlement(
				session.user.id,
				{
					throwOnError: true,
				},
			);
			if (entitlement !== "pro") {
				redirect("/checkout/start?returnTo=%2Fdevice");
			}
		}
	}

	return children;
}
