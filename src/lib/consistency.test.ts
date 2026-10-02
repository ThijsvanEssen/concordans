// What was made one in the polish of October 2026 stays one. Each rule names where the one
// form lives, so a new page uses it instead of a second version beside it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

const sources = files(ROOT)
	.filter((path) => !path.includes(`${join('lib', 'api', 'generated')}`))
	.map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, 'utf8') }));

const offenders = (test: (text: string) => boolean, allowed: string[] = []) =>
	sources.filter(({ path, text }) => !allowed.includes(path) && test(text)).map((s) => s.path);

describe('one form for each thing', () => {
	it('formats a date only in $lib/text/datum.ts', () => {
		const dateFormat = /toLocaleDateString|Intl\.DateTimeFormat|\btoLocaleTimeString\b/;
		const monthNames = /['"](januari|jan\.)['"]/;
		expect(
			offenders((t) => dateFormat.test(t) || monthNames.test(t), ['lib/text/datum.ts'])
		).toEqual([]);
	});

	it('fills no missing value with a sign: Waarde leaves it empty, Veld drops the row', () => {
		// "—" or "–" as a value reads as a fact ("unknown") where the data only lacks it.
		const sign = /['"`>][—–]['"`<]/;
		expect(offenders((t) => sign.test(t))).toEqual([]);
	});

	it('heads a section of a reader with Sectie, not a grey label', () => {
		expect(offenders((t) => /class="sec-title"|\.sec-title\b/.test(t))).toEqual([]);
	});

	it('gives every tab of Bladeren the same width', () => {
		expect(offenders((t) => /page--wide/.test(t))).toEqual([]);
	});

	it('colours an outcome through its tokens, without a second value beside them', () => {
		expect(offenders((t) => /var\(--uitkomst-(ja|nee),/.test(t))).toEqual([]);
	});

	it('uses tabular figures only in columns of figures', () => {
		// Tabular figures give a full stop a figure's width: "28 sep . 2026" in a sentence.
		// These files set them on a column of numbers; a new one needs the same reason.
		const columns = [
			'lib/components/articles/VersionCompare.svelte',
			'lib/components/explore/IndexView.svelte',
			'lib/components/explore/ZaalLegenda.svelte',
			'lib/components/explore/index/IndexFacets.svelte',
			'lib/components/explore/readers/CabinetReader.svelte',
			'lib/components/explore/readers/CommitmentReader.svelte',
			'lib/components/explore/readers/DecisionReader.svelte',
			'lib/components/explore/readers/MemberReader.svelte',
			'lib/components/ui/FilterOptie.svelte',
			'routes/(main)/api/+page.svelte',
			'routes/(main)/docs/+page.svelte'
		];
		expect(offenders((t) => /tabular-nums/.test(t), columns)).toEqual([]);
	});

	it('opens a row in place on one click, through the shared rule', () => {
		// A row whose title is a link to the bron (Bladeren, Verbonden, the table) takes the
		// click through terPlekke ($lib/actions/klik), so a plain click opens the row and a
		// cmd-click goes to the bron.
		const rows = sources.filter(({ text }) =>
			/class="(row-title|row__title)"[\s\S]{0,80}href=/.test(text)
		);
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.filter(({ text }) => !text.includes('terPlekke')).map((s) => s.path)).toEqual([]);
	});

	it('draws every option of a filter with FilterOptie', () => {
		expect(offenders((t) => /class="(box|opt|check__box)"/.test(t))).toEqual([]);
	});

	it('separates with a comma, not a middle dot (Thijs, 2 October 2026)', () => {
		// "Motie, nr. 21", "Dossier, Kamerstuk 36799", "Aangenomen, 7 sep. 2026". Only the
		// browser tab keeps its "Actueel · Concordans".
		expect(offenders((t) => /·(?! Concordans)/.test(t.replace(/· Concordans/g, '')))).toEqual([]);
	});

	it('has no prototype switches or study folders left', () => {
		expect(
			offenders((t) => /searchParams\.get\('(ontwerp|contrast)'\)|components\/r[0-9]\//.test(t))
		).toEqual([]);
	});
});
