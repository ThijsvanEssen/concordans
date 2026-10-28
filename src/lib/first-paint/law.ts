// The first paint of a law of the BWB: the reader's column as the app sets it (ReaderFrame,
// BelongsTo, ReaderHead, WholeLawReader, WholeLawReaderArticle, ArticleText), in the app's own
// elements and classes, from what the server puts in the page (api/seo/paint.py of the API):
// the law's answer, the first articles of its list with their text of today, its basis and the
// bill that made it. The words come from the functions the app's reader uses (law-head,
// instrument-meta, division, law-article-text). The title, the official title and the first
// articles show; the band, the kind, the status and the actions stand in their place unseen
// (`data-later`) until the app has come.
import { findBucket } from '$lib/api/buckets';
import type { NodeGraph } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import { validityOf } from '$lib/api/validity';
import { layerOf } from '$lib/bron/behoort-layer';
import { naamVanId } from '$lib/bron/menselijk';
import { partsOf } from '$lib/text/article-parts';
import { articleName } from '$lib/text/bw';
import { coverageLine } from '$lib/text/coverage';
import { langeDatum } from '$lib/text/datum';
import { basisHeadLines } from '$lib/text/delegaties';
import { newSections } from '$lib/text/division';
import { formatCount } from '$lib/text/getal';
import { lawName, metaOf } from '$lib/text/instrument-meta';
import { articleText as shownText, type Row } from '$lib/text/law-article-text';
import {
	lawCitationRecord,
	lawFullTitle,
	lawHeadFacts,
	lawKind,
	treatyLink
} from '$lib/text/law-head';
import { kindName } from '$lib/text/law-kind';
import { statusOf } from '$lib/text/validity';
import { ARTICLES_SOURCE, articleTextHtml } from './article';
import type { Classes } from './classes';
import {
	band,
	coverage,
	esc,
	fact,
	factStrip,
	glyph,
	headRow,
	asOfFact,
	readerHead
} from './markup';
import type { PaintedColumn } from './paint';

type Detail = Schema<'InstrumentDetailDTO'>;
type Listed = Schema<'InstrumentArticleNodeDTO'>;
type Today = Pick<
	Schema<'InstrumentArticleVersionDTO'>,
	'article_number' | 'text' | 'parts' | 'tables' | 'headings' | 'footnote_marks' | 'footnotes'
>;

/** What the server gives of a law (api/seo/paint.py). */
export type LawPaint = {
	kind: 'law';
	bwb_id: string;
	/** Its answer of `/api/instruments/{bwb_id}`. */
	instrument: Detail;
	/** Its articles in force, and its annexes, counted. */
	total: number;
	annexes: number;
	/** The first of its list (`/articles`), a preview only where its text of today is not there. */
	articles: Listed[];
	/** Their texts of today (`/articles/at/{today}`). */
	texts: Today[];
	/** The laws its Gelet op names (`/basis`). */
	basis: Schema<'InstrumentBasisItem'>[];
	/** Its light node of the bill that made it (`LEGISLATED_IN`). */
	light: NodeGraph;
};

/** The characters of text the paint sets, more than a screen of them. */
const TEXT = 6000;

/** Contents beside the text from this many entries (contents-state's MIN_ENTRIES). */
const MIN_ENTRIES = 2;

/** The bill that made a law, its line in the band (behoort-rules, `instruments`). */
const LEGISLATED_IN = {
	relation: 'LEGISLATED_IN',
	direction: 'outbound',
	collection: 'dossiers'
} as const;

/** The rows of the list as the reader holds them (law-list's loadPage), each with its text of
 *  today. */
function listRows(v: LawPaint): Row[] {
	const texts = new Map(v.texts.map((t) => [t.article_number, t]));
	return v.articles.map((a) => {
		const own = a.article_number ? texts.get(a.article_number) : undefined;
		return {
			textToday: own?.text ?? null,
			partsToday: own?.parts?.length ? own.parts : null,
			tablesToday: own?.tables ?? [],
			headingsToday: own?.headings ?? [],
			footnoteMarksToday: own?.footnote_marks ?? [],
			footnotesToday: own?.footnotes ?? [],
			id: a.id,
			key: a.key,
			article_number: a.article_number ?? null,
			label: a.label ?? null,
			heading: a.heading ?? null,
			address: a.article_number ?? a.address ?? null,
			breadcrumb: a.breadcrumb ?? [],
			text: null,
			parts: null,
			tables: [],
			footnoteMarks: [],
			footnotes: [],
			text_preview: a.text_preview ?? null
		};
	});
}

/** The column of the reader of a law, and whether contents stand beside it; null where the
 *  paint does not set it (no article it sets as the app does). */
export function lawPaint(v: LawPaint, k: Classes): PaintedColumn | null {
	const d = v.instrument;
	const bwbId = v.bwb_id;
	const rows = listRows(v);
	// The articles before the first whose text the paint does not set as the app does: one
	// without its text of today (the app asks it alone), with a table or a note.
	const stop = rows.findIndex((r) => {
		const t = shownText(r, undefined);
		return (
			!t ||
			t.tables.length > 0 ||
			t.footnoteMarks.length > 0 ||
			t.footnotes.length > 0 ||
			partsOf(t.text, t.parts).length === 0
		);
	});
	const before = stop < 0 ? rows : rows.slice(0, stop);
	// More than a screen of text, as a judgment's and a Kamerstuk's paint: the app adds the rest.
	let size = 0;
	const enough = before.findIndex((r) => (size += shownText(r, undefined)!.text.length) >= TEXT);
	const shown = enough < 0 ? before : before.slice(0, enough + 1);
	if (!shown.length) return null;
	const meta = metaOf(bwbId, d);
	const title = lawName(meta, d.citation_title ?? d.title ?? bwbId);
	const body = shown
		.map(
			(r, i) =>
				newSections(shown[i - 1], r, title)
					.map((s) => section(s, k))
					.join('') + article(r, bwbId, k)
		)
		.join('');
	return {
		html:
			headRow(bandOf(v, k), k, false) +
			`<article class="whole-law ${k.law}">${head(v, title, k)}${body}</article>`,
		contents: v.total + v.annexes >= MIN_ENTRIES
	};
}

/** The band "Behoort bij" of a law: the bill that made it, where the data has one. */
function bandOf(v: LawPaint, k: Classes): string {
	const n = findBucket(v.light, LEGISLATED_IN)?.items?.[0];
	if (!n) return '';
	const l = layerOf(n, 'Dossier');
	return band(
		ARTICLES_SOURCE,
		[{ term: 'Wetsvoorstel', layers: [{ name: l.naam, short: l.kort, link: !!l.ref }] }],
		k,
		{ phone: false }
	);
}

/** The head (ReaderHead with WholeLawReader's words): kind, title, official title, status. */
function head(v: LawPaint, title: string, k: Classes): string {
	const d = v.instrument;
	const meta = metaOf(v.bwb_id, d);
	const record = lawCitationRecord(v.bwb_id, d, meta);
	const full = lawFullTitle(d, title);
	const facts = lawHeadFacts(d, {
		count: v.total,
		peildatum: null,
		longDate: (day: string) => langeDatum(day),
		formatCount,
		validity: validityOf(d)
	});
	const cells =
		facts.dates.map((f) => fact(f.label, f.value)).join('') +
		// Its peildatum, while its versions are asked the day it shows (WholeLawReaderPeildatum).
		(d.article_count === 0 && v.total === 0
			? ''
			: asOfFact(validityOf(d)?.state === 'expired', null, k)) +
		facts.counts.map((f) => fact(f.label, f.value)).join('');
	return readerHead(
		{
			kind: `${glyph('instruments', 12, k)}<span class="${k.head}">${esc(lawKind(d))}</span>`,
			title: record.heading,
			// The row under the title stands, empty or not: the reader gives it always (onderTitel).
			under: full
				? `<details class="full-title ${k.fullTitle}"><summary class="raakvlak ${k.fullTitle}">Volledige titel</summary><p class="${k.fullTitle}">${esc(full)}</p></details>`
				: '',
			status: status(v, k) ?? undefined,
			facts: cells ? factStrip(cells, k) : undefined,
			// The rows under the head stand, empty or not: the reader gives them always (a peildatum).
			rows: ''
		},
		k
	);
}

/** The laws of a Gelet op named first (WholeLawReader's GROUNDS_SHOWN); the rest opens in place. */
const GROUNDS_SHOWN = 3;

/** The words of the status line: whether it holds, what the data lacks, its grondslag, its
 *  treaty; null where it has none (the reader draws no empty line). */
function status(v: LawPaint, k: Classes): string | null {
	const d = v.instrument;
	const validity = validityOf(d);
	const s = validity ? statusOf(validity, 'wet') : null;
	let out = '';
	if (s) {
		const next = validity?.successors[0] ?? null;
		const name = next ? (next.citation_title ?? next.title) : null;
		out += `<span class="validity ${k.validity}"><span class="${s.negative ? 'validity__no' : 'validity__status'} ${k.validity}">${esc(s.text)}</span>${next && name ? `, opvolger: <a>${esc(name)}</a>` : ''}</span>`;
	}
	const ministry = d.ministry_name ?? d.ministry;
	if (d.ministry && ministry) out += `<span>Ministerie: <a>${esc(ministry)}</a>.</span>`;
	if (coverageLine(d.completeness))
		out += `<p class="whole-count ${k.law}">${coverage(d.completeness, k)}</p>`;
	const kind = kindName(d.kind);
	if (/^BWBR/i.test(v.bwb_id) && kind && !/wet$/i.test(kind))
		for (const part of basisHeadLines(v.basis)) {
			const shown = part.wetten.slice(0, GROUNDS_SHOWN);
			const rest = part.wetten.length - shown.length;
			out +=
				`<p class="whole-count ${k.law}">${esc(part.werkwoord)} ` +
				shown
					.map(
						(w, i) =>
							(i > 0 ? (i === shown.length - 1 && !rest ? ' en ' : ', ') : '') +
							`<a>${esc(w.naam)}</a>`
					)
					.join('') +
				(rest > 0
					? ` en <button type="button" class="tekstlink raakvlak ${k.textLink}" tabindex="-1">${formatCount(rest)} andere</button>`
					: '') +
				'.</p>';
		}
	const treaty = treatyLink(d, d.same_treaty ?? []);
	if (treaty) out += `<p class="whole-count ${k.law}"><a>${esc(treaty.label)}</a></p>`;
	return out || null;
}

/** A layer of the law that begins at an article: its designation once, its heading under it. */
function section(s: ReturnType<typeof newSections>[number], k: Classes): string {
	const c = k.law;
	const words = s.title
		? `<span class="whole-section-label ${c}">${esc(s.label ?? '')}</span><span class="whole-section-title ${c}">${esc(s.title)}</span>`
		: `<span class="whole-section-title ${c}">${esc(s.label ?? '')}</span>`;
	return `<h2 class="whole-section whole-section--depth-${Math.min(s.depth, 2)} ${c}">${words}</h2>`;
}

/** An article of the law (WholeLawReaderArticle): its number and opschrift, its text. */
function article(r: Row, bwbId: string, k: Classes): string {
	const c = k.lawArticle;
	const t = shownText(r, undefined)!;
	const name = articleName(bwbId, r.article_number, r.label) ?? naamVanId(r.id);
	const heading =
		r.heading && r.article_number
			? `<span class="whole-art-heading ${c}">${esc(` ${r.heading}`)}</span>`
			: '';
	return (
		`<section class="whole-article ${c}" data-artikel="${esc(r.address ?? '')}">` +
		`<div class="whole-article-head ${c}"><a class="whole-article-jump ${c}"><span class="whole-art-num ${c}">${esc(name)}</span>${heading}</a></div>` +
		articleTextHtml(
			{ text: t.text, parts: t.parts ?? undefined, headings: t.headings, law_id: bwbId },
			[],
			k
		) +
		'</section>'
	);
}
