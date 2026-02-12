"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { signIn, signUp, useSession } from "@/lib/auth-client";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
	const { data: session, isPending } = useSession();
	const router = useRouter();
	const [mode, setMode] = useState<AuthMode>("signin");
	const [name, setName] = useState("");
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
		if (!normalizedEmail || !normalizedEmail.includes("@")) {
			setError("Please enter a valid email address.");
			return;
		}

		if (!password) {
			setError("Please enter your password.");
			return;
		}

		if (mode === "signup" && password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}

		if (mode === "signup" && !name.trim()) {
			setError("Please enter your name.");
			return;
		}

		setIsSubmitting(true);
		try {
			if (mode === "signin") {
				const result = await signIn.email({
					email: normalizedEmail,
					password,
					callbackURL: "/",
				});
				if (result.error) {
					setError(result.error.message || "Failed to sign in.");
					return;
				}
			} else {
				const result = await signUp.email({
					name: name.trim(),
					email: normalizedEmail,
					password,
					callbackURL: "/",
				});
				if (result.error) {
					setError(result.error.message || "Failed to create account.");
					return;
				}
			}

			router.push("/");
		} catch {
			setError("Authentication failed. Please try again.");
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
		<main className="min-h-screen px-8 py-24 flex items-center justify-center">
			<div className="w-full max-w-md border border-border-subtle bg-surface rounded-lg p-8">
				<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
					Welcome back
				</p>
				<h1 className="text-3xl font-bold tracking-tight mb-3">
					Sign in to Ultrahope
				</h1>
				<p className="text-foreground-secondary mb-8">
					Continue with GitHub or Email/Password to authorize the web dashboard.
				</p>
				<div className="grid grid-cols-2 gap-2 mb-4">
					<button
						type="button"
						onClick={() => {
							setMode("signin");
							setError(null);
						}}
						className={`px-4 py-2 rounded-md border ${
							mode === "signin"
								? "bg-foreground text-canvas border-foreground"
								: "border-border text-foreground"
						}`}
					>
						Sign in with email
					</button>
					<button
						type="button"
						onClick={() => {
							setMode("signup");
							setError(null);
						}}
						className={`px-4 py-2 rounded-md border ${
							mode === "signup"
								? "bg-foreground text-canvas border-foreground"
								: "border-border text-foreground"
						}`}
					>
						Create account
					</button>
				</div>
				<form onSubmit={handleSubmit} className="space-y-3 mb-4">
					{mode === "signup" ? (
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Name"
							className="w-full px-4 py-3 bg-canvas-dark border border-border rounded-md placeholder:text-foreground-muted"
							disabled={isSubmitting}
						/>
					) : null}
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Email"
						className="w-full px-4 py-3 bg-canvas-dark border border-border rounded-md placeholder:text-foreground-muted"
						disabled={isSubmitting}
					/>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
						className="w-full px-4 py-3 bg-canvas-dark border border-border rounded-md placeholder:text-foreground-muted"
						disabled={isSubmitting}
					/>
					<p className="text-xs text-foreground-secondary">
						Password must be at least 8 characters.
					</p>
					{error ? <p className="text-sm text-red-400">{error}</p> : null}
					<button
						type="submit"
						disabled={isSubmitting}
						className="w-full inline-flex items-center justify-center px-5 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 disabled:opacity-60"
					>
						{isSubmitting
							? "Processing..."
							: mode === "signin"
								? "Sign in with Email"
								: "Create account with Email"}
					</button>
				</form>
				<div className="text-right mb-6">
					<Link href="/forgot-password" className="text-sm hover:opacity-80">
						Forgot password?
					</Link>
				</div>
				<div className="relative my-6">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-border" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-surface px-2 text-foreground-secondary">
							Or
						</span>
					</div>
				</div>
				<button
					type="button"
					onClick={handleGitHubSignIn}
					className="w-full inline-flex items-center justify-center px-5 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 disabled:opacity-60"
				>
					Sign in with GitHub
				</button>
				<div className="mt-6 text-center text-sm text-foreground-secondary">
					<Link href="/privacy" className="hover:opacity-80">
						Privacy Policy
					</Link>
					<span className="mx-2">·</span>
					<Link href="/terms" className="hover:opacity-80">
						Terms of Use
					</Link>
				</div>
			</div>
		</main>
	);
}
