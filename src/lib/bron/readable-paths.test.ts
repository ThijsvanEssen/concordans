// The contract of the readable addresses with the back end (Back-end #2, SEO PR #394): the
// same file is tests/data/readable-paths.json in the API, which makes each bron's `path` from
// its props. The front end reads and writes those addresses, and makes one only where the key
// is in it (a bron the contract gives without props). A change goes into both at once.
import { describe, expect, it } from 'vitest';
import contract from './readable-paths.json';
import { focusOfPad, keyEcli, padHref, padOfFocus, parsePad } from './address';

type Geval = { focus: string; props: Record<string, unknown>; path?: string };

describe('readable-paths.json', () => {
	it('reads each address back, and takes it as the API gives it', () => {
		for (const g of contract.paths as Geval[]) {
			const pad = parsePad(g.path!);
			expect(pad, g.path).not.toBeNull();
			expect(padHref(pad!)).toBe(g.path);
			expect(padOfFocus(g.focus, g.path), g.focus).toBe(g.path);
		}
	});

	it('makes the address of a key that is in it, and no other', () => {
		for (const g of contract.paths as Geval[])
			if (Object.keys(g.props).length === 0) expect(padOfFocus(g.focus), g.focus).toBe(g.path);
		for (const g of contract.none as Geval[]) expect(padOfFocus(g.focus), g.focus).toBeNull();
	});

	it('reads another spelling as its canonical address', () => {
		for (const g of contract.parse as { path: string; canonical: string }[]) {
			const pad = parsePad(g.path);
			expect(pad, g.path).not.toBeNull();
			expect(padHref(pad!)).toBe(g.canonical);
		}
	});

	it('takes no other path for a bron', () => {
		for (const p of contract.invalid as string[]) expect(parsePad(p), p).toBeNull();
	});

	it('names the focus of an address without a request', () => {
		for (const g of contract.focus as { path: string; focus: string | null }[]) {
			// The front end names a dossier by its number (dossiers/36600-VIII), not its key.
			if (g.focus?.startsWith('dossiers/')) continue;
			expect(focusOfPad(parsePad(g.path)!), g.path).toBe(g.focus);
		}
	});

	it('reads no ECLI from a key whose dots were made underscores', () => {
		expect(keyEcli('ecli_nl_hr_2019_2006')).toBe('ECLI:NL:HR:2019:2006');
		expect(keyEcli('ecli_be_cass_2019_arr_20190101_1')).toBeNull();
	});

	it('takes the number of a toezegging as the back end does', () => {
		expect(parsePad('/toezeggingen/TZ202609-124')).not.toBeNull();
		expect(parsePad('/toezeggingen/TZ2026-124')).toBeNull();
		expect(parsePad('/toezeggingen/TZ202609-123456')).toBeNull();
	});
});
