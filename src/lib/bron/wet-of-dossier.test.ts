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
	dossierUitProps,
	dossierVolledigeTitel,
	kamerstukNummer
} from './dossier-naam';
import { describe as beschrijf, dossierVanRij, type Row } from '$lib/verbonden/rows';
import { previewFromNode } from './preview';

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
			/`(?:[dD]ossier|Kamerstuk(?: I)?) \$\{|`Kamerstuk\$\{|>(?:[dD]ossier|Kamerstuk) \{/;
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
