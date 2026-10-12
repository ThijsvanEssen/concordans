// The places of the Eerste Kamer's hall (ZaalTegenover): two blocks facing each other, four
// places wide and ten rows deep. Who sits where the API gives only for the hall as the Kamer
// shows it now (`hall`); for any other day the seats of the day fill the places by fractie,
// the largest first, so the Kamer still stands as it is drawn (Thijs, 12 Oct: "de EK met
// zetels zoals we die kennen").

export type Plaats = { block: 'left' | 'right'; row: number; column: number; name: string };

const RIJEN = 10;
const KOLOMMEN = 4;

/**
 * The places in the order they are filled: the left block from the regering down, row by
 * row, then the right block the same way. Each fractie's seats stay together.
 */
export function plaatsenOpVolgorde(fracties: { name: string; seats: number }[]): Plaats[] {
	const plaatsen: Plaats[] = [];
	const vrij = (['left', 'right'] as const).flatMap((block) =>
		Array.from({ length: RIJEN * KOLOMMEN }, (_, i) => ({
			block,
			row: Math.floor(i / KOLOMMEN),
			column: i % KOLOMMEN
		}))
	);
	for (const f of [...fracties].sort((a, b) => b.seats - a.seats))
		for (let n = 0; n < f.seats && plaatsen.length < vrij.length; n++)
			plaatsen.push({ ...vrij[plaatsen.length], name: f.name });
	return plaatsen;
}
