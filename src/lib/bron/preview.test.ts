import { describe, expect, it } from 'vitest';
import { fail, fakeApi, slow } from '$lib/test/fakeApi';
import {
	PREVIEW_CHARS,
	eersteZin,
	indieners,
	loadPreview,
	previewFromNode,
	uitslagVan
} from './preview';

describe('previewFromNode', () => {
	it('shows a judgment by its court, date and the first sentence of its summary', () => {
		const p = previewFromNode('judgments', 'Hoge Raad 2019-07-19 / 18/04298', {
			court_code: 'HR',
			date: '2019-07-19',
			summary: 'Prejudiciële vraag (art. 392 Rv). Aardbevingsschade.'
		});
		expect(p.kicker).toBe('Uitspraak, Hoge Raad');
		expect(p.date).toBe('19\u00a0juli\u00a02019');
		expect(p.lines).toBe('Prejudiciële vraag (art. 392 Rv).');
	});

	it('names a judgment as its heading does, without an ISO date', () => {
		const p = previewFromNode(
			'judgments',
			'Hoge Raad 2026-08-25 / 24/01299',
			{ ecli: 'ECLI:NL:HR:2026:1357', court: 'Hoge Raad', date: '2026-08-25' },
			{
				short: 'HR 25\u00a0augustus\u00a02026',
				full: 'HR 25\u00a0augustus\u00a02026, ECLI:NL:HR:2026:1357'
			}
		);
		expect(p.title).toBe('HR 25\u00a0augustus\u00a02026');
		expect(p.date).toBeNull();
		const named = previewFromNode(
			'judgments',
			'Hoge Raad 2019-12-20 / 19/00135',
			{
				ecli: 'ECLI:NL:HR:2019:2006',
				court: 'Hoge Raad',
				date: '2019-12-20',
				names: ['Urgenda']
			},
			{
				short: 'HR 20\u00a0december\u00a02019',
				full: 'HR 20\u00a0december\u00a02019, ECLI:NL:HR:2019:2006'
			}
		);
		expect(named.title).toBe('HR 20\u00a0december\u00a02019 (Urgenda)');
	});

	it('names a stemming and an activity without an ISO date', () => {
		const vote = previewFromNode(
			'decisions',
			'Eerste Kamer 2026-09-29: Wet toekomstbestendige huurcommissie (36.791)',
			{ subject: 'Wet toekomstbestendige huurcommissie', chamber: 'EK', date: '2026-09-29' }
		);
		expect(vote.title).toBe(
			'Eerste Kamer, 29\u00a0september\u00a02026: Wet toekomstbestendige huurcommissie'
		);
		const activity = previewFromNode('activities', 'Stemmingen (2026-09-29)', {
			kind: 'Stemmingen',
			date: '2026-09-29'
		});
		expect([activity.title, activity.date]).toEqual(['Stemmingen', '29\u00a0september\u00a02026']);
		for (const t of [vote.title, activity.title]) expect(t).not.toMatch(/\d{4}-\d{2}-\d{2}|\u00b7/);
	});

	it('shows a dossier by its number, title and where it stands', () => {
		const p = previewFromNode('dossiers', null, {
			label: '34372',
			title: 'Wijziging van het Wetboek van Strafrecht',
			outcome: 'aangenomen'
		});
		expect([p.kicker, p.title, p.lines]).toEqual([
			'Dossier, Dossier 34372',
			'Wijziging van het Wetboek van Strafrecht',
			'Aangenomen'
		]);
	});

	it('names a BW article by its book and cuts long text', () => {
		expect(previewFromNode('articles', 'Artikel 162 Burgerlijk Wetboek Boek 6', {}).title).toBe(
			'Artikel 6:162 BW'
		);
		const long = previewFromNode('judgments', 'x', { summary: 'a'.repeat(PREVIEW_CHARS + 50) });
		expect(long.lines!.length).toBe(PREVIEW_CHARS);
		expect(long.lines!.endsWith('…')).toBe(true);
	});

	it('places a stuk by its dossier and its indieners', () => {
		const p = previewFromNode('documents', null, {
			kind: 'Amendement (gewijzigd/nader/vervangend)',
			number: '66',
			title: 'Gewijzigd amendement van het lid Madlener',
			date: '2024-04-24',
			dossier_number: '36496',
			dossier_title: 'Wijziging van de Wet goed verhuurderschap (Wet betaalbare huur)',
			actors: [
				{ name: 'H. de Jong', faction: 'GL-PvdA', role: 'Medeondertekenaar' },
				{ name: 'B. Madlener', faction: 'PVV', role: 'Eerste ondertekenaar' }
			]
		});
		expect(p.kicker).toBe('Amendement, nr. 66');
		expect(p.date).toBe('24\u00a0april\u00a02024');
		expect(p.dossier).toBe(
			'Dossier 36496 Wijziging van de Wet goed verhuurderschap (Wet betaalbare huur)'
		);
		expect(p.wie).toBe('Ingediend door B. Madlener (PVV), mede namens H. de Jong (GL-PvdA)');
	});
});

describe('preview helpers', () => {
	it('takes the first sentence past the usual abbreviations', () => {
		expect(eersteZin('Onrechtmatige daad (art. 6:162 BW). Causaal verband.')).toBe(
			'Onrechtmatige daad (art. 6:162 BW).'
		);
		expect(eersteZin('Zie r.o. 4.3 en mr. Jansen. Tweede zin.')).toBe(
			'Zie r.o. 4.3 en mr. Jansen.'
		);
		expect(eersteZin('Eén zin zonder punt')).toBe('Eén zin zonder punt');
	});

	it('names the indieners and the vote as the source gives them', () => {
		expect(indieners([{ name: 'B. Madlener', faction: 'PVV', role: 'Eerste ondertekenaar' }])).toBe(
			'Ingediend door B. Madlener (PVV)'
		);
		expect(indieners([])).toBeNull();
		expect(uitslagVan({ decision_text: 'Aangenomen.', tally: { Voor: 137, Tegen: 13 } })).toBe(
			'Aangenomen, 137 voor en 13 tegen'
		);
		expect(uitslagVan({ passed: true, tally: { Voor: 150 } })).toBe(
			'Aangenomen, 150 voor en 0 tegen'
		);
		expect(uitslagVan({ passed: true, tally: { Voor: 0, Tegen: 0 } })).toBe('Aangenomen');
		expect(uitslagVan({ passed: false })).toBe('Verworpen');
		expect(uitslagVan({})).toBeNull();
	});
});

describe('loadPreview', () => {
	const node = {
		node: { collection: 'commitments', key: 'c1', display_name: 'Toezegging', props: {} },
		neighbors: { total: 0, buckets: [] }
	};

	it('asks again after a failure, instead of keeping no card for the session', async () => {
		const answers: unknown[] = [slow(), node];
		const fake = fakeApi({ '/api/nodes/{collection}/{key}': () => answers.shift() });
		await expect(loadPreview('commitments/c1')).rejects.toMatchObject({ name: 'TimeoutError' });
		expect((await loadPreview('commitments/c1'))?.title).toBe('Toezegging');
		expect(fake.asked('/api/nodes/{collection}/{key}')).toHaveLength(2);
	});

	it('gives no card for a bron the API does not have (404)', async () => {
		fakeApi({ '/api/nodes/{collection}/{key}': fail(404) });
		expect(await loadPreview('commitments/c2')).toBeNull();
	});
});

describe('the card of an article', () => {
	it('shows the part the API numbers, not what the text seems to hold', async () => {
		const text = 'Bij algemene maatregel van bestuur.\nDeze regels gelden voor elk orgaan.';
		fakeApi({
			'/api/nodes/{collection}/{key}': {
				node: {
					collection: 'articles',
					key: 'a1',
					display_name: 'Artikel 3',
					props: { bwb_id: 'BWBR0000001', article_number: '3' }
				},
				neighbors: { total: 0, buckets: [] }
			},
			'/api/articles/{bwb_id}/{article_number}': {
				article: {
					text,
					parts: [{ id: 'lid-1', kind: 'lid', number: null, start: 36, end: text.length }]
				}
			}
		});
		expect((await loadPreview('articles/a1'))?.lines).toBe('Deze regels gelden voor elk orgaan.');
	});
});
