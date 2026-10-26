import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import type { Schema } from '$lib/api/types';
import ProposedBy from './ProposedBy.svelte';

const who = (p: Partial<Schema<'DossierProposerDTO'>>) =>
	({
		member_key: 'm1',
		name: 'H.M. de Jonge',
		function: 'minister van Justitie',
		date: null,
		capacity: 'bewindspersoon',
		...p
	}) as Schema<'DossierProposerDTO'>;
const sentence = (proposer: Schema<'DossierProposerDTO'>, title?: string) =>
	render(ProposedBy, { proposer, title }).container.textContent?.replace(/\s+/g, ' ').trim();

describe('ProposedBy', () => {
	it('writes the whole sentence, with a space before the name', () => {
		expect(sentence(who({}))).toBe(
			'Voorstel van de regering, ingediend door H.M. de Jonge, minister van Justitie.'
		);
	});
	it('names a Kamerlid of an initiative bill without a function', () => {
		expect(sentence(who({ capacity: 'kamerlid', function: 'lid van de Tweede Kamer' }))).toBe(
			'Initiatiefvoorstel van H.M. de Jonge.'
		);
	});
	it('does not call a burgerinitiatief the Kamerlid’s own bill', () => {
		expect(
			sentence(
				who({
					capacity: 'kamerlid',
					function: 'voorzitter van de vaste commissie voor Volksgezondheid, Welzijn en Sport'
				}),
				'Burgerinitiatief “Levenseinderegie”'
			)
		).toBe(
			'Burgerinitiatief, ingediend door H.M. de Jonge, voorzitter van de vaste commissie voor Volksgezondheid, Welzijn en Sport.'
		);
	});
});
