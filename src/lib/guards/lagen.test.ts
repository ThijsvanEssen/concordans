// The layers (code-eenvoud F96): every request is a named function in $lib/api, the API layer
// knows no presentation, and the generic components know no domain.
import { describe, expect, it } from 'vitest';
import { BRONNEN, overtreders, plek } from '$lib/test/bronnen';

const inApi = (path: string) => path.startsWith('lib/api/');
const OUTSIDE_API = BRONNEN.filter(({ path }) => !inApi(path));

/** An import of the clients themselves, or a request made with them or with `fetch`. */
const ASKS = [
	/import\s*\{[^}]*\b(?:api|slowApi|clientFor)\b[^}]*\}\s*from\s*'\$lib\/api\/client'/,
	/\b(?:api|slowApi)\.(?:GET|POST)\b/,
	/(?<![.\w$])fetch\(/
];

/** The folders of one domain: a part of a page, its data and its words. */
const DOMAIN =
	/from\s*'(?:\$lib\/components\/|\.\.\/)(?:parliamentary|actueel|explore|open|articles|graph)\/|from\s*'\$lib\/(?:verbonden|onderwerpen|netwerk)\//;

/** What the API layer may not lean on: how a bron is shown, or a part of a page. */
const PRESENTATION =
	/from\s*'\$lib\/(?:bron|components|verbonden|search|map|onderwerpen|netwerk|graph|stores|actions)\//;

describe('the layers', () => {
	it('finds what it guards against', () => {
		const asks = (t: string) => ASKS.some((r) => r.test(t));
		expect(asks("import { api, unwrap } from '$lib/api/client';")).toBe(true);
		expect(asks("import {\n\tisTimeout,\n\tslowApi\n} from '$lib/api/client';")).toBe(true);
		expect(asks("unwrap(api.GET('/api/feed'))")).toBe(true);
		expect(asks('const r = await fetch(url);')).toBe(true);
		expect(asks("import { ApiError, isTimeout } from '$lib/api/client';")).toBe(false);
		expect(asks('request = ask(key, signal); getFeed(q);')).toBe(false);
		expect(DOMAIN.test("import X from '$lib/components/parliamentary/CoalitieRegel.svelte';")).toBe(
			true
		);
		expect(DOMAIN.test("import { feedStand } from '../actueel/feed';")).toBe(true);
		expect(DOMAIN.test("import Picto from '$lib/components/ui/Picto.svelte';")).toBe(false);
		expect(PRESENTATION.test("import { naamVan } from '$lib/bron/menselijk';")).toBe(true);
	});

	it('asks the API only in $lib/api: a named function per request, no client or fetch outside it', () => {
		expect(
			overtreders(
				(t) => ASKS.some((r) => r.test(t)),
				[
					plek('lib/test/fakeApi.ts', 'the fake of the clients in the tests'),
					plek('lib/test/opname.ts', 'records answers of the live API for the fixtures')
				],
				OUTSIDE_API
			)
		).toEqual([]);
	});

	it('keeps presentation out of $lib/api', () => {
		expect(
			overtreders(
				(t) => PRESENTATION.test(t),
				[],
				BRONNEN.filter(({ path }) => inApi(path))
			)
		).toEqual([]);
	});

	it('keeps the generic components (ui, tijdlijn, layout) free of a domain', () => {
		const generiek = BRONNEN.filter(({ path }) =>
			/^lib\/components\/(?:ui|tijdlijn|layout)\//.test(path)
		);
		expect(overtreders((t) => DOMAIN.test(t), [], generiek)).toEqual([]);
	});

	it('lets a module outside the components lean on them only where it does now, fewer over time', () => {
		// The words these take from a component folder (kindName, Chamber, dossierStatus, …)
		// move to $lib/text or $lib/bron; a file that no longer needs one comes off this list.
		const NOG = [
			'lib/bron/behoort-rules.ts',
			'lib/bron/herkomst.ts',
			'lib/bron/naam.ts',
			'lib/bron/overweging.ts',
			'lib/bron/preview.ts',
			'lib/fixtures/coalition-votes.ts',
			'lib/map/inhoud.ts',
			'lib/onderwerpen/onderwerpen.ts',
			'lib/onderwerpen/overview-load.ts',
			'lib/onderwerpen/overzicht.ts',
			'lib/search/kamer.ts',
			'lib/search/present.ts',
			'lib/verbonden/document-chamber.ts',
			'lib/verbonden/groups.ts',
			'lib/verbonden/hoe.ts',
			'lib/verbonden/loaders.ts',
			'lib/verbonden/rows.ts'
		];
		const leunt = BRONNEN.filter(
			({ path, text }) =>
				/^lib\/(?!components\/).*\.ts$/.test(path) && /from\s*'\$lib\/components\//.test(text)
		).map(({ path }) => path);
		expect(leunt.sort()).toEqual(NOG);
	});

	it('has one folder of helpers, $lib/util', () => {
		expect(BRONNEN.filter(({ path }) => path.startsWith('lib/utils/'))).toEqual([]);
	});
});
