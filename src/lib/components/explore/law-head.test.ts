import { describe, expect, it } from 'vitest';
import { lawFullTitle, lawHeadLine, lawKind, sourceName, treatyLink } from './law-head';

const eu = {
	kind: null,
	title:
		'Verordening (EU) 2022/868 van het Europees Parlement en de Raad van 30 mei 2022 (Datagovernanceverordening)',
	citation_title: 'Verordening (EU) 2022/868',
	official_title: null,
	official_url: 'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32022R0868',
	jurisdiction: 'eu'
};

describe('the head of a law', () => {
	it('names an act of the EU by its kind', () => {
		expect(lawKind(eu)).toBe('Verordening');
		expect(lawKind({ ...eu, citation_title: 'Richtlijn 95/46/EG' })).toBe('Richtlijn');
		expect(lawKind({ ...eu, kind: 'wet', jurisdiction: 'nl' })).toBe('Wet');
		expect(lawKind(null)).toBe('Regeling');
	});
	it('gives the full title where the official title is missing', () => {
		expect(lawFullTitle(eu, 'Verordening (EU) 2022/868')).toBe(eu.title);
		expect(
			lawFullTitle({ ...eu, title: 'Verordening (EU) 2022/868' }, 'Verordening (EU) 2022/868')
		).toBeNull();
	});
	it('names the site of the official text', () => {
		expect(sourceName(eu.official_url)).toBe('eur-lex.europa.eu');
		expect(sourceName('https://wetten.overheid.nl/BWBR0005537')).toBe('wetten.overheid.nl');
		expect(sourceName(null)).toBeNull();
	});
});

describe('the head line', () => {
	const opts = {
		count: 587,
		peildatum: null,
		longDate: (d: string) => d,
		formatCount: (n: number) => String(n)
	};
	const awb = {
		date_in_force: '1994-01-01',
		version_date_in_force: '2026-08-15',
		article_count: 584,
		inbound_citation_count: 15108
	};
	it('says when the law came into force and which version is the text in force', () => {
		expect(lawHeadLine(awb, opts)).toBe(
			'584 artikelen. In werking sinds 1994-01-01. Geldende tekst: versie van 2026-08-15. 15108 keer aangehaald.'
		);
	});
	it('takes the current version from the list where the law gives none', () => {
		expect(
			lawHeadLine({ ...awb, version_date_in_force: null }, { ...opts, currentFrom: '2026-08-15' })
		).toContain('versie van 2026-08-15');
	});
	it('says the date once where the version is the law as it came into force', () => {
		expect(lawHeadLine({ ...awb, version_date_in_force: '1994-01-01' }, opts)).not.toContain(
			'Geldende tekst'
		);
	});
	it('gives on a peildatum the count of that day, without the text in force', () => {
		const line = lawHeadLine(awb, { ...opts, count: 530, peildatum: '2015-01-01' });
		expect(line).toContain('530 artikelen.');
		expect(line).not.toContain('Geldende tekst');
	});
	it('leaves out a date the act of the EU has not', () => {
		expect(
			lawHeadLine(
				{
					date_in_force: null,
					version_date_in_force: null,
					article_count: 99,
					inbound_citation_count: 0
				},
				opts
			)
		).toBe('99 artikelen.');
	});
});

describe('a treaty in the BWB and in the Verdragenbank', () => {
	const evrmBwb = { bwb_id: 'BWBV0001000', treaty_number: '005132' };
	const evrmRecord = { bwb_id: null, treaty_number: '005132' };
	it('links the BWB text to its Verdragenbank record', () => {
		expect(treatyLink(evrmBwb, [{ key: 'verdrag_005132', bwb_id: null }])).toEqual({
			label: 'Verdragenbank: nr. 005132',
			target: { kind: 'bron', key: 'verdrag_005132' }
		});
	});
	it('links to the Verdragenbank itself where the dataset lacks the record', () => {
		expect(treatyLink({ bwb_id: 'BWBV0001002', treaty_number: '007233' }, [])?.target).toEqual({
			kind: 'url',
			url: 'https://verdragenbank.overheid.nl/nl/Verdrag/Details/007233'
		});
	});
	it('links the Verdragenbank record to the text in the BWB', () => {
		expect(treatyLink(evrmRecord, [{ key: 'bwbv0001000', bwb_id: 'BWBV0001000' }])).toEqual({
			label: 'Tekst in het BWB: BWBV0001000',
			target: { kind: 'bron', key: 'bwbv0001000' }
		});
		expect(treatyLink(evrmRecord, [])).toBeNull();
	});
	it('is nothing for a law without a treaty number', () => {
		expect(treatyLink({ bwb_id: 'BWBR0005537', treaty_number: null }, [])).toBeNull();
	});
});

describe('the count in the head', () => {
	const opts = {
		peildatum: null,
		longDate: (d: string) => d,
		formatCount: (n: number) => String(n)
	};
	it('takes the list where the law says 0, and leaves out a count of none', () => {
		const d = {
			date_in_force: null,
			version_date_in_force: null,
			article_count: 0,
			inbound_citation_count: 0
		};
		expect(lawHeadLine(d, { ...opts, count: 66 })).toBe('66 artikelen.');
		expect(lawHeadLine(d, { ...opts, count: 0 })).toBe('');
	});
});
