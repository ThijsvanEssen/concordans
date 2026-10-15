// What a row of Actueel and Gevolgd says it is tied to, without a click (API 0.79.55, #626):
// a publication the laws it enacts and changes, an inwerkingtreding the publication that
// brought it and the law it is issued under, a letter the motions it answers, a commitment
// the letters that answer it, an amendment the articles it changes, a changed paper the one
// it replaces, a judgment the articles it cites; of a followed law, how the row is tied to it
// (`via`). Each a line of words with its bronnen as links, so each opens in place.
import { capitalize, count, joinAnd, separatorBefore } from '$lib/text/words';
import { korteDatum } from '$lib/text/datum';
import { isLetter, motionOrAmendment } from '$lib/text/document-kind';
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { changeAround, changeVerb } from '$lib/verbonden/relation-words';
import { changeRelation } from '$lib/vocabulary';
import { headSurname } from './home-stream';
import { artikelenGewijzigd, publicationCite, type FeedItem } from './feed';

/** A piece of a line: words, or a bron by its id and its readable address. */
type Schakel = { tekst: string; ref?: string; href?: string | null };

/** A line: what it says (`Gaat in op`), then its pieces. */
export type Verband = { label: string; delen: Schakel[] };

type Link = NonNullable<FeedItem['replaces']>;
type Artikel = Schema<'FeedArticleDTO'>;
type Wet = Schema<'FeedChangedInstrumentDTO'>;

/** Bronnen named on one line; the rest counted. */
const GENOEMD = 6;

/** `A, B en C`, each piece a bron: the pieces between them words. */
function opsomming(lijst: Schakel[][], max = GENOEMD): Schakel[] {
	const getoond = lijst.slice(0, max);
	const rest = lijst.length - getoond.length;
	const uit: Schakel[] = [];
	getoond.forEach((stuk, i) => {
		if (i > 0) uit.push({ tekst: separatorBefore(i, getoond.length, rest > 0) });
		uit.push(...stuk);
	});
	if (rest > 0) uit.push({ tekst: ` en ${count(rest, 'ander', 'andere')}` });
	return uit;
}

const artikelen = (n: number) => count(n, 'artikel', 'artikelen');

// ── A publication ───────────────────────────────────────────────────────

/**
 * `Stelt vast: Cyberbeveiligingswet`, `Wijzigt: Telecommunicatiewet (5 artikelen), …`: the
 * laws of a publication per effect, in the order the feed gives them; a law it enacts
 * without a count, the one it changes with the articles it changes.
 */
export function publicatieVerbanden(p: FeedItem['publication']): Verband[] {
	const perEffect = new Map<Wet['effect'], Wet[]>();
	const gezien = new Set<string>();
	for (const w of p?.instruments ?? []) {
		const k = `${w.effect}/${w.key}`;
		if (gezien.has(k)) continue;
		gezien.add(k);
		perEffect.set(w.effect, [...(perEffect.get(w.effect) ?? []), w]);
	}
	return [...perEffect].map(([effect, wetten]) => ({
		label: changeVerb(changeRelation(effect)),
		delen: opsomming(
			wetten.map((w) => [
				{ tekst: w.title ?? naamVanId(`instruments/${w.key}`), ref: `instruments/${w.key}` },
				...(effect !== 'establishes' && w.article_count
					? [{ tekst: ` (${artikelen(w.article_count)})` }]
					: [])
			])
		)
	}));
}

// ── An inwerkingtreding ─────────────────────────────────────────────────

/** Up to this many articles a version changed are named; more are counted. */
const ARTIKELEN_GENOEMD = 4;

/** `art. 10 en 19bis`. */
const artNummers = (nummers: readonly string[]) => `art. ${joinAnd(nummers)}`;

/**
 * What a new version of a law is: `Art. 2 gewijzigd bij Stcrt. 2026, 17140`, `111 artikelen,
 * vastgesteld bij Stb. 2026, 187`; then the law a regulation is issued under, `Krachtens
 * Uitvoeringswet huurprijzen woonruimte, art. 10 en 19bis`. The publication and the law each
 * a bron.
 */
export function inwerkingVerbanden(c: FeedItem['commencement']): Verband[] {
	if (!c) return [];
	const uit: Verband[] = [];
	const pub = c.publication;
	const cited = pub ? publicationCite(pub) : null;
	const bij: Schakel[] = cited
		? [
				{ tekst: c.new ? ', vastgesteld bij ' : ' bij ' },
				{
					tekst: cited,
					...(pub?.key ? { ref: `instruments/${pub.key}` } : {}),
					href: pub?.path ?? null
				}
			]
		: [];
	const nummers = c.articles ?? [];
	const wat = c.new
		? c.article_count
			? artikelen(c.article_count)
			: 'Nieuw'
		: nummers.length && nummers.length <= ARTIKELEN_GENOEMD
			? `${capitalize(artNummers(nummers))} gewijzigd`
			: capitalize(artikelenGewijzigd(c) ?? '') || (pub ? 'Gewijzigd' : '');
	if (wat) uit.push({ label: '', delen: [{ tekst: wat }, ...bij] });
	const basis = c.based_on;
	if (basis?.instrument)
		uit.push({
			label: 'Krachtens',
			delen: [
				{
					tekst: basis.instrument.title ?? naamVanId(`instruments/${basis.instrument.key}`),
					ref: `instruments/${basis.instrument.key}`
				},
				...(basis.articles?.length ? [{ tekst: `, ${artNummers(basis.articles)}` }] : [])
			]
		});
	return uit;
}

// ── Papers and articles ─────────────────────────────────────────────────

/** `motie-Kathmann (36764, nr. 31)`, `toezegging TZ202609-124`, `brief van 7 okt. 2026`. */
export function stukNaam(l: Link, eigenDossier?: string | null): string {
	const kind = (l.kind ?? '').trim();
	if (kind === 'toezegging') return `toezegging${l.number ? ` ${l.number}` : ''}`;
	const soort =
		motionOrAmendment(kind) ?? (isLetter(kind) ? 'brief' : kind.toLowerCase() || 'stuk');
	const wie = soort !== 'brief' && l.surname ? `-${headSurname(l.surname)}` : '';
	const nr = l.number ? `nr. ${l.number}` : '';
	const plek =
		l.dossier && l.dossier !== eigenDossier ? [l.dossier, nr].filter(Boolean).join(', ') : nr;
	const datum = soort === 'brief' && !plek && l.date ? ` van ${korteDatum(l.date)}` : '';
	return `${soort}${wie}${datum}${plek ? ` (${plek})` : ''}`;
}

const stuk = (l: Link, eigenDossier?: string | null): Schakel[] => [
	{ tekst: stukNaam(l, eigenDossier), ref: l.id, href: l.path ?? null }
];

/**
 * Papers and commitments as a line names them: several commitments by their numbers after
 * the word once, `toezeggingen TZ202604-062 en TZ202604-064`.
 */
function stukken(lijst: readonly Link[], eigenDossier: string | null): Schakel[][] {
	const allemaal = lijst.length > 1 && lijst.every((l) => l.kind === 'toezegging' && l.number);
	if (!allemaal) return lijst.map((l) => stuk(l, eigenDossier));
	return lijst.map((l, n) => [
		...(n === 0 ? [{ tekst: 'toezeggingen ' }] : []),
		{ tekst: l.number!, ref: l.id, href: l.path ?? null }
	]);
}

/** `art. 3, 4 en 7 Awb`: the articles of one law after each other, the law once. */
function artikelLijst(lijst: readonly Artikel[]): Schakel[] {
	const perWet = new Map<string, Artikel[]>();
	for (const a of lijst) {
		const wet = a.law_short ?? a.law ?? '';
		perWet.set(wet, [...(perWet.get(wet) ?? []), a]);
	}
	const delen = [...perWet].map(([wet, as]): Schakel[] => [
		{ tekst: 'art. ' },
		...opsomming(
			as.map((a) => [
				{
					tekst: a.number ?? naamVanId(`articles/${a.key}`),
					ref: `articles/${a.key}`,
					href: a.path ?? null
				}
			]),
			Number.POSITIVE_INFINITY
		),
		...(wet ? [{ tekst: ` ${wet}` }] : [])
	]);
	return opsomming(delen, GENOEMD);
}

/**
 * The papers and articles a row is tied to, per kind: a letter `Gaat in op motie-Kathmann
 * (36764, nr. 31)`, a commitment `Beantwoord in brief van 7 okt. 2026`, an amendment
 * `Wijzigt art. 3 en 4 Cbw`, a changed paper `Ter vervanging van nr. 19`, a judgment `Noemt
 * art. 7:12 Awb`.
 */
export function relatieVerbanden(i: FeedItem): Verband[] {
	const eigen = i.dossier?.number ?? null;
	const uit: Verband[] = [];
	if (i.answers?.length)
		uit.push({ label: 'Gaat in op', delen: opsomming(stukken(i.answers, eigen)) });
	if (i.answered_by?.length)
		uit.push({
			label: 'Beantwoord in',
			delen: opsomming(stukken(i.answered_by, eigen))
		});
	if (i.amends_articles?.length) {
		const perEffect = new Map<string, Artikel[]>();
		for (const a of i.amends_articles) {
			const w = changeVerb(changeRelation(a.effect ?? 'amends'));
			perEffect.set(w, [...(perEffect.get(w) ?? []), a]);
		}
		for (const [label, as] of perEffect) uit.push({ label, delen: artikelLijst(as) });
	}
	if (i.replaces) {
		const r = i.replaces;
		const nr = r.number ? `nr. ${r.number}` : stukNaam(r, eigen);
		const tekst = r.dossier && r.dossier !== eigen ? `${r.dossier}, ${nr}` : nr;
		uit.push({
			label: 'Ter vervanging van',
			delen: [{ tekst, ref: r.id, href: r.path ?? null }]
		});
	}
	if (i.cites?.length) uit.push({ label: 'Noemt', delen: artikelLijst(i.cites) });
	return uit;
}

// ── A followed law ──────────────────────────────────────────────────────

/**
 * How a row is tied to the law (and article) followed, `wet` its name: `Wijzigt art. 3
 * Cyberbeveiligingswet`, `Stelt Cyberbeveiligingswet vast`, `In dossier 36764`. Null without
 * `via`.
 */
export function viaTekst(via: FeedItem['via'], wet?: string | null): string | null {
	if (!via) return null;
	const naam = wet?.trim() || 'de wet';
	const doel = via.article ? `art. ${via.article}${wet?.trim() ? ` ${wet.trim()}` : ''}` : naam;
	if (via.dossier) return `In dossier ${via.dossier}`;
	switch (via.relation) {
		case 'establishes':
			return capitalize(changeAround('ESTABLISHES', 'instruments', naam));
		case 'amends':
			return capitalize(changeAround('AMENDS', 'articles', doel));
		case 'introduces':
			return capitalize(
				changeAround('INTRODUCES', 'articles', via.article ? doel : `artikelen in ${naam}`)
			);
		case 'repeals':
			return capitalize(
				via.article
					? changeAround('REPEALS', 'articles', doel)
					: changeAround('REPEALS', 'instruments', naam)
			);
		case 'proposes':
			return `Stelt wijziging van ${doel} voor`;
		case 'version_of':
			return `Nieuwe versie van ${doel}`;
		case 'based_on':
			return `Krachtens ${doel}`;
		case 'refers_to':
			return `Noemt ${doel}`;
		case 'legislated_in':
			return 'Wetgevingsdossier';
		default:
			return null;
	}
}

/** The law followed: its BWB id and its name. */
export type Gevolgd = { bwb: string; titel: string };

/**
 * The tie to the law followed where the row does not say it already: not the dossier its
 * row names, not a law its publication or its new version names, not an article its
 * amendment changes or its judgment cites, not a law its regulation is issued under.
 */
export function viaRegel(i: FeedItem, wet: Gevolgd | null | undefined): string | null {
	const via = i.via;
	if (!via || !wet) return null;
	const sleutel = wet.bwb.toLowerCase();
	const vanWet = (bwb: string | null | undefined, key?: string) =>
		(bwb ?? key?.split('_')[0] ?? '').toLowerCase() === sleutel;
	const artikelGenoemd = (lijst: readonly Artikel[]) =>
		lijst.some((a) => vanWet(a.bwb_id, a.key) && (!via.article || a.number === via.article));
	if (via.dossier) return i.dossier?.number === via.dossier ? null : viaTekst(via, wet.titel);
	switch (via.relation) {
		case 'establishes':
		case 'amends':
		case 'introduces':
		case 'repeals':
			if (!via.article && (i.publication?.instruments ?? []).some((w) => vanWet(w.key)))
				return null;
			break;
		case 'proposes':
			if (artikelGenoemd(i.amends_articles ?? [])) return null;
			break;
		case 'refers_to':
			if (artikelGenoemd(i.cites ?? [])) return null;
			break;
		case 'version_of':
			if (!via.article && vanWet(i.commencement?.instrument?.key)) return null;
			break;
		case 'based_on': {
			const b = i.commencement?.based_on;
			if (b && vanWet(b.instrument.key) && (!via.article || b.articles?.includes(via.article)))
				return null;
			break;
		}
	}
	return viaTekst(via, wet.titel);
}
