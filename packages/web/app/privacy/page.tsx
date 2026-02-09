import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Privacy Policy | Ultrahope",
	description: "Ultrahope Privacy Policy",
};

export default function PrivacyPage() {
	return (
		<main className="min-h-screen px-8 py-12">
			<div className="mx-auto w-full max-w-5xl">
				<Link
					href="/"
					className="inline-block text-3xl font-black tracking-tighter mb-6 no-underline hover:opacity-80 transition-opacity"
					aria-label="Go to Ultrahope top page"
				>
					ULTRAHOPE
				</Link>
				<iframe
					src="/privacy/termly-policy.html"
					title="Ultrahope Privacy Policy"
					className="w-full min-h-[85vh] rounded-xl border border-border-subtle"
				/>
			</div>
		</main>
	);
}
