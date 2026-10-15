import { describe, expect, it } from 'vitest';
import {
	historyRow,
	openLabelOf,
	rowKey,
	rowOfNeighbor,
	uniqueRows,
	type Row,
	aardOf,
	bundleMentions,
	unresolvedRows,
	mentionRows,
	metaParts,
	passageOf,
	caseNumberOf,
	repeatedTitles
} from './rows';
import { describeBron, UNNAMED } from '$lib/bron/describe';
import { activityLine, periodLabel, citedLine, rolesLine } from './lines';
import type { Neighbor } from '$lib/api/nodes';
import { positionsLabel } from './edge-meta';
import { stemmingNaam } from '$lib/components/parliamentary/stemming';

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

describe('bundleMentions', () => {
	const mention = (position: string, confidence: number, lid: string | null = null): Row => ({
		ref: { collection: 'judgments', key: 'ecli_nl_hr_2019_1278' },
		title: 'Hoge Raad, 19 juli 2019',
		context: null,
		kind: 'uitspraken',
		position,
		confidence,
		lid,
		derived: confidence < 1
	});

	it('makes one row of the mentions of one bron, keeping each mention', () => {
		const row = bundleMentions([
			mention('r.o. 2.2.2', 0.8),
			mention('r.o. 2.4.1', 0.95, '1'),
			mention('r.o. 2.7.3', 0.9)
		]);
		expect(row.position).toBe('r.o. 2.2.2, 2.4.1 en 1 meer');
		expect(row.confidence).toBe(0.95);
		expect(row.lid).toBe('1');
		expect(row.mentions).toHaveLength(3);
		expect(mentionRows([row])).toHaveLength(3);
	});

	it('leaves a single mention as it is', () => {
		const one = mention('r.o. 3.1', 1);
		expect(bundleMentions([one])).toBe(one);
		expect(positionsLabel(['r.o. 3.1', 'r.o. 3.2'])).toBe('r.o. 3.1 en 3.2');
		expect(positionsLabel(['onder 3.4', 'onder 4.1', 'onder 5'])).toBe('onder 3.4, 4.1 en 1 meer');
		expect(positionsLabel(['§ 9', '§ 12'])).toBe('§ 9 en 12');
	});
});

describe('metaParts', () => {
	it('names the betrouwbaarheid only when it is not hoog', () => {
		const base: Row = {
			ref: { collection: 'judgments', key: 'j' },
			title: 't',
			context: null,
			kind: 'uitspraken'
		};
		expect(metaParts({ ...base, confidence: 0.95, derived: true }).map((p) => p.text)).toEqual([]);
		expect(metaParts({ ...base, confidence: 0.7 }).map((p) => p.text)).toEqual([
			'betrouwbaarheid matig'
		]);
	});

	it('does not say the name again under it', () => {
		const fractie: Row = {
			ref: { collection: 'factions', key: 'd66' },
			title: 'D66-fractie',
			context: 'D66',
			kind: 'leden'
		};
		expect(metaParts(fractie).map((p) => p.text)).toEqual([]);
		expect(metaParts(fractie, true).map((p) => p.text)).toEqual([]);
		// Part of a word is no repeat: "D6" under "D66-fractie" stays.
		expect(metaParts({ ...fractie, context: 'D6' }).map((p) => p.text)).toEqual(['D6']);
	});
});

describe('describe, a bron without a name', () => {
	it('says the name is unknown instead of showing the database key', () => {
		expect(
			describeBron('members', '71868ebc_5700_4a64_9d6e_0110f2148b38', '', { name: '' }).title
		).toBe(UNNAMED);
		expect(describeBron('members', 'k', null, { name: 'Claudia van Bruggen' }).title).toBe(
			'Claudia van Bruggen'
		);
	});
});

describe('sister cases', () => {
	it('finds the titles rows share, and the case number that tells them apart', () => {
		const row = (ecli: string, display_name: string) =>
			({
				title: 'Gerechtshof Amsterdam, 22 september 2026',
				identifier: ecli,
				props: { display_name }
			}) as unknown as Row;
		const rows = [
			row('ECLI:NL:GHAMS:2026:2678', 'Gerechtshof Amsterdam 2026-09-22 / 200.343.062/01'),
			row('ECLI:NL:GHAMS:2026:2679', 'Gerechtshof Amsterdam 2026-09-22 / 200.343.064/01')
		];
		expect([...repeatedTitles(rows)]).toEqual(['Gerechtshof Amsterdam, 22 september 2026']);
		expect(rows.map(caseNumberOf)).toEqual(['200.343.062/01', '200.343.064/01']);
		expect(caseNumberOf({ ...rows[0], props: {} } as Row)).toBe('2678');
	});

	it('say of a judgment outside the dataset that it is, without a case number', () => {
		const props = { court_code: 'HR', ecli: 'ECLI:NL:HR:2017:305', stub: true };
		const bron = describeBron('judgments', 'ecli_nl_hr_2017_305', null, props);
		expect(bron.title).toBe('Hoge Raad');
		expect(bron.context).toBe('niet in de gegevens');
		const row: Row = {
			ref: { collection: 'judgments', key: 'k' },
			kind: 'uitspraken',
			...bron,
			props
		};
		expect(caseNumberOf(row)).toBeNull();
		expect(metaParts(row).map((p) => p.text)).toEqual([
			'niet in de gegevens',
			'ECLI:NL:HR:2017:305'
		]);
	});
});

describe('a row opened under itself', () => {
	it('marks the cited phrase in its passage', () => {
		expect(
			passageOf({ snippet: 'in strijd met art. 6:162 BW gehandeld', match: 'art. 6:162 BW' })
		).toEqual({
			before: 'in strijd met ',
			mark: 'art. 6:162 BW',
			after: ' gehandeld'
		});
		expect(passageOf({ snippet: null, match: null })).toBeNull();
	});

	it('says where opening it goes', () => {
		const ref = { collection: 'judgments', key: 'ecli_nl_hr_2019_2006' } as const;
		expect(openLabelOf({ ref, position: 'r.o. 6.16', at: 'rov-6.16' })).toBe('Lees bij r.o. 6.16');
		expect(openLabelOf({ ref, position: null, at: null })).toBe('Lees');
		expect(openLabelOf({ ref, position: null, at: null }, true)).toBe('Lees naast het artikel');
	});
});

describe('unresolvedRows', () => {
	it('lists an article of a law the dataset lacks, grey and without a link', () => {
		const [row] = unresolvedRows([
			{ law: 'Rv', article_number: '843a', leden: ['1'], paragraph_ids: ['rov-3.2'] }
		]);
		expect(row.title).toBe('Artikel 843a Rv');
		expect(row.missing).toBe(true);
		expect(metaParts(row).map((p) => p.text)).toEqual(['lid 1', 'niet in de gegevens']);
	});
});

describe('aardOf', () => {
	it('says an aard the hand check found often wrong is only possible', () => {
		expect(aardOf('conditional_requirement', 0.3)).toBe('mogelijk voorwaarde');
		expect(aardOf('conditional_requirement', 0.9)).toBe('voorwaarde');
		expect(aardOf('definition', null)).toBe('definitie');
		expect(aardOf(null, 0.3)).toBeNull();
	});
});

describe('rolesLine', () => {
	it('names the role, a function other than Kamerlid and the stukken', () => {
		expect(
			rolesLine({
				roles: ['Eerste ondertekenaar', 'Mede ondertekenaar'],
				functions: ['minister van Financiën'],
				document_count: 6
			})
		).toBe('eerste ondertekenaar, als minister van Financiën, 6 stukken');
		expect(
			rolesLine({
				roles: ['Mede ondertekenaar'],
				functions: ['Tweede Kamerlid'],
				document_count: 1
			})
		).toBe('mede ondertekenaar, 1 stuk');
		expect(rolesLine({ roles: ['Mede ondertekenaar'], functions: ['Eerste Kamerlid'] })).toBe(
			'mede ondertekenaar, als Eerste Kamerlid'
		);
		expect(rolesLine({})).toBeNull();
	});
});

describe('citedLine', () => {
	it('names two articles and counts the rest', () => {
		expect(citedLine([])).toBeNull();
		expect(citedLine([{ article_number: '4:12' }])).toBe('art. 4:12');
		expect(
			citedLine([
				{ article_number: '4:12' },
				{ article_number: '5:49' },
				{ article_number: '5:50' }
			])
		).toBe('art. 4:12, 5:49 en 1 ander');
		expect(
			citedLine([
				{ article_number: '1' },
				{ article_number: '2' },
				{ article_number: '3' },
				{ article_number: null },
				{ article_number: '4' }
			])
		).toBe('art. 1, 2 en 2 andere');
	});
});

describe('activityLine', () => {
	it('names the kind, a status out of the ordinary and the dossiers', () => {
		expect(
			activityLine({ kind: 'Commissiedebat', status: 'Uitgevoerd', dossier_numbers: ['36600'] })
		).toBe('Commissiedebat, over Kamerstuk 36600');
		expect(
			activityLine({
				kind: 'Commissiedebat',
				status: 'Geannuleerd',
				dossier_numbers: ['22112', '21501-04']
			})
		).toBe('Commissiedebat, geannuleerd, over Kamerstuk 22112 en Kamerstuk 21501-04');
		expect(activityLine({})).toBeNull();
	});

	it('names a dossier by number and name where the API gives it (0.79.30)', () => {
		expect(
			activityLine({
				kind: 'Commissiedebat',
				dossier_numbers: ['36496'],
				dossiers: [{ number: '36496', short_title: 'Wet betaalbare huur', title: null }]
			})
		).toBe('Commissiedebat, over Kamerstuk 36496 Wet betaalbare huur');
		expect(stemmingNaam(null, { number: '29665', title: 'Evaluatie Schipholbeleid' })).toBe(
			'Stemming over Kamerstuk 29665 Evaluatie Schipholbeleid'
		);
		expect(stemmingNaam(null, '36496')).toBe('Stemming over Kamerstuk 36496');
		const brief = describeBron('documents', 'b', null, {
			kind: 'Brief regering',
			title: 'Kabinetsreactie op het advies',
			dossier_number: '36496',
			sequence: 12,
			dossier_short_title: 'Wet betaalbare huur'
		});
		expect(brief.context).toBe('Brief regering, Kamerstuk 36496, nr. 12, Wet betaalbare huur');
	});
});

describe('historyRow', () => {
	it('titles a change by its dossier and says what it does', () => {
		const row = historyRow({
			dossier_number: '34588',
			dossier_title: 'Wet op de inlichtingen- en veiligheidsdiensten 2017',
			date: '2017-08-17',
			change: 'amends',
			status: 'canoniek',
			summary: 'Stb. 2017, 317',
			document_id: 'instruments/stb_2017_317'
		});
		expect(row?.ref).toEqual({ collection: 'instruments', key: 'stb_2017_317' });
		expect(row?.title).toBe('Wet op de inlichtingen- en veiligheidsdiensten 2017');
		expect(row?.identifier).toBe('Stb. 2017, 317');
		expect(row?.context).toBe('wijzigt, Kamerstuk 34588');
		expect(row?.proposed).toBe(false);
		expect(row?.relation).toBe('AMENDS');
	});

	it('marks a proposed change and falls back on the dossier', () => {
		const row = historyRow({ dossier_number: '36000', change: 'repeals', status: 'voorgesteld' });
		expect(row?.ref).toEqual({ collection: 'dossiers', key: '36000', number: '36000' });
		expect(row?.proposed).toBe(true);
		expect(row?.context).toBe('voorgesteld, doet vervallen, Kamerstuk 36000');
		expect(historyRow({})).toBeNull();
	});
});
