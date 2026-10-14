import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fail, fakeApi } from '$lib/test/fakeApi';
import { factionKeyOf, keyOfName } from './names.svelte';

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

describe('factionKeyOf', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('asks the list again after a failure, instead of leaving every name unlinked', async () => {
		const answers: unknown[] = [fail(503), [{ key: 'd66', abbreviation: 'D66', name: 'D66' }]];
		const fake = fakeApi({ '/api/factions': () => answers.shift(), '/api/cabinets': [] });
		expect(factionKeyOf('D66')).toBeNull();
		await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
		factionKeyOf('D66');
		await vi.waitFor(() => expect(factionKeyOf('D66')).toBe('d66'));
		expect(fake.asked('/api/factions')).toHaveLength(2);
	});
});
