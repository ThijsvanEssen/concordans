// A bron, a fractie, a Kamer and a grondslag are named by one helper each, never by a key.
import { describe, expect, it } from 'vitest';
import { overtreders, plek, regelOvertreders, type Uitzondering } from '$lib/test/bronnen';

describe('names, not keys', () => {
	it('falls back to the name of a bron, never to its key or id ($lib/bron/menselijk)', () => {
		// "x ?? y.key" put "bwbr0005537_2022_05_01" and uuids on the screen. A name that may be
		// missing falls back to menselijkeNaam (naamVan, naamVanId); a key or id used as a key
		// (an href, a lookup, a version's id) is named here with what it is for.
		const techniek: Uitzondering[] = [
			{
				pad: 'lib/components/articles/VersionCompare.svelte',
				reden: 'the id of a wording, not shown'
			},
			{ pad: 'lib/components/graph/GraphView.svelte', reden: 'node ids for focus and hover' },
			{
				pad: 'lib/components/explore/IndexView.svelte',
				reden: 'the key of a concept for the URL; a fraction key for its colour'
			},
			{ pad: 'lib/components/explore/JudgmentToc.svelte', reden: 'the ECLI asked of the API' },
			{
				pad: 'lib/components/explore/readers/JudgmentReader.svelte',
				reden: 'the ECLI asked of the API'
			},
			{
				pad: 'lib/components/explore/WholeLawReader.svelte',
				reden: 'the id of a version, not shown'
			},
			{
				pad: 'lib/components/explore/readers/CommitmentReader.svelte',
				reden: 'the number in a dossier ref'
			},
			{ pad: 'lib/components/actueel/wetsnetwerk.ts', reden: 'the key of an href' },
			{
				pad: 'lib/components/parliamentary/amendementen.ts',
				reden: 'the ids of the zaken not done'
			},
			{ pad: 'lib/api/law-articles.ts', reden: 'the address of an article, not its name' },
			{ pad: 'lib/text/version-diff.ts', reden: 'the id of a version, not shown' }
		];
		const fallback = /(\?\?|\|\|)\s*[A-Za-z_$][\w.?$]*\.(key|id)\b(?!\s*\.|\s*[!=]==|\s*\()/;
		expect(regelOvertreders((l) => fallback.test(l), techniek)).toEqual([]);
	});

	it('says a grondslag in one place ($lib/text/delegaties)', () => {
		// "AMvB op grond van", "Op grond van", "mede op grond van": the row of Verbonden, a map, a
		// regulation under a regulation and the head of a regulation read them from there. The
		// words of the relation itself are hoe.ts's (BASED_ON).
		expect(
			regelOvertreders(
				(l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l) && /['`"][^'`"]*\bop grond van\b/i.test(l),
				[plek('lib/text/delegaties.ts')]
			)
		).toEqual([]);
	});

	it('names a fractie by its abbreviation through fractieNaam (UX #57)', () => {
		const eigen =
			/\babbreviation \?\? (?:\w+\.(?:faction|faction_key)\b|(?:\w+\.name \?\? )?\w*[nN]aamVan\('factions')/;
		expect(overtreders((t) => eigen.test(t))).toEqual([]);
	});

	it('names a Kamer from $lib/components/parliamentary/chamber (code-eenvoud F55)', () => {
		const ownName =
			/\{\s*TK: 'Tweede Kamer'|label: 'Tweede Kamer'|=== 'EK' \? 'Eerste Kamer' : 'Tweede Kamer'/;
		expect(
			overtreders((t) => ownName.test(t), [plek('lib/components/parliamentary/chamber.ts')])
		).toEqual([]);
	});
});
