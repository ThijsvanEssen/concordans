// What every first paint sets alike ($lib/first-paint): words escaped, a date on one line as
// CitedText keeps it, the band "Behoort bij" (BelongsTo) in its lines and layers, the caret and
// the coverage mark, in the classes `k` of the app's components.
import { coverageLine, type Completeness } from '$lib/text/coverage';
import { splitDates } from '$lib/text/datum';
import { formatCount } from '$lib/text/getal';
import { langeDatum, vandaag } from '$lib/text/datum';
import { peildatumLabel } from '$lib/text/peildatum-label';
import { VORMEN, VORM_VAN } from '$lib/bron/vormen';
import type { Collection } from '$lib/vocabulary';
import { titleParts } from '$lib/text/title-parts';
import type { Classes } from './classes';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** `s` as text in HTML. */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** Running text as CitedText sets it: a date on one line (A184). */
export const running = (text: string, k: Classes) =>
	splitDates(text)
		.map((d) => (d.date ? `<span class="date ${k.cited}">${esc(d.text)}</span>` : esc(d.text)))
		.join('');

/** The caret of a control that opens (Caret). */
export const caret = (k: Classes) =>
	`<svg class="caret ${k.caret}" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false"><path d="M2 3.75 5 6.75 8 3.75"></path></svg>`;

/** The mark of what the dataset lacks (Coverage); nothing where nothing is known to lack. */
export function coverage(c: Completeness | null | undefined, k: Classes, source?: string): string {
	const line = coverageLine(c);
	return line
		? `<span class="dekking ${k.coverage}">${esc(line)}${source ? `, <a class="${k.coverage}">${esc(source)} ↗</a>` : ''}</span>`
		: '';
}

/** A layer of a line of the band: its name (and the name a phone's line carries), whether it
 *  opens a bron, how it ended, whether it is the bron itself. */
type BandLayer = {
	name: string;
	short?: string;
	link: boolean;
	outcome?: string;
	current?: boolean;
};

/** A line of the band: its term, its layers, side by side (`loose`) or a chain. */
export type BandLine = { term: string; layers: BandLayer[]; loose?: boolean };

/**
 * The band "Behoort bij" (BelongsTo): the source first (`Wetten ›`), each line its term and
 * its layers, folded as the band folds them (more than three; side by side only on a phone),
 * the button of what a phone folds away (`more`), and the groups under the lines.
 */
export function band(
	source: string,
	lines: BandLine[],
	k: Classes,
	o: { phone: boolean; more?: string | null; groups?: { label: string; count: number }[] }
): string {
	if (!lines.length && !o.groups?.length) return '';
	const c = k.belongsTo;
	const crumb = `<a class="soort raakvlak ${c}">${esc(source)}</a><span class="scheiding ${c}" aria-hidden="true">›</span>`;
	const more = o.more
		? `<button type="button" class="uitklap-knop btn is-text ${c}" tabindex="-1">${esc(o.more)}${caret(k)}</button>`
		: '';
	const layer = (l: BandLayer, last: boolean) => {
		const cls = [l.current ? 'huidig' : '', last ? 'laatst' : '', c].filter(Boolean).join(' ');
		const name = `<span class="vol ${c}">${esc(l.name)}</span>${l.short ? `<span class="kort ${c}">${esc(l.short)}</span>` : ''}`;
		const outcome = l.outcome ? `<span class="uitkomst ${c}">, ${esc(l.outcome)}</span>` : '';
		return `<li class="${cls}">${l.link ? `<a class="raakvlak ${c}">${name}</a>` : `<span>${name}</span>`}${outcome}</li>`;
	};
	const line = (r: BandLine, i: number) => {
		const folded = r.loose ? o.phone && r.layers.length > 2 : r.layers.length > 3;
		const last = r.layers.length - 1;
		const items = folded
			? layer(r.layers[0], false) +
				`<li class="vouw ${c}"><button class="raakvlak ${c}" type="button" tabindex="-1">…</button></li>` +
				layer(r.layers[last], true)
			: r.layers.map((l, j) => layer(l, j === last)).join('');
		const cls = ['lagen', r.loose ? 'los' : '', folded ? 'gevouwen' : '', c].filter(Boolean);
		return `<div class="regel ${c}">${i === 0 ? crumb : ''}<dt class="term ${c}">${esc(r.term)}</dt><dd class="${c}"><ol class="${cls.join(' ')}">${items}</ol>${i === 0 ? more : ''}</dd></div>`;
	};
	const body = lines.length
		? `<dl class="regels ${c}">${lines.map(line).join('')}</dl>`
		: `<div class="regel ${c}">${crumb}${more}</div>`;
	const groups = o.groups?.length
		? `<div class="groepen ${c}">${o.groups.map((g) => `<div class="groep ${c}"><button type="button" class="groep-kop raakvlak ${c}" tabindex="-1">${esc(g.label)}<span class="aantal ${c}">${formatCount(g.count)}</span>${caret(k)}</button></div>`).join('')}</div>`
		: '';
	return `<nav class="behoort${lines.length ? '' : ' zonder-kern'} ${c}">${body}${groups}</nav>`;
}

/** The row of the band (ReaderFrame): a band with nothing to name leaves the row out, as the
 *  frame does once its light node told so; `held` where the frame keeps the band's room from
 *  the start (bandAlways). */
export const headRow = (bandHtml: string, k: Classes, held = true) =>
	bandHtml
		? `<div class="kop-rij ${k.frame}"><div class="kop-rij__band${held ? ' kop-rij__band--held' : ''} ${k.frame}" data-later>${bandHtml}</div></div>`
		: `<div class="kop-rij ${k.frame}" hidden><div class="kop-rij__band ${k.frame}" hidden></div></div>`;

/** The head of a reader (ReaderHead): the line of its kind, the title, what stands under it,
 *  the row of its actions with Zoek in dit stuk, its status and facts, the rows under them.
 *  What the app shows only once it has come stands unseen in its room (`data-later`). */
export function readerHead(
	o: {
		/** The words of the line of its kind (unseen). */
		kind: string;
		title: string;
		/** What stands under the title; undefined where the reader gives nothing there. */
		under?: string;
		/** The status line's words; undefined where the reader has none. */
		status?: string;
		/** The strip of its facts (Feiten), whole. */
		facts?: string;
		/** The rows under the status; undefined where the reader gives none. */
		rows?: string;
	},
	k: Classes
): string {
	const find = `<button type="button" class="find-btn raakvlak ${k.head}" tabindex="-1"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.8"/><path d="M10.6 10.6 14 14"/></svg><span class="${k.head}">Zoek<span class="find-rest ${k.head}"> in dit stuk</span></span></button>`;
	return (
		`<div class="reader-head ${k.head}">` +
		`<div class="reader-line ${k.head}"><div class="reader-kind ${k.head}" data-later>${o.kind}</div></div>` +
		`<h1 class="reader-title ${k.head}">${titleParts(o.title).map(esc).join('<wbr>')}</h1>` +
		(o.under === undefined ? '' : `<div class="reader-onder ${k.head}">${o.under}</div>`) +
		`<span class="reader-status__acties ${k.head}" data-later><span class="kop-acties ${k.actions}"><span class="ev-actions"></span></span>${find}</span>` +
		`<div class="reader-status ${k.head}">` +
		(o.status === undefined
			? ''
			: `<div class="reader-status__woorden ${k.head}" data-later>${o.status}</div>`) +
		(o.facts ? `<div class="reader-facts ${k.head}" data-later>${o.facts}</div>` : '') +
		'</div>' +
		(o.rows === undefined ? '' : `<div class="reader-rijen ${k.head}" data-later>${o.rows}</div>`) +
		'</div>'
	);
}

/** The strip of a bron's facts (Feiten `strip`), its cells given. */
export const factStrip = (cells: string, k: Classes) =>
	`<div class="strip-edge ${k.facts}"><dl class="feiten strip ${k.facts}" aria-label="Kenmerken">${cells}</dl></div>`;

/** A cell of the strip (Veld): its label over its value. */
export const fact = (label: string, value: string) =>
	`<div class="field"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;

/** The peildatum of a law as a cell of the strip (WholeLawReaderPeildatum `asFact`): the text of
 *  today, or of an expired law its last one. */
export function asOfFact(expired: boolean, last: string | null, k: Classes): string {
	const day = langeDatum(expired ? last : vandaag());
	return `<div class="field ${k.peil}"><dt class="${k.peil}">${peildatumLabel(expired)}</dt><dd class="as-fact ${k.peil}"><div class="tekstmenu ${k.textMenu}"><button type="button" class="btn tekstmenu__knop ${k.textMenu}" tabindex="-1">${esc(day)}${caret(k)}</button></div></dd></div>`;
}

/** The glyph of a kind of bron (KindGlyph), in its shape. */
export function glyph(collection: Collection, size: number, k: Classes): string {
	const v = VORMEN[VORM_VAN[collection] ?? 'overig'];
	const line = v.wijze === 'lijn';
	return `<svg class="kind-glyph ${k.glyph}" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true" fill="${line ? 'none' : 'currentColor'}" stroke="${line ? 'currentColor' : 'none'}" stroke-width="${line ? 2 : 0}" fill-rule="${v.wijze === 'gat' ? 'evenodd' : 'nonzero'}"><path class="${k.glyph}" d="${v.d}"></path></svg>`;
}

/** The storage of what headings a reader opened (dicht.svelte.ts). */
const FOLDS = 'concordans:kopjes';

/** Whether a section of a reader, by its key, stands open in this browser (dicht.svelte.ts). */
export function sectionOpen(key: string): boolean {
	try {
		return JSON.parse(localStorage.getItem(FOLDS) ?? '{}')?.[key] === true;
	} catch {
		return false;
	}
}

/** A section of a reader as it stands closed (Sectie): its heading, its glyph and count. */
export const closedSection = (
	title: string,
	collection: Collection,
	count: number | null,
	k: Classes
) =>
	`<section class="sectie section-block is-dicht ${k.section}"><h3 class="kop ${k.section}">` +
	`<button type="button" class="fold-knop raakvlak ${k.fold}" tabindex="-1">${glyph(collection, 14, k)}${esc(title)}` +
	(count === null ? '' : `<span class="aantal ${k.section}">${formatCount(count)}</span>`) +
	`<svg class="caret is-side ${k.caret}" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false"><path d="M2 3.75 5 6.75 8 3.75"></path></svg></button></h3></section>`;
