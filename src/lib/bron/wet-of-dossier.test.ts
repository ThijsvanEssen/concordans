// A wet and the dossier of the same name are told apart by their kind, in one wording
// everywhere (Thijs, 13 Oct): the wet as "Wet", the dossier as "Kamerstuk 36764", never its
// bare number. The wording lives in `kamerstukNummer` (dossier-naam.ts) and DossierNaam; a page
// that writes its own "Dossier 36764" or "Kamerstuk 36764" beside them fails here.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	dossierLabel,
	dossierName,
	dossierOwnName,
	dossierUitProps,
	dossierVolledigeTitel,
	kamerstukNummer,
	officialNumber
} from './dossier-naam';
import { describe as beschrijf, dossierVanRij, type Row } from '$lib/verbonden/rows';
import { previewFromNode } from './preview';
import { tabTitle } from './tab-title';
import { laagVan } from './behoort';
import { paarZin } from '$lib/verbonden/hoe';
import { buildNodeLabel } from '$lib/graph/types';
import { kamerstukName } from '$lib/components/parliamentary/kamerstuk';
import type { Neighbor } from '$lib/api/nodes';

const ROOT = join(process.cwd(), 'src');
const files = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});

const LONG =
	'Regels ter implementatie van Richtlijn (EU) 2022/2555 van het Europees Parlement en de Raad van 14 december 2022 betreffende maatregelen voor een hoog gezamenlijk niveau van cyberbeveiliging in de Unie (PbEU 2022, L 333) (Cyberbeveiligingswet)';

describe('wet and dossier of the same name', () => {
	it('words a dossier number in one place only', () => {
		// `Dossier ${nr}`, `dossier ${nr}`, `Kamerstuk ${nr}`, `>Kamerstuk {nr}`, `Kamerstuk I ${nr}`.
		const eigen =
			/`(?:[dD]ossier|Kamerstuk(?: I)?) \$\{|`Kamerstuk\$\{|>[^<{}\n]*\b(?:[dD]ossier|Kamerstuk(?:en)?) \{/;
		const offenders = files(ROOT)
			.filter((p) => !p.includes(join('lib', 'api', 'generated')))
			.map((p) => ({ p: relative(ROOT, p), text: readFileSync(p, 'utf8') }))
			.filter(({ p, text }) => p !== join('lib', 'bron', 'dossier-naam.ts') && eigen.test(text))
			.map(({ p }) => p);
		expect(offenders).toEqual([]);
	});

	it('names a dossier by its kind and number, never the bare number', () => {
		expect(kamerstukNummer('36764')).toBe('Kamerstuk 36764');
		expect(kamerstukNummer('36764', 'EK')).toBe('Kamerstuk I 36764');
		expect(dossierLabel({ number: '36764', short_title: 'Cyberbeveiligingswet' })).toBe(
			'Kamerstuk 36764 Cyberbeveiligingswet'
		);
		expect(dossierLabel({ number: '36764' })).toBe('Kamerstuk 36764');
	});

	it('reads a dossier from node props, the long title kept for the hover', () => {
		const d = dossierUitProps({ label: '36764', title: `${LONG} ` });
		expect(d).toEqual({ number: '36764', title: LONG });
		// The props carry no short title: it is asked, not parsed from the brackets.
		expect('short_title' in d).toBe(false);
		const k = { ...d, short_title: 'Cyberbeveiligingswet' };
		expect(dossierName(k)).toBe('Cyberbeveiligingswet');
		expect(dossierVolledigeTitel(k)).toBe(LONG);
		expect(
			dossierUitProps({ display_name: 'Kamerstukdossier 36764: Regels', number: '36764' }).title
		).toBe('Regels');
	});

	it('gives a dossier row its name, and "Kamerstuk" under it; a wet row its kind', () => {
		const dossier = beschrijf('dossiers', '36764', null, {
			label: '36764',
			title: LONG,
			short_title: 'Cyberbeveiligingswet'
		});
		expect([dossier.title, dossier.identifier]).toEqual([
			'Cyberbeveiligingswet',
			'Kamerstuk 36764'
		]);
		const wet = beschrijf('instruments', 'bwbr0052872', null, {
			bwb_id: 'BWBR0052872',
			citation_title: 'Cyberbeveiligingswet',
			kind: 'wet'
		});
		expect([wet.title, wet.context, wet.identifier]).toEqual(['Cyberbeveiligingswet', 'Wet', null]);
		const row = {
			ref: { collection: 'dossiers', key: '36764', number: '36764' },
			title: 'x',
			context: null,
			kind: 'dossiers',
			props: { label: '36764', title: LONG }
		} as Row;
		expect(dossierVanRij(row)?.number).toBe('36764');
	});

	it('heads the hover card of each by its kind', () => {
		const dossier = previewFromNode('dossiers', null, {
			label: '36764',
			title: LONG,
			short_title: 'Cyberbeveiligingswet'
		});
		expect([dossier.kicker, dossier.title, dossier.extra]).toEqual([
			'Dossier, Kamerstuk 36764',
			'Cyberbeveiligingswet',
			LONG
		]);
		const wet = previewFromNode('instruments', 'Cyberbeveiligingswet', {
			citation_title: 'Cyberbeveiligingswet',
			official_title: `Wet van 8 juli 2026, houdende ${LONG}`,
			kind: 'wet'
		});
		expect([wet.kicker, wet.title]).toEqual(['Wet', 'Cyberbeveiligingswet']);
	});
});

// "36600 VIII", not the data's "36600-VIII": a dossier as a citation writes it, wherever a
// reader sees it (Thijs, 14 Oct: "spatie, officieel waar kan"). URLs and keys keep the hyphen.
const HYPHENATED_SUFFIX = /\b\d+-(?:[A-Z]+|\([A-Z0-9]+\))(?![\w-])/;

describe('a dossier number in its official notation', () => {
	it('puts a space before the suffix and keeps a number with digits after the hyphen', () => {
		expect(officialNumber('36600-VIII')).toBe('36600 VIII');
		expect(officialNumber('23908-(R1519)')).toBe('23908 (R1519)');
		expect(officialNumber('21501-20')).toBe('21501-20');
		expect(officialNumber('36764')).toBe('36764');
	});

	it('names a dossier with a suffix officially in every wording of it', () => {
		const d = { number: '36600-VIII' };
		const props = { label: '36600-VIII', number: '36600', suffix: 'VIII' };
		const shown = [
			kamerstukNummer('36600-VIII'),
			kamerstukNummer('36600-VIII', 'EK'),
			dossierLabel(d),
			dossierName(d),
			kamerstukName({ dossier_number: '36600-VIII', number: 5 }),
			kamerstukName({ dossier_number: '36600-VIII' }),
			beschrijf('dossiers', '36600-VIII', null, props).identifier,
			previewFromNode('dossiers', null, props).kicker,
			tabTitle({ collection: 'dossiers', label: '36600-VIII', raw: { display_name: null, props } }),
			buildNodeLabel({ collection: 'dossiers', key: '36600-VIII', props } as never, 'dossier'),
			laagVan(
				{ collection: 'dossiers', key: '36600-VIII', props } as unknown as Neighbor,
				'Dossier'
			).naam,
			paarZin([
				{
					from: {
						paper: true,
						kind: 'Brief',
						dossier_number: '36600',
						dossier_suffix: 'VIII',
						sequence: 5
					},
					to: { paper: true, kind: 'Motie', dossier_number: '36600-VIII', sequence: 12 }
				}
			])
		];
		expect(shown.filter((t) => !t || HYPHENATED_SUFFIX.test(t))).toEqual([]);
		expect(dossierLabel(d)).toBe('Kamerstuk 36600 VIII');
		expect(kamerstukNummer('21501-20')).toBe('Kamerstuk 21501-20');
	});

	it('tells a dossier without a name of its own by dossierOwnName, not by its number', () => {
		expect(dossierOwnName({ number: '36600-VIII' })).toBeNull();
		expect(dossierOwnName({ number: '36764', short_title: 'Cyberbeveiligingswet' })).toBe(
			'Cyberbeveiligingswet'
		);
		// `dossierName(d) === d.number` no longer tells it: the name is the official number.
		const compares = /dossierName\([^)]*\)\)?\s*[!=]==/;
		const offenders = files(ROOT)
			.filter((p) => !p.includes(join('lib', 'api', 'generated')))
			.filter((p) => compares.test(readFileSync(p, 'utf8')))
			.map((p) => relative(ROOT, p));
		expect(offenders).toEqual([]);
	});

	it('joins a number and its suffix with a hyphen only for a URL or a key', () => {
		const joins = /\}-\$\{[^}]*[sS]uffix\b/;
		const forAddress = [join('lib', 'bron', 'leesbaar.ts'), join('lib', 'bron', 'behoort.ts')];
		const offenders = files(ROOT)
			.filter((p) => !p.includes(join('lib', 'api', 'generated')))
			.map((p) => relative(ROOT, p))
			.filter((p) => !forAddress.includes(p) && joins.test(readFileSync(join(ROOT, p), 'utf8')));
		expect(offenders).toEqual([]);
	});
});
