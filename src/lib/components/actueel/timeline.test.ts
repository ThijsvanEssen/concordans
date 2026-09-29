import { describe, expect, it } from 'vitest';
import type { FeedItem } from './feed';
import { commitmentTitle, dayLines, dossierName, inWords, surname, timelineOf } from './timeline';

let n = 0;
const item = (over: Partial<FeedItem>): FeedItem =>
	({
		id: `x/${++n}`,
		kind: 'motie',
		date: '2026-09-22',
		title: null,
		summary: null,
		subkind: null,
		node: { collection: 'documents', key: `k${n}` },
		dossier: null,
		persons: [],
		...over
	}) as FeedItem;

const vote = (voor: number, tegen: number, over: Partial<FeedItem> = {}) =>
	item({
		kind: 'stemming',
		subkind: 'motie',
		node: { collection: 'decisions', key: `d${n}` } as FeedItem['node'],
		vote: {
			passed: voor > tegen,
			outcome: voor > tegen ? 'aangenomen' : 'verworpen',
			tally: { Voor: voor, Tegen: tegen }
		} as FeedItem['vote'],
		...over
	});

describe('surname', () => {
	it('drops initials and a first name written out', () => {
		expect(surname('P.A. Grinwis')).toBe('Grinwis');
		expect(surname('D.J. van den Berg')).toBe('Van den Berg');
		expect(surname('Hans Vijlbrief')).toBe('Vijlbrief');
		expect(surname('I. (Inge) van Dijk')).toBe('Van Dijk');
	});
});

describe('dossierName', () => {
	it('takes the short title, the name in brackets, or the law a bill changes', () => {
		expect(
			dossierName({ key: 'a', number: '37014', short_title: 'Wet weerbare waarden' } as never)
		).toBe('Wet weerbare waarden');
		expect(
			dossierName({
				key: 'b',
				number: '36889',
				title: 'Wijziging van de Archiefwet 1995 ter verruiming van de mogelijkheden'
			} as never)
		).toBe('Archiefwet 1995');
		expect(
			dossierName({
				key: 'c',
				number: '36892',
				title: 'Wijziging van de Gemeentewet, de Provinciewet en de Waterschapswet'
			} as never)
		).toBe('Gemeentewet');
	});
});

describe('inWords', () => {
	it('writes small numbers out', () => {
		expect(inWords(6)).toBe('zes');
		expect(inWords(14)).toBe('14');
	});
});

describe('commitmentTitle', () => {
	it('names the bewindspersoon in place of De minister', () => {
		expect(
			commitmentTitle(
				item({
					kind: 'toezegging',
					summary: 'De minister komt in de startbrief terug op het nabestaandenpensioen.',
					persons: [{ name: 'Hans Vijlbrief' } as never]
				})
			)
		).toBe('Minister Vijlbrief komt in de startbrief terug op het nabestaandenpensioen.');
	});
});

describe('dayLines', () => {
	it('shows few votes each on their own, in plain words', () => {
		const [line] = dayLines('2026-09-23', [
			vote(141, 7, {
				title: 'Gewijzigde motie van het lid Grinwis over steward ownership',
				persons: [
					{
						name: 'P.A. Grinwis',
						role: 'indiener',
						faction: { key: 'cu', short: 'ChristenUnie' }
					} as never
				],
				dossier: { key: 'd', number: '21501-30' } as never
			})
		]);
		expect(line.title).toBe('Kamer neemt motie-Grinwis aan over steward ownership');
		expect(line.context).toBe('141 voor, 7 tegen. ChristenUnie, dossier 21501-30');
		expect(line.major).toBe(true);
	});

	it('bundles a day of votes, with the bills and the close ones on their own', () => {
		const bills = ['36889', '36899'].map((number) =>
			vote(100, 50, {
				subkind: 'wetsvoorstel',
				dossier: {
					key: number,
					number,
					title: `Wijziging van de Wet ${number} in verband met iets`
				} as never
			})
		);
		const lines = dayLines('2026-09-22', [
			...bills,
			vote(75, 75, {
				title: 'Motie van het lid Schilder over strafverzwaring',
				persons: [{ name: 'J.M.M. Schilder', role: 'indiener' } as never]
			}),
			vote(120, 30),
			vote(20, 130),
			vote(90, 60, { subkind: 'amendement' })
		]);
		expect(lines.map((l) => l.title)).toEqual([
			'Kamer neemt twee wetsvoorstellen aan',
			'Kamer verwerpt motie-Schilder over strafverzwaring',
			'Kamer stemt over 3 moties: 1 aangenomen, 2 verworpen'
		]);
		expect(lines[0].context).toBe('Wet 36889 en Wet 36899');
		expect(lines[1].failed).toBe(true);
		expect(lines[2].context).toBe('Ook 1 amendement');
		expect(lines[2].href).toBe('/actueel?van=2026-09-22&tot=2026-09-22&soort=stemming');
	});

	it('bundles the moties of a day and names their largest dossiers', () => {
		const d = (number: string, short: string) =>
			({ key: number, number, short_title: short }) as never;
		const lines = dayLines('2026-09-24', [
			item({ dossier: d('21501-32', 'Landbouw- en Visserijraad') }),
			item({ dossier: d('21501-32', 'Landbouw- en Visserijraad') }),
			item({ dossier: d('30234', 'Toekomstig sportbeleid') })
		]);
		expect(lines).toHaveLength(1);
		expect(lines[0].title).toBe('3 moties ingediend');
		expect(lines[0].context).toBe('Landbouw- en Visserijraad en Toekomstig sportbeleid');
		expect(lines[0].major).toBe(false);
	});

	it('names the dossier and the submitters when all papers are on one', () => {
		const d = { key: '36922', number: '36922', short_title: 'Studievoorschot' } as never;
		const [line] = dayLines('2026-09-23', [
			item({
				kind: 'amendement',
				dossier: d,
				persons: [{ key: 'b', name: 'S.M. Beckerman', faction: { short: 'SP' } } as never]
			}),
			item({
				kind: 'amendement',
				dossier: d,
				persons: [{ key: 'e', name: 'D.A. Ergin', faction: { short: 'DENK' } } as never]
			})
		]);
		expect(line.title).toBe('2 amendementen bij Studievoorschot');
		expect(line.context).toBe('Beckerman (SP) en Ergin (DENK)');
	});
});

describe('timelineOf', () => {
	it('takes whole days, newest first, up to the limit', () => {
		const lines = timelineOf(
			[
				item({
					date: '2026-09-17',
					kind: 'wetsvoorstel',
					dossier: { key: 'w', number: '37014', short_title: 'Wet weerbare waarden' } as never
				}),
				item({ date: '2026-09-24' })
			],
			10
		);
		expect(lines.map((l) => l.title)).toEqual([
			'Motie',
			'Wetsvoorstel ingediend: Wet weerbare waarden'
		]);
	});

	it('keeps what matters of the last day before its bundles', () => {
		const lines = timelineOf(
			[
				item({ date: '2026-09-22', kind: 'brief_regering', title: 'Brief' }),
				item({
					date: '2026-09-22',
					kind: 'toezegging',
					summary: 'De minister stuurt een brief.',
					persons: [{ name: 'Hans Vijlbrief' } as never]
				})
			],
			1
		);
		expect(lines.map((l) => l.title)).toEqual(['Minister Vijlbrief stuurt een brief.']);
	});
});

describe('kamerstukken', () => {
	it('counts the moties, amendementen and nota’s of a day in one line', () => {
		const d = { key: '36922', number: '36922', short_title: 'Studievoorschot' } as never;
		const lines = dayLines('2026-09-23', [
			item({ dossier: d }),
			item({ dossier: d }),
			item({ kind: 'amendement', dossier: d }),
			item({ kind: 'nota_van_wijziging' })
		]);
		expect(lines).toHaveLength(1);
		expect(lines[0].title).toBe('Ingediend: 2 moties, 1 amendement en 1 nota van wijziging');
		expect(lines[0].context).toBe('Studievoorschot');
	});
});

describe('subjects and names', () => {
	it('leaves out the paper a motie replaces, and names a begroting', () => {
		const [line] = dayLines('2026-09-23', [
			vote(141, 7, {
				title: 'Gewijzigde motie van het lid Grinwis over steward ownership (t.v.v. 21501-30-712)'
			})
		]);
		expect(line.title).toBe('Kamer neemt motie aan over steward ownership');
		expect(
			dossierName({
				key: 'b',
				number: '37020-IV',
				title:
					'Vaststelling van de begrotingsstaten van Koninkrijksrelaties (IV) en het BES-fonds (H) voor het jaar 2027'
			} as never)
		).toBe('Begroting Koninkrijksrelaties');
	});
});
