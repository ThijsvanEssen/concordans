import { describe, expect, it } from 'vitest';
import { describe as describeBron, periodLabel, rowKey, rowOfNeighbor, type Row } from './rows';
import type { Neighbor } from '$lib/api/nodes';

describe('rowKey', () => {
	it('tells apart two references from one article', () => {
		const row = (edgeId: string) =>
			({
				ref: { collection: 'articles', key: 'bwbr0005289_13' },
				title: 'Artikel 6:13',
				context: null,
				kind: 'artikelen',
				edgeId
			}) as Row;
		expect(rowKey(row('e1'))).not.toBe(rowKey(row('e2')));
	});
});

describe('a conclusion', () => {
	it('is named by its author, as it is cited', () => {
		const props = {
			court: 'PHR',
			date: '2018-08-02',
			advocate_general: 'mr. R.E.C.M. Niessen',
			advocate_general_role: 'advocaat-generaal'
		};
		expect(describeBron('judgments', 'ecli_nl_phr_2018_1', 'x', props).title).toBe(
			'Conclusie A-G Niessen, 2 augustus 2018'
		);
	});
});

describe('a bewindspersoon of a cabinet', () => {
	const post = (fn: string, from: string, to: string | null) => ({
		function: fn,
		from_date: from,
		to_date: to
	});
	const row = (posts: unknown[]) =>
		rowOfNeighbor({
			id: 'members/a',
			key: 'a',
			collection: 'members',
			display_name: 'Rob Jetten (D66)',
			relation: 'SERVED_IN',
			direction: 'inbound',
			meta: { posts }
		} as unknown as Neighbor)!;

	it('reads the post and the period from the SERVED_IN posts', () => {
		const r = row([post('Minister-president', '2026-02-23', null)]);
		expect(r.period).toEqual({ from: '2026-02-23', to: null, role: 'minister-president' });
		expect(periodLabel(r.period!)).toBe('minister-president, sinds 2026');
	});

	it('runs from the first post to the end of the last', () => {
		const r = row([
			post('Minister van Justitie en Veiligheid', '2024-07-02', '2025-06-03'),
			post('Minister van Asiel en Migratie', '2025-06-03', '2025-09-01')
		]);
		expect(periodLabel(r.period!)).toBe(
			'minister van Justitie en Veiligheid en minister van Asiel en Migratie, 2024–2025'
		);
	});
});
