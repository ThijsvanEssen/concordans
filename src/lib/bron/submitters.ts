import type { Schema } from '$lib/api/types';

// Who submitted a motie or amendement, as the API gives them: on a document its
// `submitters`, in Actueel the `persons` of an item. One shape for both, so the line
// `Ingediend door X (fractie), mede namens Y (fractie)` is written once.

export type Submitter = {
	name: string;
	/** Their member, where the API knows it. */
	memberKey: string | null;
	/** The faction they signed for, by its abbreviation. */
	faction: string | null;
	factionKey: string | null;
	role: 'indiener' | 'medeindiener';
};

/**
 * A faction named after the member (a group of one: "Lid Keijzer", "Groep Markuszower")
 * says their name again: left out (UX-toets 10 Oct, #32: "Mona Keijzer (Lid Keijzer)").
 */
export function eigenFractie(name: string, faction: string | null): string | null {
	if (!faction) return null;
	const achternaam = name.trim().split(/\s+/).at(-1)?.toLowerCase();
	if (!achternaam) return faction;
	const woorden = faction.toLowerCase().split(/[\s-]+/);
	return woorden.includes(achternaam) ? null : faction;
}

/** From `/api/documents/{key}`. */
export const fromDocument = (list: Schema<'SubmitterDTO'>[] | null | undefined): Submitter[] =>
	(list ?? []).map((s) => ({
		name: s.name,
		memberKey: s.member_key ?? null,
		faction: eigenFractie(s.name, s.faction ?? null),
		factionKey: null,
		role: s.role
	}));

/** From the persons of a feed item: its indieners and medeindieners, not a bewindspersoon. */
export const fromFeed = (list: Schema<'FeedPersonDTO'>[] | null | undefined): Submitter[] =>
	(list ?? []).flatMap((p) =>
		p.name && (p.role === 'indiener' || p.role === 'medeindiener')
			? [
					{
						name: p.name,
						memberKey: p.key ?? null,
						faction: eigenFractie(p.name, p.faction?.short ?? null),
						factionKey: p.faction?.key ?? null,
						role: p.role
					}
				]
			: []
	);

/** The first signatories and the others, each in the order of the source. */
export function groupSubmitters(list: readonly Submitter[]): {
	by: Submitter[];
	with: Submitter[];
} {
	const by = list.filter((s) => s.role === 'indiener');
	return { by, with: list.filter((s) => s.role !== 'indiener') };
}

/**
 * Whether a role is that of the first submitter, as the source or the API writes it: the
 * TK's `Eerste ondertekenaar` (a motie) and `Eerste indiener`, the API's `indiener`.
 */
export const isEersteIndiener = (role: unknown) =>
	/^(eerste (indiener|ondertekenaar)|indiener)$/i.test(String(role ?? '').trim());

/**
 * The first submitter of a list of persons, by role and never by place: the source lists
 * the mede-ondertekenaars first as often as after (motie 36799-45: Schenk and Flach, then
 * Ceder). The first in the list only where no role says it.
 */
export const eersteIndiener = <T extends { role?: unknown }>(list: readonly T[]): T | undefined =>
	list.find((p) => isEersteIndiener(p.role)) ?? list[0];

/** The bewindspersoon of a feed item (a toezegging), by role. */
export const bewindspersoonVan = <T extends { role?: unknown }>(
	list: readonly T[]
): T | undefined => list.find((p) => p.role === 'bewindspersoon') ?? list[0];
