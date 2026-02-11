"use client";

import { useState } from "react";

type DeleteAccountFormProps = {
	email: string;
};

export function DeleteAccountForm({ email }: DeleteAccountFormProps) {
	const [confirmEmail, setConfirmEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [completed, setCompleted] = useState(false);

	const isConfirmValid = confirmEmail.trim() === email;

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		if (!isConfirmValid) {
			setError("Please enter your current account email exactly.");
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/account/delete", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ confirmEmail }),
			});

			const data = (await response.json()) as {
				error?: string;
				message?: string;
			};
			if (!response.ok) {
				setError(data.message ?? data.error ?? "Failed to delete account.");
				return;
			}

			setCompleted(true);
			window.location.href = "/";
		} catch (submissionError) {
			setError(
				submissionError instanceof Error
					? submissionError.message
					: "Failed to delete account.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<p className="text-sm text-foreground-secondary">
				This permanently deletes your account and data. This action cannot be
				undone.
			</p>
			<label className="block space-y-2">
				<span className="text-sm font-medium text-foreground">
					Confirm your email
				</span>
				<input
					type="email"
					value={confirmEmail}
					onChange={(event) => setConfirmEmail(event.target.value)}
					placeholder={email}
					autoComplete="email"
					className="w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-border-subtle"
					disabled={isSubmitting || completed}
				/>
			</label>
			{error ? <p className="text-sm text-red-500">{error}</p> : null}
			<button
				type="submit"
				disabled={!isConfirmValid || isSubmitting || completed}
				className="inline-flex items-center justify-center rounded-md border border-red-400 px-4 py-2 text-sm font-medium text-red-500 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-red-500/10"
			>
				{isSubmitting ? "Deleting..." : "Delete account"}
			</button>
		</form>
	);
}
