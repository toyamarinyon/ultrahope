export const dynamic = "force-dynamic";

export default function DevEnvPage() {
	const nextEnvEntries = Object.entries(process.env)
		.filter(([key]) => key.startsWith("NEXT_"))
		.sort(([a], [b]) => a.localeCompare(b));

	return (
		<main className="min-h-screen px-8 py-12">
			<section className="mx-auto max-w-5xl">
				<h1 className="mb-3 text-3xl font-bold tracking-tight">Debug: NEXT_* env</h1>
				<p className="mb-8 text-sm text-foreground-secondary">
					Found {nextEnvEntries.length} variables
				</p>

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
