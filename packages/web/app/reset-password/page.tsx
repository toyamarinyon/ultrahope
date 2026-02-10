"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { resetPassword } from "@/lib/auth-client";

function ResetPasswordContent() {
	const searchParams = useSearchParams();
	const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		if (!token) {
			setError("Missing reset token.");
			return;
		}

		if (newPassword.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}

		if (newPassword !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		setIsSubmitting(true);
		try {
			const result = await resetPassword({
				newPassword,
				token,
			});
			if (result.error) {
				setError(result.error.message || "Failed to reset password.");
				return;
			}

			setIsSuccess(true);
		} catch {
			setError("Failed to reset password.");
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
					Reset password
				</h1>
				{!token ? (
					<div className="space-y-4">
						<p className="text-sm text-red-400">
							Invalid or missing reset token. Please request a new reset link.
						</p>
						<Link
							href="/forgot-password"
							className="inline-flex items-center justify-center px-5 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90"
						>
							Request new link
						</Link>
					</div>
				) : isSuccess ? (
					<div className="space-y-4">
						<p className="text-sm text-foreground-secondary">
							Password updated successfully.
						</p>
						<Link
							href="/login"
							className="inline-flex items-center justify-center px-5 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90"
						>
							Go to login
						</Link>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-3">
						<input
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							placeholder="New password"
							className="w-full px-4 py-3 bg-canvas-dark border border-border rounded-md placeholder:text-foreground-muted"
							disabled={isSubmitting}
						/>
						<input
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							placeholder="Confirm new password"
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
							{isSubmitting ? "Updating..." : "Update password"}
						</button>
					</form>
				)}
			</div>
		</main>
	);
}

export default function ResetPasswordPage() {
	return (
		<Suspense
			fallback={
				<main className="min-h-screen px-8 py-24 flex items-center justify-center">
					<div className="w-full max-w-md border border-border-subtle bg-surface rounded-lg p-8">
						<p className="text-foreground-secondary">Loading...</p>
					</div>
				</main>
			}
		>
			<ResetPasswordContent />
		</Suspense>
	);
}
