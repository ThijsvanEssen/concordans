// The anchor of words in a text (O4): made from a selection, found again in four steps, on
// the Kamerstukken of A28 (their `p-` and `s-` places) and on articles with leden and onderdelen.
import { describe, expect, it } from 'vitest';
import papers from '$lib/fixtures/paper-paragraphs-api.json';
import art162 from '$lib/fixtures/article-bwbr0005289_162.json';
import art67 from '$lib/fixtures/article-bwbr0001903_67.json';
import art47 from '$lib/fixtures/article-bwbr0001854_47.json';
import { partsOf } from './article-parts';
import { paperParagraphs, type PaperSource } from './anchor';
import {
	WHOLE_ARTICLE,
	articlePlaces,
	fragmentOf,
	paperPlaces,
	placeText,
	resolve,
	smallestPlace,
	type Places
} from './fragment';

const article = (text: string): Places => articlePlaces(text, partsOf(text, null));
const of = (bron: Places, place: string, words: string, nth = 0) => {
	const t = placeText(bron, place)!;
	let at = -1;
	for (let i = 0; i <= nth; i++) at = t.indexOf(words, at + 1);
	expect(at, words).toBeGreaterThanOrEqual(0);
	return fragmentOf(bron, place, at, at + words.length)!;
};

const BW = art162.article.text;
const bw = article(BW);

describe('the text of a place', () => {
	it('is the text of a lid without its number, its spaces folded', () => {
		expect(placeText(bw, 'lid-2')).toMatch(/^Als onrechtmatige daad worden aangemerkt .*\.$/);
		expect(placeText(bw, 'lid-9')).toBeNull();
		// The article as a whole: its leden after each other, one space between.
		expect(placeText(bw, WHOLE_ARTICLE)).toBe(
			['lid-1', 'lid-2', 'lid-3'].map((l) => placeText(bw, l)).join(' ')
		);
	});

	it('holds the onderdelen of a lid without their letters', () => {
		const sv = article(art67.article.text);
		const lid1 = placeText(sv, 'lid-1')!;
		expect(lid1).toMatch(/^Een bevel tot voorlopige hechtenis .* verdenking van: een misdrijf/);
		expect(lid1).toContain(placeText(sv, 'lid-1-onder-a')!);
		expect(placeText(sv, 'lid-1-onder-a')).toMatch(/^een misdrijf waarop/);
		const sr = article(art47.article.text);
		expect(placeText(sr, 'lid-1-onder-1')).toMatch(/^zij die het feit plegen/);
	});

	it('of a Kamerstuk is an alinea by its anchor, a passage by its section', () => {
		const motie = papers.kst_37020_57 as PaperSource;
		const bron = paperPlaces(motie);
		const alinea = paperParagraphs(motie).find((p) => p.at === 'p-360a090c')!;
		expect(placeText(bron, 'p-360a090c')).toBe(alinea.text);
		const mvt = paperPlaces(papers.kst_32467_14 as PaperSource);
		const passage = placeText(mvt, 's-3')!;
		expect(passage.startsWith('Aanleiding en strekking')).toBe(true);
		// An alinea in a passage: the passage is the smallest place of words over two alineas.
		const lines = paperParagraphs(papers.kst_32467_14 as PaperSource).filter(
			(p) => p.at && p.start >= 1368 && p.start < 5270
		);
		const [a, b] = [placeText(mvt, lines[0].at!)!, placeText(mvt, lines[1].at!)!];
		const at = mvt.text.indexOf(a);
		const end = mvt.text.indexOf(b) + 10;
		expect(smallestPlace(mvt, at + 5, end)?.id).toBe('s-3');
	});
});

describe('a fragment made from a selection', () => {
	it('keeps the words alone where they are one in the place', () => {
		const f = of(bw, 'lid-2', 'ongeschreven recht');
		expect(f).toEqual({ waar: 'lid-2', exact: 'ongeschreven recht', start: f.start });
	});

	it('takes as much before and after as makes repeated words one', () => {
		const f = of(bw, WHOLE_ARTICLE, 'onrechtmatige daad', 1);
		expect(f.prefix).toBeTruthy();
		expect(f.prefix!.length).toBeLessThanOrEqual(32);
		const t = placeText(bw, WHOLE_ARTICLE)!;
		expect(t.split(`${f.prefix}${f.exact}${f.suffix ?? ''}`)).toHaveLength(2);
	});

	it('leaves out the space around the words; none for a selection of spaces', () => {
		const t = placeText(bw, 'lid-3')!;
		const at = t.indexOf(' dader ');
		expect(fragmentOf(bw, 'lid-3', at, at + 7)?.exact).toBe('dader');
		expect(fragmentOf(bw, 'lid-3', at, at + 1)).toBeNull();
		expect(fragmentOf(bw, 'lid-7', 0, 3)).toBeNull();
	});
});

describe('a fragment found again', () => {
	it('step 1: on its position', () => {
		const f = of(bw, 'lid-2', 'rechtvaardigingsgrond');
		expect(resolve(bw, f)).toEqual({
			state: 'found',
			place: 'lid-2',
			start: f.start,
			end: f.start + f.exact.length
		});
	});

	it('step 2: elsewhere in its place, by its prefix and suffix, without a mark', () => {
		const f = of(bw, 'lid-2', 'rechtvaardigingsgrond');
		const changed = article(BW.replace('2. Als onrechtmatige', '2. Voortaan als onrechtmatige'));
		const hit = resolve(changed, f);
		expect(hit.state).toBe('found');
		expect(hit.place).toBe('lid-2');
		if ('start' in hit) expect(hit.start).toBe(f.start + 'Voortaan a'.length - 1);
	});

	it('step 2: of two the one with its context', () => {
		const f = of(bw, WHOLE_ARTICLE, 'onrechtmatige daad', 2);
		const moved = article(
			`1. Vooraf.\n${BW.replace(/^1\./, '2.')
				.replace(/\n2\./, '\n3.')
				.replace(/\n3\. Een/, '\n4. Een')}`
		);
		const hit = resolve(moved, f);
		expect(hit.state).toBe('found');
		if ('start' in hit) {
			const t = placeText(moved, WHOLE_ARTICLE)!;
			expect(t.slice(hit.start - (f.prefix?.length ?? 0), hit.end)).toBe(
				`${f.prefix ?? ''}${f.exact}`
			);
		}
	});

	it('step 3: once in another place, with where it is now', () => {
		const f = of(bw, 'lid-3', 'in het verkeer geldende opvattingen');
		// A lid put in before it: lid 3 is lid 4 now.
		const renumbered = article(
			BW.replace('\n3. Een onrechtmatige', '\n3. Een nieuw lid.\n4. Een onrechtmatige')
		);
		expect(resolve(renumbered, f)).toMatchObject({ state: 'moved', place: 'lid-4' });
	});

	it('step 3: an alinea with a new id is followed', () => {
		const motie = papers.kst_37020_57 as PaperSource;
		const bron = paperPlaces(motie);
		const f = of(bron, 'p-360a090c', 'belastinggeld');
		const renamed = paperPlaces({
			...motie,
			paragraphs: motie.paragraphs!.map((p) =>
				p.id === 'p-360a090c' ? { ...p, id: 'p-11111111' } : p
			)
		});
		expect(resolve(renamed, f)).toMatchObject({ state: 'moved', place: 'p-11111111' });
	});

	it('step 3 does not follow words that stand twice elsewhere', () => {
		const f = of(bw, 'lid-3', 'toegerekend');
		// Lid 3 gone; the words stand in lid 1 and, now, in lid 2.
		const twice = article(
			BW.replace(/\n3\. .*$/, '').replace('rechtvaardigingsgrond.', 'grond die wordt toegerekend.')
		);
		expect(resolve(twice, f).state).toBe('lost');
	});

	it('step 4: through the kept tekstversie, its words changed', () => {
		const f = of(bw, 'lid-2', 'in het maatschappelijk verkeer betaamt');
		const now = article(
			BW.replace('maatschappelijk verkeer betaamt', 'maatschappelijk verkeer past')
		);
		const hit = resolve(now, f, { places: bw, since: '2026-07-01' });
		expect(hit).toMatchObject({ state: 'changed', place: 'lid-2', since: '2026-07-01' });
		if ('start' in hit)
			expect(placeText(now, 'lid-2')!.slice(hit.start, hit.end)).toBe(
				'in het maatschappelijk verkeer past'
			);
	});

	it('step 4: its words struck', () => {
		const f = of(
			bw,
			'lid-2',
			', een en ander behoudens de aanwezigheid van een rechtvaardigingsgrond'
		);
		const now = article(
			BW.replace(', een en ander behoudens de aanwezigheid van een rechtvaardigingsgrond', '')
		);
		expect(resolve(now, f, { places: bw, since: '2026-07-01' })).toEqual({
			state: 'lapsed',
			place: 'lid-2',
			since: '2026-07-01'
		});
	});

	it('found nowhere: said, never a guess at words alike', () => {
		const f = of(bw, 'lid-2', 'ongeschreven recht');
		const now = article(BW.replace('ongeschreven recht', 'ongeschreven regels'));
		expect(resolve(now, f)).toEqual({ state: 'lost', place: 'lid-2' });
		// Kept in a text the page cannot find it in either: nowhere.
		expect(resolve(now, f, { places: now, since: '2026-07-01' }).state).toBe('lost');
	});
});
