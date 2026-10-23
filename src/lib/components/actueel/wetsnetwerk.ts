// The network of the last passed bill, above Actueel on the start page: its dossier, the
// stukken that change a law, the articles they change and the judgments on the most
// changed one. Chosen by a rule, not by hand: the newest passed bill that changes articles.
// Its links are made as from outside the Verkenner, where the band stands.
import { isBill, motionOrAmendment, shortKind } from '$lib/text/document-kind';
import { count } from '$lib/text/words';
import { citationRecord } from '$lib/text/citation-record';
import { naamVanId } from '$lib/bron/menselijk';
import { formatCount } from '$lib/text/getal';
import { getChangedArticles } from '$lib/api/dossiers';
import { getFeed } from '$lib/api/feed';
import { getCitedByTop } from '$lib/api/articles';
import type { Schema } from '$lib/api/types';
import { buildBronHref } from '$lib/bron/href';
import { exploreHref } from '$lib/bron/address';
import type { Vorm } from '$lib/bron/vormen';
import {
	articleLabel,
	type ChangedArticles,
	type ChangedLaw,
	type DossierChange
} from '$lib/components/parliamentary/changed-articles';
import { dossierName } from '$lib/bron/dossier-naam';
import { kamerstukNummer } from '$lib/bron/dossier-naam';
import type { Chamber } from '$lib/components/parliamentary/chamber';
import { AMENDING_BILL_KINDS } from '$lib/votes/stages';

type FeedItem = Schema<'FeedItemDTO'>;
export type CitedBy = Schema<'ArticleCitedByResponse'>;

/** A bill the Kamer passed: by its dossier, the day and the Kamer. */
type Kandidaat = { number: string; naam: string; datum: string; kamer: Chamber };

/** The changed-articles asked at most, the summary's candidates and the older ones together. */
const POGINGEN = 4;

/**
 * The bills passed, newest first, each dossier once: a vote on a law that passed. On one day
 * the Eerste Kamer goes first, as its vote is the last.
 */
export function kandidaten(items: readonly FeedItem[]): Kandidaat[] {
	const out = new Map<string, Kandidaat>();
	const passed = items
		.filter(
			(i) =>
				i.kind === 'stemming' &&
				i.vote?.passed &&
				i.dossier &&
				AMENDING_BILL_KINDS.has(i.subkind ?? '')
		)
		.map((i) => ({
			number: i.dossier!.number,
			naam: dossierName(i.dossier!),
			datum: i.date,
			kamer: i.vote!.chamber
		}))
		.sort((a, b) => b.datum.localeCompare(a.datum) || a.kamer.localeCompare(b.kamer));
	for (const k of passed) if (!out.has(k.number)) out.set(k.number, k);
	return [...out.values()];
}

export type SchetsBron = {
	id: string;
	vorm: Vorm;
	label: string;
	sub?: string | null;
	href: string;
	/** A group stands for more bronnen than are drawn. */
	groep?: boolean;
};
type SchetsKolom = {
	titel: string;
	/** A law draws as a frame round its articles. */
	kader?: { label: string; href: string } | null;
	bronnen: SchetsBron[];
	/** Under the frame: what the column leaves out. */
	na?: SchetsBron | null;
};
export type Schets = {
	kandidaat: Kandidaat;
	kolommen: SchetsKolom[];
	lijnen: [string, string][];
	exploreHref: string;
	/** The chain in counts, for a narrow screen: stukken, articles, the law, judgments. */
	keten: {
		stukken: number;
		artikelen: number;
		wet: string;
		uitspraken: number | null;
		artikel: string;
	};
};

/** A stuk by its number in its dossier and its kind (`7`, `Nota van wijziging`); a
 *  publication has neither. */
const stukVan = (s: DossierChange['source']): { nr: string; soort: string } => ({
	nr: s.number ?? (s.sequence != null ? String(s.sequence) : ''),
	soort: s.official_id ? '' : shortKind(s.kind ?? '')
});

const isAmendement = (soort: string) => motionOrAmendment(soort) === 'amendement';
const nummer = (nr: string) => Number.parseInt(nr, 10) || Number.MAX_SAFE_INTEGER;

/** The articles to draw and the one the judgments are about. */
const ARTIKELEN = 4;

export function schetsVan(k: Kandidaat, ch: ChangedArticles, cb: CitedBy | null): Schets | null {
	const laws = [...ch.laws].sort((a, b) => b.total - a.total);
	const law = laws[0];
	if (!law || !law.changes.length) return null;
	const dossier: SchetsBron = {
		id: `dossiers/${k.number}`,
		vorm: 'dossier',
		label: k.naam,
		sub: kamerstukNummer(k.number),
		href: buildBronHref(null, { collection: 'dossiers', key: k.number, number: k.number })
	};
	const changes = laws.flatMap((l) => l.changes);

	// The stukken in the order of their number; the amendments as one group.
	const AMEND = 'groep/amendementen';
	const stukOf = new Map<string, string>();
	const stukken = new Map<string, SchetsBron & { nr: string }>();
	const amendementen = new Set<string>();
	for (const c of changes) {
		const { nr, soort } = stukVan(c.source);
		if (isAmendement(soort)) {
			amendementen.add(c.source.id);
			stukOf.set(c.source.id, AMEND);
			continue;
		}
		stukOf.set(c.source.id, c.source.id);
		if (!stukken.has(c.source.id))
			stukken.set(c.source.id, {
				id: c.source.id,
				nr,
				vorm: isBill(soort) ? 'voorstel' : 'stuk',
				label: soort || naamVanId(c.source.id, c.source.display_name),
				sub: nr ? `nr. ${nr}` : null,
				href: buildBronHref(null, { collection: 'documents', key: c.source.key ?? c.source.id })
			});
	}
	const stukLijst: SchetsBron[] = [...stukken.values()]
		.sort((a, b) => nummer(a.nr) - nummer(b.nr))
		.map(({ nr: _, ...s }) => s);
	if (amendementen.size)
		stukLijst.push({
			id: AMEND,
			vorm: 'stuk',
			label: count(amendementen.size, 'amendement', 'amendementen'),
			href: dossier.href,
			groep: true
		});

	// The articles of the law most changed, the most changed first.
	const OVERIG = 'groep/artikelen';
	const tel = new Map<string, { c: DossierChange; n: number; i: number }>();
	law.changes.forEach((c, i) => {
		const t = tel.get(c.article.id);
		if (t) t.n++;
		else tel.set(c.article.id, { c, n: 1, i });
	});
	const top = [...tel.values()].sort((a, b) => b.n - a.n || a.i - b.i).slice(0, ARTIKELEN);
	const getekend = new Set(top.map((t) => t.c.article.id));
	const artikelen: SchetsBron[] = top.map(({ c }) => ({
		id: c.article.id,
		vorm: 'regel-o',
		label: articleLabel(law.law, c.article),
		href: buildBronHref(null, { collection: 'articles', key: c.article.key ?? c.article.id })
	}));
	const rest = tel.size - top.length;
	if (rest > 0)
		artikelen.push({
			id: OVERIG,
			vorm: 'regel-o',
			label: count(rest, 'ander artikel', 'andere artikelen'),
			href: dossier.href,
			groep: true
		});
	const andereWetten = laws.length - 1;

	const lijnen: [string, string][] = stukLijst.map((s) => [dossier.id, s.id]);
	const seen = new Set<string>();
	for (const c of law.changes) {
		const van = stukOf.get(c.source.id)!;
		const naar = getekend.has(c.article.id) ? c.article.id : OVERIG;
		const key = `${van}>${naar}`;
		if (!seen.has(key)) {
			seen.add(key);
			lijnen.push([van, naar]);
		}
	}

	const kolommen: SchetsKolom[] = [
		{ titel: 'Dossier', bronnen: [dossier] },
		{ titel: 'Stukken die wijzigen', bronnen: stukLijst },
		{
			titel: 'Gewijzigde artikelen',
			kader: { label: lawName(law), href: lawHref(law) },
			bronnen: artikelen,
			na: andereWetten
				? {
						id: 'groep/wetten',
						vorm: 'regel',
						label: `en ${count(andereWetten, 'andere wet', 'andere wetten')}`,
						href: dossier.href,
						groep: true
					}
				: null
		}
	];

	const art = top[0].c.article;
	const artLabel = articleLabel(law.law, art);
	// The Verkenner gets at least what the band draws: the dossier, every stuk that changes
	// a law (the amendments one by one), every law it changes with the changed articles in
	// it (a chosen law keeps the articles its stukken amend), the article and its judgments.
	const alleStukken = [...new Map(changes.map((c) => [c.source.id, c.source])).values()]
		.map((s) => ({ id: s.id, nr: stukVan(s).nr }))
		.sort((a, b) => nummer(a.nr) - nummer(b.nr))
		.map((s) => s.id);
	const netwerk = [dossier.id, ...alleStukken, ...laws.map(lawNodeId), art.id];
	const uitspraken = cb?.judgment_total ?? null;
	if (cb && cb.judgment_total > 0) {
		const uniek = [...new Map(cb.items.map((i) => [i.judgment.id, i.judgment])).values()].slice(
			0,
			2
		);
		const us: SchetsBron[] = uniek.map((j) => ({
			id: j.id,
			vorm: 'uitspraak',
			label: j.ecli ?? naamVanId(j.id, j.display_name),
			sub: [
				// The judgment as it is cited: `HR 27 oktober 2009`.
				citationRecord({ ...j, kind: 'judgment' })?.short,
				j.inbound_citation_count ? `${j.inbound_citation_count}× aangehaald` : null
			]
				.filter(Boolean)
				.join(', '),
			href: buildBronHref(null, { collection: 'judgments', key: j.key ?? j.id })
		}));
		if (cb.judgment_total > uniek.length)
			us.push({
				id: 'groep/uitspraken',
				vorm: 'uitspraak',
				label: `${formatCount(cb.judgment_total)} uitspraken`,
				sub: `noemen ${artLabel.toLowerCase()}`,
				href: buildBronHref(null, { collection: 'articles', key: art.key ?? art.id }),
				groep: true
			});
		for (const u of us) lijnen.push([art.id, u.id]);
		kolommen.push({ titel: `Uitspraken over ${artLabel.toLowerCase()}`, bronnen: us });
		netwerk.push(...uniek.map((j) => j.id));
	}
	// No focus: the canvas takes the page, as the band's network grown, not a reader.
	const params = new URLSearchParams({ netwerk: netwerk.join(',') });
	return {
		kandidaat: k,
		kolommen,
		lijnen,
		exploreHref: exploreHref(params),
		keten: {
			stukken: stukken.size + amendementen.size,
			artikelen: tel.size,
			wet: lawName(law),
			uitspraken,
			artikel: artLabel
		}
	};
}

const lawName = (l: ChangedLaw) =>
	l.law.display_name ?? l.law.bwb_id ?? (l.law.id ? naamVanId(l.law.id) : 'Wet');
const lawKey = (l: ChangedLaw) =>
	(l.law.id ?? l.law.bwb_id ?? '').replace(/^instruments\//, '').toLowerCase();
const lawNodeId = (l: ChangedLaw) => `instruments/${lawKey(l)}`;
const lawHref = (l: ChangedLaw) =>
	buildBronHref(null, { collection: 'instruments', key: lawKey(l) });

/** The bills the Eerste Kamer passed before the summary's days: its votes are on bills only. */
async function oudere(today: string, signal?: AbortSignal): Promise<Kandidaat[]> {
	const { items } = await getFeed(
		{ kind: 'stemming', chamber: 'EK', limit: 50, facets: false, until: today },
		{ signal, wait: 'short' }
	);
	return kandidaten(items);
}

/**
 * The sketch of the newest passed bill that changes articles: first among the summary's
 * items, then among the older votes of the Eerste Kamer, at most POGINGEN bills asked.
 * One at a time. Null when none answers.
 */
export async function laadWetsnetwerk(
	items: readonly FeedItem[],
	today: string,
	signal?: AbortSignal
): Promise<Schets | null> {
	const gevraagd = new Set<string>();
	const probeer = async (lijst: Kandidaat[]): Promise<Schets | null> => {
		for (const k of lijst) {
			if (gevraagd.size >= POGINGEN || signal?.aborted) return null;
			if (gevraagd.has(k.number)) continue;
			gevraagd.add(k.number);
			const ch = await getChangedArticles(k.number).catch(() => null);
			if (!ch || ch.total === 0) continue;
			const law = [...ch.laws].sort((a, b) => b.total - a.total)[0];
			const bwb = law?.law.bwb_id;
			const top = law ? mostChanged(law) : null;
			const cb =
				bwb && top?.article_number
					? await getCitedByTop(bwb, top.article_number, signal).catch(() => null)
					: null;
			// A caller that left ignores the answer; the shared cited-by goes on for others.
			if (signal?.aborted) return null;
			return schetsVan(k, ch, cb);
		}
		return null;
	};
	return (
		(await probeer(kandidaten(items))) ??
		(gevraagd.size < POGINGEN ? await probeer(await oudere(today, signal)) : null)
	);
}

/** The article a law's changes touch most often; the first of them on a tie. */
function mostChanged(law: ChangedLaw) {
	const tel = new Map<string, { a: DossierChange['article']; n: number }>();
	for (const c of law.changes) {
		const t = tel.get(c.article.id);
		if (t) t.n++;
		else tel.set(c.article.id, { a: c.article, n: 1 });
	}
	let best: { a: DossierChange['article']; n: number } | null = null;
	for (const t of tel.values()) if (!best || t.n > best.n) best = t;
	return best?.a ?? null;
}
