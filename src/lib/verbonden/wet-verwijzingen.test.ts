import { describe, expect, it } from 'vitest';
import { richtingKop, verwijzingenPerRichting } from './wet-verwijzingen';

const artikel = (bwb: string, n: string) => ({
	id: `articles/${bwb.toLowerCase()}_${n}`,
	key: `${bwb.toLowerCase()}_${n}`,
	bwb_id: bwb,
	celex: null,
	article_number: n,
	display_name: `Artikel ${n}`
});
const verwijzing = (
	direction: 'inbound' | 'outbound',
	van: string,
	naar: string,
	leden: string[] = [],
	onderdelen: string[] = []
) => ({
	direction,
	source: artikel(direction === 'outbound' ? 'BWBR0052875' : 'BWBR0052872', van),
	target: artikel(direction === 'outbound' ? 'BWBR0052872' : 'BWBR0052875', naar),
	leden,
	onderdelen,
	aanhef: false,
	text: null,
	semantic_type: null
});

describe('the references between two laws, opened in place', () => {
	it('lists per referring article the articles it names, with their leden', () => {
		const r = verwijzingenPerRichting([
			verwijzing('outbound', '2', '16', ['1']),
			verwijzing('outbound', '2', '17'),
			verwijzing('outbound', '3', '16', ['2'], ['b']),
			verwijzing('outbound', '3', '16', ['3'])
		]);
		expect(r).toHaveLength(1);
		expect(r[0].regels.map((g) => [g.bron.label, g.doelen.map((d) => d.label)])).toEqual([
			['art. 2', ['16 lid 1', '17']],
			['art. 3', ['16 lid 2 en 3 onder b']]
		]);
	});

	it('puts this law first, then the other, each under its own kicker', () => {
		const r = verwijzingenPerRichting([
			verwijzing('inbound', '1', '5'),
			verwijzing('outbound', '2', '16')
		]);
		expect(r.map((x) => x.richting)).toEqual(['outbound', 'inbound']);
		expect(richtingKop('outbound', 'dit besluit')).toBe('Vanuit dit besluit');
		expect(richtingKop('inbound', 'deze wet')).toBe('Naar deze wet');
	});

	it('cites a BW article with its book', () => {
		const [r] = verwijzingenPerRichting([
			{ ...verwijzing('outbound', '2', '673e', ['1']), target: artikel('BWBR0005290', '673e') }
		]);
		expect(r.regels[0].doelen[0].label).toBe('7:673e lid 1');
	});
});
