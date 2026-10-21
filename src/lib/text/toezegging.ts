// Where a toezegging was made and where it was kept, in the Kamer's words (API 0.79.55): "Toegezegd
// in het wetgevingsoverleg van 23 maart 2026", "Nagekomen in brief nr. 33". One wording for the
// reader of a toezegging and its line opened in a list (ToezeggingInhoud). The activity is
// named by its kind and day, never by its number.

import { shortKind } from '$lib/text/document-kind';
import { langeDatum } from '$lib/text/datum';

/** `het` or `de` before the kind of an activity: het debat, het overleg, de procedurevergadering. */
function lidwoord(soort: string): 'het' | 'de' {
	return /(vergadering|zitting|briefing|stemmingen|werkzaamheden|hoorzitting|bijeenkomst|regeling)$/i.test(
		soort
	)
		? 'de'
		: 'het';
}

/** The kind of an activity in a sentence: `Plenair debat (wetgeving)` is `plenair debat`. */
const soortInZin = (kind: string) => shortKind(kind).trim().toLowerCase();

/**
 * "Toegezegd in het wetgevingsoverleg van 23 maart 2026", in two parts: the words before the
 * link (`Toegezegd in het`) and the link's own (`wetgevingsoverleg van 23 maart 2026`). Null
 * without an activity.
 */
export function toegezegdIn(
	activity: { kind?: string | null; date?: string | null } | null | undefined,
	datum: (iso: string | null) => string = (iso) => langeDatum(iso)
): { voor: string; link: string } | null {
	if (!activity) return null;
	const soort = activity.kind?.trim() ? soortInZin(activity.kind) : 'activiteit';
	const dag = datum(activity.date ?? null);
	const lid = activity.kind?.trim() ? lidwoord(soort) : 'de';
	return { voor: `Toegezegd in ${lid}`, link: dag ? `${soort} van ${dag}` : soort };
}

type Brief = { key: string; sequence?: number | null; date?: string | null };

/**
 * "Nagekomen in brief nr. 33", "Nagekomen in brieven nrs. 33 en 35": the letters that fulfil
 * it (`fulfilled_by`), each a link by its number, or by its day where it has none.
 */
export function nagekomenIn(brieven: readonly Brief[] | null | undefined): {
	voor: string;
	brieven: { key: string; naam: string }[];
} | null {
	const bs = brieven ?? [];
	if (!bs.length) return null;
	const genummerd = bs.every((b) => b.sequence != null);
	return {
		voor: `Nagekomen in ${bs.length > 1 ? 'brieven' : 'brief'}${genummerd ? (bs.length > 1 ? ' nrs.' : ' nr.') : ' van'}`,
		brieven: bs.map((b) => ({
			key: b.key,
			naam: genummerd ? String(b.sequence) : langeDatum(b.date) || 'onbekende datum'
		}))
	};
}

/**
 * Why a toezegging is about a dossier (`CommitmentDossierDTO.basis`, the `meta.basis` of its
 * `ABOUT`): `nakoming`, the dossier of the letter that fulfils it, from the source; `agenda`, a
 * dossier on the agenda of the debate it was made in. A debate takes its agenda together: a
 * dossier there is where the toezegging was discussed, not what it is about.
 */
type Basis = 'nakoming' | 'agenda';

/** The words of a dossier on the agenda of that debate: on its row, the reader, Verbonden. */
export const DISCUSSED_IN_DEBATE = 'Besproken in het debat';

/** Whether a toezegging is about this dossier only by the agenda of its debate. */
export const onAgendaOnly = (basis: unknown) => basis === 'agenda';

/**
 * The dossiers of a toezegging by why: `own` those it is about (by the letter that fulfils
 * it, or every one where the API gives no basis), `agenda` those of its debate's agenda.
 */
export function dossiersByBasis<D extends { basis?: Basis | null }>(
	dossiers: readonly D[] | null | undefined
): { own: D[]; agenda: D[] } {
	const all = dossiers ?? [];
	return {
		own: all.filter((d) => !onAgendaOnly(d.basis)),
		agenda: all.filter((d) => onAgendaOnly(d.basis))
	};
}

/**
 * "Besproken in het debat over Staat van de Volkshuisvesting", in three parts: the label
 * (`Besproken`), the words before the link (`in het debat over`) and the link's own (its
 * subject, else its day: `in het debat van` `11 maart 2026`). The link is null without either.
 */
export function discussedIn(
	activity: { agenda_title?: string | null; date?: string | null } | null | undefined,
	formatDate: (iso: string | null) => string = (iso) => langeDatum(iso)
): { label: string; before: string; link: string | null } {
	const [label, ...rest] = DISCUSSED_IN_DEBATE.split(' ');
	const inDebate = rest.join(' ');
	const subject = activity?.agenda_title?.trim();
	const day = formatDate(activity?.date ?? null);
	return subject
		? { label, before: `${inDebate} over`, link: subject }
		: day
			? { label, before: `${inDebate} van`, link: day }
			: { label, before: inDebate, link: null };
}

/** The same as one phrase in a line of text: `besproken in het debat over Staat van de …`. */
export function discussedPhrase(...args: Parameters<typeof discussedIn>): string {
	const d = discussedIn(...args);
	return [d.label.toLowerCase(), d.before, d.link].filter(Boolean).join(' ');
}
