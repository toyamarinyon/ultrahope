import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { SignOutButton } from "@/components/sign-out-button";
import { getAuth } from "@/lib/auth/auth";
import { buildNoIndexMetadata } from "@/lib/util/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Account Access",
	description: "Manage access to your Ultrahope account.",
	path: "/account/access",
});

export default async function AccountAccessPage() {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	return (
		<main className="min-h-screen px-8 py-24 flex items-center justify-center">
			<section className="w-full max-w-xl rounded-2xl border border-border-subtle bg-surface px-8 py-8">
				<p className="text-sm uppercase tracking-[0.2em] text-foreground-muted">
					Account access
				</p>
				<h1 className="mt-3 text-3xl font-black tracking-tight">
					Manage this account
				</h1>
				<p className="mt-3 text-sm text-foreground-secondary">
					Use these actions if you need to sign out or delete your account.
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<SignOutButton />
					<Link
						href="/privacy"
						className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-hover"
					>
						Privacy
					</Link>
					<Link
						href="/terms"
						className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-hover"
					>
						Terms
					</Link>
				</div>
				<div className="mt-8 border-t border-border-subtle pt-6">
					<h2 className="text-lg font-semibold text-red-500">Delete account</h2>
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
