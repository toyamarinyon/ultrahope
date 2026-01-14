import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { magicLink } from "better-auth/plugins/magic-link";
import { Resend } from "resend";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "sqlite",
		schema,
	}),
	basePath: "/api/auth",
	socialProviders: {
		github: {
			clientId: process.env.GITHUB_CLIENT_ID ?? "",
			clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
		},
	},
	plugins: [
		deviceAuthorization({
			verificationUri: process.env.DEVICE_VERIFICATION_URI ?? "/device",
			expiresIn: "30m",
			validateClient: async (clientId) => {
				return clientId === "ultrahope-cli";
			},
		}),
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				await resend.emails.send({
					from: process.env.EMAIL_FROM ?? "noreply@ultrahope.dev",
					to: email,
					subject: "Sign in to Ultrahope",
					html: `<p>Click the link below to sign in:</p><p><a href="${url}">${url}</a></p>`,
				});
			},
		}),
	],
});
