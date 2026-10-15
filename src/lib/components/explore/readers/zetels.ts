// The changes that begin a stretch of seats, as a line under the course (concept 16, rules
// for the changes). The Eerste Kamer's own words verbatim, once per headline; a change the
// API derives (the Tweede Kamer gives no reason) by its kind as a plain label, with its
// fracties. No direction: the source gives none, the number beside it shows what happened.
import { fractieNaam } from '$lib/bron/menselijk';
import type { Schema } from '$lib/api/types';
import { getParliamentSeats } from '$lib/api/records';
import type { Chamber } from '$lib/components/parliamentary/chamber';
import { report } from '$lib/api/errors';
import { vandaag } from '$lib/text/datum';

type Stuk = Schema<'SeatStretchDTO'>;
type Gebeurtenis = Schema<'SeatEventDTO'>;
type Zaal = Schema<'ParliamentSeatsResponse'>;

/**
 * The height of `n` seats in the step chart: on the Kamer's whole scale, from none at the
 * foot to all its seats at the top, so the majority's line stands at its true height and a
 * coalition under it stays under it (Thijs, 12 Oct: "uitlijning klopt niet").
 */
export function zetelHoogte(n: number, zetels: number, hoogte: number, rand: number): number {
	const deel = Math.min(1, Math.max(0, n / zetels));
	return rand + (1 - deel) * (hoogte - 2 * rand);
}

/**
 * The hall of the Eerste Kamer for a day: the API knows who sits where from the day Wie zit
 * waar was read (`hall_read_on`), an API before that only without a `date`. On today the hall
 * of the day takes that plan where the dated one has none; on an earlier day the seats are
 * placed by fractie, marked (indelingMarkering).
 */
export function zaalMetPlan(opDag: Zaal, nu: Zaal | null): Zaal {
	return opDag.hall?.seats?.length || !nu?.hall?.seats?.length
		? opDag
		: { ...opDag, hall: nu.hall };
}

/**
 * The hall of a cabinet's Kamer on `day`: null where the data has none for this cabinet (no
 * stretches, and the hall of the day is another cabinet's). A failure throws: it is never
 * "niet in de gegevens". The Eerste Kamer's seating only comes without a date: today takes it.
 */
export async function hallOfDay(
	chamber: Chamber,
	day: string,
	cabinet: string,
	withStretches: boolean
): Promise<Zaal | null> {
	const plan =
		chamber === 'EK' && day === vandaag()
			? getParliamentSeats(chamber).catch((e) => {
					// The seats are placed by fractie without it (indelingMarkering).
					report('Zaalplan', e);
					return null;
				})
			: null;
	const [hall, today] = await Promise.all([getParliamentSeats(chamber, day), plan]);
	return withStretches || hall.cabinet?.key === cabinet ? zaalMetPlan(hall, today) : null;
}

/** The Kamer's own words as a clause: no space before a stop, no stop of their own. */
const zinsdeel = (t: string) =>
	t
		.replace(/\s+([.,;:])/g, '$1')
		.trim()
		.replace(/[.;,:]+$/, '');

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

/**
 * The vacant seats of a stretch that no fractie holds (UX #48): its `vacant` counts every seat
 * no member held, the fracties' own vacancies among them. Neither coalition nor opposition.
 */
export function vacantZonderFractie(stuk: Pick<Stuk, 'vacant' | 'factions'>): number {
	const vanFracties = (stuk.factions ?? []).reduce((n, f) => n + (f.vacant ?? 0), 0);
	return Math.max(0, (stuk.vacant ?? 0) - vanFracties);
}

export type Wijziging =
	| { woorden: string; soort?: undefined; wie?: undefined }
	| { soort: string; wie: string; woorden?: undefined };

/**
 * The changes of a stretch, one per headline (or per kind where there are no words), with
 * all their fracties by the names the stretch gives them.
 */
export function wijzigingenVan(stuk: Pick<Stuk, 'events' | 'factions'>): Wijziging[] {
	const naam = new Map((stuk.factions ?? []).map((f) => [f.key, fractieNaam(f)]));
	const per = new Map<string, { e: Gebeurtenis; fracties: Set<string> }>();
	for (const e of stuk.events ?? []) {
		const woorden = e.words ? zinsdeel(e.words) : '';
		const sleutel = woorden ? `w:${woorden}` : `s:${e.kind}`;
		const v = per.get(sleutel) ?? { e, fracties: new Set<string>() };
		for (const f of e.factions ?? []) v.fracties.add(naam.get(f) ?? f);
		per.set(sleutel, v);
	}
	return [...per.values()].map(({ e, fracties }) =>
		e.words && zinsdeel(e.words)
			? { woorden: zinsdeel(e.words) }
			: { soort: SOORT[e.kind] ?? e.kind, wie: [...fracties].join(', ') }
	);
}
