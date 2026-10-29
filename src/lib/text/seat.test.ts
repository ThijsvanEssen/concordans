import { describe, expect, it } from 'vitest';
import { joinSeats, seatAndOthers, seatWord } from './seat';

const seat = (from_date: string, to_date: string | null, role = 'Lid', substitute = false) => ({
	from_date,
	to_date,
	role,
	substitute
});

describe('seatWord', () => {
	it('names a fungerend voorzitter, not the code', () => {
		expect(seatWord('FngVz')).toBe('fungerend voorzitter');
	});
});

describe('joinSeats', () => {
	it('joins a seat the next continues in the same word (a new Kamer)', () => {
		expect(
			joinSeats([
				seat('2025-11-18', null, 'PlvLid', true),
				seat('2024-09-03', '2025-11-18', 'PlvLid', true)
			])
		).toEqual([seat('2024-09-03', null, 'PlvLid', true)]);
	});

	it('joins on the day after the end (TotEnMet is inclusive)', () => {
		expect(joinSeats([seat('2021-04-13', '2023-12-12'), seat('2023-12-13', '2024-09-05')])).toEqual(
			[seat('2021-04-13', '2024-09-05')]
		);
	});

	it('keeps a gap and another word apart', () => {
		const gap = [seat('2017-03-28', '2021-04-13'), seat('2026-01-29', null)];
		expect(joinSeats(gap)).toEqual(gap);
		const word = [seat('2022-01-26', '2023-12-11', 'PlvLid', true), seat('2023-12-12', null)];
		expect(joinSeats(word)).toEqual(word);
	});
});

describe('seatAndOthers', () => {
	it('shows the joined seat, the rest beside it', () => {
		const now = seat('2025-11-18', null);
		const periods = [seat('2021-04-13', '2025-11-18'), now, seat('2017-01-01', '2019-01-01')];
		expect(seatAndOthers(now, periods)).toEqual({
			seat: seat('2021-04-13', null),
			others: [seat('2017-01-01', '2019-01-01')]
		});
	});

	it('takes the period in the word of the seat where another ends on its first day', () => {
		const now = seat('2026-03-25', null);
		const fng = seat('2025-11-19', '2026-03-25', 'FngVz');
		const periods = [seat('2024-07-02', '2025-11-18'), fng, now];
		expect(seatAndOthers(now, periods)).toEqual({
			seat: now,
			others: [seat('2024-07-02', '2025-11-18'), fng]
		});
	});
});
