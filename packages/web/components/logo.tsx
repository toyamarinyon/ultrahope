const STAR_GAP = 2;
const STAR_ROTATE = 29.5;
const STAR_RAY_COUNT = 15;
const STAR_STROKE = 0.9;
const SYMBOL_SCALE = 1.12;

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

export function Logo({ className }: { className: string }) {
	const phase = 1;
	const coreOuter = 4.95 + phase * 0.16;
	const coreInner = 2.45 + phase * 0.08;
	const innerRay = coreOuter + STAR_GAP;
	const outerRay = 10.2;
	const step = 360 / STAR_RAY_COUNT;

	return (
		<svg className={className} viewBox="0 0 24 24" aria-hidden="true">
			<g
				transform={`translate(12 12) scale(${SYMBOL_SCALE}) translate(-12 -12)`}
			>
				{Array.from({ length: STAR_RAY_COUNT }).map((_, index) => {
					const start = polarPoint(innerRay, STAR_ROTATE + index * step);
					const end = polarPoint(
						(index + phase) % 3 === 0 ? outerRay - 1 : outerRay,
						STAR_ROTATE + index * step,
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
							strokeWidth={STAR_STROKE * 0.9}
							strokeLinecap="round"
						/>
					);
				})}
				<polygon
					points={starPoints(4, coreOuter, coreInner, 45 + STAR_ROTATE)}
					fill="currentColor"
					stroke="currentColor"
					strokeWidth="0.35"
					strokeLinejoin="round"
				/>
			</g>
		</svg>
	);
}
