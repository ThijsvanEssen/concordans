// What a publication or an inwerkingtreding in Actueel opens on (RijInhoud): the changes, in
// the words of a verbinding ($lib/verbonden/relation-words, relationWords). A publication its articles per
// law and verb, from its own ESTABLISHES, AMENDS, INTRODUCES and REPEALS; an inwerkingtreding the
// publication that brought the version, from the law's `/amended-by`. The feed gives neither
// verb nor article (onderzoek samenhang, GGN 3.2 and 3.3: back-end B2, B3).
import { count, textOf } from '$lib/text/words';
import type { Schema } from '$lib/api/types';
import {
	CHANGE_RELATIONS,
	isChangeRelation,
	type ChangeRelation,
	type Relation
} from '$lib/vocabulary';
import { changeAround, changeByEffect, changeVerb } from '$lib/verbonden/relation-words';
import { naamVanId } from '$lib/bron/menselijk';

/** A neighbour as the node response gives it: the part a change reads. */
type Buur = {
	key: string;
	collection: string;
	display_name?: string | null;
	relation?: string | null;
	direction?: string | null;
	props?: Record<string, unknown> | null;
	meta?: Record<string, unknown> | null;
};

/** An article a line names: its key, its number. */
export type Artikel = { key: string; nummer: string };

/** One line: the change and its verb, the law, the articles of it (none where the law as a whole). */
export type WetRegel = {
	relation: Relation;
	werkwoord: string;
	wet: { key: string; titel: string };
	artikelen: Artikel[];
	/** The articles past those named. */
	meer: number;
};

/** Articles named on one line; the rest counted. */
export const ARTIKELEN_GENOEMD = 12;

/**
 * The changes of a publication per law and verb: `Wijzigt Telecommunicatiewet, art. 11a.3 en
 * 11a.4`. The laws in the order the response first names them; the articles in the law's
 * order. `wetten` are the laws the feed names, for a title the article does not carry.
 */
export function wijzigingenVan(
	buren: readonly Buur[],
	wetten: readonly { key: string; title?: string | null }[] = [],
	genoemd = ARTIKELEN_GENOEMD
): WetRegel[] {
	const titels = new Map(wetten.map((w) => [w.key.toLowerCase(), w.title ?? null]));
	const regels = new Map<string, WetRegel & { plek: (Artikel & { positie: number })[] }>();
	for (const b of buren) {
		const relation = b.relation;
		if (!isChangeRelation(relation) || b.direction !== 'outbound') continue;
		const p = b.props ?? {};
		const meta = b.meta ?? {};
		const isWet = b.collection === 'instruments';
		const wetKey = (isWet ? b.key : (textOf(p.bwb_id) ?? '')).toLowerCase();
		if (!wetKey) continue;
		// The verb as the row of Verbonden says it: `Wijzigt`, `Voegt in`, `Doet vervallen`.
		const werkwoord = changeVerb(relation, isWet ? 'instruments' : 'articles', meta);
		const sleutel = `${werkwoord}/${wetKey}`;
		let regel = regels.get(sleutel);
		if (!regel) {
			const titel =
				titels.get(wetKey) ??
				textOf(p.instrument_citation_title) ??
				(isWet ? textOf(b.display_name) : null) ??
				naamVanId(`instruments/${wetKey}`);
			regel = {
				relation: changeByEffect(relation, meta),
				werkwoord,
				wet: { key: wetKey, titel },
				artikelen: [],
				meer: 0,
				plek: []
			};
			regels.set(sleutel, regel);
		}
		const nummer = textOf(p.article_number);
		if (!isWet && nummer) {
			const positie = typeof p.position === 'number' ? p.position : Number.POSITIVE_INFINITY;
			regel.plek.push({ key: b.key, nummer, positie });
		}
	}
	const orde = (r: Relation) => (CHANGE_RELATIONS as readonly Relation[]).indexOf(r);
	const wetOrde = [...new Set([...regels.values()].map((r) => r.wet.key))];
	return [...regels.values()]
		.sort(
			(a, b) =>
				wetOrde.indexOf(a.wet.key) - wetOrde.indexOf(b.wet.key) ||
				orde(a.relation) - orde(b.relation)
		)
		.map(({ plek, ...r }) => {
			const alle = plek.sort(
				(a, b) => a.positie - b.positie || a.nummer.localeCompare(b.nummer, 'nl', { numeric: true })
			);
			return {
				...r,
				artikelen: alle.slice(0, genoemd).map(({ key, nummer }) => ({ key, nummer })),
				meer: Math.max(0, alle.length - genoemd)
			};
		});
}

type Wijzigend = Schema<'AmendingInstrumentDTO'>;

/** A publication that brought a version: its key, its citation, what it did to the law. */
export type Brenger = { key: string; naam: string; wat: string | null };

/** `stelt 111 artikelen vast`, `wijzigt 1 artikel`, `voegt 7 artikelen in`, `doet 2 artikelen vervallen`. */
function telling(relation: ChangeRelation, n: number): string | null {
	return n ? changeAround(relation, 'articles', count(n, 'artikel', 'artikelen')) : null;
}

/**
 * The publications that brought the version of a law in force on `datum`, from its
 * `/amended-by`: those whose first change takes effect that day, the publication that enacted
 * the law among them (`establishes`). Empty where the data names none.
 */
export function brengersVan(items: readonly Wijzigend[], datum: string): Brenger[] {
	return items
		.filter((d) => d.first_effective_date?.slice(0, 10) === datum.slice(0, 10))
		.map((d) => ({
			key: d.key,
			naam: d.display_name ?? d.identifier ?? naamVanId(d.id),
			wat:
				[
					telling('ESTABLISHES', d.establishes ?? 0),
					telling('AMENDS', d.amends ?? 0),
					telling('INTRODUCES', d.introduces ?? 0),
					telling('REPEALS', d.repeals ?? 0)
				]
					.filter(Boolean)
					.join(', ') || null
		}));
}
