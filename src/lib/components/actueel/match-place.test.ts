import { describe, expect, it } from 'vitest';
import { getoondOnder, plekVan, termenVan } from './match-place';
import { normalizeItem, type FeedItem } from './feed';
import { headlineOf } from './home-stream';

const DOSSIER_36875 = {
	key: '36875',
	number: '36875',
	title:
		'Uitvoering van Verordening (EU) 2024/2847 van het Europees Parlement en de Raad van 23\u00a0oktober\u00a02024 inzake horizontale cyberbeveiligingsvereisten voor producten met digitale elementen (cyberweerbaarheidsverordening)',
	short_title: 'Uitvoeringswet verordening cyberweerbaarheid'
};

const item = (extra: Record<string, unknown>): FeedItem =>
	normalizeItem({
		kind: 'toezegging',
		date: '2026-09-11',
		node: { collection: 'commitments', key: 'k' },
		headline: {},
		...extra
	} as never);

const tekst = (p: ReturnType<typeof plekVan>) => p?.delen.map((d) => d.tekst).join('');

describe('why a row is in a followed topic', () => {
	it('says the dossier’s title where only that holds the word (36875, cyberbeveiliging)', () => {
		const i = item({
			summary:
				'Een terugkoppeling van gesprekken over cyberveiligheid BES-eilanden ontvangt de Kamer.',
			title: 'Een terugkoppeling van gesprekken over cyberveiligheid BES-eilanden…',
			dossier: DOSSIER_36875
		});
		const p = plekVan(['cyberbeveiliging'], i, [headlineOf(i).title, ...getoondOnder(i)]);
		expect(p?.waar).toBe('In dossier');
		expect(p?.delen.find((d) => d.mark)?.tekst).toBe('cyberbeveiliging');
		expect(tekst(p)).toContain('horizontale cyberbeveiligingsvereisten');
	});

	it('says nothing where the row shows the word: it is marked there', () => {
		const i = item({
			kind: 'inwerkingtreding',
			node: { collection: 'instrument_versions', key: 'bwbr0052872_2026_08_15' },
			title: 'Cyberbeveiligingswet',
			commencement: { instrument: { key: 'bwbr0052872', title: 'Cyberbeveiligingswet' } }
		});
		expect(plekVan(['cyberbeveiliging'], i, [headlineOf(i).title, ...getoondOnder(i)])).toBeNull();
		// The dossier's name under the row holds it.
		const j = item({
			summary: 'Iets anders.',
			dossier: { ...DOSSIER_36875, short_title: 'Cyberbeveiliging' }
		});
		expect(getoondOnder(j)).toEqual(['Dossier 36875 Cyberbeveiliging']);
		expect(plekVan(['cyberbeveiliging'], j, [headlineOf(j).title, ...getoondOnder(j)])).toBeNull();
	});

	it('names the text of a toezegging, the title of another kind, before the dossier', () => {
		const lang = `${'De minister zegt toe de Kamer te informeren over de voortgang. '.repeat(4)}Ook over de huurtoeslag.`;
		const t = item({ summary: lang, title: lang.slice(0, 80), dossier: DOSSIER_36875 });
		expect(plekVan(['huurtoeslag'], t, ['De minister zegt toe…'])?.waar).toBe('In de tekst');
		const m = item({
			kind: 'Motie',
			node: { collection: 'documents', key: 'm' },
			title: 'Motie van het lid Straatman over criminele vreemdelingen',
			dossier: DOSSIER_36875
		});
		expect(plekVan(['vreemdeling'], m, ['Motie-Straatman'])?.waar).toBe('In de titel');
	});

	it('says nothing without words, or where the feed does not give the text that holds them', () => {
		const i = item({ summary: 'Tekst.', dossier: DOSSIER_36875 });
		expect(plekVan([], i, ['Tekst.'])).toBeNull();
		expect(plekVan(['huur'], i, ['Tekst.'])).toBeNull();
	});

	it('goes by where the API found the word (`matched`, API 0.79.55)', () => {
		// The API found it in the dossier's title: the excerpt, though the row's title holds a
		// word the front end alone would take for it.
		const i = item({
			summary: 'Een terugkoppeling over cyberbeveiliging-light.',
			title: 'Een terugkoppeling…',
			dossier: DOSSIER_36875,
			matched: [{ term: 'cyberbeveiliging', field: 'dossier_title' }]
		});
		expect(plekVan(['cyberbeveiliging'], i, ['Een terugkoppeling…'])?.waar).toBe('In dossier');
		// In the names of a publication's laws: marked there, no line.
		const p = item({
			kind: 'publicatie',
			node: { collection: 'instruments', key: 'stb_2026_187' },
			title: 'Stb. 2026, 187',
			publication: {
				instruments: [{ key: 'bwbr0052872', title: 'Cyberbeveiligingswet', effect: 'establishes' }]
			},
			matched: [{ term: 'Cyberbeveiligingswet', field: 'laws' }]
		});
		expect(plekVan(['Cyberbeveiligingswet'], p, ['Stb. 2026, 187'])).toBeNull();
		expect(termenVan(['cyber'], p)).toEqual(['Cyberbeveiligingswet']);
		expect(termenVan(['cyber'], {})).toEqual(['cyber']);
	});
});
