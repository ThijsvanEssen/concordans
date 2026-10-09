// The direction of a motie with respect to a topic, as the researcher codes it (Thijs, 10 Oct,
// ~/Development/stance-voorstel.md): positief, negatief or neutraal, per motie per topic. A
// direction is always relative to the topic, so it is never a source value: Concordans keeps
// the coding, counts it and exports it, and shows the dictum as the sentence it rests on.
// Stored in this browser only (no account, no server), and as a file to share.

import type { Stem, Uitkomst } from './overzicht';

export type Richting = 'positief' | 'negatief' | 'neutraal';
export const RICHTINGEN: readonly Richting[] = ['positief', 'negatief', 'neutraal'];
export const RICHTING_LABEL: Record<Richting, string> = {
	positief: 'Positief',
	negatief: 'Negatief',
	neutraal: 'Neutraal'
};

/** Per topic, per decision key, its direction. */
export type Codering = Record<string, Record<string, Richting>>;

const SLEUTEL = 'concordans:richting';

/** A topic as one key: its words, lowercase and sorted, so `Huur; huurtoeslag` is one topic. */
export const onderwerpSleutel = (termen: readonly string[]) =>
	[...new Set(termen.map((t) => t.trim().toLowerCase()).filter(Boolean))].sort().join('|');

const isRichting = (v: unknown): v is Richting => RICHTINGEN.includes(v as Richting);

/** The coding in this browser; empty where there is none or storage is closed. */
export function leesCodering(): Codering {
	try {
		const ruw = JSON.parse(localStorage.getItem(SLEUTEL) ?? '{}') as unknown;
		if (!ruw || typeof ruw !== 'object') return {};
		const uit: Codering = {};
		for (const [o, rijen] of Object.entries(ruw as Record<string, unknown>)) {
			if (!rijen || typeof rijen !== 'object') continue;
			const goed = Object.entries(rijen as Record<string, unknown>).filter(([, r]) =>
				isRichting(r)
			) as [string, Richting][];
			if (goed.length) uit[o] = Object.fromEntries(goed);
		}
		return uit;
	} catch {
		return {};
	}
}

export function schrijfCodering(c: Codering) {
	try {
		localStorage.setItem(SLEUTEL, JSON.stringify(c));
	} catch {
		// A browser that keeps nothing: the coding lasts as long as the page.
	}
}

/** A coding with one decision set, or cleared with null. */
export function metRichting(
	c: Codering,
	onderwerp: string,
	besluit: string,
	r: Richting | null
): Codering {
	const rijen = { ...(c[onderwerp] ?? {}) };
	if (r) rijen[besluit] = r;
	else delete rijen[besluit];
	const uit = { ...c, [onderwerp]: rijen };
	if (!Object.keys(rijen).length) delete uit[onderwerp];
	return uit;
}

/**
 * The dictum of a motie, from its text: from "verzoekt", "roept … op", "spreekt (zich) uit",
 * "draagt … op" or "besluit" up to "en gaat over tot de orde van de dag". The words of the
 * source, cut, not rewritten; null where the text has none.
 */
export function dictumUit(tekst: string | null | undefined): string | null {
	const t = (tekst ?? '').replace(/\s+/g, ' ');
	const begin = /\b(verzoekt|roept|spreekt (zich )?uit|draagt|besluit)\b/i.exec(t);
	if (!begin) return null;
	const rest = t.slice(begin.index);
	const eind = /,?\s*en gaat over tot de orde van de dag/i.exec(rest);
	const zin = (eind ? rest.slice(0, eind.index) : rest).trim().replace(/[,;]$/, '');
	return zin ? (zin.length > 600 ? `${zin.slice(0, 597).trimEnd()}…` : zin) : null;
}

export type Gecodeerd = { richting: Richting; uitkomst: Uitkomst; stem: Stem | null };

export type RichtingTelling = Record<Richting, number> & { totaal: number };

const leeg = (): RichtingTelling => ({ positief: 0, negatief: 0, neutraal: 0, totaal: 0 });

/** The coded moties counted, all and per outcome, and per vote of the chosen fractie. */
export function telRichting(rijen: readonly Gecodeerd[]) {
	const alles = leeg();
	const perUitkomst: Record<Uitkomst, RichtingTelling> = {
		aangenomen: leeg(),
		verworpen: leeg(),
		overig: leeg()
	};
	const perStem: Record<Stem, RichtingTelling> = { voor: leeg(), tegen: leeg() };
	for (const r of rijen) {
		for (const t of [alles, perUitkomst[r.uitkomst], r.stem ? perStem[r.stem] : null]) {
			if (!t) continue;
			t[r.richting]++;
			t.totaal++;
		}
	}
	return { alles, perUitkomst, perStem };
}

const veld = (v: string) => (/[",;\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** The coding of one topic as a file: one decision a line, to share or keep. */
export function coderingNaarCsv(
	onderwerp: string,
	rijen: Record<string, Richting>,
	titels: ReadonlyMap<string, string> = new Map()
): string {
	const kop = ['onderwerp', 'besluit', 'richting', 'titel'];
	const regels = Object.entries(rijen).map(([k, r]) =>
		[onderwerp, k, r, titels.get(k) ?? ''].map(veld).join(',')
	);
	return [kop.join(','), ...regels].join('\n');
}

/** A coding file read back: the lines it holds, per topic; a line it cannot read is skipped. */
export function coderingUitCsv(tekst: string): Codering {
	const uit: Codering = {};
	const regels = tekst
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.slice(1);
	for (const regel of regels) {
		const velden: string[] = [];
		let v = '';
		let tussen = false;
		for (let i = 0; i < regel.length; i++) {
			const ch = regel[i];
			if (tussen) {
				if (ch === '"' && regel[i + 1] === '"') {
					v += '"';
					i++;
				} else if (ch === '"') tussen = false;
				else v += ch;
			} else if (ch === '"') tussen = true;
			else if (ch === ',') {
				velden.push(v);
				v = '';
			} else v += ch;
		}
		velden.push(v);
		const [onderwerp, besluit, richting] = velden.map((x) => x.trim());
		if (!onderwerp || !besluit || !isRichting(richting)) continue;
		uit[onderwerp] = { ...(uit[onderwerp] ?? {}), [besluit]: richting };
	}
	return uit;
}

/** Two codings together; where both code a decision, the second one counts. */
export const samen = (a: Codering, b: Codering): Codering =>
	Object.fromEntries(
		[...new Set([...Object.keys(a), ...Object.keys(b)])].map((o) => [o, { ...a[o], ...b[o] }])
	);
