// The distribution of Periode: bars per year, and the years two handles stand on.

export type Verdeling = { jaar: number; aantal: number }[];

/** Width of the drawing; its bars share it with 2 units between them. */
export const BREED = 288;
export const HOOG = 48;
const TUSSEN = 2;

export type Staaf = { x: number; y: number; breed: number; hoog: number; binnen: boolean };

/** The bars, one per year from the first to the last, `binnen` where the year is in the period. */
export function staven(v: Verdeling, vanJaar: number, totJaar: number): Staaf[] {
	if (v.length === 0) return [];
	const eerste = v[0].jaar;
	const n = v[v.length - 1].jaar - eerste + 1;
	const breed = (BREED - TUSSEN * (n - 1)) / n;
	const telling = new Map(v.map((r) => [r.jaar, r.aantal]));
	const max = Math.max(1, ...v.map((r) => r.aantal));
	return Array.from({ length: n }, (_, i) => {
		const jaar = eerste + i;
		const aantal = telling.get(jaar) ?? 0;
		const hoog = aantal > 0 ? Math.max(1, Math.round((aantal / max) * HOOG)) : 0;
		return {
			x: i * (breed + TUSSEN),
			y: HOOG - hoog,
			breed,
			hoog,
			binnen: jaar >= vanJaar && jaar <= totJaar
		};
	});
}

/** How many are counted in the years `van` to `tot`, both included. */
export const inPeriode = (v: Verdeling, van: number, tot: number): number =>
	v.reduce((som, r) => (r.jaar >= van && r.jaar <= tot ? som + r.aantal : som), 0);

/** The year a key moves a handle to, or null for a key that moves nothing. */
export function stapJaar(key: string, nu: number, min: number, max: number): number | null {
	const stap: Record<string, number> = {
		ArrowLeft: -1,
		ArrowDown: -1,
		ArrowRight: 1,
		ArrowUp: 1,
		PageDown: -10,
		PageUp: 10
	};
	if (key === 'Home') return min;
	if (key === 'End') return max;
	return key in stap ? Math.min(max, Math.max(min, nu + stap[key])) : null;
}

/** The year at `deel` (0 to 1) of the track. */
export const jaarBij = (deel: number, min: number, max: number): number =>
	Math.round(min + Math.min(1, Math.max(0, deel)) * (max - min));
