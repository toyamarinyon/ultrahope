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
			<main>
				<p>Loading...</p>
			</main>
		);
	}

	return (
		<main>
			<h1>Sign in to Ultrahope</h1>
			<button type="button" onClick={handleSignIn}>
				Sign in with GitHub
			</button>
		</main>
	);
}
