"use client";

import { useState } from "react";
import { device, signIn, useSession } from "@/lib/auth-client";

type Status =
	| "idle"
	| "verifying"
	| "verified"
	| "approving"
	| "approved"
	| "denied"
	| "error";

export default function DevicePage() {
	const { data: session, isPending } = useSession();
	const [userCode, setUserCode] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	const containerClass =
		"min-h-screen px-8 py-24 flex items-center justify-center";
	const panelClass =
		"w-full max-w-md border border-border-subtle bg-surface rounded-lg p-8";
	const primaryButtonClass =
		"inline-flex items-center justify-center px-4 py-3 bg-foreground text-canvas font-medium rounded-md hover:opacity-90 disabled:opacity-60 disabled:cursor-wait";
	const secondaryButtonClass =
		"inline-flex items-center justify-center px-4 py-3 border border-border text-foreground font-medium rounded-md hover:bg-surface-hover disabled:opacity-60 disabled:cursor-wait";

	const handleVerify = async () => {
		if (!userCode.trim()) return;
		setStatus("verifying");
		setError(null);

		try {
			const result = await device({
				query: { user_code: userCode.trim().toUpperCase() },
			});
			if (result.error) {
				setError(result.error.error_description || "Invalid code");
				setStatus("error");
			} else {
				setStatus("verified");
			}
		} catch {
			setError("Failed to verify code");
			setStatus("error");
		}
	};

	const handleApprove = async () => {
		setStatus("approving");
		setError(null);

		try {
			const result = await device.approve({
				userCode: userCode.trim().toUpperCase(),
			});
			if (result.error) {
				setError(result.error.error_description || "Failed to approve");
				setStatus("error");
			} else {
				setStatus("approved");
			}
		} catch {
			setError("Failed to approve device");
			setStatus("error");
		}
	};

	const handleDeny = async () => {
		setStatus("approving");
		setError(null);

		try {
			const result = await device.deny({
				userCode: userCode.trim().toUpperCase(),
			});
			if (result.error) {
				setError(result.error.error_description || "Failed to deny");
				setStatus("error");
			} else {
				setStatus("denied");
			}
		} catch {
			setError("Failed to deny device");
			setStatus("error");
		}
	};

	if (isPending) {
		return (
			<main className={containerClass}>
				<div className={panelClass}>
					<p className="text-foreground-secondary">Loading...</p>
				</div>
			</main>
		);
	}

	if (!session) {
		return (
			<main className={containerClass}>
				<div className={panelClass}>
					<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
						Device authorization
					</p>
					<h1 className="text-2xl font-bold tracking-tight mb-3">
						Sign in to continue
					</h1>
					<p className="text-foreground-secondary mb-6">
						Authorize your CLI by signing in with GitHub.
					</p>
					<button
						type="button"
						onClick={() =>
							signIn.social({ provider: "github", callbackURL: "/device" })
						}
						className={primaryButtonClass}
					>
						Sign in with GitHub
					</button>
				</div>
			</main>
		);
	}

	if (status === "approved") {
		return (
			<main className={containerClass}>
				<div className={panelClass}>
					<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
						Device authorized
					</p>
					<h1 className="text-2xl font-bold tracking-tight mb-3">
						Authorization complete
					</h1>
					<p className="text-foreground-secondary">
						You can close this window and return to the CLI.
					</p>
				</div>
			</main>
		);
	}

	if (status === "denied") {
		return (
			<main className={containerClass}>
				<div className={panelClass}>
					<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
						Authorization denied
					</p>
					<h1 className="text-2xl font-bold tracking-tight mb-3">
						Device denied
					</h1>
					<p className="text-foreground-secondary">
						Authorization was denied. You can close this window.
					</p>
				</div>
			</main>
		);
	}

	return (
		<main className={containerClass}>
			<div className={panelClass}>
				<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
					Device authorization
				</p>
				<h1 className="text-2xl font-bold tracking-tight mb-3">
					Authorize your CLI
				</h1>
				<p className="text-foreground-secondary mb-6">
					Signed in as{" "}
					<strong className="text-foreground">{session.user.email}</strong>
				</p>

				{status === "idle" || status === "verifying" || status === "error" ? (
					<>
						<p className="text-sm text-foreground-secondary mb-2">
							Enter the code from your CLI:
						</p>
						<input
							type="text"
							value={userCode}
							onChange={(e) => setUserCode(e.target.value.toUpperCase())}
							placeholder="XXXX-XXXX"
							className="w-full px-4 py-3 text-lg text-center tracking-[0.2em] bg-canvas-dark border border-border rounded-md mb-3 placeholder:text-foreground-muted"
							maxLength={9}
						/>
						{error && <p className="text-sm text-red-400 mb-3">{error}</p>}
						<button
							type="button"
							onClick={handleVerify}
							disabled={status === "verifying" || !userCode.trim()}
							className={`${primaryButtonClass} w-full`}
						>
							{status === "verifying" ? "Verifying..." : "Verify Code"}
						</button>
					</>
				) : status === "verified" || status === "approving" ? (
					<>
						<p className="text-foreground-secondary mb-4">
							Authorize{" "}
							<strong className="text-foreground">ultrahope-cli</strong> to
							access your account?
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={handleApprove}
								disabled={status === "approving"}
								className={`${primaryButtonClass} flex-1`}
							>
								Approve
							</button>
							<button
								type="button"
								onClick={handleDeny}
								disabled={status === "approving"}
								className={`${secondaryButtonClass} flex-1`}
							>
								Deny
							</button>
						</div>
					</>
				) : null}
			</div>
		</main>
	);
}
