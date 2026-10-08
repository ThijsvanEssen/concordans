import { describe, expect, it } from 'vitest';
import { fractiePeriodes } from './fractie-periode';

const m = (faction_key: string, from_date: string, to_date: string | null) => ({
	faction_key,
	abbreviation: faction_key.toUpperCase(),
	from_date,
	to_date
});

describe('fractiePeriodes', () => {
	it('joins records that follow on, keeps a gap, and names a running period sinds', () => {
		expect(
			fractiePeriodes([
				m('d66', '2017-03-23', '2018-10-08'),
				m('d66', '2018-10-09', '2021-03-30'),
				m('d66', '2023-12-06', '2026-02-09'),
				m('d66', '2026-02-09', null)
			])
		).toEqual([{ key: 'd66', naam: 'D66', periode: '2017–2021, sinds 2023', tot: null }]);
	});

	it('puts the current fractie first, an earlier one with its years', () => {
		const f = fractiePeriodes([
			m('vvd', '2017-03-23', '2021-03-30'),
			m('ja21', '2021-03-31', null)
		]);
		expect(f.map((x) => `${x.naam}, ${x.periode}`)).toEqual(['JA21, sinds 2021', 'VVD, 2017–2021']);
	});

	it('gives nothing without memberships', () => {
		expect(fractiePeriodes(undefined)).toEqual([]);
		expect(fractiePeriodes([{ faction_key: null }])).toEqual([]);
	});
});
