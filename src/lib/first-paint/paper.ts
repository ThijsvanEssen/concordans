// The first paint of a Kamerstuk: the reader's column as the app sets it (ReaderFrame,
// BelongsTo, ReaderHead, DocumentReader, SubmitterLine, PlaceNumber), in the app's own elements
// and classes, from what the server puts in the page (api/seo/paint.py of the API): its answer
// with its first alineas and its light node. The words come from the functions the app's reader
// uses (anchor's paperParagraphs and paperBlocks, paper-record, submitters, voetnoten). The
// title, the indieners and the first alineas show; the band, the kind, the status and the
// actions stand in their place unseen (`data-later`) until the app has come.
import { findBucket } from '$lib/api/buckets';
import type { NodeGraph } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import { layerOf } from '$lib/bron/behoort-layer';
import { naamVan } from '$lib/bron/menselijk';
import { fromDocument, groupSubmitters, type Submitter } from '$lib/bron/submitters';
import { motionKindLabel } from '$lib/text/motion-kind';
import { hasOwnOutcome, numberWord, replacementsOf } from '$lib/text/vervanging';
import { langeDatum } from '$lib/text/datum';
import { voteBarOf, type VoteBarModel, type VoteSide } from '$lib/votes/stembalk';
import { decidingVote, hasSides, voteLineOf } from '$lib/votes/vote-line';
import { numeralOf, paperBlocks, paperParagraphs, type PaperBlock } from '$lib/text/anchor';
import { korteDatum } from '$lib/text/datum';
import { belongsToBill, isCoverLetter, motionOrAmendment, ownKind } from '$lib/text/document-kind';
import { formatCount } from '$lib/text/getal';
import { paperRecord } from '$lib/text/paper-record';
import { stukNoten } from '$lib/text/voetnoten';
import { capitalize, joinParts, separatorBefore, textOf } from '$lib/text/words';
import type { Classes } from './classes';
import {
	band,
	caret,
	coverage,
	esc,
	glyph,
	headRow,
	readerHead,
	sectionHead,
	sectionOpen,
	type BandLine
} from './markup';
import type { PaintedColumn } from './paint';

type Doc = Schema<'DocumentTextResponse'>;

/** What the server gives of a Kamerstuk (api/seo/paint.py). */
export type PaperPaint = {
	kind: 'paper';
	/** Its answer of `/api/documents/{key}`, its text up to the end of an alinea. */
	document: Doc;
	/** Whether `document.text` is its whole text. */
	whole: boolean;
	/** Its sections, counted: the contents beside the text list them. */
	section_count: number;
	/** The headings of its sections past its first part that a line in it repeats: the reader
	 *  leaves such a line out ("Voorzitter: Beckerman"). */
	headings?: string[];
	/** The widest numbers of all its alineas, for the margin they stand in. */
	numbers?: string[];
	/** Its light node of its dossier, zaak, debate and bijlagen, with the props its citation
	 *  reads. */
	light: NodeGraph;
};

/** The source a Kamerstuk is under, first in its band (sourceOfCollection: a test keeps the
 *  two equal). */
export const PAPERS_SOURCE = 'Kamerstukken';

/** Contents beside the text from this many entries (contents-state's MIN_ENTRIES). */
const MIN_ENTRIES = 2;

const bucket = (relation: string, direction: 'inbound' | 'outbound', collection: string) => ({
	relation,
	direction,
	collection
});
const TO_DOSSIER = bucket('PART_OF', 'outbound', 'dossiers');
const TO_CASE = bucket('PART_OF', 'outbound', 'cases');
const MADE_IN = bucket('MADE_IN', 'outbound', 'activities');
const TO_LETTER = bucket('ACCOMPANIES', 'outbound', 'documents');
const ATTACHMENTS = bucket('ACCOMPANIES', 'inbound', 'documents');

type Entry =
	| { type: 'heading'; start: number; section: Schema<'SectionDTO'> }
	| { type: 'para'; start: number; block: PaperBlock };

/** The column of the reader of a Kamerstuk, and whether contents stand beside it; null where
 *  the paint does not set it: a line of its band the app asks apart (its bill, what a letter
 *  offers), or nothing it sets as the app does. */
export function paperPaint(v: PaperPaint, k: Classes): PaintedColumn | null {
	const doc = v.document;
	if (!doc.text) return null;
	// The vote that settled it, in the head; a vote without its fracties is asked apart.
	const deciding = settledBy(doc);
	if (deciding && !hasSides(deciding)) return null;
	const sections = sectionHeads(doc, deciding, k);
	const props = (v.light.node?.props ?? {}) as Record<string, unknown>;
	const kind = textOf(props.kind) ?? doc.kind ?? '';
	if (
		(findBucket(v.light, TO_CASE)?.total ?? 0) > 0 &&
		(belongsToBill(kind) || isCoverLetter(kind))
	)
		return null;
	const items = body(v, k);
	if (!items) return null;
	const [lines, more] = paperBandOf(v, kind);
	return {
		html:
			headRow(band(PAPERS_SOURCE, lines, k, { phone: false, more }), k) +
			`<div class="r-document ${k.paper}">${head(v, props, k)}${sections}${items}</div>`,
		contents: v.section_count >= MIN_ENTRIES
	};
}

/** The band "Behoort bij" of a Kamerstuk (behoort-rules, `documents`): its dossier, the debate
 *  it was made in, the letter it accompanies. */
export function paperBandOf(v: PaperPaint, kind: string): [BandLine[], string | null] {
	const lines: BandLine[] = [];
	const line = (term: string, n: Schema<'NeighborDTO'> | undefined, layerKind: string) => {
		if (!n) return;
		const l = layerOf(n, layerKind);
		lines.push({ term, layers: [{ name: l.naam, short: l.kort, link: !!l.ref }] });
	};
	line(
		motionOrAmendment(kind) ? 'Ingediend bij' : 'Dossier',
		findBucket(v.light, TO_DOSSIER)?.items?.[0],
		'Dossier'
	);
	const debate = findBucket(v.light, MADE_IN)?.items?.[0];
	line(debate?.meta?.reason === 'ingediend' ? 'Ingediend in' : 'Verslag van', debate, 'Activiteit');
	line('Bijlage bij', findBucket(v.light, TO_LETTER)?.items?.[0], 'Brief');
	// What a phone's first line folds away (BelongsTo's `knop`): the lines after it.
	return [lines, lines.length > 1 ? 'Meer' : null];
}

/** The head (ReaderHead with DocumentReader's words): kind and date, title, indieners, status. */
function head(v: PaperPaint, props: Record<string, unknown>, k: Classes): string {
	const doc = v.document;
	const kind = motionKindLabel(doc.motion_kind) ?? ownKind(doc.kind) ?? 'Document';
	const caseKinds = (doc.case_kinds ?? []).filter(
		(c) => !doc.kind?.toLowerCase().startsWith(c.toLowerCase())
	);
	const parts = joinParts([doc.date ? korteDatum(doc.date) : null, ...caseKinds]);
	const title = doc.title ?? naamVan('documents', doc);
	const submitters = fromDocument(doc.submitters);
	const vote = settledBy(doc);
	return readerHead(
		{
			kind:
				`${glyph('documents', 12, k)}<span class="${k.head}">${esc(kind)}</span>` +
				(parts ? `<span class="reader-juris ${k.head}">, ${esc(parts)}</span>` : ''),
			title,
			// The row under the title stands, empty or not: the reader gives it always (onderTitel).
			under: submitters.length
				? `<p class="submitted ${k.paper}">${submitterLine(submitters, k)}</p>`
				: '',
			status: status(v, props, k),
			rows: vote ? voteLine(vote, k) : ''
		},
		k
	);
}

/** The indieners in one line (SubmitterLine): `Ingediend door X (F), mede namens Y (F)`. */
function submitterLine(list: Submitter[], k: Classes): string {
	const { by, with: others } = groupSubmitters(list);
	// A name and its fractie as the template sets them: the bracket closes a text of its own.
	// A name with its key, and a fractie (found by its name in the app's list), a link of a row's
	// height (NameLink, .raak-rij).
	const link = (name: string) => `<a class="raak-rij">${esc(name)}</a>`;
	const person = (s: Submitter) =>
		(s.memberKey ? link(s.name) : `<span>${esc(s.name)}</span>`) +
		(s.faction ? ` (${link(s.faction)})<!---->` : '');
	const names = (people: Submitter[]) =>
		people.map((s, i) => separatorBefore(i, people.length) + person(s)).join('');
	const words =
		(by.length ? `Ingediend door ${names(by)}` : '') +
		(others.length ? (by.length ? ', mede namens ' : 'Mede namens ') + names(others) : '');
	return words ? `<span class="submitters ${k.submitterLine}">${words}</span>` : '';
}

/** The status: its citation, what replaced it or what it replaces, its bijlagen, what of its
 *  references is linked. */
function status(v: PaperPaint, props: Record<string, unknown>, k: Classes): string {
	const doc = v.document;
	const cite = paperRecord(doc, props)?.short ?? null;
	let out = cite ? `<span class="${k.paper}">${esc(cite)}.</span>` : '';
	for (const z of replacementsOf(doc))
		out +=
			`<span class="vervanging ${k.replaced}">${esc(z.woord)} ${esc(numberWord(z.nrs))} ` +
			z.nrs.map((n, i) => separatorBefore(i, z.nrs.length) + `<a>${esc(n.nummer)}</a>`).join('') +
			'.</span>';
	const attachments = findBucket(v.light, ATTACHMENTS)?.total ?? 0;
	if (attachments > 0)
		out += `<span class="bijlagen ${k.attachments}"><button type="button" class="knop ${k.attachments}" tabindex="-1">Bijlagen <span class="aantal ${k.attachments}">${formatCount(attachments)}</span>${caret(k)}</button></span>`;
	return out + coverage(doc.completeness, k);
}

/** The text (DocumentReader's body): its headings and alineas up to the first with a table or
 *  a note, an alinea's number in the margin; null where it sets none. */
function body(v: PaperPaint, k: Classes): string | null {
	const doc = v.document;
	const c = k.paper;
	const paragraphs = paperParagraphs(doc);
	const sections = doc.sections ?? [];
	// The headings past its first part count too: a number or a label before one joins no block.
	const blocks = paperBlocks(paragraphs, {
		...doc,
		sections: [...sections, ...(v.headings ?? []).map((heading) => ({ heading }))]
	} as Doc);
	const notes = stukNoten(doc.footnotes ?? [], paragraphs, sections);
	const headings = new Set([
		...sections.map((s) => s.heading.trim().toLowerCase()),
		...(v.headings ?? [])
	]);
	const entries: Entry[] = [
		...sections.map((section) => ({
			type: 'heading' as const,
			start: section.char_start,
			section
		})),
		...blocks
			.filter((b) => !(b.lines.length === 1 && headings.has(b.line.text.trim().toLowerCase())))
			.map((block) => ({ type: 'para' as const, start: block.start, block }))
	].sort((a, b) => a.start - b.start || (a.type === 'heading' ? -1 : 1));
	const stop = entries.findIndex(
		(e) =>
			e.type === 'para' &&
			(e.block.tables.length > 0 ||
				e.block.lines.some((l) => notes.markers.has(l.i) || notes.naSectie.has(l.i)))
	);
	let shown = stop < 0 ? entries : entries.slice(0, stop);
	// Of a first part, its last alinea may join what follows it (a question's number, an
	// answer's label), and a heading at its end goes with what follows it.
	if (!v.whole && stop < 0) shown = shown.slice(0, -1);
	if (!v.whole || stop >= 0)
		while (shown.length && shown[shown.length - 1].type === 'heading') shown = shown.slice(0, -1);
	if (!shown.some((e) => e.type === 'para')) return null;
	const html = shown
		.map((e) => {
			if (e.type === 'heading') {
				const s = e.section;
				const level = Math.min(s.level, 3);
				const badge =
					s.kind === 'article' && s.article_refs?.length
						? ` <span class="heading__badge ${c}">${esc(s.article_refs.map((r) => r.number).join(', '))}</span>`
						: '';
				return `<div class="heading heading--lvl${level} ${c}" id="${esc(s.id)}"><h${level + 2} class="heading__text ${c}"><button type="button" class="heading__knop ${c}" tabindex="-1">${esc(s.heading)}${badge}</button></h${level + 2}></div>`;
			}
			const b = e.block;
			const p = b.line;
			const place = p.n !== null && p.at !== null;
			// The number of a question as the source prints it before it hangs in the margin.
			const numeral = b.numeral ? numeralOf(b.numeral.text) : null;
			const number =
				place && p.first
					? `<button type="button" class="plaats-marker plaats-nummer${b.numeral ? '' : ' quiet'} ${k.placeNumber}" tabindex="-1">${esc(b.numeral ? (numeral ?? '') : String(p.n ?? ''))}</button>`
					: '';
			const label = b.answerLabel
				? `<span class="answer-label ${k.paragraphWords}">${esc(b.answerLabel.text)}</span>`
				: '';
			return (
				`<div class="body-para plaats-blok${place ? ' body-para--plaats' : ''} ${c}"${p.id ? ` id="${esc(p.id)}"` : ''}>` +
				(b.numeral
					? `<span class="${c}"${b.numeral.id ? ` id="${esc(b.numeral.id)}"` : ''}></span>`
					: '') +
				number +
				`<div class="body-para__tekst${place ? ' is-klikbaar' : ''} ${c}"><p class="${b.question ? 'question ' : ''}${k.paragraphWords}">${label}${esc(p.text)}</p></div></div>`
			);
		})
		.join('');
	return `<div class="body ${c}">${html}${margin(v.numbers ?? [], k)}</div>`;
}

/** The numbers of the alineas the paint leaves to the app, unseen: the margin is measured over
 *  all of them, as the reader's is (place-column). */
const margin = (numbers: string[], k: Classes) =>
	numbers.length
		? `<div class="${k.paper}" aria-hidden="true" style="position: absolute; visibility: hidden; height: 0; overflow: hidden">${numbers.map((n) => `<span class="plaats-nummer quiet ${k.placeNumber}">${esc(n)}</span>`).join('')}</div>`
		: '';

type Decision = Schema<'DecisionDTO'>;

/** The vote that settled a stuk, where it has an outcome of its own (DocumentReader). */
const settledBy = (doc: Doc): Decision | null =>
	hasOwnOutcome(doc) ? decidingVote(doc.decisions, doc.decision) : null;

/** The mark of an outcome and its word (Uitkomst). */
const outcome = (tone: string, word: string | null, k: Classes) =>
	`<span class="uk uk--${tone} ${k.outcome}"><span class="vak ${k.outcome}" aria-hidden="true"></span>${word ? `<span class="w ${k.outcome}">${esc(word)}</span>` : ''}</span>`;

/** A vote at rest (VoteLine): its outcome and day, its bar, the fracties per side. */
function voteLine(d: Decision, k: Classes): string {
	const c = k.voteLine;
	const line = voteLineOf(d);
	const bar = voteBarOf(d, line.word);
	const when = line.date
		? `<span class="${c}">&nbsp;op <a>${esc(langeDatum(line.date))}</a></span>`
		: '';
	const how = line.how ? `<span class="${c}">, ${esc(line.how)}</span>` : '';
	const sides = line.sides
		.filter((s) => s.names.length)
		.map((s) => {
			const tone = /^voor$/i.test(s.choice) ? 'ja' : /^tegen$/i.test(s.choice) ? 'nee' : 'open';
			const word = capitalize(s.choice.toLowerCase());
			const names = s.names
				.map(
					(n, i) =>
						(i > 0 ? ', ' : '') +
						esc(n) +
						(s.seats[i] ? `&nbsp;<span class="zetels ${c}">${s.seats[i]}</span>` : '')
				)
				.join('');
			return `<p class="side ${c}"><span class="choice ${c}">${outcome(tone, word, k)}</span> <span class="${c}">${names}</span></p>`;
		})
		.join('');
	return (
		`<div class="vote-line ${c}"><p class="outcome ${c}">${outcome(line.tone, line.word, k)}${when}${how}</p>` +
		(bar ? stembalk(bar, k) : '') +
		sides +
		'</div>'
	);
}

/** The bar of a vote (Stembalk): voor from the left, tegen from the right, the majority. */
function stembalk(m: VoteBarModel, k: Classes): string {
	const c = k.voteBar;
	const pct = (seats: number) => `${(seats / m.total) * 100}%`;
	const partsOf = (side: VoteSide) =>
		m.parts[side].length > 0 ? m.parts[side] : [{ name: '', seats: m.counts[side] }];
	const part = (side: VoteSide) =>
		partsOf(side)
			.map((p) => `<span class="part part--${side} ${c}" style="flex: 0 0 ${pct(p.seats)}"></span>`)
			.join('');
	const left = (['for', 'other'] as VoteSide[])
		.filter((s) => m.counts[s] > 0)
		.map(part)
		.join('');
	return (
		`<figure class="stembalk ${c}"><div class="row ${c}">` +
		`<span class="figure ${c}"><b class="${c}">${m.counts.for}</b> voor</span>` +
		`<div class="field with-label ${c}"><div class="bar ${c}">${left}<span class="rest ${c}"></span>${part('against')}</div>` +
		`<span class="line ${c}" style="left: ${pct(m.total / 2)}" aria-hidden="true"></span>` +
		`<span class="label ${c}" style="left: ${pct(m.total / 2)}" aria-hidden="true">meerderheid ${m.majority}</span></div>` +
		`<span class="figure ${c}"><b class="${c}">${m.counts.against}</b> tegen</span>` +
		'</div>' +
		table(m, c) +
		'</figure>'
	);
}

/** The vote per fractie for a screen reader, where it names them (Stembalk's table). */
function table(m: VoteBarModel, c: string): string {
	const sides: VoteSide[] = ['for', 'against', 'other'];
	if (!sides.some((side) => m.parts[side].length)) return '';
	const word = { for: 'voor', against: 'tegen', other: 'niet deelgenomen' } as const;
	const rows = sides
		.flatMap((side) =>
			m.parts[side].map(
				(p) =>
					`<tr class="${c}"><td class="${c}">${esc(p.name)}</td><td class="${c}">${word[side]}</td><td class="${c}">${p.seats}</td></tr>`
			)
		)
		.join('');
	return `<table class="sr-only ${c}"><caption class="${c}">${esc(m.sentence)}</caption><thead class="${c}"><tr class="${c}"><th class="${c}">Fractie</th><th class="${c}">Keuze</th><th class="${c}">Zetels</th></tr></thead><tbody class="${c}">${rows}</tbody></table>`;
}

/**
 * The headings of the sections between the head and the text, open until the reader closed
 * them (Sectie): the articles a memorie explains (Licht toe), the other votes on it
 * (Stemming). Their rows are the app's.
 */
function sectionHeads(doc: Doc, deciding: Decision | null, k: Classes): string {
	const explained = (doc.explains ?? []).filter(
		(e) => e.collection === 'articles' && e.bwb_id && e.article_number
	);
	const others = (hasOwnOutcome(doc) ? (doc.decisions ?? []) : []).filter(
		(d) => d.key !== deciding?.key
	);
	const shown: (readonly [string, number | null])[] = [
		...(explained.length ? [['Licht toe', doc.explains!.length] as const] : []),
		...(others.length ? [['Stemming', null] as const] : [])
	];
	return shown.map(([title, count]) => sectionHead(title, count, sectionOpen(title), k)).join('');
}
