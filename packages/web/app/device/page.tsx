"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { device, signIn, signUp, useSession } from "@/lib/auth-client";

type Status =
	| "idle"
	| "verifying"
	| "verified"
	| "approving"
	| "approved"
	| "denied"
	| "error";
type AuthMode = "signin" | "signup";

export default function DevicePage() {
	const { data: session, isPending } = useSession();
	const [userCode, setUserCode] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	const [authMode, setAuthMode] = useState<AuthMode>("signin");
	const [authName, setAuthName] = useState("");
	const [authEmail, setAuthEmail] = useState("");
	const [authPassword, setAuthPassword] = useState("");
	const [authError, setAuthError] = useState<string | null>(null);
	const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
	const containerClass =
		"min-h-screen px-8 py-24 flex items-center justify-center";
	const panelClass =
		"w-full max-w-md border border-border-subtle bg-surface rounded-lg p-8";
	const primaryButtonClass =
		"inline-flex items-center justify-center px-4 py-3 bg-foreground text-canvas font-medium rounded-md hover:opacity-90 disabled:opacity-60 disabled:cursor-wait";
	const secondaryButtonClass =
		"inline-flex items-center justify-center px-4 py-3 border border-border text-foreground font-medium rounded-md hover:bg-surface-hover disabled:opacity-60 disabled:cursor-wait";

	const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setAuthError(null);

		const normalizedEmail = authEmail.trim().toLowerCase();
		if (!normalizedEmail || !normalizedEmail.includes("@")) {
			setAuthError("Please enter a valid email address.");
			return;
		}
		if (!authPassword) {
			setAuthError("Please enter your password.");
			return;
		}
		if (authMode === "signup" && authPassword.length < 8) {
			setAuthError("Password must be at least 8 characters.");
			return;
		}
		if (authMode === "signup" && !authName.trim()) {
			setAuthError("Please enter your name.");
			return;
		}

		setIsAuthSubmitting(true);
		try {
			if (authMode === "signin") {
				const result = await signIn.email({
					email: normalizedEmail,
					password: authPassword,
					callbackURL: "/device",
				});
				if (result.error) {
					setAuthError(result.error.message || "Failed to sign in.");
					return;
				}
			} else {
				const result = await signUp.email({
					name: authName.trim(),
					email: normalizedEmail,
					password: authPassword,
					callbackURL: "/device",
				});
				if (result.error) {
					setAuthError(result.error.message || "Failed to create account.");
					return;
				}
			}
		} catch {
			setAuthError("Authentication failed. Please try again.");
		} finally {
			setIsAuthSubmitting(false);
		}
	};

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
						Authorize your CLI by signing in with GitHub or Email/Password.
					</p>
					<div className="grid grid-cols-2 gap-2 mb-3">
						<button
							type="button"
							onClick={() => {
								setAuthMode("signin");
								setAuthError(null);
							}}
							className={`px-3 py-2 rounded-md border text-sm ${
								authMode === "signin"
									? "bg-foreground text-canvas border-foreground"
									: "border-border text-foreground"
							}`}
						>
							Email sign in
						</button>
						<button
							type="button"
							onClick={() => {
								setAuthMode("signup");
								setAuthError(null);
							}}
							className={`px-3 py-2 rounded-md border text-sm ${
								authMode === "signup"
									? "bg-foreground text-canvas border-foreground"
									: "border-border text-foreground"
							}`}
						>
							Create account
						</button>
					</div>
					<form onSubmit={handleAuthSubmit} className="space-y-3 mb-4">
						{authMode === "signup" ? (
							<input
								type="text"
								value={authName}
								onChange={(e) => setAuthName(e.target.value)}
								placeholder="Name"
								className="w-full px-4 py-3 bg-canvas-dark border border-border rounded-md placeholder:text-foreground-muted"
								disabled={isAuthSubmitting}
							/>
						) : null}
						<input
							type="email"
							value={authEmail}
							onChange={(e) => setAuthEmail(e.target.value)}
							placeholder="Email"
							className="w-full px-4 py-3 bg-canvas-dark border border-border rounded-md placeholder:text-foreground-muted"
							disabled={isAuthSubmitting}
						/>
						<input
							type="password"
							value={authPassword}
							onChange={(e) => setAuthPassword(e.target.value)}
							placeholder="Password"
							className="w-full px-4 py-3 bg-canvas-dark border border-border rounded-md placeholder:text-foreground-muted"
							disabled={isAuthSubmitting}
						/>
						{authError ? (
							<p className="text-sm text-red-400">{authError}</p>
						) : null}
						<button
							type="submit"
							disabled={isAuthSubmitting}
							className={`${primaryButtonClass} w-full`}
						>
							{isAuthSubmitting
								? "Processing..."
								: authMode === "signin"
									? "Sign in with Email"
									: "Create account with Email"}
						</button>
					</form>
					<div className="text-right mb-5">
						<Link href="/forgot-password" className="text-sm hover:opacity-80">
							Forgot password?
						</Link>
					</div>
					<div className="relative my-5">
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
						onClick={() =>
							void signIn.social({ provider: "github", callbackURL: "/device" })
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
