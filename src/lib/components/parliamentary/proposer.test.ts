import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { proposal } from './proposer';

const who = (p: Partial<Schema<'DossierProposerDTO'>>) =>
	({
		member_key: 'm1',
		name: 'A. Jansen',
		function: 'minister van Justitie',
		date: null,
		...p
	}) as Schema<'DossierProposerDTO'>;

describe('proposal', () => {
	it('names the government and the minister who signed', () => {
		expect(proposal(who({ capacity: 'bewindspersoon' }))).toEqual({
			lead: 'Voorstel van de regering, ingediend door',
			name: 'A. Jansen',
			memberKey: 'm1',
			function: 'minister van Justitie'
		});
	});
	it('names the Kamerlid of an initiative bill, without a function', () => {
		expect(proposal(who({ capacity: 'kamerlid' }))).toMatchObject({
			lead: 'Initiatiefvoorstel van',
			function: null
		});
	});
	it('says the government alone where the source gives no name', () => {
		expect(proposal(who({ name: null, capacity: 'bewindspersoon' }))?.lead).toBe(
			'Voorstel van de regering'
		);
	});
	it('leaves out what the source does not say', () => {
		expect(proposal(null)).toBeNull();
		expect(proposal(who({ name: null, capacity: 'overig' }))).toBeNull();
	});
	it('names a burgerinitiatief handed over by a committee chair as such', () => {
		const chair = who({
			capacity: 'kamerlid',
			function: 'voorzitter van de vaste commissie voor X'
		});
		expect(proposal(chair, 'Burgerinitiatief “Levenseinderegie”')?.lead).toBe(
			'Burgerinitiatief, ingediend door'
		);
		expect(proposal(chair, 'Wet X')?.lead).toBe('Ingediend door');
	});
});
