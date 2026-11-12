// Which headings stand open, per kind (Thijs, 10 Oct: "de verschillende kopjes inklapbaar,
// zodat ik de EK of TK dicht kan klappen, of de amendementen"; and later: "Maak de
// standaard van kopjes dicht in de reader en sub kopjes ook collapsable"). A section of a
// reader starts closed, a heading inside it starts open; what the reader opens or closes is
// kept for every bron of its kind, in this browser. One key per kind: `Procedure`,
// `Zetels in de Eerste Kamer`, `verbonden:judgments`, `sub:Tweede Kamer`. The panel Netwerk
// folded on a phone is kept here too.
import { onForget } from '$lib/util/forget';
import { entriesOf, FOLDS_KEY, readJson, writeJson } from '$lib/util/storage';

/**
 * The keys of what something else opens or reads by name: a section opened from elsewhere
 * (the day of votes in a procedure opens Amendementen, and scrolls to it by the same word as
 * its anchor), and the panel Netwerk.
 */
export const FOLD = {
	amendments: 'amendementen',
	networkPanel: 'netwerkpaneel'
} as const;

/** The key of a heading inside a section (a group of a timeline, a law's articles). */
export const subKey = (name: string) => `sub:${name}`;

const lees = (): Record<string, boolean> =>
	readJson('local', FOLDS_KEY, (ruw) =>
		Object.fromEntries(
			entriesOf(ruw).filter((e): e is [string, boolean] => typeof e[1] === 'boolean')
		)
	) ?? {};

// Read once in the browser, as the module loads: a first read inside a template would write
// state during rendering.
const keuzes = $state<{ open: Record<string, boolean> }>({
	open: typeof window === 'undefined' ? {} : lees()
});
onForget(() => {
	keuzes.open = {};
});

/** Whether the heading of this kind stands open: as chosen, else its default. */
export const isOpen = (sleutel: string, standaard: boolean) => keuzes.open[sleutel] ?? standaard;

/** Open or close the headings of this kind, and keep it. */
export function zetOpen(sleutel: string, open: boolean) {
	keuzes.open = { ...keuzes.open, [sleutel]: open };
	// A browser that keeps nothing: the heading stays as chosen for this page.
	writeJson('local', FOLDS_KEY, keuzes.open);
}
