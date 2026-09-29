import { describe, expect, it } from 'vitest';
import { keyOfName } from './names.svelte';

const factions = [
	{ key: 'd66', names: ['D66', 'Democraten 66'] },
	{ key: 'nieuw_sociaal_contract', names: ['Nieuw Sociaal Contract', 'NSC'] },
	{ key: 'groenlinks_pvda', names: ['GroenLinks-PvdA', null] },
	{ key: 'grko', names: ['GrKÖ'] }
];

describe('keyOfName', () => {
	it('finds a fractie by abbreviation, name or key, whatever the case and accents', () => {
		expect(keyOfName(factions, 'D66')).toBe('d66');
		expect(keyOfName(factions, 'NSC')).toBe('nieuw_sociaal_contract');
		expect(keyOfName(factions, 'groenlinks pvda')).toBe('groenlinks_pvda');
		expect(keyOfName(factions, 'GrKO')).toBe('grko');
	});

	it('leaves a name that is not in the list unlinked', () => {
		expect(keyOfName(factions, 'Partij van de Toekomst')).toBeNull();
		expect(keyOfName(factions, '')).toBeNull();
	});
});
