import { describe, expect, it } from 'vitest';
import {
	activityLine,
	describe as describeBron,
	historyRow,
	openLabelOf,
	periodLabel,
	rowKey,
	rowOfNeighbor,
	uniqueRows,
	type Row
} from './rows';
import type { Neighbor } from '$lib/api/nodes';

describe('rowKey', () => {
	it('tells apart two references from one article', () => {
		const row = (edgeId: string) =>
			({
				ref: { collection: 'articles', key: 'bwbr0005289_13' },
				title: 'Artikel 6:13',
				context: null,
				kind: 'artikelen',
				edgeId
			}) as Row;
		expect(rowKey(row('e1'))).not.toBe(rowKey(row('e2')));
	});

	it('tells apart two changes by one stuk without an edge: it amends and it repeals', () => {
		// Art. 273f Sr: the memorie van toelichting of 36547 does both.
		const change = (kind: string) =>
			historyRow({
				document_id: 'documents/mvt',
				dossier_number: '36547',
				change: kind,
				status: 'voorgesteld'
			})!;
		expect(rowKey(change('amends'))).not.toBe(rowKey(change('repeals')));
		expect(uniqueRows([change('amends'), change('repeals'), change('amends')])).toHaveLength(2);
	});
});

describe('openLabelOf', () => {
	it('opens a conclusion onder its paragraph, a judgment at its r.o.', () => {
		const at = (key: string) =>
			openLabelOf({ ref: { collection: 'judgments', key }, at: 'rov-5', position: null });
		expect(at('ecli_nl_phr_2020_453')).toBe('Lees bij onder 5');
		expect(at('ecli_nl_hr_2019_2006')).toBe('Lees bij r.o. 5');
	});
});

describe('a conclusion', () => {
	it('is named by its author, as it is cited', () => {
		const props = {
			court: 'PHR',
			date: '2018-08-02',
			advocate_general: 'mr. R.E.C.M. Niessen',
			advocate_general_role: 'advocaat-generaal'
		};
		expect(describeBron('judgments', 'ecli_nl_phr_2018_1', 'x', props).title).toBe(
			'Conclusie A-G Niessen, 2 augustus 2018'
		);
	});
});

describe('a bewindspersoon of a cabinet', () => {
	const post = (fn: string, from: string, to: string | null) => ({
		function: fn,
		from_date: from,
		to_date: to
	});
	const row = (posts: unknown[]) =>
		rowOfNeighbor({
			id: 'members/a',
			key: 'a',
			collection: 'members',
			display_name: 'Rob Jetten (D66)',
			relation: 'SERVED_IN',
			direction: 'inbound',
			meta: { posts }
		} as unknown as Neighbor)!;

	it('reads the post and the period from the SERVED_IN posts', () => {
		const r = row([post('Minister-president', '2026-02-23', null)]);
		expect(r.period).toEqual({ from: '2026-02-23', to: null, role: 'minister-president' });
		expect(periodLabel(r.period!)).toBe('minister-president, sinds 2026');
	});

	it('runs from the first post to the end of the last', () => {
		const r = row([
			post('Minister van Justitie en Veiligheid', '2024-07-02', '2025-06-03'),
			post('Minister van Asiel en Migratie', '2025-06-03', '2025-09-01')
		]);
		expect(periodLabel(r.period!)).toBe(
			'minister van Justitie en Veiligheid en minister van Asiel en Migratie, 2024–2025'
		);
	});
});

describe('a seat on a commissie', () => {
	const seat = (role: string) =>
		rowOfNeighbor({
			id: 'members/b',
			key: 'b',
			collection: 'members',
			display_name: 'Stientje van Veldhoven',
			relation: 'MEMBER_OF',
			direction: 'inbound',
			meta: { role, from_date: '2012-11-01', to_date: '2015-03-01' }
		} as unknown as Neighbor)!;

	it('names its role in one spelling, a plain seat not at all (UX #50)', () => {
		expect(periodLabel(seat('PlvLid').period!)).toBe('plaatsvervangend lid, 2012–2015');
		expect(periodLabel(seat('Plv. lid').period!)).toBe('plaatsvervangend lid, 2012–2015');
		expect(periodLabel(seat('Lid').period!)).toBe('2012–2015');
	});
});

describe('the name of a Kamerstuk', () => {
	const doc = (props: Record<string, unknown>) =>
		describeBron('documents', 'k', 'Kamerstuk 36547', props);

	it('is its own title where that says more than its kind, with kind and number under it', () => {
		expect(
			doc({
				kind: 'Brief',
				title: 'Brief van de minister van J&V betreffende het verzoek',
				dossier_numbers: ['36547'],
				number: 'G',
				chamber: 'EK'
			})
		).toMatchObject({
			title: 'Brief van de minister van J&V betreffende het verzoek',
			context: 'Brief, Kamerstuk I 36547, G'
		});
		expect(
			doc({
				kind: 'Motie',
				title: 'Kamerstuk 36547, nr. 38: Motie van het lid Krul c.s. over pleegouders',
				dossier_number: '36547',
				sequence: 38
			})
		).toMatchObject({
			title: 'Motie van het lid Krul c.s. over pleegouders',
			context: 'Motie, Kamerstuk 36547, nr. 38'
		});
	});

	it('writes the dossier with its suffix as a citation does (#84)', () => {
		const motie = { kind: 'Motie', title: 'Motie van het lid X over Y', sequence: 183 };
		expect(doc({ ...motie, dossier_numbers: ['36600-VIII'] }).context).toBe(
			'Motie, Kamerstuk 36600 VIII, nr. 183'
		);
		expect(doc({ ...motie, dossier_number: '36600', dossier_suffix: 'VIII' }).context).toBe(
			'Motie, Kamerstuk 36600 VIII, nr. 183'
		);
		// The Eerste Kamer's letter, also where the data gives it as the sequence.
		expect(doc({ ...motie, dossier_number: '31936', sequence: 'CG' }).context).toBe(
			'Motie, Kamerstuk I 31936, CG'
		);
	});

	it('is its kind and number where the title only names the kind', () => {
		expect(
			doc({
				kind: 'Verslag',
				title: 'Blanco verslag',
				dossier_number: '36547',
				number: 'C',
				chamber: 'EK'
			}).title
		).toBe('Blanco verslag, Kamerstuk I 36547, C');
	});

	it('names a paper of a bill by its kind and number, not by the title of the bill', () => {
		expect(
			doc({
				kind: 'Memorie van toelichting',
				title: 'Wijziging van het Wetboek van Strafrecht',
				dossier_number: '36547',
				sequence: 3
			}).title
		).toBe('Memorie van toelichting, Kamerstuk 36547, nr. 3');
	});

	it('is never the kind alone where the date is known', () => {
		expect(doc({ kind: 'Brief', title: 'Brief', date: '2026-09-10' }).title).toBe(
			'Brief, 10 september 2026'
		);
	});
});

describe('the name of an activity', () => {
	const act = (props: Record<string, unknown>, name = 'act') =>
		describeBron('activities', 'k', name, props);

	it('is its agenda title, with its kind under it', () => {
		expect(
			act({ kind: 'Procedurevergadering', agenda_title: 'Procedures en brieven' })
		).toMatchObject({ title: 'Procedures en brieven', context: 'Procedurevergadering' });
	});

	it('is the name the source gives (the committee and the day) without an agenda title', () => {
		expect(
			act({ date: '2026-03-24' }, 'Commissie voor Justitie en Veiligheid (J&V) (2026-03-24)').title
		).toBe('Commissie voor Justitie en Veiligheid (J&V) (2026-03-24)');
	});

	it('is its kind with its date where nothing else tells it apart', () => {
		expect(
			act(
				{ kind: 'plenaire vergadering', agenda_title: 'Stemmingen', date: '2026-09-29' },
				'Stemmingen (2026-09-29)'
			).title
		).toBe('Stemmingen, 29 september 2026');
		expect(
			act({ kind: 'Plenair debat', date: '2026-09-22' }, 'Plenair debat (2026-09-22)').title
		).toBe('Plenair debat, 22 september 2026');
	});
});

describe('a translation of a judgment', () => {
	it('says it is the English translation, as its name in the source does', () => {
		const d = describeBron(
			'judgments',
			'ecli_nl_rbdha_2015_7196',
			'Rechtbank Den Haag 2015-06-24 / C/09/456689 / HA ZA 13-1396 (English translation)',
			{ ecli: 'ECLI:NL:RBDHA:2015:7196', court: 'Rechtbank Den Haag', date: '2015-06-24' }
		);
		expect(d.context).toBe('Engelse vertaling');
	});
});

describe('activityLine (UX-toets 0.79.47, #59)', () => {
	const op = (date: string, status = 'Gepland') =>
		activityLine({ kind: 'Commissiedebat', status, date }, '2026-10-12');
	it('says that an activity still to come is planned', () => {
		expect(op('2027-06-03')).toBe('Commissiedebat, gepland');
		expect(op('2026-10-12')).toBe('Commissiedebat, gepland');
	});
	it('leaves the word out for one held, or planned on a day that has passed', () => {
		expect(op('2026-10-01', 'Uitgevoerd')).toBe('Commissiedebat');
		expect(op('2026-10-01')).toBe('Commissiedebat');
		expect(op('2027-06-03', 'Geannuleerd')).toBe('Commissiedebat, geannuleerd');
	});
});

describe('periodLabel', () => {
	it('writes a seat as years, with a role other than plain membership', () => {
		expect(periodLabel({ from: '2017-11-14', to: '2021-04-06', role: null })).toBe('2017–2021');
		expect(periodLabel({ from: '2025-11-12', to: null, role: 'Lid' })).toBe('sinds 2025');
		expect(periodLabel({ from: '2023-12-06', to: '2026-02-09', role: 'Fractievoorzitter' })).toBe(
			'fractievoorzitter, 2023–2026'
		);
		// The end date is the last day of the seat (TotEnMet).
		expect(periodLabel({ from: null, to: '2026-06-09', role: null })).toBe('tot en met 2026');
	});
});
