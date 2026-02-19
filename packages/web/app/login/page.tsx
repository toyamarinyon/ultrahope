"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "@/lib/auth/auth-client";
import {
	isLikelyInvalidEmailDomain,
	mapAuthClientError,
} from "@/lib/auth/auth-error";

export default function LoginPage() {
	const { data: session, isPending } = useSession();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (session) {
			router.push("/");
		}
	}, [session, router]);

	const handleGitHubSignIn = () => {
		void signIn.social({
			provider: "github",
			callbackURL: "/",
		});
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		const normalizedEmail = email.trim().toLowerCase();
		if (isLikelyInvalidEmailDomain(normalizedEmail)) {
			setError("Please enter a valid email address.");
			return;
		}

		if (!password) {
			setError("Please enter your password.");
			return;
		}

		setIsSubmitting(true);
		try {
			const result = await signIn.email({
				email: normalizedEmail,
				password,
				callbackURL: "/",
			});
			if (result.error) {
				const mapped = mapAuthClientError(result.error, "login");
				console.error("[auth][login] email sign-in failed", mapped.internal);
				setError(mapped.userMessage);
				return;
			}

			router.push("/");
		} catch (error) {
			const mapped = mapAuthClientError(error, "login");
			console.error("[auth][login] email sign-in threw", mapped.internal);
			setError(mapped.userMessage);
		} finally {
			setIsSubmitting(false);
		}
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
		<main className="min-h-screen bg-canvas px-6 py-14 sm:px-8 sm:py-20">
			<section className="mx-auto w-full max-w-xl">
				<h1 className="text-2xl tracking-tight">Welcome to Ultrahope</h1>
				<p className="mt-1 text-foreground-muted">Sign in to continue</p>

				<button
					type="button"
					onClick={handleGitHubSignIn}
					className="mt-10 w-full inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface px-5 py-3.5 font-medium text-foreground no-underline hover:bg-surface-hover disabled:opacity-60"
				>
					<svg
						className="h-5 w-5"
						fill="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							fillRule="evenodd"
							d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
							clipRule="evenodd"
						/>
					</svg>
					Continue with GitHub
				</button>

				<form onSubmit={handleSubmit} className="mt-9 space-y-6">
					<div className="space-y-2">
						<label
							htmlFor="login-email"
							className="block text-foreground-secondary"
						>
							Email address
						</label>
						<input
							id="login-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="Your email address"
							autoComplete="email"
							className="w-full rounded-md border border-border bg-canvas px-4 py-3 placeholder:text-foreground-muted"
							disabled={isSubmitting}
						/>
					</div>

					<div className="space-y-2">
						<label
							htmlFor="login-password"
							className="block text-foreground-secondary"
						>
							Password
						</label>
						<input
							id="login-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Your password"
							autoComplete="current-password"
							className="w-full rounded-md border border-border bg-canvas px-4 py-3 placeholder:text-foreground-muted"
							disabled={isSubmitting}
						/>
					</div>

					{error ? <p className="text-red-400">{error}</p> : null}

					<button
						type="submit"
						disabled={isSubmitting}
						className="w-full inline-flex items-center justify-center rounded-md border border-border-subtle bg-surface px-5 py-3.5 font-medium text-foreground no-underline hover:bg-surface-hover disabled:opacity-60"
					>
						{isSubmitting ? "Processing..." : "Continue"}
					</button>
				</form>

				<p className="mt-10 text-center text-foreground-secondary">
					Don&apos;t have an account?{" "}
					<Link href="/signup" className="text-foreground hover:opacity-80">
						Sign up
					</Link>
				</p>

				<div className="mt-7 text-center text-foreground-secondary">
					<Link href="/forgot-password" className="hover:opacity-80">
						Forgot password?
					</Link>
					<span className="mx-2">·</span>
					<Link href="/privacy" className="hover:opacity-80">
						Privacy Policy
					</Link>
					<span className="mx-2">·</span>
					<Link href="/terms" className="hover:opacity-80">
						Terms of Use
					</Link>
				</div>
			</section>
		</main>
	);
}
