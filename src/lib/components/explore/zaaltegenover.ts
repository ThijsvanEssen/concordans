// The places of the Eerste Kamer's hall (ZaalTegenover): two blocks facing each other, four
// places wide and ten rows deep. Who sits where the API gives in `hall`, from the day Wie zit
// waar was read (`hall_read_on`) on; for an earlier day the seats of the day fill the places
// by fractie, the largest first, so the Kamer still stands as it is drawn (Thijs, 12 Oct: "de
// EK met zetels zoals we die kennen"), and the caption marks it (Thijs, 12 Oct: option a).

import { langeDatum } from '$lib/text/datum';

export type Plaats = { block: 'left' | 'right'; row: number; column: number; name: string };

export const HALL_ROWS = 10;
export const HALL_COLUMNS = 4;

/**
 * The places in the order they are filled: the left block from the regering down, row by
 * row, then the right block the same way. Each fractie's seats stay together.
 */
export function plaatsenOpVolgorde(fracties: { name: string; seats: number }[]): Plaats[] {
	const plaatsen: Plaats[] = [];
	const vrij = (['left', 'right'] as const).flatMap((block) =>
		Array.from({ length: HALL_ROWS * HALL_COLUMNS }, (_, i) => ({
			block,
			row: Math.floor(i / HALL_COLUMNS),
			column: i % HALL_COLUMNS
		}))
	);
	for (const f of [...fracties].sort((a, b) => b.seats - a.seats))
		for (let n = 0; n < f.seats && plaatsen.length < vrij.length; n++)
			plaatsen.push({ ...vrij[plaatsen.length], name: f.name });
	return plaatsen;
}

/**
 * The marker of a hall drawn by fractie, for the caption beside its date: null where the
 * hall has its plan (or is the Tweede Kamer's). With `hall_read_on` it names the day the plan
 * is known from.
 */
export function indelingMarkering(z: {
	chamber: string;
	hall?: { seats?: unknown[] | null } | null;
	hall_read_on?: string | null;
}): string | null {
	if (z.chamber !== 'EK' || z.hall?.seats?.length) return null;
	return z.hall_read_on
		? `Indeling per fractie; zaal bekend vanaf ${langeDatum(z.hall_read_on)}`
		: 'Indeling per fractie';
}
