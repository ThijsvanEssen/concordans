import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stukUitslag, uitslagTekst } from './stuk-uitslag';
import { nagekomenIn, toegezegdIn } from '$lib/text/toezegging';

describe('the outcome of a motie or amendement', () => {
	it('reads the outcome, the seats and the day, and links the stemming', () => {
		const u = stukUitslag({
			outcome: 'aangenomen',
			decided_on: '2026-03-31',
			tally: { Voor: 150 },
			decision: 'decision_1'
		});
		expect(u).toMatchObject({
			uitkomst: 'aangenomen',
			telling: '150–0',
			datum: '31 mrt. 2026',
			besluit: 'decision_1'
		});
		expect(uitslagTekst(u!)).toBe('aangenomen 150–0 op 31 mrt. 2026');
		expect(
			uitslagTekst(stukUitslag({ outcome: 'verworpen', tally: { Voor: 65, Tegen: 85 } })!)
		).toBe('verworpen 65–85');
	});

	it('names what replaced a stuk, by number', () => {
		const u = stukUitslag({
			outcome: 'vervangen',
			replaced_by: [
				{ id: 'documents/b', key: 'b', sequence: 38 },
				{ id: 'documents/a', key: 'a', sequence: 26 }
			]
		})!;
		expect(u.vervangers.map((v) => v.nummer)).toEqual(['26', '38']);
		expect(uitslagTekst(u)).toBe('vervangen door nrs. 26 en 38');
		expect(
			stukUitslag({
				outcome: 'vervangen',
				replaced_by: [{ sequence: 12 }, { key: 'c', sequence: null }, { key: 'd', sequence: 47 }]
			})!.vervangers
		).toEqual([{ key: 'd', nummer: '47' }]);
	});

	it('shows nothing while nothing was decided, and no tally without seats', () => {
		expect(stukUitslag({ outcome: null })).toBeNull();
		expect(stukUitslag({ outcome: 'onbekend' })).toBeNull();
		expect(stukUitslag(null)).toBeNull();
		expect(
			stukUitslag({ outcome: 'aangenomen', tally: { Voor: 0, Tegen: 0 } })!.telling
		).toBeNull();
		expect(stukUitslag({ outcome: 'aangehouden', decided_on: '2026-04-07' })!.telling).toBeNull();
	});

	it('stands on every list of Kamerstukken in one form (StukUitslag)', () => {
		const ROOT = join(process.cwd(), 'src');
		const files = (dir: string): string[] =>
			readdirSync(dir).flatMap((n) => {
				const p = join(dir, n);
				return statSync(p).isDirectory() ? files(p) : p.endsWith('.svelte') ? [p] : [];
			});
		const met = files(ROOT)
			.filter((p) => /<StukUitslag\b/.test(readFileSync(p, 'utf8')))
			.map((p) => relative(ROOT, p))
			.sort();
		expect(met).toEqual([
			'lib/components/explore/index/rows/DocumentRows.svelte',
			'lib/map/MapInhoud.svelte',
			'lib/verbonden/VerbondenRow.svelte'
		]);
	});
});

describe('where a toezegging was made and kept', () => {
	it('names the activity by its kind and day, never by its number', () => {
		expect(toegezegdIn({ kind: 'Wetgevingsoverleg', date: '2026-03-23' })).toEqual({
			voor: 'Toegezegd in het',
			link: 'wetgevingsoverleg van 23 maart 2026'
		});
		expect(toegezegdIn({ kind: 'Plenair debat (wetgeving)', date: '2026-03-23' })?.link).toBe(
			'plenair debat van 23 maart 2026'
		);
		expect(toegezegdIn({ kind: 'Procedurevergadering', date: null })?.voor).toBe('Toegezegd in de');
		expect(toegezegdIn(null)).toBeNull();
	});

	it('names the letters that kept it by number', () => {
		expect(nagekomenIn([{ key: 'b', sequence: 33 }])).toEqual({
			voor: 'Nagekomen in brief nr.',
			brieven: [{ key: 'b', naam: '33' }]
		});
		expect(nagekomenIn([{ key: 'b', sequence: null, date: '2026-06-24' }])?.voor).toBe(
			'Nagekomen in brief van'
		);
		expect(nagekomenIn([])).toBeNull();
	});
});
