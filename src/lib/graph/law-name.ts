import { stbCitation } from '$lib/text/enacted-law';

/**
 * The name of a law whose meta is not loaded, by its id: "Stb. 2026, 314" for a publication,
 * "Richtlijn 2004/38" for a CELEX number (32004L0038). An article always stands in a hull that
 * names its wet (Netwerkcanvas, Namen), so the articles of a European regeling are named too.
 */
export function fallbackLawName(id: string): string {
	const eu = /^3(\d{4})([LR])0*(\d+)$/.exec(id);
	if (eu) return `${eu[2] === 'L' ? 'Richtlijn' : 'Verordening'} ${eu[1]}/${eu[3]}`;
	return stbCitation(id) ?? '';
}
