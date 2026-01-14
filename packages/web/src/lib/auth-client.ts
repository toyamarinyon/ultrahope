import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
	plugins: [deviceAuthorizationClient()],
});

export const { signIn, signOut, useSession } = authClient;
export const device = authClient.device;
