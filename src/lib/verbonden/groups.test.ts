import { describe, expect, it } from 'vitest';
import { naarSoort } from './groups';

describe('naarSoort', () => {
	const groups = [
		{ label: 'Artikelen van deze wet' },
		{ label: 'Wetten die met deze wet verbonden zijn' }
	];
	it('names a richtlijn and a verdrag by their kind', () => {
		expect(
			naarSoort(groups, { jurisdiction: 'eu', citation_title: 'Richtlijn (EU) 2017/1132' }).map(
				(g) => g.label
			)
		).toEqual(['Artikelen van deze richtlijn', 'Wetten die met deze richtlijn verbonden zijn']);
		expect(naarSoort(groups, { kind: 'multilateraalverdrag' })[0].label).toBe(
			'Artikelen van dit verdrag'
		);
	});
	it('keeps a wet and a regeling as they are', () => {
		expect(naarSoort(groups, { kind: 'wet' })).toEqual(groups);
		expect(naarSoort(groups, {})).toEqual(groups);
	});
});
