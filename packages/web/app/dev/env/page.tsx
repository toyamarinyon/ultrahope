export const dynamic = "force-dynamic";

type EnvEntry = [key: string, value: string | undefined];

export default function DevEnvPage() {
	const sortEnvEntries = (entries: EnvEntry[]) =>
		entries.sort(([a], [b]) => a.localeCompare(b));

	const nextEnvEntries = sortEnvEntries(
		(Object.entries(process.env) as EnvEntry[]).filter(([key]) =>
			key.startsWith("NEXT_"),
		),
	);
	const explicitNextPublicEntries: EnvEntry[] = [
		["NEXT_PUBLIC_VERCEL_ENV", process.env.NEXT_PUBLIC_VERCEL_ENV],
		["NEXT_PUBLIC_VERCEL_TARGET_ENV", process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV],
		["NEXT_PUBLIC_VERCEL_URL", process.env.NEXT_PUBLIC_VERCEL_URL],
		["NEXT_PUBLIC_VERCEL_BRANCH_URL", process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL],
		[
			"NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
			process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_PROVIDER",
			process.env.NEXT_PUBLIC_VERCEL_GIT_PROVIDER,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG",
			process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER",
			process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_REPO_ID",
			process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_ID,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF",
			process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
			process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE",
			process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_LOGIN",
			process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_LOGIN,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_NAME",
			process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_NAME,
		],
		[
			"NEXT_PUBLIC_VERCEL_GIT_PULL_REQUEST_ID",
			process.env.NEXT_PUBLIC_VERCEL_GIT_PULL_REQUEST_ID,
		],
	];
	sortEnvEntries(explicitNextPublicEntries);

	return (
		<main className="min-h-screen px-8 py-12">
			<section className="mx-auto max-w-5xl">
				<h1 className="mb-3 text-3xl font-bold tracking-tight">Debug: NEXT_* env</h1>
				<p className="mb-8 text-sm text-foreground-secondary">
					Enumerated: {nextEnvEntries.length} / Explicit NEXT_PUBLIC:{" "}
					{explicitNextPublicEntries.length}
				</p>

				<h2 className="mb-3 text-xl font-semibold">Explicit NEXT_PUBLIC_* (direct access)</h2>
				<div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
					<table className="w-full border-collapse text-left text-sm">
						<thead className="bg-canvas-dark">
							<tr>
								<th className="border-b border-border-subtle px-4 py-3 font-semibold">
									Key
								</th>
								<th className="border-b border-border-subtle px-4 py-3 font-semibold">
									Value
								</th>
							</tr>
						</thead>
						<tbody>
							{explicitNextPublicEntries.map(([key, value]) => (
								<tr key={key} className="align-top">
									<td className="border-t border-border-subtle px-4 py-3 font-mono">
										{key}
									</td>
									<td className="border-t border-border-subtle px-4 py-3 font-mono whitespace-pre-wrap break-all">
										{value ?? ""}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<h2 className="mb-3 mt-10 text-xl font-semibold">
					Enumerated from process.env (Object.entries)
				</h2>
				<div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
					<table className="w-full border-collapse text-left text-sm">
						<thead className="bg-canvas-dark">
							<tr>
								<th className="border-b border-border-subtle px-4 py-3 font-semibold">
									Key
								</th>
								<th className="border-b border-border-subtle px-4 py-3 font-semibold">
									Value
								</th>
							</tr>
						</thead>
						<tbody>
							{nextEnvEntries.length === 0 ? (
								<tr>
									<td
										colSpan={2}
										className="px-4 py-6 text-foreground-secondary"
									>
										No NEXT_* variables found.
									</td>
								</tr>
							) : (
								nextEnvEntries.map(([key, value]) => (
									<tr key={key} className="align-top">
										<td className="border-t border-border-subtle px-4 py-3 font-mono">
											{key}
										</td>
										<td className="border-t border-border-subtle px-4 py-3 font-mono whitespace-pre-wrap break-all">
											{value ?? ""}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</section>
		</main>
	);
}
