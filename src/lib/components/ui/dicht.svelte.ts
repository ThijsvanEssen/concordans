// Which sections are closed, per kind of section (Thijs, 10 Oct: "de verschillende kopjes
// inklapbaar, zodat ik de EK of TK dicht kan klappen, of de amendementen"). A section is
// open unless it was closed; closed, it stays closed on every bron of its kind, in this
// browser. One key per kind: `Procedure`, `Zetels in de Eerste Kamer`, `verbonden:judgments`.

const SLEUTEL = 'concordans:dicht';

function lees(): Set<string> {
	try {
		const ruw = JSON.parse(localStorage.getItem(SLEUTEL) ?? '[]') as unknown;
		return new Set(Array.isArray(ruw) ? ruw.filter((x): x is string => typeof x === 'string') : []);
	} catch {
		return new Set();
	}
}

// Read once in the browser, as the module loads: a first read inside a template would write
// state during rendering.
const dicht = $state<{ sleutels: Set<string> }>({
	sleutels: typeof window === 'undefined' ? new Set() : lees()
});

const sleutels = () => dicht.sleutels;

/** Whether the section of this kind is closed. */
export const isDicht = (sleutel: string) => sleutels().has(sleutel);

/** Open or close the sections of this kind, and keep it. */
export function zetDicht(sleutel: string, toe: boolean) {
	const nieuw = new Set(sleutels());
	if (toe) nieuw.add(sleutel);
	else nieuw.delete(sleutel);
	dicht.sleutels = nieuw;
	try {
		localStorage.setItem(SLEUTEL, JSON.stringify([...nieuw]));
	} catch {
		// A browser that keeps nothing: the section stays as chosen for this page.
	}
}
