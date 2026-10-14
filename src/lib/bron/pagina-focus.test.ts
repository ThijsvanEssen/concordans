import { afterEach, describe, expect, it, vi } from 'vitest';
import * as leesbaar from './leesbaar';

// The focus the server's page names (<meta name="focus">) is for the address it served,
// once (UX test 0.79.43, #28): after a step in the app the meta still names the first page.
function pagina(served: string, focus: string, nu: string) {
	let meta: { getAttribute: () => string; remove: () => void } | null = {
		getAttribute: () => focus,
		remove: () => (meta = null)
	};
	vi.stubGlobal('document', { querySelector: () => meta });
	vi.stubGlobal('location', { pathname: nu, href: `https://concordans.nl${nu}` });
	vi.stubGlobal('performance', {
		getEntriesByType: () => [{ name: `https://concordans.nl${served}` }]
	});
	return leesbaar;
}

describe('focusUitPagina', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('gives the focus for the address the page was served for', async () => {
		const { focusUitPagina } = pagina('/leden/rob-jetten', 'members/49be3576', '/leden/rob-jetten');
		expect(focusUitPagina({ soort: 'lid', slug: 'rob-jetten' })).toBe('members/49be3576');
	});

	it('gives nothing after a step in the app to another address', async () => {
		const { focusUitPagina, padOfFocus } = pagina(
			'/uitspraken/ECLI:NL:HR:2019:2006',
			'judgments/ecli_nl_hr_2019_2006',
			'/kamerstukken/36600-VII/147'
		);
		expect(focusUitPagina({ soort: 'kamerstuk', dossier: '36600-VII', nummer: '147' })).toBeNull();
		// Nothing wrong is remembered for the Kamerstuk's address either.
		expect(padOfFocus('judgments/ecli_nl_hr_2019_2006')).not.toBe('/kamerstukken/36600-VII/147');
	});

	it('gives the focus once: back on the first address later, the lookup speaks', async () => {
		const { focusUitPagina } = pagina('/leden/rob-jetten', 'members/49be3576', '/leden/rob-jetten');
		expect(focusUitPagina({ soort: 'lid', slug: 'rob-jetten' })).toBe('members/49be3576');
		expect(focusUitPagina({ soort: 'lid', slug: 'rob-jetten' })).toBeNull();
	});
});
