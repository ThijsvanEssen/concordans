// The first paint of an article: the reader's column as the app sets it (ReaderFrame,
// BelongsTo, ReaderHead, ArticleReader, ArticleText), in the app's own elements and classes,
// from what the server puts in the page (api/seo/paint.py of the API). The words come from
// the functions the app's reader uses (article-head, behoort-wet, article-parts), so the lines
// are the app's. The title and the text show; what the app shows only once it has come (the
// band, the place, the status, the actions) stands in its place unseen (`data-later`), so it
// takes its room and the text does not move when the app takes over.
import type { Schema } from '$lib/api/types';
import type { Validity } from '$lib/api/validity';
import { citeDate, validityOf } from '$lib/api/validity';
import { lawLineWords, type LawLayer, type LawSource } from '$lib/bron/law-line';
import { dossierOwnName, kamerstukNummer } from '$lib/bron/dossier-naam';
import {
	dossierExplanation,
	explanatoryLabel,
	headTitle,
	originVerbOf,
	ownExplanation,
	versionLabelOf,
	type Explanatory
} from '$lib/text/article-head';
import { articleCitation } from '$lib/text/cite';
import { citationRecord } from '$lib/text/citation-record';
import { langeDatum, vandaag } from '$lib/text/datum';
import { formatCount } from '$lib/text/getal';
import { peildatumLabel } from '$lib/text/peildatum-label';
import { lawShortName } from '$lib/text/bw';
import { titleParts } from '$lib/text/title-parts';
import { markerOf, onderdeelMark, partsOf, type ArticlePart } from '$lib/text/article-parts';
import { coverageLine, type Completeness } from '$lib/text/coverage';
import { placeOf, type Division } from '$lib/text/division';
import { withHeadings, type Heading } from '$lib/text/headings';
import { statusOf } from '$lib/text/validity';
import { blocksOf } from '$lib/text/tables';
import { wordingsOf } from '$lib/text/version-diff';
import { joinParts, textOf } from '$lib/text/words';
import { uniqueBy } from '$lib/util/unique';
import type { Classes } from './classes';

type Dossier = {
	key: string;
	number: string;
	title?: string | null;
	short_title?: string | null;
	exists?: boolean;
};
/** A version as the history lists it, of the fields the head reads. */
type Version = Pick<
	Schema<'ArticleVersionListedDTO'>,
	| 'key'
	| 'valid_from'
	| 'valid_until'
	| 'current'
	| 'change'
	| 'text_changed'
	| 'changes'
	| 'amended_by'
>;

/** What the server gives of an article (api/seo/paint.py): the fields of its API answers. */
export type ArticlePaint = {
	kind: 'article';
	article: {
		law_id?: string | null;
		bwb_id?: string | null;
		official_id?: string | null;
		article_number?: string | null;
		label?: string | null;
		heading?: string | null;
		display_name?: string | null;
		repealed?: boolean;
		validity?: unknown;
		text?: string | null;
		parts?: { id: string; kind: string; number?: string | null; start: number; end: number }[];
		tables?: unknown[];
		headings?: Heading[];
		footnote_marks?: unknown[];
		footnotes?: unknown[];
	};
	instrument?: {
		bwb_id?: string | null;
		celex?: string | null;
		display_name?: string | null;
		signed_on?: string | null;
		official_url?: string | null;
	} | null;
	completeness?: Completeness | null;
	versions?: Version[];
	explained?: Parameters<typeof ownExplanation>[0];
	mvt?: { key: string; title?: string | null; kind?: string | null } | null;
	law?: LawSource | null;
	node?: Record<string, unknown>;
	/** Vorig and Volgend; `listed` whether its law's list holds it, which gives its place. */
	steps?: { listed: boolean; prev: boolean; next: boolean };
	/** The formulas of delegation in the text (GrondslagFormule): a control whose words break
	 *  as one. */
	delegations?: { start: number; end: number }[];
};

/** The source an article is under, first in its band (sourceOfCollection in $lib/nav/sources,
 *  which reads the app's page: a test keeps the two equal). */
export const ARTICLES_SOURCE = 'Wetten';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** Whether the paint sets the text as the app does: leden, onderdelen, paragraphs and
 *  headings. A table or a footnote is the app's alone (TextTable, the notes). */
export function paintable(a: ArticlePaint['article']): boolean {
	return (
		!!a.text?.trim() &&
		!a.tables?.length &&
		!a.footnote_marks?.length &&
		!a.footnotes?.length &&
		partsOf(a.text, a.parts ?? null).length > 0
	);
}

/** The column of the reader of an article, in the classes `k` of its components. */
export function articleColumn(v: ArticlePaint, k: Classes): string {
	const a = v.article;
	const node = v.node ?? {};
	const wordings = wordingsOf(v.versions ?? []);
	const current = wordings.at(-1)?.until === null ? wordings.at(-1)! : null;
	const lapse = wordings.at(-1)?.lapsed ? wordings.at(-1)! : null;
	const onScreen = current;
	const validity = validityOf(a) as Validity | null | undefined;
	const showStatus = statusOf(validity) !== null;
	const instrument = v.instrument ?? null;
	const euAct = instrument?.celex && !instrument.bwb_id ? instrument : null;
	const label = versionLabelOf({
		stubLabel: null,
		shown: null,
		showStatus,
		officialId: a.official_id,
		validity,
		repealed: !!a.repealed,
		lapseFrom: lapse?.from,
		euAct: !!euAct,
		validFrom: current?.from ?? textOf(node.valid_from)
	});
	const wordingDossier = onScreen?.first.amended_by?.dossiers?.[0] ?? null;
	const since = onScreen?.from ?? null;
	const versionKeys = onScreen?.versions.map((x) => x.key) ?? [];
	const dossier = wordingDossier?.exists === false ? null : (wordingDossier?.number ?? null);
	const explanatory: Explanatory | null =
		ownExplanation(v.explained ?? [], versionKeys, since) ??
		(v.mvt && dossier ? dossierExplanation(v.mvt, dossier, since) : null);
	// The law's names as the reader has them once the article is in (recordInstrument, of the
	// law of its band), and the article's name in its record: "Artikel 6:162 BW".
	const props = v.law?.props ?? {};
	const lawTitle = textOf(props.title) ?? textOf(v.law?.display_name) ?? null;
	const cited = textOf(props.citation_title) ?? null;
	const meta = {
		title: lawTitle ?? cited,
		citationTitle: cited ?? lawTitle,
		shortTitle: lawShortName(a.law_id ?? a.bwb_id, textOf(props.abbreviation))
	};
	const citation = articleCitation(a, {
		own: textOf(node.instrument_citation_title),
		meta,
		displayName: instrument?.display_name,
		adopted: euAct ? { on: euAct.signed_on ?? null } : null
	});
	const recorded = citation
		? citationRecord({ ...citation, kind: 'article', date: citeDate(validity) })?.heading
		: null;
	const caret = `<svg class="caret ${k.caret}" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false"><path d="M2 3.75 5 6.75 8 3.75"></path></svg>`;

	const coverage = (c: Completeness | null | undefined, source?: string) => {
		const line = coverageLine(c);
		return line
			? `<span class="dekking ${k.coverage}">${esc(line)}${source ? `, <a class="${k.coverage}">${esc(source)} ↗</a>` : ''}</span>`
			: '';
	};
	let status = '';
	if (showStatus) {
		const s = statusOf(validity)!;
		const next = validity?.successors[0] ?? null;
		const name = next ? (next.citation_title ?? next.title) : null;
		status += `<span class="validity ${k.validity}"><span class="${s.negative ? 'validity__no' : 'validity__status'} ${k.validity}">${esc(s.text)}</span>${next && name ? `, opvolger: <a>${esc(name)}</a>` : ''}</span>`;
	} else if (label === null) {
		status += coverage(
			{ versions: { state: 'not_in_source', as_of: euAct?.signed_on ?? null } },
			euAct?.official_url ? 'EUR-Lex' : undefined
		);
	} else if (label) {
		status += `<span class="head__stand ${k.reader}">${esc(label)}</span>`;
	}
	status += coverage(v.completeness);
	if (wordings.length > 1)
		status += `<span class="menu ${k.reader}"><button type="button" class="btn ${k.reader}" tabindex="-1">${formatCount(wordings.length)} tekstversies${caret}</button></span>`;
	if (explanatory)
		status += `<a class="head__mvt ${k.reader}">${esc(explanatoryLabel(explanatory))}<span class="head__mvt-mark ${k.reader}" aria-hidden="true">↓</span></a>`;

	const dossiers = uniqueBy(onScreen?.first.amended_by?.dossiers ?? [], (d) => d.key);
	const origin = dossiers.length
		? `<div class="head__origin ${k.reader}"><span class="head__item ${k.reader}">${esc(originVerbOf(onScreen))} ${dossiers.map((d) => dossierLink(d, k)).join(', ')}</span></div>`
		: '';

	const steps = v.steps ?? { listed: false, prev: false, next: false };
	const place = placeOf(
		steps.listed && Array.isArray(node.breadcrumb) ? (node.breadcrumb as Division[]) : [],
		instrument?.display_name ?? null
	);
	const lawName = joinParts([
		textOf(node.instrument_citation_title) ?? instrument?.display_name ?? null
	]);
	const glyph = `<svg class="kind-glyph ${k.glyph}" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"></svg>`;
	const placeLine = place?.title
		? `<div class="reader-place ${k.head}" data-later>${glyph}<i class="${k.head}">${esc(place.title)}</i></div>`
		: `<div class="reader-kind ${k.head}" data-later>${glyph}<span class="${k.head}">Artikel</span>${lawName ? `<span class="reader-juris ${k.head}">, ${esc(lawName)}</span>` : ''}</div>`;
	const nav =
		steps.prev || steps.next
			? `<nav class="reader-nav ${k.reader}" data-later>${steps.prev ? `<a class="reader-nav-link raakvlak ${k.reader}">← Vorig</a>` : ''}${steps.next ? `<a class="reader-nav-link raakvlak reader-nav-link--next ${k.reader}">Volgend →</a>` : ''}</nav>`
			: '';
	const compare =
		wordings.length > 1 ? `<a class="btn head__compare ${k.reader}">Vergelijken${caret}</a>` : '';
	const head =
		`<div class="reader-head ${k.head}">` +
		`<div class="reader-line reader-line--plaats ${k.head}">${placeLine}${nav}</div>` +
		`<h1 class="reader-title ${k.head}">${titleParts(headTitle(a, recorded)).map(esc).join('<wbr>')}</h1>` +
		`<div class="reader-status ${k.head}">` +
		`<div class="reader-status__woorden ${k.head}" data-later>${status}</div>` +
		`<div class="reader-status__later ${k.head}"></div>` +
		`<span class="reader-status__acties ${k.head}" data-later>${compare}<span class="kop-acties ${k.actions}"><span class="ev-actions"></span></span></span>` +
		'</div>' +
		`<div class="reader-rijen ${k.head}" data-later>${euAct ? '' : peildatum(validity, onScreen?.from ?? null, k, caret)}${origin}</div>` +
		'</div>';

	return (
		`<div class="kop-rij ${k.frame}">` +
		`<div class="kop-rij__band kop-rij__band--held ${k.frame}" data-later>${belongsTo(v.law ?? undefined, node, k)}</div>` +
		`<div class="head-actions ${k.frame}" data-later><button type="button" class="btn ${k.frame}" tabindex="-1">Zoek in dit stuk</button></div>` +
		'</div>' +
		head +
		`<div class="reader-body ${k.reader}">${text(a, v.delegations ?? [], k)}</div>`
	);
}

/** A dossier as DossierLink names it: a link where the data holds it, its number where not. */
function dossierLink(d: Dossier, k: Classes): string {
	const number = esc(kamerstukNummer(d.number));
	if (d.exists === false) return `<span>${number}</span>`;
	const name = dossierOwnName(d);
	return `<a><span class="dossier ${k.dossierName}">${number}${name ? `<span class="naam ${k.dossierName}"> ${esc(name)}</span>` : ''}</span></a>`;
}

/** The band "Behoort bij" of an article (BelongsTo): its one line, Wet › … › its division. */
function belongsTo(law: LawSource | undefined, props: Record<string, unknown>, k: Classes): string {
	const { term, law: own, divisions } = lawLineWords(law, props, true);
	const layers: LawLayer[] = [...(own ? [own] : []), ...divisions];
	if (!layers.length) return '';
	const folded = layers.length > 3;

	const layer = (l: LawLayer, last: boolean) =>
		`<li class="${last ? 'laatst ' : ''}${k.belongsTo}"><a class="raakvlak ${k.belongsTo}"><span class="vol ${k.belongsTo}">${esc(l.name)}</span>${l.short ? `<span class="kort ${k.belongsTo}">${esc(l.short)}</span>` : ''}</a></li>`;
	const items = folded
		? layer(layers[0], false) +
			`<li class="vouw ${k.belongsTo}"><button class="raakvlak ${k.belongsTo}" type="button" tabindex="-1">…</button></li>` +
			layer(layers.at(-1)!, true)
		: layers.map((l, i) => layer(l, i === layers.length - 1)).join('');
	return `<nav class="behoort ${k.belongsTo}"><dl class="regels ${k.belongsTo}"><div class="regel ${k.belongsTo}"><a class="soort raakvlak ${k.belongsTo}">${ARTICLES_SOURCE}</a><span class="scheiding ${k.belongsTo}" aria-hidden="true">›</span><dt class="term ${k.belongsTo}">${esc(term)}</dt><dd class="${k.belongsTo}"><ol class="lagen${folded ? ' gevouwen' : ''} ${k.belongsTo}">${items}</ol></dd></div></dl></nav>`;
}

/** The peildatum of the law (WholeLawReaderPeildatum): the text of today, or of an expired
 *  law its last one. */
function peildatum(
	validity: Validity | null | undefined,
	last: string | null,
	k: Classes,
	caret: string
): string {
	const expired = validity?.state === 'expired';
	const label = peildatumLabel(expired);
	const day = langeDatum(expired ? last : vandaag());
	return `<div class="whole-peil ${k.peil}"><span class="${k.peil}">${label}</span><div class="tekstmenu ${k.textMenu}"><button type="button" class="btn tekstmenu__knop ${k.textMenu}" tabindex="-1">${esc(day)}${caret}</button></div></div>`;
}

type Formulas = { start: number; end: number }[];

/** The words of `text[start, end)`, a formula of delegation in it as the one control it is in
 *  the reader (a button, which breaks as one). */
function words(text: string, start: number, end: number, formulas: Formulas): string {
	let out = '';
	let at = start;
	for (const f of formulas) {
		if (f.start < at || f.end > end) continue;
		out +=
			esc(text.slice(at, f.start)) +
			`<span class="ev-formula">${esc(text.slice(f.start, f.end))}</span>`;
		at = f.end;
	}
	return out + esc(text.slice(at, end));
}

/** The paragraphs and headings of `text[start, end)`, as ArticleText's `tekst` sets them. */
function paragraphs(
	text: string,
	start: number,
	end: number,
	headings: Heading[],
	formulas: Formulas,
	k: Classes
): string {
	return blocksOf(text, start, end, [])
		.flatMap((piece) => withHeadings(text, piece, headings))
		.map((p) => {
			const inline = words(text, p.start, p.end, formulas);
			return p.heading
				? `<p class="tussenkop ${k.text}">${inline}</p>`
				: `<p class="${k.text}">${inline}</p>`;
		})
		.join('');
}

/** A part and its children (ArticleText's `render`). */
function part(
	text: string,
	p: ArticlePart,
	top: boolean,
	o: { mark: '.' | ')'; headings: Heading[]; formulas: Formulas },
	k: Classes
): string {
	const { mark, headings, formulas } = o;
	const inner =
		paragraphs(text, p.textStart, p.textEnd, headings, formulas, k) +
		p.children.map((c) => part(text, c, false, o, k)).join('') +
		(p.children.length
			? paragraphs(text, Math.max(...p.children.map((c) => c.end)), p.end, headings, formulas, k)
			: '');
	if (top) {
		const no = p.kind === 'lid' ? `${p.number}.` : p.number ? markerOf(p.number, mark) : '';
		return `<div class="lid lid--${p.kind} ${k.text}"><span class="lid__no ${k.text}">${esc(no)}</span><div class="lid__body ${k.text}"><div class="lid__text ${k.text}">${inner}</div></div></div>`;
	}
	const no =
		p.number && p.id
			? `<span class="part__number ${k.text}">${esc(markerOf(p.number, mark))}</span>`
			: '';
	return `<div class="part part--${p.kind} ${k.text}">${no}<div class="part__body ${k.text}">${inner}</div></div>`;
}

/** The text (ArticleText): its leden, their numbers in the margin, the onderdelen. */
function text(a: ArticlePaint['article'], formulas: Formulas, k: Classes): string {
	const source = a.text ?? '';
	const o = {
		mark: onderdeelMark(a.law_id ?? a.bwb_id),
		headings: a.headings ?? [],
		formulas: [...formulas].sort((x, y) => x.start - y.start)
	};
	const parts = partsOf(source, a.parts ?? null)
		.map((p) => part(source, p, true, o, k))
		.join('');
	return `<div class="article-text-box ${k.text}"><div class="article-text ${k.text}">${parts}</div></div>`;
}
