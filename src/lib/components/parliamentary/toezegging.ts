// Where a toezegging was made and where it was kept, in the Kamer's words (API 0.79.55): "Toegezegd
// in het wetgevingsoverleg van 23 maart 2026", "Nagekomen in brief nr. 33". One wording for the
// reader of a toezegging and its line opened in a list (ToezeggingInhoud). The activity is
// named by its kind and day, never by its number.
import { withoutGroup } from '$lib/text/words';
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
const soortInZin = (kind: string) => withoutGroup(kind).trim().toLowerCase();

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
