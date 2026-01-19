import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { magicLink } from "better-auth/plugins/magic-link";
import { Resend } from "resend";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

export const polarClient = new Polar({
	accessToken: process.env.POLAR_ACCESS_TOKEN,
	server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});

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
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					const freeProductId = process.env.POLAR_PRODUCT_FREE_ID;
					if (!freeProductId) {
						console.error(
							"[polar] POLAR_PRODUCT_FREE_ID not set, skipping free subscription creation",
						);
						return;
					}

					try {
						const customerState = await polarClient.customers.getStateExternal({
							externalId: user.id,
						});

						const hasFreePlan = customerState.activeSubscriptions.some(
							(sub) => sub.productId === freeProductId,
						);
						if (hasFreePlan) {
							console.log(
								`[polar] User ${user.id} already has free subscription, skipping`,
							);
							return;
						}

						await polarClient.subscriptions.create({
							productId: freeProductId,
							externalCustomerId: user.id,
						});
						console.log(
							`[polar] Created free subscription for user ${user.id}`,
						);
					} catch (error) {
						console.error(
							`[polar] Failed to create free subscription for user ${user.id}:`,
							error,
						);
					}
				},
			},
		},
	},
	plugins: [
		bearer(),
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
		polar({
			client: polarClient,
			createCustomerOnSignUp: true,
			use: [
				checkout({
					products: [
						{
							productId: process.env.POLAR_PRODUCT_FREE_ID ?? "",
							slug: "free",
						},
						{ productId: process.env.POLAR_PRODUCT_PRO_ID ?? "", slug: "pro" },
						{
							productId: process.env.POLAR_PRODUCT_TEAM_ID ?? "",
							slug: "team",
						},
					],
					successUrl: "/checkout/success?checkout_id={CHECKOUT_ID}",
					authenticatedUsersOnly: true,
				}),
				portal(),
				webhooks({
					secret: process.env.POLAR_WEBHOOK_SECRET ?? "",
					onPayload: async (payload) => {
						console.log("Polar webhook received:", payload.type);
					},
				}),
			],
		}),
	],
});
