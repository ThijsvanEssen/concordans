import { describe, expect, it } from 'vitest';
import { buildNodeLabel } from '$lib/graph/types';
import { ecliTail, distinctNames } from './canvas-names';

/** A Memorie van toelichting of dossier `d`, as a neighbourhood with `props=canvas` gives it. */
const mvt = (d: string, suffix: string | null = null) => ({
	id: `documents/mvt-${d}`,
	collection: 'documents',
	key: `mvt-${d}`,
	raw: {
		props: {
			kind: 'Memorie van toelichting',
			dossier_number: d,
			dossier_suffix: suffix,
			sequence: 3
		}
	}
});

const uitspraak = (key: string, short: string) => ({
	id: `judgments/${key}`,
	collection: 'judgments',
	key,
	raw: { props: {} },
	short
});

describe('onderscheiden', () => {
	it('tells seven judgments of one court on one day apart by their ECLI (BH2815, N4)', () => {
		const sameDay = [816, 817, 830, 831, 832, 833, 837].map((n) =>
			uitspraak(`ecli_nl_ghams_2024_${n}`, 'Hof Amsterdam 2 april 2024')
		);
		const other_ = uitspraak('ecli_nl_hr_2015_1198', 'HR 1 mei 2015');
		const namen = distinctNames([...sameDay, other_], (b) => b.short);
		expect(namen.get(sameDay[0].id)).toBe('Hof Amsterdam 2 april 2024, GHAMS:2024:816');
		expect(new Set(namen.values()).size).toBe(8);
		// A name that is its own stays as it is.
		expect(namen.get(other_.id)).toBe('HR 1 mei 2015');
	});

	it('reads the ECLI from the key where the node carries no cite', () => {
		expect(ecliTail({ id: 'j', collection: 'judgments', key: 'ecli_nl_gharl_2019_317' })).toBe(
			'GHARL:2019:317'
		);
	});

	it('tells two stukken of one name apart by their dossier', () => {
		const a = mvt('34710');
		const b = mvt('34071');
		const namen = distinctNames([a, b], () => 'Memorie van toelichting, nr. 3');
		expect([namen.get(a.id), namen.get(b.id)]).toEqual([
			'Memorie van toelichting, nr. 3, 34710',
			'Memorie van toelichting, nr. 3, 34071'
		]);
	});
});

describe('a toezegging on the canvas', () => {
	it('is named by what was promised, not by its number alone (BZK, N4)', () => {
		// A neighbourhood with props=canvas: no display_name, the number, the API's title.
		const label = buildNodeLabel(
			{
				id: 'commitments/004b6a2b',
				key: '004b6a2b_29d5_45e4_8817_1f5d9bf2cc61',
				collection: 'commitments',
				type: 'commitment',
				display_name: null,
				labels: ['TK'],
				props: { number: 'TZ202306-087' },
				title:
					'Toezegging TZ202306-087: Voor de zomer komt de minister met een doorvertaling naar de woningbouwopgave.',
				path: '/toezeggingen/TZ202306-087'
			} as never,
			'activity'
		);
		expect(label).toBe(
			'Voor de zomer komt de minister met een doorvertaling naar de woningbouwopgave.'
		);
	});
});
