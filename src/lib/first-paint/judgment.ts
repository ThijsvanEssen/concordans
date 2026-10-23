// The first paint of a judgment: the reader's column as the app sets it (ReaderFrame,
// BelongsTo, ReaderHead, JudgmentReader, TextBlocks), in the app's own elements and classes,
// from what the server puts in the page (api/seo/paint.py of the API): the answer of the
// judgment with its first paragraphs, and its light node for the band. The words come from the
// functions the app's reader uses (judgment-text, citation-record, appeal-chain). The
// title, the summary, the parties and the first overwegingen show; the band, the kind, the
// status and the actions stand in their place unseen (`data-later`) until the app has come.
import type { Schema } from '$lib/api/types';
import type { NodeGraph } from '$lib/api/nodes';
import { findBucket } from '$lib/api/buckets';
import { layerOf, type Layer } from '$lib/bron/behoort-layer';
import { ADVISED, LATER, appealChain } from '$lib/bron/appeal-chain';
import { keyEcli } from '$lib/text/ecli';
import { articleRef } from '$lib/text/bw';
import { citationRecord } from '$lib/text/citation-record';
import { NOT_IN_DATA, type Completeness } from '$lib/text/coverage';
import { langeDatum } from '$lib/text/datum';
import { bevindingen, kenmerken, strekking } from '$lib/text/judgment-outcome';
import {
	bodyItems,
	judgmentParticipants,
	partiesByRole,
	partyNote,
	signatureStart,
	splitSummary,
	type BodyItem
} from '$lib/text/judgment-text';
import { blocksOf } from '$lib/text/tables';
import { uitspraakNoten } from '$lib/text/voetnoten';
import { formatCount } from '$lib/text/getal';
import { capitalize, count, textOf } from '$lib/text/words';
import { bronLabel } from '$lib/vocabulary';
import type { Classes } from './classes';
import type { PaintedColumn } from './paint';
import { band, coverage, esc, glyph, headRow, readerHead, running, type BandLine } from './markup';

type Judgment = Schema<'JudgmentDTO'>;
type Neighbor = Schema<'NeighborDTO'>;

/** What the server gives of a judgment (api/seo/paint.py). */
export type JudgmentPaint = {
	kind: 'judgment';
	/** Its answer of `/api/judgments/{ecli}`, its paragraphs the first of them, without citations. */
	judgment: Judgment;
	/** Whether `judgment.paragraphs` are all its paragraphs. */
	whole: boolean;
	/** The numbers of all its paragraphs, for the margin they stand in. */
	numbers?: string[];
	same_as?: { key: string; ecli?: string | null }[];
	conclusions?: Schema<'JudgmentDetailResponse'>['conclusions'];
	completeness?: Completeness | null;
	/** Its light node of the procesgang and the conclusie (`limit=1`), the props the band reads. */
	light: NodeGraph;
	/** The instances before its eerdere aanleg, the nearest first. */
	chain?: Neighbor[];
};

/** The source a judgment is under, first in its band (sourceOfCollection in $lib/nav/sources:
 *  a test keeps the two equal). */
export const JUDGMENTS_SOURCE = 'Uitspraken';

/** The articles outside the dataset the head names (JudgmentReader's OUTSIDE_SHOWN). */
const OUTSIDE_SHOWN = 6;
/** The parties a role shows before "en N meer" (JudgmentReader's PARTIES_PREVIEW). */
const PARTIES_PREVIEW = 6;
/** Contents beside the text from this many entries (contents-state's MIN_ENTRIES). */
const MIN_ENTRIES = 2;

/** The column of the reader of a judgment, and whether contents stand beside it; null where
 *  the paint does not set it (nothing to show, or its contents unknown from its first part). */
export function judgmentColumn(v: JudgmentPaint, k: Classes): PaintedColumn | null {
	const j = v.judgment;
	const paragraphs = j.paragraphs ?? [];
	// Its parties the API read (`parties`); of one normalized before, the app reads them from
	// its whole text, which the paint has not.
	if (!paragraphs.length || j.withdrawn || j.translation_of || !j.parties) return null;
	const notes = uitspraakNoten(j.footnotes).perAlinea;
	const all = bodyItems(
		v.whole ? paragraphs.slice(0, signatureStart(paragraphs)) : paragraphs,
		notes
	);
	const hasSummary = !!j.summary?.trim();
	const participants = judgmentParticipants(j);
	const entries =
		(hasSummary ? 1 : 0) +
		(participants.length ? 1 : 0) +
		all.filter((it) => it.kind === 'heading' || it.kind === 'rov').length;
	if (!v.whole && entries < MIN_ENTRIES) return null;
	const items = shown(all, v.whole);
	if (!items.length) return null;
	// With numbers, all text stands in one column and the numbers hang left of it: the numbers
	// of its paragraphs tell where its first part has none.
	const numbered = all.some((it) => it.kind === 'rov') || !!v.numbers?.length;
	const [lines, o] = bandOf(v);
	const body =
		`<div class="reader-body${numbered ? ' reader-body--numbered' : ''} ${k.judgment}">` +
		items.map((it) => item(it, k)).join('') +
		margin(v.numbers ?? [], k) +
		'</div>';
	return {
		html:
			headRow(band(JUDGMENTS_SOURCE, lines, k, o), k) +
			head(v, k) +
			(hasSummary ? summary(j.summary!, k) : '') +
			(participants.length ? parties(participants, k) : '') +
			body,
		contents: entries >= MIN_ENTRIES
	};
}

/** The items the paint sets: those before the first with footnotes or a table (the app's
 *  alone), and of a first part not a heading at its end, which may head what is cut. */
function shown(items: BodyItem[], whole: boolean): BodyItem[] {
	const stop = items.findIndex(
		(it) => (it.kind === 'rov' || it.kind === 'prose') && (it.noten?.length || it.tables?.length)
	);
	const kept = stop < 0 ? items : items.slice(0, stop);
	if (whole && stop < 0) return kept;
	let end = kept.length;
	while (end > 0 && kept[end - 1].kind !== 'rov' && kept[end - 1].kind !== 'prose') end--;
	return kept.slice(0, end);
}

/** The band "Behoort bij" of a judgment (behoort-rules, `judgments`): Conclusie bij, the
 *  procesgang with the instances before its eerdere aanleg, the group of more appeals. */
export function bandOf(
	v: JudgmentPaint
): [
	BandLine[],
	{ phone: boolean; more: string | null; groups: { label: string; count: number }[] }
] {
	const props = (v.light.node?.props ?? {}) as Record<string, unknown>;
	const lines: { term: string; layers: Layer[] }[] = [];
	const advised = findBucket(v.light, ADVISED)?.items?.[0];
	if (advised) lines.push({ term: 'Conclusie bij', layers: [layerOf(advised, 'Arrest')] });
	const { earlier, gang } = appealChain(props, v.light);
	if (gang.length) {
		const before = earlier.at(-1)?.ref ? (v.chain ?? []) : [];
		const instances = [...before].reverse().map((n) => layerOf(n, 'Eerdere aanleg'));
		lines.push({ term: 'Procesgang', layers: [...instances, ...gang] });
	}
	const appeals = findBucket(v.light, LATER)?.total ?? 0;
	const groups = appeals >= 2 ? [{ label: 'Hoger beroep of cassatie', count: appeals }] : [];
	// What a phone's first line folds away (BelongsTo's `knop`).
	const hidden = Math.max(lines.length - 1, 0) + groups.length;
	const more = !hidden
		? null
		: lines.length === 0 && groups.length === 1
			? groups[0].label
			: lines.length > 1
				? 'Meer'
				: count(groups.length, 'groep', 'groepen');
	return [
		lines.map((l) => ({
			term: l.term,
			layers: l.layers.map((x) => ({
				name: x.naam,
				short: x.kort,
				link: !!x.ref,
				outcome: x.uitkomst,
				current: x.huidig
			}))
		})),
		{ phone: false, more, groups }
	];
}

/** The head (ReaderHead with JudgmentReader's words): kind and court, title, status, rows. */
function head(v: JudgmentPaint, k: Classes): string {
	const j = v.judgment;
	const conclusion = j.decision_kind === 'conclusie';
	const record = citationRecord({ ...j, kind: 'judgment' });
	const title =
		(record ? record.full : (j.display_name ?? 'Uitspraak')) +
		(j.names?.length ? ` (${j.names.join(', ')})` : '');
	const court = textOf(j.props?.court);
	const kind =
		`${glyph('judgments', 12, k)}<span class="${k.head}">${esc(conclusion ? 'Conclusie' : bronLabel('judgments'))}</span>` +
		(court ? `<span class="reader-juris ${k.head}">, ${esc(court)}</span>` : '');
	return readerHead(
		{ kind, title, status: status(v, k) + coverage(v.completeness, k), rows: rows(v, k) },
		k
	);
}

/** The status sentence: kind, date, case number, how it ended; the conclusies after it. */
function status(v: JudgmentPaint, k: Classes): string {
	const j = v.judgment;
	const conclusion = j.decision_kind === 'conclusie';
	const words = [
		j.decision_kind && !conclusion ? capitalize(j.decision_kind) : null,
		langeDatum(textOf(j.props?.date)),
		textOf(j.props?.case_number),
		...kenmerken(j)
	].filter(Boolean);
	const own = conclusion ? strekking(j.conclusion_outcome) : null;
	const echr = bevindingen(j.echr_findings);
	const conclusions = (v.conclusions ?? []).map((c) => {
		const name = citationRecord({ ...c, kind: 'judgment' })?.short ?? c.ecli;
		const how = strekking(c.outcome);
		return (c.id ? `<a>${esc(name)}</a>` : esc(name)) + (how ? `, ${esc(how)}` : '');
	});
	const parts = [
		words.length || own ? `${esc([...words, own].filter(Boolean).join(', '))}.` : '',
		echr ? `${esc(capitalize(echr))}.` : '',
		conclusions.join('; ')
	].filter(Boolean);
	return parts.length ? `<p class="${k.judgment}">${parts.join(' ')}</p>` : '';
}

/** The rows under the status: another publication of it, the articles it cites outside the
 *  data. */
function rows(v: JudgmentPaint, k: Classes): string {
	const j = v.judgment;
	const row = (inner: string) => `<p class="reader-translation ${k.judgment}">${inner}</p>`;
	let out = '';
	if (j.same_as)
		out += row(`Vervangen publicatie. De uitspraak staat onder <a>${esc(j.same_as)}</a>.`);
	else if (j.replaced_by)
		out += row(
			`Vervangen publicatie. De publicatie die haar vervangt, ${esc(j.replaced_by)}, staat ${NOT_IN_DATA}.`
		);
	else if (v.same_as?.length)
		out += row(
			`Ook gepubliceerd als ${v.same_as.map((o) => `<a>${esc(o.ecli ?? keyEcli(o.key) ?? 'Uitspraak')}</a>`).join(', ')}.`
		);
	const outside = j.unresolved_citations ?? [];
	if (outside.length)
		out += row(
			`Haalt ook aan, ${NOT_IN_DATA}: ` +
				outside
					.slice(0, OUTSIDE_SHOWN)
					.map((c) => {
						const name = esc(`${articleRef(null, c.article_number)} ${c.law}`);
						return c.paragraph_ids?.[0] ? `<a>${name}</a>` : name;
					})
					.join(', ') +
				(outside.length > OUTSIDE_SHOWN
					? ` en ${formatCount(outside.length - OUTSIDE_SHOWN)} meer`
					: '') +
				'.'
		);
	return out;
}

/** The summary (inhoudsindicatie), its paragraphs. */
const summary = (text: string, k: Classes) =>
	`<div class="reader-summary-block ${k.judgment}" id="summary">` +
	splitSummary(text)
		.map((p) => `<p class="reader-summary-para ${k.judgment}">${esc(p)}</p>`)
		.join('') +
	'</div>';

/** The parties, one row per role: the named listed, the pseudonymised counted. */
function parties(participants: ReturnType<typeof judgmentParticipants>, k: Classes): string {
	const c = k.judgment;
	const counsel = (line: string) => `<span class="reader-parties-counsel ${c}">${esc(line)}</span>`;
	const roles = partiesByRole(participants).map((g) => {
		const named = g.named.slice(0, PARTIES_PREVIEW);
		const derived = g.derived
			? ` <span class="reader-parties-derived ${c}">niet in de uitspraak</span>`
			: '';
		const names = named.map((p) => {
			const note = partyNote(p);
			return (
				`<span class="reader-party ${c}">${esc(p.name)}${note ? `<span class="reader-parties-party ${c}">${esc(` ${note}`)}</span>` : ''}</span>` +
				p.counsel.map(counsel).join('')
			);
		});
		const more =
			named.length < g.named.length
				? `<button type="button" class="tekstlink raakvlak ${k.textLink}" tabindex="-1">en ${formatCount(g.named.length - named.length)} meer</button>`
				: '';
		const anonymous = g.anonymous.length
			? `<span class="reader-parties-count ${c}">${g.named.length ? 'en ' : ''}${count(g.anonymous.length, 'geanonimiseerde partij', 'geanonimiseerde partijen')}</span>`
			: '';
		return (
			`<tr class="${c}"><th class="reader-parties-role ${c}">${esc(g.role)}${derived}</th>` +
			`<td class="reader-parties-name ${c}">${names.join('')}${more}${anonymous}${g.counsel.map(counsel).join('')}</td></tr>`
		);
	});
	return `<table class="reader-parties ${c}" id="parties"><tbody class="${c}">${roles.join('')}</tbody></table>`;
}

/** A text as TextBlocks sets it without tables and notes: one paragraph of CitedText. */
const blocks = (text: string, k: Classes) =>
	blocksOf(text, 0, text.length, [])
		.map((b) => `<p class="${k.textBlocks}">${running(text.slice(b.start, b.end), k)}</p>`)
		.join('');

/** An item of the body as JudgmentReader sets it. */
function item(it: BodyItem, k: Classes): string {
	const c = k.judgment;
	const id = (x: string | undefined) => (x ? ` id="${esc(x)}"` : '');
	if (it.kind === 'subheading') return `<p class="reader-subheading ${c}">${esc(it.text)}</p>`;
	if (it.kind === 'heading')
		return (
			`<div class="reader-heading ${c}"${id(it.id)}><h3 class="reader-heading__text ${c}">${esc(it.text)}</h3>` +
			`<span class="cite ${k.citeMenu}"><button type="button" class="btn is-text reader-heading__link raakvlak-knop ${k.citeMenu}" tabindex="-1">Citeer</button></span></div>`
		);
	if (it.kind === 'rov')
		return (
			`<div class="reader-para-block plaats-blok ${c}"${id(it.id)}>` +
			`<div class="reader-para-num ${c}"><button type="button" class="plaats-marker plaats-nummer ${k.placeNumber}" tabindex="-1">${esc(it.num)}</button></div>` +
			`<div class="reader-para-inner is-klikbaar ${c}">` +
			(it.subTitle ? `<p class="reader-para-subtitle ${c}">${esc(it.subTitle)}</p>` : '') +
			`<div class="reader-para ${c}">${blocks(it.body, k)}</div></div></div>`
		);
	return `<div class="reader-para reader-para--prose${it.within ? ' reader-para--within' : ''} ${c}"${id(it.id)}>${blocks(it.body, k)}</div>`;
}

/** The numbers of the paragraphs the paint leaves to the app, unseen: the margin is measured
 *  over all of them, as the reader's is (place-column). */
const margin = (numbers: string[], k: Classes) =>
	numbers.length
		? `<div class="reader-para-num ${k.judgment}" aria-hidden="true" style="position: absolute; visibility: hidden; height: 0; overflow: hidden">${numbers.map((n) => `<span class="plaats-nummer ${k.placeNumber}">${esc(n)}</span>`).join('')}</div>`
		: '';
