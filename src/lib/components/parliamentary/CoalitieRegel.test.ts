import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import CoalitieRegel from './CoalitieRegel.svelte';
import { COALITION_VOTES as CASES, faction } from '$lib/fixtures/coalition-votes';

type Faction = Schema<'CoalitionFactionDTO'>;

const text = (coalitie: Schema<'CoalitionVoteDTO'>, fracties: Faction[] = []) =>
	render(CoalitieRegel, { props: { coalitie, fracties } })
		.body.replace(/<!--[^>]*-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const fractie = (short: string, choice: Faction['choice']) =>
	faction(short.toLowerCase(), choice, 0);

describe('CoalitieRegel', () => {
	it('says the side of a coalition as one', () => {
		expect(text(CASES.tegen)).toBe('Coalitie tegen');
		expect(text(CASES.voor)).toBe('Coalitie voor');
	});

	it('says nothing where the coalition cast no seat', () => {
		expect(text(CASES.geen)).toBe('');
	});

	it('names the fracties per side where it split, else the seats', () => {
		expect(
			text(CASES.verdeeld, [
				fractie('D66', 'Voor'),
				fractie('VVD', 'Tegen'),
				fractie('CDA', 'Tegen'),
				fractie('PVV', null)
			])
		).toBe('Coalitie verdeeld voor: D66 tegen: VVD, CDA PVV verdeeld');
		expect(text(CASES.verdeeld)).toBe('Coalitie verdeeld voor: 26 zetels tegen: 40 zetels');
	});

	it('names a wisselmeerderheid and a decisive coalition', () => {
		expect(text(CASES.wissel, [fractie('D66', 'Voor'), fractie('VVD', 'Tegen')])).toBe(
			'Coalitie verdeeld wisselmeerderheid doorslaggevend voor: D66 tegen: VVD'
		);
	});
});
