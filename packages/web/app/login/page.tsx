"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signIn, useSession } from "@/lib/auth-client";

export default function LoginPage() {
	const { data: session, isPending } = useSession();
	const router = useRouter();

	useEffect(() => {
		if (session) {
			router.push("/");
		}
	}, [session, router]);

	const handleSignIn = () => {
		signIn.social({
			provider: "github",
			callbackURL: "/",
		});
	};

	if (isPending) {
		return (
			<main className="min-h-screen px-8 py-24 flex items-center justify-center">
				<div className="w-full max-w-md border border-border-subtle bg-surface rounded-lg p-8">
					<p className="text-foreground-secondary">Loading...</p>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-screen px-8 py-24 flex items-center justify-center">
			<div className="w-full max-w-md border border-border-subtle bg-surface rounded-lg p-8">
				<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
					Welcome back
				</p>
				<h1 className="text-3xl font-bold tracking-tight mb-3">
					Sign in to Ultrahope
				</h1>
				<p className="text-foreground-secondary mb-8">
					Continue with GitHub to authorize the web dashboard.
				</p>
				<button
					type="button"
					onClick={handleSignIn}
					className="w-full inline-flex items-center justify-center px-5 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 disabled:opacity-60"
				>
					Sign in with GitHub
				</button>
			</div>
		</main>
	);
}
