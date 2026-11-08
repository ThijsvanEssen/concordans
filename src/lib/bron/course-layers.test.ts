import { describe, expect, it } from 'vitest';
import {
	basisArticle,
	courseIds,
	courseLayers,
	stageOf,
	stepName,
	type Course,
	type CourseStep
} from './course-layers';

const step = (ecli: string, over: Partial<CourseStep> = {}): CourseStep => ({
	ecli,
	key: ecli.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
	court_code: null,
	court_name: null,
	tier: null,
	court_kind: null,
	date: null,
	procedure: null,
	decision_kind: 'uitspraak',
	outcome: null,
	area: null,
	basis: null,
	loaded: true,
	current: false,
	links: [],
	...over
});
const courseOf = (steps: CourseStep[], over: Partial<Course> = {}): Course => ({
	steps,
	unresolved: [],
	truncated: false,
	...over
});

const RB = step('ECLI:NL:RBDHA:2015:7145', {
	court_name: 'Rechtbank Den Haag',
	date: '2015-06-24',
	procedure: 'Eerste aanleg - meervoudig',
	basis: { bwb_id: 'BWBR0001830', article_number: '42' }
});
const HOF = step('ECLI:NL:GHDHA:2018:2591', {
	court_name: 'Gerechtshof Den Haag',
	date: '2018-10-09',
	procedure: 'Hoger beroep',
	outcome: 'bekrachtigd',
	links: [{ relation: 'APPEAL_OF', to: RB.ecli, source_outcome: null }]
});
const PHR = step('ECLI:NL:PHR:2019:887', { decision_kind: 'conclusie', date: '2019-09-13' });
const HR = step('ECLI:NL:HR:2019:2006', {
	court_name: 'Hoge Raad',
	date: '2019-12-20',
	procedure: 'Cassatie',
	outcome: 'verworpen',
	current: true,
	links: [{ relation: 'APPEAL_OF', to: HOF.ecli, source_outcome: 'Bekrachtiging/bevestiging' }]
});

describe('the stage of a step', () => {
	it('names its procedure in the lawyer’s word', () => {
		const c = courseOf([RB, HOF, PHR, HR]);
		expect([RB, HOF, PHR, HR].map((s) => stageOf(s, c))).toEqual([
			'Eerste aanleg',
			'Hoger beroep',
			'Conclusie',
			'Cassatie'
		]);
		expect(stageOf(step('x', { procedure: 'Artikel 80a RO' }), c)).toBe('Cassatie');
		expect(stageOf(step('x', { procedure: 'Verwijzing na cassatie' }), c)).toBe('Na verwijzing');
		expect(stageOf(step('x', { procedure: 'herziening' }), c)).toBe('Herziening');
	});

	it('names a stub without a procedure by the edge that points at it', () => {
		const stub = step('ECLI:NL:HR:2020:1', { loaded: false });
		const after = (relation: string) =>
			courseOf([stub, step('y', { links: [{ relation, to: stub.ecli, source_outcome: null }] })]);
		expect(stageOf(stub, after('REFERRED_BY'))).toBe('Cassatie');
		expect(stageOf(stub, after('CONTINUES'))).toBe('Eerdere uitspraak');
		expect(stageOf(stub, after('APPEAL_OF'))).toBe('Eerdere aanleg');
	});
});

describe('the article of a step', () => {
	it('cites the article with its law and links to its node', () => {
		expect(basisArticle(RB)).toEqual({
			naam: 'art. 42 RO',
			ref: { collection: 'articles', key: 'bwbr0001830_42' }
		});
		expect(
			basisArticle(step('x', { basis: { bwb_id: 'BWBR0005537', article_number: '8:105' } }))
		).toEqual({
			naam: 'art. 8:105 Awb',
			ref: { collection: 'articles', key: 'bwbr0005537_8_105' }
		});
	});

	it('gives nothing where the API has no article', () => {
		expect(basisArticle(HOF)).toBeNull();
	});
});

describe('the line Verloop', () => {
	it('names the instances in their order, this one in its place, without the conclusie', () => {
		const layers = courseLayers(courseOf([RB, HOF, PHR, HR]));
		expect(layers.map((l) => [l.soort, l.naam, !!l.ref, l.uitkomst ?? null, !!l.huidig])).toEqual([
			['Eerste aanleg', stepName(RB), true, null, false],
			['Hoger beroep', 'Gerechtshof Den Haag 9 okt. 2018', true, 'hoger beroep bekrachtigd', false],
			['Deze uitspraak', 'deze uitspraak', false, 'cassatie verworpen', true]
		]);
	});

	it('puts a decision the data lacks first, and marks a stub', () => {
		const stub = { ...RB, loaded: false, court_name: null, court_code: 'RBDHA', basis: null };
		const layers = courseLayers(
			courseOf([stub, HOF], {
				unresolved: [{ court: 'rechtbank Gelderland', date: '2025-07-09', case_number: '24/6811' }]
			})
		);
		expect(layers.map((l) => [l.soort, l.naam])).toEqual([
			['Eerdere aanleg, niet in de gegevens', 'Rechtbank Gelderland, 9 juli 2025, 24/6811'],
			['Eerste aanleg, niet in de gegevens', 'RBDHA 24 jun. 2015'],
			['Hoger beroep', 'Gerechtshof Den Haag 9 okt. 2018']
		]);
	});

	it('names a conclusie as this one, and a translation by its original', () => {
		const own = courseLayers(
			courseOf([
				{ ...PHR, current: true },
				{ ...HR, current: false }
			])
		);
		expect(own[0]).toMatchObject({ naam: 'deze conclusie', huidig: true });
		const self = {
			soort: 'Het origineel',
			naam: 'Hoge Raad',
			ref: { collection: 'judgments', key: HR.key }
		};
		expect(courseLayers(courseOf([HOF, HR]), self)[1]).toBe(self);
	});

	it('is empty when the case has nothing besides this one', () => {
		expect(courseLayers(courseOf([HR]))).toEqual([]);
		expect(courseLayers(courseOf([PHR, HR]))).toEqual([]);
	});

	it('names the other judgments of the case for Verbonden', () => {
		expect(courseIds(courseOf([RB, HOF, PHR, HR]))).toEqual([
			`judgments/${RB.key}`,
			`judgments/${HOF.key}`,
			`judgments/${PHR.key}`
		]);
	});
});
