import { describe, expect, it } from 'vitest';
import { feedStand, standLine } from './stand';

describe('feedStand', () => {
	it('takes the newest record of the Kamers, and says when it was fetched', () => {
		const stand = feedStand({
			tk: { retrieved_at: '2026-09-24T20:51:42Z', newest: '2026-09-24', completeness: {} },
			eerstekamer: { retrieved_at: '2026-09-23T10:07:37Z', newest: '2026-09-21', completeness: {} },
			rechtspraak: { retrieved_at: '2026-09-29T07:29:57Z', newest: '2026-09-28', completeness: {} }
		});
		expect(stand).toEqual({ newest: '2026-09-24', retrievedAt: '2026-09-24T20:51:42Z' });
		expect(standLine(stand!)).toBe(
			'Stukken van de Kamers tot en met 24 sep. 2026, opgehaald op 24 sep. 2026'
		);
		expect(
			feedStand({ bwb: { retrieved_at: null, newest: '2026-09-01', completeness: {} } })
		).toBeNull();
		expect(feedStand(undefined)).toBeNull();
	});
});
