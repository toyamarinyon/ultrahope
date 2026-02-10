import { polarClient } from "@polar-sh/better-auth";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { baseUrl } from "./base-url";

const authClient = createAuthClient({
	baseURL: baseUrl,
	plugins: [deviceAuthorizationClient(), polarClient()],
});

export const {
	signIn,
	signUp,
	signOut,
	useSession,
	requestPasswordReset,
	resetPassword,
} = authClient;
export const device = authClient.device;
export const checkout = authClient.checkout;
