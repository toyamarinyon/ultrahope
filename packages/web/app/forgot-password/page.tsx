"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { requestPasswordReset } from "@/lib/auth-client";
import {
	isLikelyInvalidEmailDomain,
	mapAuthClientError,
	shouldTreatForgotPasswordRequestAsSuccess,
} from "@/lib/auth-error";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		const normalizedEmail = email.trim().toLowerCase();
		if (isLikelyInvalidEmailDomain(normalizedEmail)) {
			setError("Please enter a valid email address.");
			return;
		}

		setIsSubmitting(true);
		try {
			const result = await requestPasswordReset({
				email: normalizedEmail,
				redirectTo: "/reset-password",
			});
			if (!shouldTreatForgotPasswordRequestAsSuccess(result)) {
				const errorResult = result as { error?: unknown };
				const mapped = mapAuthClientError(errorResult.error, "forgot-password");
				console.error(
					"[auth][forgot-password] request reset failed",
					mapped.internal,
				);
				setError(mapped.userMessage);
				return;
			}
			setSubmitted(true);
		} catch (error) {
			const mapped = mapAuthClientError(error, "forgot-password");
			console.error(
				"[auth][forgot-password] request reset threw",
				mapped.internal,
			);
			setError(mapped.userMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<main className="min-h-screen px-8 py-24 flex items-center justify-center">
			<div className="w-full max-w-md border border-border-subtle bg-surface rounded-lg p-8">
				<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
					Account recovery
				</p>
				<h1 className="text-3xl font-bold tracking-tight mb-3">
					Forgot password
				</h1>
				<p className="text-foreground-secondary mb-6">
					Enter your email to request a password reset link.
				</p>
				{submitted ? (
					<div className="space-y-4">
						<p className="text-sm text-foreground-secondary">
							If an account exists for this email, a password reset link has
							been sent.
						</p>
						<Link
							href="/login"
							className="inline-flex items-center justify-center px-5 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90"
						>
							Back to login
						</Link>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-3">
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="Email"
							className="w-full px-4 py-3 bg-canvas-dark border border-border rounded-md placeholder:text-foreground-muted"
							disabled={isSubmitting}
						/>
						{error ? <p className="text-sm text-red-400">{error}</p> : null}
						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full inline-flex items-center justify-center px-5 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 disabled:opacity-60"
						>
							{isSubmitting ? "Submitting..." : "Send reset link"}
						</button>
					</form>
				)}
			</div>
		</main>
	);
}
