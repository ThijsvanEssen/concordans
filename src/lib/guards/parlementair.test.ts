// The parliamentary small things said once (code-eenvoud F48–F62).
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

describe('the parliamentary things said once (code-eenvoud F48–F62)', () => {
	it('takes the ministries, their order and their renamings from the API (F48)', () => {
		// No list of ministry codes of its own: getMinistries gives order and successors.
		expect(overtreders((t) => /['"]az['"],\s*['"]bz['"]|\bvenj\s*:/.test(t))).toEqual([]);
	});

	it('opens a post of a cabinet through CabinetPostOpen (F50)', () => {
		expect(
			overtreders(
				(t) => /import PostOpen\b/.test(t),
				[plek('lib/components/explore/index/CabinetPostOpen.svelte')]
			)
		).toEqual([]);
		expect(
			overtreders(
				(t) => /\/\^kabinet-\//.test(t),
				[plek('lib/components/explore/index/government.ts')]
			)
		).toEqual([]);
	});

	it('says where a composition or a decision comes from in BronRegel (F49)', () => {
		expect(
			overtreders(
				(t) => /gegevens sinds|geraadpleegd op/.test(t),
				[plek('lib/components/parliamentary/BronRegel.svelte')]
			)
		).toEqual([]);
	});

	it('counts and orders the choices of a stemming in $lib/votes/stemming (F50)', () => {
		expect(
			overtreders((t) =>
				/\[['"](Voor|Tegen)['"]\]|['"]Voor['"],\s*['"]Tegen['"]|[!=]== ?['"](Voor|Tegen)['"]/.test(
					t
				)
			)
		).toEqual([]);
	});

	it('reads the verbs of a change from relationWords, in the order of CHANGE_HEAD (F60)', () => {
		expect(
			overtreders(
				(t) => /['"](Stelt vast|Wijzigt|Voegt in|Doet vervallen|Trekt in|Vernummert)['"]/i.test(t),
				[
					plek('lib/verbonden/relation-words.ts'),
					plek('lib/verbonden/hoe.ts', 'a supplementary budget: Wijzigt deze wet')
				]
			)
		).toEqual([]);
	});

	it('says a tally through votesSentence and votesShort (F61)', () => {
		expect(
			overtreders(
				(t) => /\} voor(, | en )\$?\{|\}–\$?\{[^}]*tegen|\.Voor\b|\.Tegen\b/.test(t),
				[plek('lib/votes/stemming.ts')]
			)
		).toEqual([]);
	});

	it('draws what the coalition did with CoalitieRegel, from coalitionLine (F62)', () => {
		expect(
			overtreders(
				(t) => /coalition_(for|against)\b|Coalitie (verdeeld|voor|tegen)/.test(t),
				[
					plek('lib/components/parliamentary/coalitie.ts'),
					plek('lib/components/parliamentary/CoalitieRegel.svelte'),
					plek('lib/fixtures/coalition-votes.ts', 'the API answer of a test')
				]
			)
		).toEqual([]);
	});

	it('names the open state of a toezegging by OPEN_STATUS (F50)', () => {
		expect(
			overtreders(
				(t) => /['"]Openstaand['"]/.test(t),
				[plek('lib/components/explore/index/government.ts')]
			)
		).toEqual([]);
	});

	it('reads the outcome of a vote in one form, VoteLine, wherever it stands at rest or opens', () => {
		// The head of a motie or amendement, its Stemming section and the opened row of a stemming
		// (Stemmingen, Actueel, a lid's votes) say the outcome and the fracties alike (A98).
		for (const pad of [
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/components/parliamentary/StemmingUitslag.svelte',
			'lib/components/open/RijInhoud.svelte'
		])
			expect(bron(pad), pad).toMatch(/<VoteLine\b/);
		// The fracties per side are drawn there only, and on the stemming's own page in full.
		expect(
			overtreders(
				(t) => /\bekFactionGroups\(|Map\.groupBy\([^)]*\.choice\)/.test(t),
				[
					plek('lib/votes/vote-line.ts'),
					plek('lib/votes/voters.ts'),
					plek('lib/components/explore/readers/DecisionReader.svelte', 'the stemming in full')
				]
			)
		).toEqual([]);
	});
});
