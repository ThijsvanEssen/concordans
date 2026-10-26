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
			before: 'Voorstel van de regering, ingediend door ',
			name: 'A. Jansen',
			memberKey: 'm1',
			after: ', minister van Justitie.'
		});
	});
	it('names the Kamerlid of an initiative bill, without a function', () => {
		expect(proposal(who({ capacity: 'kamerlid' }))).toMatchObject({
			before: 'Initiatiefvoorstel van ',
			after: '.'
		});
	});
	it('says the government alone where the source gives no name', () => {
		expect(proposal(who({ name: null, capacity: 'bewindspersoon' }))?.before).toBe(
			'Voorstel van de regering'
		);
	});
	it('leaves out what the source does not say', () => {
		expect(proposal(null)).toBeNull();
		expect(proposal(who({ name: null, capacity: 'overig' }))).toBeNull();
	});
	it('words a Brief commissie of a committee chair as a burgerinitiatief, else as plain submission', () => {
		const chair = who({
			capacity: 'kamerlid',
			function: 'voorzitter van de vaste commissie voor X'
		});
		expect(proposal(chair, { 'Brief commissie': 1 })).toEqual({
			before: 'Burgerinitiatief, door de vaste commissie voor X (voorzitter ',
			name: 'A. Jansen',
			memberKey: 'm1',
			after: ') voorgesteld in behandeling te nemen.'
		});
		expect(proposal(chair, { Motie: 2 })?.before).toBe('Ingediend door ');
		expect(proposal(chair)?.before).toBe('Ingediend door ');
	});
});
