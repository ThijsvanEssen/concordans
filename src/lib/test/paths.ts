// Paths as SVG draws them, read back as points: for the guards that no line crosses another or
// runs through a name (the Keten, the lanes).
import type { Pt } from '$lib/network/tree-lines';

/** Points along a path of M, L, Q and C commands, 2 px apart at most. */
export function sample(d: string): Pt[] {
	const t = d.match(/[MLQC]|-?\d+(?:\.\d+)?/g) ?? [];
	const out: Pt[] = [];
	let cur: Pt = { x: 0, y: 0 };
	for (let i = 0; i < t.length; ) {
		const c = t[i++];
		const n = c === 'Q' ? 4 : c === 'C' ? 6 : 2;
		const v = t.slice(i, i + n).map(Number);
		i += n;
		const end = { x: v[n - 2], y: v[n - 1] };
		if (c === 'M') out.push(end);
		else {
			const steps = Math.max(2, Math.ceil(Math.hypot(end.x - cur.x, end.y - cur.y) / 2));
			for (let s = 1; s <= steps; s++) {
				const u = s / steps;
				const a = 1 - u;
				if (c === 'L') out.push({ x: cur.x + (end.x - cur.x) * u, y: cur.y + (end.y - cur.y) * u });
				else if (c === 'Q')
					out.push({
						x: a * a * cur.x + 2 * a * u * v[0] + u * u * end.x,
						y: a * a * cur.y + 2 * a * u * v[1] + u * u * end.y
					});
				else
					out.push({
						x: a ** 3 * cur.x + 3 * a * a * u * v[0] + 3 * a * u * u * v[2] + u ** 3 * end.x,
						y: a ** 3 * cur.y + 3 * a * a * u * v[1] + 3 * a * u * u * v[3] + u ** 3 * end.y
					});
			}
		}
		cur = end;
	}
	return out;
}
