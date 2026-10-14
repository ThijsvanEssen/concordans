// How the Kamer decided on a motie or amendement, on its row wherever a Kamerstuk is listed
// (Verbonden on a dossier, an article or a lid; Bronnen; Gemarkeerd): the API's `outcome`,
// with the day (`decided_on`) and the seats voor and tegen of that vote (`tally`), a link to
// the stemming (`decision`). A stuk another replaced names the one that did (`replaced_by`).
// Source values only: nothing is read from a title, and a stuk without an outcome shows none.
import { textOf } from '$lib/text/words';
import { korteDatum } from '$lib/text/datum';
import { nrWoord, tussen } from './vervanging';

export type Uitkomst =
	| 'aangenomen'
	| 'verworpen'
	| 'ingetrokken'
	| 'aangehouden'
	| 'vervallen'
	| 'vervangen';

const UITKOMSTEN: readonly string[] = [
	'aangenomen',
	'verworpen',
	'ingetrokken',
	'aangehouden',
	'vervallen',
	'vervangen'
];

export type StukUitslag = {
	uitkomst: Uitkomst;
	/** The seats voor and tegen, `139–11`; null without votes (a hamerstuk, a motie held). */
	telling: string | null;
	/** The day of the decision, `15 apr. 2026`; null without one. */
	datum: string | null;
	/** The stemming's key (`/stemmingen/{key}`); null without one. */
	besluit: string | null;
	/** The stukken that replaced it, by number, lowest first: of `vervangen`. */
	vervangers: { key: string; nummer: string }[];
};

const getal = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The seats voor and tegen of a tally, `150–0`; null for a tally without seats. */
export function telling(tally: unknown): string | null {
	if (!tally || typeof tally !== 'object') return null;
	const t = tally as Record<string, unknown>;
	const voor = getal(t.Voor) ?? 0;
	const tegen = getal(t.Tegen) ?? 0;
	return voor + tegen > 0 ? `${voor}–${tegen}` : null;
}

/** The outcome of a stuk from its props or its list item; null while nothing was decided. */
export function stukUitslag(p: Record<string, unknown> | null | undefined): StukUitslag | null {
	const uitkomst = textOf(p?.outcome);
	if (!p || !uitkomst || !UITKOMSTEN.includes(uitkomst)) return null;
	const vervangers = (Array.isArray(p.replaced_by) ? p.replaced_by : [])
		.filter(
			(r): r is { key: string; sequence: number } =>
				!!r && typeof r.key === 'string' && typeof r.sequence === 'number'
		)
		.sort((a, b) => a.sequence - b.sequence)
		.map((r) => ({ key: r.key, nummer: String(r.sequence) }));
	return {
		uitkomst: uitkomst as Uitkomst,
		telling: telling(p.tally),
		datum: korteDatum(textOf(p.decided_on)) || null,
		besluit: textOf(p.decision),
		vervangers
	};
}

/** The outcome as plain words, for the table and the export: `aangenomen 139–11 op 15 apr. 2026`. */
export function uitslagTekst(u: StukUitslag): string {
	if (u.uitkomst === 'vervangen' && u.vervangers.length)
		return `vervangen door ${nrWoord(u.vervangers)} ${u.vervangers.map((v, i) => tussen(i, u.vervangers.length) + v.nummer).join('')}`;
	return [u.uitkomst, u.telling].filter(Boolean).join(' ') + (u.datum ? ` op ${u.datum}` : '');
}
