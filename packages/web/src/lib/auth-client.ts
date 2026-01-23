import { polarClient } from "@polar-sh/better-auth";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
	baseURL:
		process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
			? `https://ultrahope.dev`
			: "http://localhost:3100",
	plugins: [deviceAuthorizationClient(), polarClient()],
});

export const { signIn, signOut, useSession } = authClient;
export const device = authClient.device;
export const checkout = authClient.checkout;
