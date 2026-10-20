// The Bundel of the start page: a research question kept with an article, a judgment and
// a note, as a shared link (/bundels#m=…, $lib/map/share). The card shows the link and
// lines of start.json; this keeps them equal to the bundel the link holds.
import { describe, expect, it } from 'vitest';
import { sharedOfFragment } from '$lib/map/share';
import { bewaarItem, itemHref, type Map } from '$lib/map/map';
import { START } from './start';

const EXAMPLE_BUNDLE: Pick<Map, 'naam' | 'notitie' | 'volgorde' | 'groepNotities' | 'items'> = {
	naam: 'Aansprakelijkheid werkgever thuiswerk',
	notitie: 'Vraag: valt een RSI-klacht bij thuiswerk onder art. 7:658 BW?',
	volgorde: 'groep',
	groepNotities: {},
	items: [
		{
			...bewaarItem(
				'articles/bwbr0005290_658',
				{
					kort: 'art. 7:658 lid 1 BW',
					voluit: 'artikel 7:658 lid 1 Burgerlijk Wetboek',
					at: 'lid-1'
				},
				{ wet: 'BWBR0005290', groep: 'Burgerlijk Wetboek Boek 7' }
			),
			notitie: 'Zorgplicht, ook thuis?'
		},
		bewaarItem(
			'articles/bwbr0005290_611',
			{ kort: 'art. 7:611 BW', voluit: 'artikel 7:611 Burgerlijk Wetboek' },
			{ wet: 'BWBR0005290', groep: 'Burgerlijk Wetboek Boek 7' }
		),
		bewaarItem(
			'judgments/ecli_nl_hr_2005_au3313',
			{ kort: 'HR 11 november 2005, ECLI:NL:HR:2005:AU3313' },
			{ groep: 'HR 11 november 2005' }
		)
	]
};

/** An article's readable address, which its key alone does not give (7:658 is in the key 658). */
const ARTICLE_PADS: Record<string, string> = {
	'articles/bwbr0005290_658': '/wetten/BWBR0005290/artikel/7:658',
	'articles/bwbr0005290_611': '/wetten/BWBR0005290/artikel/7:611'
};

/** The bundel's lines as its card shows them: each kept bron by its citation, to its readable place. */
const exampleLines = () =>
	EXAMPLE_BUNDLE.items.map((item) => ({
		collection: item.id.startsWith('judgments/') ? 'judgments' : 'articles',
		label: item.kort,
		href: itemHref({ ...item, pad: ARTICLE_PADS[item.id] ?? item.pad })
	}));

describe('the Bundel of the start page', () => {
	// Not the compressed string itself: deflate output differs between zlib builds (CI against a Mac).
	it('opens whole: every item reads back', async () => {
		const shared = await sharedOfFragment(new URL(START.bundle.href, 'https://x.nl').hash);
		expect(shared).toMatchObject({
			naam: EXAMPLE_BUNDLE.naam,
			notitie: EXAMPLE_BUNDLE.notitie,
			items: EXAMPLE_BUNDLE.items,
			skipped: 0
		});
	});

	it('shows the bundel the link holds: its name, lines and first note', () => {
		expect(START.bundle.title).toBe(EXAMPLE_BUNDLE.naam);
		expect(START.bundle.lines).toEqual(exampleLines());
		expect(START.bundle.note).toBe(EXAMPLE_BUNDLE.items[0].notitie);
	});

	it('links each line to its readable address, not to /explore?focus= (a 301)', () => {
		expect(START.bundle.lines.map((l) => l.href)).toEqual([
			'/wetten/BWBR0005290/artikel/7:658#lid-1',
			'/wetten/BWBR0005290/artikel/7:611',
			'/uitspraken/ECLI:NL:HR:2005:AU3313'
		]);
	});
});
