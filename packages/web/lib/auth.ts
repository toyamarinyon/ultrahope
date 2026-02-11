import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { Resend } from "resend";
import { getDb } from "@/db";
import * as schema from "@/db/schemas";
import { baseUrl } from "./base-url";

let cachedAuth: ReturnType<typeof betterAuth> | null = null;
let cachedPolarClient: Polar | null = null;

function resolvePolarServer(): "sandbox" | "production" {
	const fromEnv = process.env.POLAR_SERVER;
	if (fromEnv === "sandbox" || fromEnv === "production") {
		return fromEnv;
	}

	// On Vercel, NODE_ENV is "production" for both preview and production.
	// Use VERCEL_ENV to avoid pointing preview deployments to Polar production.
	if (process.env.VERCEL_ENV) {
		return process.env.VERCEL_ENV === "production" ? "production" : "sandbox";
	}

	return process.env.NODE_ENV === "production" ? "production" : "sandbox";
}

export function getAuth() {
	if (cachedAuth) return cachedAuth;

	const polarClient = getPolarClient();

	const db = getDb();

	cachedAuth = betterAuth({
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
		emailAndPassword: {
			enabled: true,
			disableSignUp: false,
			sendResetPassword: async ({ user, token }) => {
				const resend = new Resend(process.env.RESEND_API_KEY);
				const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
				await resend.emails.send({
					from: process.env.EMAIL_FROM ?? "noreply@ultrahope.dev",
					to: user.email,
					subject: "Reset your Ultrahope password",
					html: `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
				});
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
							const customerState =
								await polarClient.customers.getStateExternal({
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
							{
								productId: process.env.POLAR_PRODUCT_PRO_ID ?? "",
								slug: "pro",
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
		advanced: {
			database: {
				generateId: "serial",
			},
		},
	});

	return cachedAuth;
}

export function getPolarClient() {
	if (!cachedPolarClient) {
		cachedPolarClient = new Polar({
			accessToken: process.env.POLAR_ACCESS_TOKEN,
			server: resolvePolarServer(),
		});
	}
	return cachedPolarClient;
}
