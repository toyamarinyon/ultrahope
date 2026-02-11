import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

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
					<h2 className="text-xl font-semibold">Billing</h2>
					<p className="mt-2 text-sm text-foreground-secondary">
						Open the customer portal to manage plan, invoices, and payment
						methods.
					</p>
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
