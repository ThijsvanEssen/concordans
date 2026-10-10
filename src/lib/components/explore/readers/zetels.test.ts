import { describe, expect, it } from 'vitest';
import { wijzigingenVan } from './zetels';

const fracties = [
	{ key: 'vvd', abbreviation: 'VVD', name: 'VVD', seats: 24, coalition: true },
	{ key: 'nieuw_sociaal_contract', abbreviation: 'NSC', name: 'NSC', seats: 19, coalition: true }
];
const e = (kind: string, factions: string[], words: string | null = null) => ({
	kind,
	date: '2024-07-04',
	words,
	basis: words ? 'tekst' : 'afgeleid',
	factions,
	members: []
});

describe('wijzigingenVan', () => {
	it('gives a derived change its kind as a label, once, with all its fracties', () => {
		const stuk = {
			factions: fracties,
			events: [
				e('opvolging', ['vvd']),
				e('opvolging', ['nieuw_sociaal_contract']),
				e('opvolging', ['vvd'])
			]
		} as never;
		expect(wijzigingenVan(stuk)).toEqual([{ soort: 'Opvolging', wie: 'VVD, NSC' }]);
	});

	it('keeps the Kamer’s own words verbatim, once per headline', () => {
		const kop = 'Twee nieuwe senatoren geïnstalleerd';
		const stuk = {
			factions: fracties,
			events: [e('beëdiging', ['vvd'], kop), e('beëdiging', ['nieuw_sociaal_contract'], kop)]
		} as never;
		expect(wijzigingenVan(stuk)).toEqual([{ woorden: kop }]);
	});

	it('names a fractie it does not know by its key', () => {
		const stuk = { factions: fracties, events: [e('vacature', ['bbb'])] } as never;
		expect(wijzigingenVan(stuk)).toEqual([{ soort: 'Vacature', wie: 'bbb' }]);
	});
});
