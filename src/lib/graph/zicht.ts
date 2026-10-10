// What the bronfilter leaves on the canvas, as one key: the kinds hidden, the court and the
// period. When it changes the camera frames what is left (GraphView); without that the view
// kept the zoom of the full network, and two papers next to their article vanished under its
// mark (Thijs, 10 Oct: Wet buitenlandse schepen art. 1, "1 stuk en geen lijnen").
import type { BronKind } from '$lib/verbonden/filter';

export type Zicht = {
	verborgen: ReadonlySet<BronKind>;
	rechter: string | null;
	van: string | null;
	tot: string | null;
};

export const zichtSleutel = (z: Zicht): string =>
	[[...z.verborgen].sort().join(','), z.rechter ?? '', z.van ?? '', z.tot ?? ''].join('|');

/**
 * Whether a change of the filter asks the camera to frame what is left: not on the first look
 * (the load frames itself), and only when the key changed. A fit is enough also for a few
 * bronnen: laid out again they settle where they were, tied to their focus, while the fit
 * spreads them over the canvas as ⤢ does.
 */
export const naFilter = (vorige: string | null, nu: string): boolean =>
	vorige !== null && vorige !== nu;
