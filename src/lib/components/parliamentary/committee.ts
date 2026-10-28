// A committee's standing and its seats, one place for the list of Bronnen and its reader.
import type { Schema } from '$lib/api/types';
import { seatWord } from '$lib/text/seat';

type Member = Schema<'MemberDTO'>;

/**
 * Whether a committee sits (API 0.80.15: not ended and, of the Tweede Kamer, a member seated
 * today); null where the answer has no `sitting` yet, so no label is shown.
 */
export const sittingOf = (c: { sitting?: boolean | null } | null | undefined): boolean | null =>
	typeof c?.sitting === 'boolean' ? c.sitting : null;

/** The standing of a committee in a word; null where it is not known. */
export const standingWord = (sitting: boolean | null): string | null =>
	sitting == null ? null : sitting ? 'Actief' : 'Opgeheven';

export type Seats = {
	/** The voorzitter first, then the ondervoorzitter, with the word of their seat. */
	officers: (Member & { zetel: string })[];
	leden: Member[];
	/** The substitutes (`PlvLid`, `Plv. lid`): of a vaste commissie up to half its seats. */
	plaatsvervangers: Member[];
};

const RANG: Record<string, number> = { voorzitter: 0, ondervoorzitter: 1 };
const byName = (a: Member, b: Member) =>
	(a.family_name ?? a.name ?? '').localeCompare(b.family_name ?? b.name ?? '', 'nl');

/** A committee's members split by their seat, each group by family name. */
export function seatsOf(members: Member[]): Seats {
	const seats: Seats = { officers: [], leden: [], plaatsvervangers: [] };
	for (const m of [...members].sort(byName)) {
		const zetel = seatWord(m.role);
		if (zetel === 'plaatsvervangend lid') seats.plaatsvervangers.push(m);
		else if (zetel) seats.officers.push({ ...m, zetel });
		else seats.leden.push(m);
	}
	seats.officers.sort((a, b) => (RANG[a.zetel] ?? 2) - (RANG[b.zetel] ?? 2));
	return seats;
}
