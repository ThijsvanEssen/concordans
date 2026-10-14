import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { boxesOf, stand } from './stand';

const dossier = (phases: { name: string; done: boolean; date?: string }[], over: object = {}) =>
	({
		number: '36799',
		current_phase: 'Stemmingen',
		phases,
		...over
	}) as unknown as Schema<'DossierSummaryDTO'>;

describe('stand', () => {
	it('takes a phase as done only where the source marks it (BE-27)', () => {
		const d = dossier([
			{ name: 'Advies Raad van State', done: false },
			{ name: 'Verslag', done: true },
			{ name: 'Stemmingen', done: true }
		]);
		expect(stand(d)?.bodies[0].state).toBe('unknown');
	});

	it('gives the Raad van State its advice where the source has it', () => {
		const d = dossier([
			{ name: 'Advies Raad van State', done: true },
			{ name: 'Verslag', done: false }
		]);
		expect(stand(d)?.bodies[0].state).toBe('done');
	});
});

describe('stand: the phase and the day as data', () => {
	it('gives the phase in its sentence form and its day, besides the sentence', () => {
		const d = dossier([{ name: 'Nota n.a.v. het verslag', done: true, date: '2026-03-12' }], {
			current_phase: 'Nota n.a.v. het verslag'
		});
		expect(stand(d)).toMatchObject({
			zin: 'Bij de Tweede Kamer: nota naar aanleiding van het verslag, 12 mrt. 2026.',
			group: 'tk',
			phase: 'nota naar aanleiding van het verslag',
			date: '2026-03-12'
		});
	});

	it('gives the day of submission for a bill that is submitted', () => {
		const d = dossier(
			[
				{ name: 'Voorstel van wet', done: true, date: '2025-01-10' },
				{ name: 'Advies Raad van State', done: true, date: '2024-11-02' }
			],
			{ current_phase: 'Advies Raad van State' }
		);
		expect(stand(d)).toMatchObject({
			zin: 'Ingediend bij de Tweede Kamer op 10 jan. 2025, met advies van de Raad van State.',
			group: 'ingediend',
			phase: null,
			date: '2025-01-10'
		});
	});

	it('names how the Eerste Kamer decided in the sentence', () => {
		const ek = (method: string | null) =>
			stand(
				dossier([], {
					tk_decision: { kind: 'Stemmen - aangenomen', date: '2024-03-05' },
					ek_outcome: { outcome: 'Aangenomen', date: '2024-06-25', method }
				})
			)?.zin;
		expect(ek('Hamerstuk')).toBe('Aangenomen door de Eerste Kamer als hamerstuk, 25 jun. 2024.');
		expect(ek('Stemming bij zitten en opstaan, aangenomen')).toBe(
			'Aangenomen door de Eerste Kamer bij zitten en opstaan, 25 jun. 2024.'
		);
		expect(ek('Hoofdelijke stemming, aangenomen')).toBe(
			'Aangenomen door de Eerste Kamer, 25 jun. 2024.'
		);
	});
});

describe('boxesOf: the three boxes of the bar', () => {
	type Row = [string, Schema<'DossierSummaryDTO'>, [string, string, string][]];
	const rows: Row[] = [
		[
			'in behandeling bij de Tweede Kamer, without advice in the data',
			dossier([{ name: 'Verslag', done: true, date: '2026-03-12' }], {
				current_phase: 'Verslag'
			}),
			[
				['open', 'Advies', 'Niet in de gegevens'],
				['nu', 'In behandeling', 'Verslag, 12 mrt. 2026'],
				['open', 'Nog niet', 'Na de Tweede Kamer']
			]
		],
		[
			'ingediend, with advice',
			dossier(
				[
					{ name: 'Voorstel van wet', done: true, date: '2025-01-10' },
					{ name: 'Advies Raad van State', done: true, date: '2024-11-02' }
				],
				{ current_phase: 'Advies Raad van State' }
			),
			[
				['klaar', 'Advies', 'Uitgebracht, 2 nov. 2024'],
				['nu', 'Ingediend', '10 jan. 2025'],
				['open', 'Nog niet', 'Na de Tweede Kamer']
			]
		],
		[
			'aangenomen zonder stemming, at the Eerste Kamer',
			dossier([{ name: 'Advies Raad van State', done: true }], {
				tk_decision: { kind: 'Stemmen - zonder stemming aannemen', date: '2026-09-29' },
				senate: { document_count: 0, progress: [], status: 'Plenaire behandeling' }
			}),
			[
				['klaar', 'Advies', 'Uitgebracht'],
				['ja', 'Aangenomen', '29 sep. 2026, zonder stemming'],
				['nu', 'In behandeling', 'Plenaire behandeling']
			]
		],
		[
			'aangenomen by the final text alone',
			dossier([{ name: 'Eindtekst', done: true, date: '2026-05-04' }], {
				current_phase: 'Eindtekst'
			}),
			[
				['open', 'Advies', 'Niet in de gegevens'],
				['ja', 'Aangenomen', '4 mei 2026'],
				['nu', 'In behandeling', 'Sinds aanneming door de Tweede Kamer']
			]
		],
		[
			'verworpen by the Tweede Kamer',
			dossier([], { outcome: 'verworpen', closed: true, closed_on: '2024-02-01' }),
			[
				['open', 'Advies', 'Niet in de gegevens'],
				['nee', 'Verworpen', '1 feb. 2024'],
				['open', 'Niet aan de orde', 'Verworpen door de Tweede Kamer']
			]
		],
		[
			'a hamerstuk in the Eerste Kamer',
			dossier([], {
				tk_decision: { kind: 'Stemmen - aangenomen', date: '2024-03-05' },
				ek_outcome: { outcome: 'Aangenomen', date: '2024-06-25', method: 'Hamerstuk' }
			}),
			[
				['open', 'Advies', 'Niet in de gegevens'],
				['ja', 'Aangenomen', '5 mrt. 2024'],
				['ja', 'Aangenomen', '25 jun. 2024, hamerstuk']
			]
		],
		[
			'verworpen by the Eerste Kamer, sitting and standing',
			dossier([], {
				tk_decision: { kind: 'Stemmen - aangenomen', date: '2024-03-05' },
				ek_outcome: {
					outcome: 'Verworpen',
					date: '2024-06-25',
					method: 'Stemming bij zitten en opstaan, verworpen'
				}
			}),
			[
				['open', 'Advies', 'Niet in de gegevens'],
				['ja', 'Aangenomen', '5 mrt. 2024'],
				['nee', 'Verworpen', '25 jun. 2024, zitten en opstaan']
			]
		],
		[
			'afgehandeld without an outcome',
			dossier([], { closed: true, closed_on: '2023-10-03', current_phase: 'Verslag' }),
			[
				['open', 'Advies', 'Niet in de gegevens'],
				['nu', 'In behandeling', '3 okt. 2023'],
				['open', 'Nog niet', 'Na de Tweede Kamer']
			]
		]
	];

	it.each(rows)('%s', (_, d, expected) => {
		const boxes = boxesOf(d);
		expect(boxes.map((b) => b.body)).toEqual(['Raad van State', 'Tweede Kamer', 'Eerste Kamer']);
		expect(boxes.map((b) => [b.mark, b.word, b.line])).toEqual(expected);
	});

	it('has no boxes without a stand', () => {
		expect(boxesOf(dossier([], { current_phase: null }))).toEqual([]);
	});
});
