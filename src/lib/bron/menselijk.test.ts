import { describe, expect, it } from 'vitest';
import { BRON_LABEL } from '$lib/vocabulary';
import { fractieNaam, isRauw, menselijkeNaam } from './menselijk';

describe('the name of a bron for a reader', () => {
	it('knows a key, an id and a slug when it sees one', () => {
		for (const s of [
			'bwbr0005537_2022_05_01',
			'bwbr0014315',
			'ek_20240402_biza',
			'0ba400a5_a152_4b5b_87ee_18c44a3ebe72',
			'decision_02ed8e6b_b45e_4692',
			'instruments/bwbr0005537'
		])
			expect(isRauw(s), s).toBe(true);
		for (const s of [
			'Algemene wet bestuursrecht',
			'BWBR0005537',
			'ECLI:NL:HR:2019:2006',
			'Kamerstukken 36496, nr. 3',
			'Toezegging TZ202603-117'
		])
			expect(isRauw(s), s).toBe(false);
	});

	it('never gives a key, whatever the collection, with no name in the data', () => {
		const sleutels = [
			'bwbr0005537_2022_05_01',
			'0ba400a5_a152_4b5b_87ee_18c44a3ebe72',
			'ek_20240402_biza',
			'decision_02ed8e6b_b45e_4692_9a70_0f66ff4bf0d4'
		];
		for (const collection of [...Object.keys(BRON_LABEL), 'onbekend'])
			for (const key of sleutels) {
				const leeg = menselijkeNaam({ collection, key });
				const naamIsSleutel = menselijkeNaam({ collection, key, display_name: key, props: {} });
				expect(isRauw(leeg), `${collection} ${leeg}`).toBe(false);
				expect(isRauw(naamIsSleutel), `${collection} ${naamIsSleutel}`).toBe(false);
			}
	});

	it('names each kind the network drew by its key, from its source values', () => {
		expect(
			menselijkeNaam(
				{
					collection: 'instrument_versions',
					key: 'bwbr0005537_2022_05_01',
					props: { bwb_id: 'BWBR0005537', valid_from: '2022-05-01' }
				},
				() => 'Algemene wet bestuursrecht'
			)
		).toBe('Algemene wet bestuursrecht, versie van 1\u00a0mei\u00a02022');
		expect(
			menselijkeNaam({
				collection: 'commitments',
				key: '02bd9062_c94a_429d_a6c9_0ff2218640f4',
				props: { number: 'TZ202603-117' }
			})
		).toBe('Toezegging TZ202603-117');
		expect(
			menselijkeNaam({
				collection: 'activities',
				key: 'ek_20240402_biza',
				props: {
					date: '2024-04-02',
					kind: null,
					agenda_title: 'Commissie voor Binnenlandse Zaken (BIZA)'
				}
			})
		).toBe('Commissie voor Binnenlandse Zaken (BIZA), 2\u00a0april\u00a02024');
		expect(
			menselijkeNaam({
				collection: 'instruments',
				key: 'bwbr0049889',
				props: { bwb_id: 'BWBR0049889', citation_title: 'Wet betaalbare huur' }
			})
		).toBe('Wet betaalbare huur');
		expect(menselijkeNaam({ collection: 'annexes', key: 'bwbr0005537_annex_1', props: {} })).toBe(
			'Bijlage'
		);
		expect(
			menselijkeNaam({
				collection: 'annexes',
				key: 'bwbr0005537_annex_2',
				props: { label: '2', title: 'Bevoegdheidsregeling bestuursrechtspraak' }
			})
		).toBe('Bijlage 2: Bevoegdheidsregeling bestuursrechtspraak');
	});

	it('names a version, a zaak and a bijlage by what props=canvas gives (API 0.79.43)', () => {
		const versie = (props: Record<string, unknown>) =>
			menselijkeNaam({ collection: 'instrument_versions', key: 'bwbr0005537_2022_05_01', props });
		const awb = { bwb_id: 'BWBR0005537', instrument_citation_title: 'Awb' };
		expect(versie({ ...awb, valid_from: '2022-05-01', current: true })).toBe(
			'Awb, geldende versie sinds 1\u00a0mei\u00a02022'
		);
		expect(
			versie({ ...awb, valid_from: '2021-01-01', valid_until: '2022-04-30', current: false })
		).toBe('Awb, versie van 1\u00a0januari\u00a02021 tot 30\u00a0april\u00a02022');
		expect(
			menselijkeNaam({ collection: 'cases', key: '81311fd5_88d6', props: { number: '2025Z15468' } })
		).toBe('Zaak 2025Z15468');
		expect(
			menselijkeNaam({
				collection: 'annexes',
				key: 'bwbr0002741_annex_ii',
				props: { bwb_id: 'BWBR0002741', label: 'II', title: 'Lijst van gevaarlijke stoffen' }
			})
		).toBe('Bijlage II: Lijst van gevaarlijke stoffen');
		// "Annex II" is the data's word, not a heading: the bijlage by its number alone (#30).
		expect(
			menselijkeNaam({
				collection: 'annexes',
				key: 'bwbr0002741_annex_ii',
				display_name: 'Annex II',
				props: { bwb_id: 'BWBR0002741', label: 'II', title: null }
			} as never)
		).toBe('Bijlage II');
		// As its heading prints it (API 0.80.1): its name once, a list of the Opiumwet a Lijst.
		const printed = (display_name: string, title: string | null = null) =>
			menselijkeNaam({
				collection: 'annexes',
				key: 'x',
				display_name,
				props: { label: 'I', title }
			} as never);
		expect(printed('Bijlage 1')).toBe('Bijlage 1');
		expect(printed('Lijst I')).toBe('Lijst I');
		expect(printed('Bijlage 2', 'Bevoegdheidsregeling')).toBe('Bijlage 2: Bevoegdheidsregeling');
	});
});

describe('fractieNaam', () => {
	it('names a fractie by its abbreviation, its name where it has none, never its key', () => {
		expect(
			fractieNaam({
				key: 'nieuw_sociaal_contract',
				abbreviation: 'NSC',
				name: 'Nieuw Sociaal Contract'
			})
		).toBe('NSC');
		expect(
			fractieNaam({
				key: 'nieuw_sociaal_contract',
				abbreviation: ' ',
				name: 'Nieuw Sociaal Contract'
			})
		).toBe('Nieuw Sociaal Contract');
		expect(fractieNaam({ key: 'nieuw_sociaal_contract' })).not.toContain('nieuw_sociaal_contract');
	});
});
