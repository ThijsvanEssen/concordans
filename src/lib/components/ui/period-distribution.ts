// The distribution of Periode: bars per year, and the years two handles stand on.

export type Distribution = { year: number; count: number }[];

/** Width of the drawing; its bars share it with 2 units between them. */
export const DRAW_WIDTH = 288;
export const DRAW_HEIGHT = 48;
const GAP = 2;

type Bar = { x: number; y: number; width: number; height: number; inside: boolean };

/** The bars, one per year from the first to the last, `inside` where the year is in the period. */
export function bars(v: Distribution, fromYear: number, toYear: number): Bar[] {
	if (v.length === 0) return [];
	const first = v[0].year;
	const n = v[v.length - 1].year - first + 1;
	const width = (DRAW_WIDTH - GAP * (n - 1)) / n;
	const tally = new Map(v.map((r) => [r.year, r.count]));
	const max = Math.max(1, ...v.map((r) => r.count));
	return Array.from({ length: n }, (_, i) => {
		const year = first + i;
		const count = tally.get(year) ?? 0;
		const height = count > 0 ? Math.max(1, Math.round((count / max) * DRAW_HEIGHT)) : 0;
		return {
			x: i * (width + GAP),
			y: DRAW_HEIGHT - height,
			width,
			height,
			inside: year >= fromYear && year <= toYear
		};
	});
}

/** How many are counted in the years `van` to `tot`, both included. */
export const inPeriod = (v: Distribution, van: number, tot: number): number =>
	v.reduce((sum, r) => (r.year >= van && r.year <= tot ? sum + r.count : sum), 0);

/** The year a key moves a handle to, or null for a key that moves nothing. */
export function stepYear(key: string, now: number, min: number, max: number): number | null {
	const step: Record<string, number> = {
		ArrowLeft: -1,
		ArrowDown: -1,
		ArrowRight: 1,
		ArrowUp: 1,
		PageDown: -10,
		PageUp: 10
	};
	if (key === 'Home') return min;
	if (key === 'End') return max;
	return key in step ? Math.min(max, Math.max(min, now + step[key])) : null;
}

/** The year at `fraction` (0 to 1) of the track. */
export const yearAt = (fraction: number, min: number, max: number): number =>
	Math.round(min + Math.min(1, Math.max(0, fraction)) * (max - min));
