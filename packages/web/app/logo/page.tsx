import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Logo Explorations | Ultrahope",
	description:
		"Arcana 07 gap studies with favicon-size comparisons on the marketing-home canvas.",
};

type StarFamily =
	| "compass"
	| "radiant"
	| "diamond"
	| "hollow"
	| "sigil"
	| "nova";

type StarVariant = {
	id: string;
	family: StarFamily;
	phase: number;
	rotate: number;
	outer: number;
	inner: number;
	rayCount: number;
	stroke: number;
};

const STAR = "#ece6d8";
const CANVAS = "var(--color-canvas)";
const BASE_GAP_OFFSET = 1.35;
const SYMBOL_SCALE = 1.12;

const GAP_PRESETS = [
	{ id: "g01", label: "Compact", offset: 1.05 },
	{ id: "g02", label: "Current", offset: 1.35 },
	{ id: "g03", label: "Airy", offset: 2.0 },
	{ id: "g04", label: "Open", offset: 2.6 },
	{ id: "g05", label: "Halo", offset: 3.2 },
] as const;

const FAMILIES: StarFamily[] = [
	"compass",
	"radiant",
	"diamond",
	"hollow",
	"sigil",
	"nova",
];

const STAR_VARIANTS: StarVariant[] = Array.from({ length: 30 }, (_, index) => {
	const family = FAMILIES[Math.floor(index / 5)] as StarFamily;
	const phase = index % 5;
	const baseRotate =
		family === "compass" ? 0 : family === "diamond" ? 45 : 22.5;

	return {
		id: String(index + 1).padStart(2, "0"),
		family,
		phase,
		rotate: baseRotate + phase * 7,
		outer: 8.6 - phase * 0.26,
		inner: 3.95 + phase * 0.2,
		rayCount: 12 + phase * 3,
		stroke: 0.8 + phase * 0.1,
	};
});

const SELECTED_ARCANA = STAR_VARIANTS.slice(5, 10);
const ARCANA_07 = SELECTED_ARCANA[1] as StarVariant;
const SET_PREVIEW_GAP = GAP_PRESETS[2].offset;

function polarPoint(radius: number, angleDeg: number, cx = 12, cy = 12) {
	const rad = (angleDeg * Math.PI) / 180;

	return {
		x: cx + radius * Math.cos(rad),
		y: cy + radius * Math.sin(rad),
	};
}

function starPoints(
	arms: number,
	outer: number,
	inner: number,
	rotate: number,
	cx = 12,
	cy = 12,
) {
	const step = 360 / (arms * 2);
	const points: string[] = [];

	for (let i = 0; i < arms * 2; i += 1) {
		const radius = i % 2 === 0 ? outer : inner;
		const point = polarPoint(radius, rotate + i * step, cx, cy);
		points.push(`${point.x.toFixed(3)},${point.y.toFixed(3)}`);
	}

	return points.join(" ");
}

function CompassStar({ variant }: { variant: StarVariant }) {
	return (
		<>
			<polygon
				points={starPoints(8, variant.outer, variant.inner, variant.rotate)}
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.45"
				strokeLinejoin="round"
			/>
			<circle cx="12" cy="12" r="2.1" fill={CANVAS} />
		</>
	);
}

function RadiantStar({
	variant,
	gapOffset = BASE_GAP_OFFSET,
}: {
	variant: StarVariant;
	gapOffset?: number;
}) {
	const rays = variant.rayCount;
	const step = 360 / rays;
	const coreOuter = 4.95 + variant.phase * 0.16;
	const coreInner = 2.45 + variant.phase * 0.08;
	const innerRay = coreOuter + gapOffset;
	const outerRay = 10.2;

	return (
		<>
			{Array.from({ length: rays }).map((_, index) => {
				const start = polarPoint(innerRay, variant.rotate + index * step);
				const end = polarPoint(
					(index + variant.phase) % 3 === 0 ? outerRay - 1 : outerRay,
					variant.rotate + index * step,
				);

				return (
					<line
						// biome-ignore lint/suspicious/noArrayIndexKey: Decorative rays are fixed-length and order-stable, so index is a stable key.
						key={index}
						x1={start.x}
						y1={start.y}
						x2={end.x}
						y2={end.y}
						stroke="currentColor"
						strokeWidth={variant.stroke * 0.9}
						strokeLinecap="round"
					/>
				);
			})}
			<polygon
				points={starPoints(4, coreOuter, coreInner, 45 + variant.rotate)}
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.35"
				strokeLinejoin="round"
			/>
		</>
	);
}

function DiamondStar({ variant }: { variant: StarVariant }) {
	const outer = variant.outer + 0.7;
	const inner = variant.inner - 0.2;

	return (
		<>
			<polygon
				points={starPoints(4, outer, inner, 45 + variant.rotate)}
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.45"
				strokeLinejoin="round"
			/>
			<polygon
				points={starPoints(4, outer / 2.45, inner / 2.2, 45 + variant.rotate)}
				fill={CANVAS}
			/>
		</>
	);
}

function HollowStar({ variant }: { variant: StarVariant }) {
	const thick = 0.8 + variant.phase * 0.12;
	const ringR = 4.2 + variant.phase * 0.16;

	return (
		<>
			<polygon
				points={starPoints(8, variant.outer, variant.inner, variant.rotate)}
				fill="none"
				stroke="currentColor"
				strokeWidth={thick}
				strokeLinejoin="round"
			/>
			<circle
				cx="12"
				cy="12"
				r={ringR}
				fill="none"
				stroke="currentColor"
				strokeWidth={thick * 0.8}
				opacity="0.65"
			/>
		</>
	);
}

function SigilStar({ variant }: { variant: StarVariant }) {
	const long = 8.6 - variant.phase * 0.22;
	const short = 5.3 + variant.phase * 0.1;

	return (
		<>
			{[0, 90].map((angle) => (
				<line
					key={angle}
					x1="12"
					y1={12 - long}
					x2="12"
					y2={12 + long}
					stroke="currentColor"
					strokeWidth={variant.stroke}
					strokeLinecap="round"
					transform={`rotate(${angle + variant.rotate} 12 12)`}
				/>
			))}
			{[45, 135, 225, 315].map((angle) => (
				<line
					key={angle}
					x1="12"
					y1={12 - short}
					x2="12"
					y2={12 + short}
					stroke="currentColor"
					strokeWidth={variant.stroke * 0.8}
					strokeLinecap="round"
					transform={`rotate(${angle + variant.rotate} 12 12)`}
					opacity="0.75"
				/>
			))}
			<circle
				cx="12"
				cy="12"
				r={3.4 + variant.phase * 0.16}
				fill="none"
				stroke="currentColor"
				strokeWidth={variant.stroke * 0.75}
			/>
		</>
	);
}

function NovaStar({ variant }: { variant: StarVariant }) {
	const outer = variant.outer + 0.9;
	const inner = variant.inner - 0.1;
	const rays = 8 + variant.phase * 2;
	const step = 360 / rays;

	return (
		<>
			<polygon
				points={starPoints(8, outer, inner, variant.rotate)}
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="0.45"
				strokeLinejoin="round"
			/>
			{Array.from({ length: rays }).map((_, index) => {
				const start = polarPoint(outer - 0.2, variant.rotate + index * step);
				const end = polarPoint(10.5, variant.rotate + index * step);

				return (
					<line
						// biome-ignore lint/suspicious/noArrayIndexKey: Decorative rays are fixed-length and order-stable, so index is a stable key.
						key={index}
						x1={start.x}
						y1={start.y}
						x2={end.x}
						y2={end.y}
						stroke="currentColor"
						strokeWidth={0.45}
						opacity="0.35"
					/>
				);
			})}
		</>
	);
}

function StarSymbol({
	variant,
	className,
	gapOffset,
}: {
	variant: StarVariant;
	className: string;
	gapOffset?: number;
}) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			aria-hidden="true"
			style={{ color: STAR }}
		>
			<g
				transform={`translate(12 12) scale(${SYMBOL_SCALE}) translate(-12 -12)`}
			>
				{variant.family === "compass" ? (
					<CompassStar variant={variant} />
				) : null}
				{variant.family === "radiant" ? (
					<RadiantStar variant={variant} gapOffset={gapOffset} />
				) : null}
				{variant.family === "diamond" ? (
					<DiamondStar variant={variant} />
				) : null}
				{variant.family === "hollow" ? <HollowStar variant={variant} /> : null}
				{variant.family === "sigil" ? <SigilStar variant={variant} /> : null}
				{variant.family === "nova" ? <NovaStar variant={variant} /> : null}
			</g>
		</svg>
	);
}

function LogoLockup({
	variant,
	symbolClassName,
	nameClassName,
	gapOffset,
}: {
	variant: StarVariant;
	symbolClassName: string;
	nameClassName: string;
	gapOffset?: number;
}) {
	return (
		<span className="inline-flex items-center gap-3">
			<StarSymbol
				variant={variant}
				className={symbolClassName}
				gapOffset={gapOffset}
			/>
			<span className={`leading-none tracking-tighter ${nameClassName}`}>
				Ultrahope
			</span>
		</span>
	);
}

function FaviconStrip({
	variant,
	gapOffset,
}: {
	variant: StarVariant;
	gapOffset?: number;
}) {
	return (
		<div className="flex items-end gap-2.5">
			{[
				{ px: "32", className: "size-8" },
				{ px: "24", className: "size-6" },
				{ px: "16", className: "size-4" },
				{ px: "12", className: "size-3" },
			].map((item) => (
				<div key={item.px} className="flex flex-col items-center gap-1">
					<span className="grid place-items-center rounded-md border border-border-subtle bg-canvas-dark p-0.5">
						<StarSymbol
							variant={variant}
							className={`${item.className} shrink-0`}
							gapOffset={gapOffset}
						/>
					</span>
					<span className="text-[9px] leading-none text-foreground-muted">
						{item.px}
					</span>
				</div>
			))}
		</div>
	);
}

function InPageMock({
	variant,
	gapOffset,
	label,
}: {
	variant: StarVariant;
	gapOffset: number;
	label: string;
}) {
	return (
		<div className="rounded-2xl border border-border-subtle bg-surface/30 p-6">
			<p className="mb-4 text-[11px] uppercase tracking-[0.16em] text-foreground-muted">
				In-page mock ({label})
			</p>
			<div className="rounded-xl border border-border-subtle bg-canvas-dark p-5">
				<div className="flex h-14 items-center border-b border-border-subtle pb-4">
					<LogoLockup
						variant={variant}
						symbolClassName="size-8 shrink-0"
						nameClassName="text-2xl"
						gapOffset={gapOffset}
					/>
				</div>
				<div className="pt-8">
					<LogoLockup
						variant={variant}
						symbolClassName="size-14 shrink-0"
						nameClassName="text-[38px]"
						gapOffset={gapOffset}
					/>
					<p className="mt-3 max-w-xl text-sm text-foreground-secondary">
						One command in. Proposals out. Human decision stays in the loop.
					</p>
					<button
						type="button"
						className="mt-5 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-surface"
					>
						<StarSymbol
							variant={variant}
							className="size-4 shrink-0"
							gapOffset={gapOffset}
						/>
						Get Started
					</button>
				</div>
			</div>
		</div>
	);
}

export default function LogoPage() {
	return (
		<main className="min-h-screen bg-canvas px-8 py-12 text-foreground">
			<div className="mx-auto max-w-7xl">
				<header className="mb-10 border-b border-border-subtle pb-4">
					<p className="mb-2 text-xs uppercase tracking-[0.24em] text-foreground-muted">
						Tarot Star Direction
					</p>
					<h1 className="text-3xl tracking-tight">Arcana 07 gap study</h1>
					<p className="mt-2 text-sm text-foreground-secondary">
						Five gap levels for Arcana 07, focused on favicon and in-page usage.
					</p>
				</header>

				<section className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{GAP_PRESETS.map((preset) => (
						<article
							key={preset.id}
							className="rounded-xl border border-border-subtle bg-surface/35 px-5 py-6"
						>
							<p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
								Gap {preset.offset.toFixed(2)}
							</p>
							<p className="mb-3 text-sm text-foreground-secondary">
								{preset.label}
							</p>
							<LogoLockup
								variant={ARCANA_07}
								symbolClassName="size-12 shrink-0"
								nameClassName="text-[34px]"
								gapOffset={preset.offset}
							/>
							<div className="mt-4">
								<FaviconStrip variant={ARCANA_07} gapOffset={preset.offset} />
							</div>
						</article>
					))}
				</section>

				<section className="mb-10 grid gap-4 lg:grid-cols-2">
					<InPageMock
						variant={ARCANA_07}
						gapOffset={GAP_PRESETS[1].offset}
						label="Current"
					/>
					<InPageMock
						variant={ARCANA_07}
						gapOffset={GAP_PRESETS[3].offset}
						label="Open"
					/>
				</section>

				<section>
					<p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-foreground-muted">
						Arcana 06-10 with reference gap ({SET_PREVIEW_GAP.toFixed(2)})
					</p>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{SELECTED_ARCANA.map((variant) => (
							<article
								key={`set-${variant.id}`}
								className="rounded-xl border border-border-subtle bg-surface/35 px-5 py-6"
							>
								<p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-foreground-muted">
									Arcana {variant.id}
								</p>
								<LogoLockup
									variant={variant}
									symbolClassName="size-12 shrink-0"
									nameClassName="text-[34px]"
									gapOffset={SET_PREVIEW_GAP}
								/>
							</article>
						))}
					</div>
				</section>
			</div>
		</main>
	);
}
