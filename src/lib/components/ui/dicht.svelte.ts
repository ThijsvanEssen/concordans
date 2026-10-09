// Which headings stand open, per kind (Thijs, 10 Oct: "de verschillende kopjes inklapbaar,
// zodat ik de EK of TK dicht kan klappen, of de amendementen"; and later: "Maak de
// standaard van kopjes dicht in de reader en sub kopjes ook collapsable"). A section of a
// reader starts closed, a heading inside it starts open; what the reader opens or closes is
// kept for every bron of its kind, in this browser. One key per kind: `Procedure`,
// `Zetels in de Eerste Kamer`, `verbonden:judgments`, `sub:Tweede Kamer`.

const SLEUTEL = 'concordans:kopjes';

function lees(): Record<string, boolean> {
	try {
		const ruw = JSON.parse(localStorage.getItem(SLEUTEL) ?? '{}') as unknown;
		if (!ruw || typeof ruw !== 'object' || Array.isArray(ruw)) return {};
		return Object.fromEntries(
			Object.entries(ruw as Record<string, unknown>).filter(
				(e): e is [string, boolean] => typeof e[1] === 'boolean'
			)
		);
	} catch {
		return {};
	}
}

// Read once in the browser, as the module loads: a first read inside a template would write
// state during rendering.
const keuzes = $state<{ open: Record<string, boolean> }>({
	open: typeof window === 'undefined' ? {} : lees()
});

/** Whether the heading of this kind stands open: as chosen, else its default. */
export const isOpen = (sleutel: string, standaard: boolean) => keuzes.open[sleutel] ?? standaard;

/** Whether the section of this kind is closed; a section starts closed. */
export const isDicht = (sleutel: string) => !isOpen(sleutel, false);

/** Open or close the headings of this kind, and keep it. */
export function zetOpen(sleutel: string, open: boolean) {
	keuzes.open = { ...keuzes.open, [sleutel]: open };
	try {
		localStorage.setItem(SLEUTEL, JSON.stringify(keuzes.open));
	} catch {
		// A browser that keeps nothing: the heading stays as chosen for this page.
	}
}

/** Close or open a section (`toe`: close it). */
export const zetDicht = (sleutel: string, toe: boolean) => zetOpen(sleutel, !toe);
