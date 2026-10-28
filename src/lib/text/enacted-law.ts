// A law the Staatsblad published and the BWB does not hold (yet), API 0.79.62 (#769): named by
// the publication that enacted it. Its address is /wetten/STB-2026-56, its node key
// wet_stb_2026_56 and its articles carry the publication as `official_id` (stb-2026-56), with
// no BWB id. Once the BWB holds it, the API lets it go and its address moves to the BWB id.

/** The id of such a law as its address and the article routes write it: STB-2026-56. */
export const STB_LAW = /^STB-\d{4}-\d+$/i;
const STB_LAW_KEY = /^wet_stb_(\d{4})_(\d+)$/;

/** The law of an `official_id` that names one (stb-2026-56 → STB-2026-56); null for another. */
export const enactedLawId = (officialId: unknown): string | null =>
	typeof officialId === 'string' && STB_LAW.test(officialId) ? officialId.toUpperCase() : null;

/** The law of a node key wet_stb_2026_56 (STB-2026-56); null for another key. */
export function enactedLawOfKey(key: string): string | null {
	const m = STB_LAW_KEY.exec(key);
	return m ? `STB-${m[1]}-${m[2]}` : null;
}

/**
 * The node key of a law by the id its address has: a BWB id or a CELEX number lower-cased
 * (bwbr0005289), a law of the Staatsblad by its publication after `wet_` (wet_stb_2026_56).
 */
export const lawNodeKey = (lawId: string): string =>
	STB_LAW.test(lawId) ? `wet_${lawId.toLowerCase().replaceAll('-', '_')}` : lawId.toLowerCase();

/** Its place in the Staatsblad as a lawyer cites it: Stb. 2026, 56. */
export function stbCitation(lawId: string): string | null {
	const m = /^STB-(\d{4})-(\d+)$/i.exec(lawId);
	return m ? `Stb. ${m[1]}, ${m[2]}` : null;
}

/** The status of such a law and of its articles: Vastgesteld, nog niet in werking (Stb. 2026, 56). */
export function enactedLawStatus(lawId: string): string | null {
	const cited = stbCitation(lawId);
	return cited ? `Vastgesteld, nog niet in werking (${cited})` : null;
}

/** Whether a node id is such a law (instruments/wet_stb_2026_56) or an article of it (articles/stb_2026_56_2_8_6). */
export const isEnactedLawItem = (id: string): boolean =>
	/^instruments\/wet_stb_\d{4}_\d+$/.test(id) || /^articles\/stb_\d{4}_\d+_./.test(id);

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
