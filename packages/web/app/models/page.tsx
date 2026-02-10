import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Models | Ultrahope",
	description: "AI models and providers used by Ultrahope",
};

const models = [
	{
		id: "mistral/ministral-3b",
		provider: "Mistral AI",
		providerUrl: "https://mistral.ai",
	},
	{
		id: "xai/grok-code-fast-1",
		provider: "xAI",
		providerUrl: "https://x.ai",
	},
];

export default function ModelsPage() {
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

				<header className="mb-10">
					<h1 className="text-3xl font-bold tracking-tight mb-4">Models</h1>
					<p className="text-foreground-secondary leading-relaxed">
						Ultrahope routes requests through the{" "}
						<a
							href="https://sdk.vercel.ai/docs/ai-sdk-core/provider-management"
							className="underline hover:opacity-80"
							target="_blank"
							rel="noopener noreferrer"
						>
							Vercel AI Gateway
						</a>{" "}
						to multiple AI providers. The default models may change as we
						evaluate new options.
					</p>
				</header>

				<section>
					<h2 className="text-xl font-semibold tracking-tight mb-4">
						Default Models
					</h2>
					<ul className="space-y-4">
						{models.map((model) => (
							<li
								key={model.id}
								className="rounded-lg border border-border-subtle bg-surface p-4"
							>
								<p className="font-mono text-sm mb-1">{model.id}</p>
								<p className="text-sm text-foreground-secondary">
									Provider:{" "}
									<a
										href={model.providerUrl}
										className="underline hover:opacity-80"
										target="_blank"
										rel="noopener noreferrer"
									>
										{model.provider}
									</a>
								</p>
							</li>
						))}
					</ul>
				</section>

				<section className="mt-10 text-sm text-foreground-secondary leading-relaxed">
					<p>
						You can override the default model using the{" "}
						<code className="font-mono bg-surface-hover px-1.5 py-0.5 rounded">
							--model
						</code>{" "}
						flag in the CLI.
					</p>
				</section>
			</div>
		</main>
	);
}
