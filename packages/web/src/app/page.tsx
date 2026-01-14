"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signIn, useSession } from "@/lib/auth-client";

export default function Home() {
	const { data: session, isPending } = useSession();
	const router = useRouter();

	useEffect(() => {
		if (session) {
			router.push("/dashboard");
		}
	}, [session, router]);

	const handleSignIn = () => {
		signIn.social({
			provider: "github",
			callbackURL: "/dashboard",
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
			<h1>Ultrahope</h1>
			<p>LLM-powered development workflow assistant</p>
			<button type="button" onClick={handleSignIn}>
				Sign in with GitHub
			</button>
		</main>
	);
}
