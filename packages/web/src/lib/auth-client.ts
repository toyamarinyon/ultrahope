import { polarClient } from "@polar-sh/better-auth";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

console.log(`process.env.NEXT_PUBLIC_APP_URL:${process.env.NEXT_PUBLIC_APP_URL}`)

const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
	plugins: [deviceAuthorizationClient(), polarClient()],
});

export const { signIn, signOut, useSession } = authClient;
export const device = authClient.device;
export const checkout = authClient.checkout;
