// The changes that begin a stretch of seats, as a line under the course (concept 16, rules
// for the changes). The Eerste Kamer's own words verbatim, once per headline; a change the
// API derives (the Tweede Kamer gives no reason) by its kind as a plain label, with its
// fracties. No direction: the source gives none, the number beside it shows what happened.
import { naamVan } from '$lib/bron/menselijk';
import type { Schema } from '$lib/api/types';

type Stuk = Schema<'SeatStretchDTO'>;
type Gebeurtenis = Schema<'SeatEventDTO'>;

/** A kind as a label, as the API names it (SeatEventDTO.kind). */
export const SOORT: Record<string, string> = {
	verkiezing: 'Verkiezing',
	afsplitsing: 'Afsplitsing',
	overstap: 'Overstap',
	vacature: 'Vacature',
	opvolging: 'Opvolging',
	coalitie: 'Coalitie gewijzigd',
	beëdiging: 'Beëdiging',
	vertrek: 'Vertrek',
	hernoeming: 'Nieuwe naam',
	samenvoeging: 'Samenvoeging'
};

export type Wijziging =
	| { woorden: string; soort?: undefined; wie?: undefined }
	| { soort: string; wie: string; woorden?: undefined };

/**
 * The changes of a stretch, one per headline (or per kind where there are no words), with
 * all their fracties by the names the stretch gives them.
 */
export function wijzigingenVan(stuk: Pick<Stuk, 'events' | 'factions'>): Wijziging[] {
	const naam = new Map(
		(stuk.factions ?? []).map((f) => [f.key, f.abbreviation ?? naamVan('factions', f)])
	);
	const per = new Map<string, { e: Gebeurtenis; fracties: Set<string> }>();
	for (const e of stuk.events ?? []) {
		const sleutel = e.words?.trim() ? `w:${e.words.trim()}` : `s:${e.kind}`;
		const v = per.get(sleutel) ?? { e, fracties: new Set<string>() };
		for (const f of e.factions ?? []) v.fracties.add(naam.get(f) ?? f);
		per.set(sleutel, v);
	}
	return [...per.values()].map(({ e, fracties }) =>
		e.words?.trim()
			? { woorden: e.words.trim() }
			: { soort: SOORT[e.kind] ?? e.kind, wie: [...fracties].join(', ') }
	);
}
