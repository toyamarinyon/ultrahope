import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { DowngradePlanButton } from "@/components/downgrade-plan-button";
import { getAuth } from "@/lib/auth";
import {
	getActiveSubscriptions,
	getBillingHistory,
	resolveCurrentPlan,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

function formatAmount(amountInCents: number, currency: string) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(amountInCents / 100);
}

function formatDate(date: Date) {
	return new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(date);
}

export default async function SettingsPage() {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	const userId = String(session.user.id);
	const [activeSubscriptions, billingHistory] = await Promise.all([
		getActiveSubscriptions(userId),
		getBillingHistory(userId, 10),
	]);
	const currentPlan = resolveCurrentPlan(activeSubscriptions);
	const hasProPlan = activeSubscriptions.some(
		(subscription) => subscription.plan === "pro",
	);

	return (
		<main className="min-h-screen px-8 py-12">
			<section className="mx-auto max-w-4xl space-y-8">
				<div className="space-y-2">
					<p className="text-sm uppercase tracking-[0.2em] text-foreground-muted">
						Settings
					</p>
					<h1 className="text-4xl font-black tracking-tight">Account</h1>
					<p className="text-sm text-foreground-secondary">
						Manage billing and privacy-related account actions.
					</p>
				</div>

				<div className="rounded-2xl border border-border-subtle bg-surface px-6 py-6">
					<h2 className="text-xl font-semibold">Billing & plan</h2>
					<p className="mt-2 text-sm text-foreground-secondary">
						Manage your subscription, invoices, and payment method.
					</p>
					<div className="mt-4">
						<p className="text-sm text-foreground-secondary">Current plan</p>
						<p className="mt-1 text-lg font-semibold uppercase tracking-wide">
							{currentPlan}
						</p>
					</div>
					<div className="mt-4 flex flex-wrap gap-3">
						<a
							href="/api/auth/customer/portal"
							className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-hover"
						>
							Open billing portal
						</a>
						<Link
							href="/pricing"
							className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-hover"
						>
							View plans
						</Link>
					</div>
					{hasProPlan ? (
						<div className="mt-4 border-t border-border-subtle pt-4">
							<p className="text-sm text-foreground-secondary">
								Want to move back to Free immediately?
							</p>
							<div className="mt-2">
								<DowngradePlanButton />
							</div>
						</div>
					) : null}
				</div>

				<div className="rounded-2xl border border-border-subtle bg-surface px-6 py-6">
					<h2 className="text-xl font-semibold">Billing history</h2>
					<p className="mt-2 text-sm text-foreground-secondary">
						Recent invoices and payments from your account.
					</p>
					{billingHistory.length === 0 ? (
						<p className="mt-4 text-sm text-foreground-secondary">
							No billing records yet.
						</p>
					) : (
						<ul className="mt-4 space-y-3">
							{billingHistory.map((order) => (
								<li
									key={order.id}
									className="rounded-lg border border-border-subtle px-4 py-3"
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="text-sm font-medium text-foreground">
											{order.description}
										</p>
										<p className="text-sm font-semibold text-foreground">
											{formatAmount(order.totalAmount, order.currency)}
										</p>
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-secondary">
										<span>{formatDate(order.createdAt)}</span>
										<span>Invoice #{order.invoiceNumber}</span>
										<span className="uppercase">{order.status}</span>
										<span>{order.paid ? "Paid" : "Unpaid"}</span>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="rounded-2xl border border-red-400/40 bg-surface px-6 py-6">
					<h2 className="text-xl font-semibold text-red-500">Danger zone</h2>
					<p className="mt-2 text-sm text-foreground-secondary">
						Deleting your account removes all associated data and linked access.
					</p>
					<div className="mt-4">
						<DeleteAccountForm email={session.user.email} />
					</div>
				</div>
			</section>
		</main>
	);
}
