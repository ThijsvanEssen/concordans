import { describe, expect, it } from 'vitest';
import {
	actingReason,
	at,
	bandsOf,
	lanesOf,
	seatLabel,
	termOf,
	ticksOf,
	type Seat,
	type SeatPost
} from './occupancy';

const post = (name: string, from: string, to: string | null, extra: Partial<SeatPost> = {}) =>
	({
		member: { key: name.toLowerCase(), name },
		post: 'minister',
		from_date: from,
		to_date: to,
		acting: false,
		also_named: [],
		corrected: [],
		overlaps_with: [],
		dossiers: 0,
		bills: 0,
		open_commitments: 0,
		...extra
	}) as SeatPost;

const seat = (posts: SeatPost[], extra: Partial<Seat> = {}) =>
	({ seat: 'ienw/minister', post: 'minister', posts, ...extra }) as Seat;

const schoof = termOf({ from_date: '2024-07-02', to_date: '2026-02-23', ministries: [] })!;

describe('termOf', () => {
	it('runs to today only while a post is held, and is not made up without posts', () => {
		const held = (to: string | null) => [
			{ ministry: 'az' as const, seats: [seat([post('A', '2026-02-23', to)])] }
		];
		const t = termOf(
			{ from_date: '2026-02-23', to_date: null, ministries: held(null) },
			'2026-09-28'
		)!;
		expect(t.open).toBe(true);
		expect(t.end).toBe(Date.parse('2026-09-28T00:00:00Z'));
		// An old cabinet whose end no source gives ends with its last post.
		const old = termOf({ from_date: '1952-09-02', to_date: null, ministries: held('1956-10-13') })!;
		expect(old.open).toBe(false);
		expect(old.end).toBe(Date.parse('1956-10-13T00:00:00Z'));
		expect(termOf({ from_date: '1913-08-29', to_date: null, ministries: [] })).toBeNull();
		expect(termOf({ from_date: null, to_date: null, ministries: [] })).toBeNull();
	});

	it('holds a day outside the term at its edge', () => {
		expect(at(schoof, '2024-07-02', 'start')).toBe(0);
		expect(at(schoof, '2030-01-01', 'end')).toBe(1);
		expect(at(schoof, null, 'end')).toBe(1);
	});
});

describe('lanesOf', () => {
	it('puts holders that follow each other on one lane, a stand-in among them', () => {
		const lanes = lanesOf(
			seat([
				post('Tieman', '2025-06-19', '2026-02-23'),
				post('Madlener', '2024-07-02', '2025-06-03'),
				post('Hermans', '2025-06-03', '2025-06-19', { acting: true })
			]),
			schoof
		);
		expect(lanes).toHaveLength(1);
		expect(lanes[0].map((b) => b.post.member.name)).toEqual(['Madlener', 'Hermans', 'Tieman']);
	});

	it('gives holders at the same time a lane each', () => {
		const lanes = lanesOf(
			seat([post('A', '2024-07-02', '2026-02-23'), post('B', '2025-01-01', '2025-06-01')]),
			schoof
		);
		expect(lanes).toHaveLength(2);
	});
});

describe('seatLabel', () => {
	it('names the post, the portfolio and a minister voor', () => {
		expect(seatLabel(seat([]))).toBe('Minister');
		expect(seatLabel(seat([], { post: 'staatssecretaris', portfolio: 'Rechtsbescherming' }))).toBe(
			'Staatssecretaris, Rechtsbescherming'
		);
		expect(
			seatLabel(
				seat([], {
					post: 'minister_zonder_portefeuille',
					portfolio: 'Buitenlandse Handel en Ontwikkelingshulp'
				})
			)
		).toBe('Minister voor Buitenlandse Handel en Ontwikkelingshulp');
	});
});

describe('bandsOf and ticksOf', () => {
	it('keeps the demissionary phases within the term', () => {
		const bands = bandsOf(
			[
				{ kind: 'formatie', from_date: '2023-11-22', to_date: '2024-07-02' },
				{ kind: 'in_functie', from_date: '2024-07-02', to_date: '2025-06-03' },
				{ kind: 'demissionair', from_date: '2025-06-03', to_date: '2025-08-22' },
				{ kind: 'dubbel_demissionair', from_date: '2025-08-22', to_date: '2026-02-23' }
			],
			schoof
		);
		expect(bands.map((b) => b.phase.kind)).toEqual(['demissionair', 'dubbel_demissionair']);
		expect(bands[1].to).toBe(1);
	});

	it('marks the quarters of a short term', () => {
		expect(ticksOf(schoof).map((t) => t.label)).toEqual([
			'okt 2024',
			'2025',
			'apr 2025',
			'jul 2025',
			'okt 2025',
			'2026'
		]);
	});
});

describe('actingReason', () => {
	it('names the other post, or keeps the words of Rijksoverheid', () => {
		expect(
			actingReason({
				acting_reason: 'held_other_seat',
				acting_other_seat: { seat: 'kgg', function: 'Minister van Klimaat en Groene Groei' }
			})
		).toBe('Naast de post minister van Klimaat en Groene Groei, tot de opvolger aantrad.');
		expect(actingReason({ acting_reason: 'held_other_seat' })).toBe(
			'Naast een andere post, tot de opvolger aantrad.'
		);
		expect(actingReason({ acting_reason: 'source', acting_basis: 'a.i.' })).toBe(
			'Ad interim, volgens Rijksoverheid.'
		);
		expect(
			actingReason({ acting_reason: 'source', acting_basis: 'Beheer portefeuille overgenomen (X)' })
		).toBe('Volgens Rijksoverheid: beheer portefeuille overgenomen (X)');
		expect(actingReason({})).toBeNull();
	});
});
