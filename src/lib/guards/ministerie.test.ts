// The ministry a wet, a dossier and a toezegging name is one link in one form (A195): their
// readers give MinistryLink the key and the name, and write no link to /ministeries/ themselves.
import { describe, expect, it } from 'vitest';
import { bron, overtreders } from '$lib/test/bronnen';

const LEZERS = [
	'lib/components/explore/WholeLawReader.svelte',
	'lib/components/explore/readers/DossierReader.svelte',
	'lib/components/explore/readers/CommitmentReader.svelte'
];

describe('the ministry on a wet, a dossier and a toezegging', () => {
	it('is the MinistryLink of every one of them', () => {
		for (const pad of LEZERS) expect(bron(pad), pad).toMatch(/<MinistryLink\b/);
	});

	it('is no link of the reader’s own', () => {
		expect(
			overtreders(
				(t) => /ref=\{`ministries\//.test(t),
				[
					{ pad: 'lib/bron/MinistryLink.svelte', reden: 'the one form' },
					{
						pad: 'lib/components/explore/readers/MinistryReader.svelte',
						reden: 'the ministry’s own page links its predecessor and successor'
					}
				]
			)
		).toEqual([]);
	});
});
