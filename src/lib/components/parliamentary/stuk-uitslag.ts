// How the Kamer decided on a motie or amendement, on its row wherever a Kamerstuk is listed
// (Verbonden on a dossier, an article or a lid; Bronnen; Gemarkeerd): the API's `outcome`,
// with the day (`decided_on`) and the seats voor and tegen of that vote (`tally`), a link to
// the stemming (`decision`). A stuk another replaced names the one that did (`replaced_by`).
// Source values only: nothing is read from a title, and a stuk without an outcome shows none.
import { textOf } from '$lib/text/words';
import { korteDatum } from '$lib/text/datum';
import { genummerd, nrsTekst, type Nr } from './vervanging';
import { votesShort } from './stemming';

const UITKOMSTEN = [
	'aangenomen',
	'verworpen',
	'ingetrokken',
	'aangehouden',
	'vervallen',
	'vervangen'
] as const;

export type Uitkomst = (typeof UITKOMSTEN)[number];

const isUitkomst = (s: string | null): s is Uitkomst =>
	!!s && (UITKOMSTEN as readonly string[]).includes(s);

export type StukUitslag = {
	uitkomst: Uitkomst;
	/** The seats voor and tegen, `139–11`; null without votes (a hamerstuk, a motie held). */
	telling: string | null;
	/** The day of the decision, `15 apr. 2026`; null without one. */
	datum: string | null;
	/** The stemming's key (`/stemmingen/{key}`); null without one. */
	besluit: string | null;
	/** The stukken that replaced it, by number, lowest first: of `vervangen`. */
	vervangers: Nr[];
};

/** The outcome of a stuk from its props or its list item; null while nothing was decided. */
export function stukUitslag(p: Record<string, unknown> | null | undefined): StukUitslag | null {
	const uitkomst = textOf(p?.outcome);
	if (!p || !isUitkomst(uitkomst)) return null;
	return {
		uitkomst,
		telling: votesShort(p.tally),
		datum: korteDatum(textOf(p.decided_on)) || null,
		besluit: textOf(p.decision),
		vervangers: genummerd(p.replaced_by)
	};
}

/** The outcome as plain words, for the table and the export: `aangenomen 139–11 op 15 apr. 2026`. */
export function uitslagTekst(u: StukUitslag): string {
	if (u.uitkomst === 'vervangen' && u.vervangers.length)
		return `vervangen door ${nrsTekst(u.vervangers)}`;
	return [u.uitkomst, u.telling].filter(Boolean).join(' ') + (u.datum ? ` op ${u.datum}` : '');
}
