// How strong a line of the canvas is drawn at rest (Netwerkcanvas, Lijnen): in its own colour,
// mixed toward the paper the more lines there are, but never fainter than a line can be read:
// 3:1 against the paper. A thread (a line between two bronnen that are neither chosen) is meant
// to be faint and has no floor; a hover is in full.

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
/** The least contrast of a line with the paper (WCAG, non-text). */
export const LINE_CONTRAST = 3;

const rgb = (hex: string): [number, number, number] | null => {
	const m = HEX.exec(hex.trim());
	return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
};

const luminance = ([r, g, b]: [number, number, number]) => {
	const f = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** The contrast ratio of two #rrggbb colours (1 to 21); 21 when one is not a hex colour. */
export function contrast(a: string, b: string): number {
	const x = rgb(a);
	const y = rgb(b);
	if (!x || !y) return 21;
	const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
	return (hi + 0.05) / (lo + 0.05);
}

/** `color` mixed `strength` of the way from the paper (0) to itself (1), as #rrggbb. */
export function mixed(color: string, paper: string, strength: number): string {
	const c = rgb(color);
	const p = rgb(paper);
	if (!c || !p) return color;
	const hex = (i: number) =>
		Math.round(c[i] * strength + p[i] * (1 - strength))
			.toString(16)
			.padStart(2, '0');
	return `#${hex(0)}${hex(1)}${hex(2)}`;
}

/** The weakest strength at which `color` still holds LINE_CONTRAST against `paper`; 1 if never. */
export function floorStrength(color: string, paper: string): number {
	if (contrast(color, paper) < LINE_CONTRAST) return 1;
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 12; i++) {
		const mid = (lo + hi) / 2;
		if (contrast(mixed(color, paper, mid), paper) >= LINE_CONTRAST) hi = mid;
		else lo = mid;
	}
	return hi;
}

/** The strength of a line of a fan of `n` lines: in full up to nine, paler beyond, never below the floor. */
export const lineStrength = (color: string, paper: string, n: number): number =>
	Math.max(Math.min(1, 3 / Math.sqrt(n || 1)), floorStrength(color, paper));
