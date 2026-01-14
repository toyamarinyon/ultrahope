"use client";

import { useState } from "react";
import { device, useSession } from "@/lib/auth-client";

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
			<main style={{ maxWidth: 400, margin: "100px auto", padding: 20 }}>
				<p>Loading...</p>
			</main>
		);
	}

	if (!session) {
		return (
			<main style={{ maxWidth: 400, margin: "100px auto", padding: 20 }}>
				<h1 style={{ marginBottom: 16 }}>Device Authorization</h1>
				<p style={{ marginBottom: 16 }}>Sign in to authorize your CLI.</p>
				<a href="/api/auth/signin/github" style={{ color: "#0070f3" }}>
					Sign in with GitHub
				</a>
			</main>
		);
	}

	if (status === "approved") {
		return (
			<main style={{ maxWidth: 400, margin: "100px auto", padding: 20 }}>
				<h1 style={{ marginBottom: 16 }}>✓ Device Authorized</h1>
				<p>You can close this window and return to the CLI.</p>
			</main>
		);
	}

	if (status === "denied") {
		return (
			<main style={{ maxWidth: 400, margin: "100px auto", padding: 20 }}>
				<h1 style={{ marginBottom: 16 }}>Device Denied</h1>
				<p>Authorization was denied. You can close this window.</p>
			</main>
		);
	}

	return (
		<main style={{ maxWidth: 400, margin: "100px auto", padding: 20 }}>
			<h1 style={{ marginBottom: 16 }}>Device Authorization</h1>
			<p style={{ marginBottom: 16 }}>
				Signed in as <strong>{session.user.email}</strong>
			</p>

			{status === "idle" || status === "verifying" || status === "error" ? (
				<>
					<p style={{ marginBottom: 8 }}>Enter the code from your CLI:</p>
					<input
						type="text"
						value={userCode}
						onChange={(e) => setUserCode(e.target.value.toUpperCase())}
						placeholder="XXXX-XXXX"
						style={{
							width: "100%",
							padding: 12,
							fontSize: 18,
							textAlign: "center",
							letterSpacing: 2,
							marginBottom: 12,
							border: "1px solid #ccc",
							borderRadius: 4,
						}}
						maxLength={9}
					/>
					{error && <p style={{ color: "red", marginBottom: 12 }}>{error}</p>}
					<button
						type="button"
						onClick={handleVerify}
						disabled={status === "verifying" || !userCode.trim()}
						style={{
							width: "100%",
							padding: 12,
							backgroundColor: "#0070f3",
							color: "white",
							border: "none",
							borderRadius: 4,
							cursor: status === "verifying" ? "wait" : "pointer",
						}}
					>
						{status === "verifying" ? "Verifying..." : "Verify Code"}
					</button>
				</>
			) : status === "verified" || status === "approving" ? (
				<>
					<p style={{ marginBottom: 16 }}>
						Authorize <strong>ultrahope-cli</strong> to access your account?
					</p>
					<div style={{ display: "flex", gap: 12 }}>
						<button
							type="button"
							onClick={handleApprove}
							disabled={status === "approving"}
							style={{
								flex: 1,
								padding: 12,
								backgroundColor: "#0070f3",
								color: "white",
								border: "none",
								borderRadius: 4,
								cursor: status === "approving" ? "wait" : "pointer",
							}}
						>
							Approve
						</button>
						<button
							type="button"
							onClick={handleDeny}
							disabled={status === "approving"}
							style={{
								flex: 1,
								padding: 12,
								backgroundColor: "#666",
								color: "white",
								border: "none",
								borderRadius: 4,
								cursor: status === "approving" ? "wait" : "pointer",
							}}
						>
							Deny
						</button>
					</div>
				</>
			) : null}
		</main>
	);
}
