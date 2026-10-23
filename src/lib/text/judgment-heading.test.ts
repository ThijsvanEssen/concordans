import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guard (gelijke pagina's): every place that cites a judgment by its heading reads it through
// headingCite, so a judgment of the courts of the EU has its case number on the reader, the
// canvas, the card and Behoort bij alike (`HvJ EU 22\u00a0juni\u00a02023, C-160/20`).
const READS_CITE = /\bcite\??\.(?:short|full)\b/;

/** The one place that reads the API's cite: a citing judgment with a cite of loose fields. */
const OWN_READ: Record<string, string> = {
	'src/lib/text/judgment-heading.ts': 'the heading itself',
	'src/lib/map/fresh.ts': 'a cited-by row of a Dutch article gives short and full apart'
};

describe('the heading of a judgment', () => {
	const files = Object.keys(
		import.meta.glob([
			'/src/lib/**/*.{ts,svelte}',
			'/src/routes/**/*.{ts,svelte}',
			'!/src/**/*.test.ts',
			'!/src/lib/test/**',
			'!/src/lib/api/generated/**'
		])
	).map((f) => f.slice(1));

	it('is read through headingCite', () => {
		const direct = files.filter(
			(f) => READS_CITE.test(readFileSync(f, 'utf8')) && !(f in OWN_READ)
		);
		expect(direct).toEqual([]);
	});

	it('names only exceptions that still read the cite', () => {
		expect(Object.keys(OWN_READ).filter((f) => !READS_CITE.test(readFileSync(f, 'utf8')))).toEqual(
			[]
		);
	});
});
