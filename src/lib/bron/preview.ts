// What a reference shows on hover or focus, for any kind of bron: its kind, its name, a
// date, and what places it (Thijs, 10 Oct: more context per kind). Read from the light node
// the API gives: a stuk its dossier, its indieners with their fractie and, for a motie or
// amendement, the vote on its zaak; a judgment the first sentence of its summary, or at an
// r.o. that overweging; an article its first lid, or the part the reference names.
import { langeDatum } from '$lib/text/datum';
import { separatorBefore, textOf } from '$lib/text/words';
import { getDossier } from '$lib/components/parliamentary/data';
import { getNodeFirst, once } from '$lib/api/records';
import { ifExists } from '$lib/api/errors';
import { getNodeGraph } from '$lib/api/nodes';
import { getArticleDetail } from '$lib/api/articles';
import { dossierStatus, isOutcome } from '$lib/components/parliamentary/stages';
import { parseArticleParts, partText } from '$lib/text/article-parts';
import { articleTitle } from '$lib/text/bw';
import { courtName } from '$lib/text/court';
import { kindName } from '$lib/components/explore/law-head';
import {
	dossierLabel,
	dossierName,
	dossierUitProps,
	dossierVolledigeTitel,
	kamerstukNummer
} from './dossier-naam';
import { eersteIndiener, isEersteIndiener } from './submitters';
import { bronLabel, isCollection, type Collection } from '$lib/vocabulary';
import { focusOf, type BronRef } from './href';
import { tabTitle } from './tab-title';
import { isOverwegingAnker, laadUitspraak, tekstVanOverweging } from './overweging';

export type Preview = {
	/** The kind, and where it helps its place: `Uitspraak, Hoge Raad`. */
	kicker: string;
	title: string;
	date: string | null;
	/** The first lines: an article's first lid, a judgment's first sentence, a dossier's phase. */
	lines: string | null;
	/** The dossier a stuk belongs to: `Dossier 36496, Wet betaalbare huur`. */
	dossier?: string | null;
	/** Who submitted a stuk: `Ingediend door B. Madlener (PVV), mede namens …`. */
	wie?: string | null;
	/** The vote on a motie or amendement: `Aangenomen, 137 voor en 13 tegen`. */
	uitslag?: string | null;
	/** A line the reference adds: the definition a citation's words name. */
	extra?: string | null;
};

/** How much text a card shows. */
export const PREVIEW_CHARS = 400;

/**
 * The first sentence of a text: up to the first full stop that is followed by a capital and
 * does not close a usual abbreviation (`art.`, `mr.`, `r.o.`, `o.a.`).
 */
export function eersteZin(s: string | null): string | null {
	if (!s) return null;
	const re = /[.!?](?=\s+[\p{Lu}"'(])/gu;
	for (let m = re.exec(s); m; m = re.exec(s)) {
		const voor = s.slice(0, m.index + 1);
		if (
			/(?:^|[\s(])(?:art|artt|mr|dr|prof|nr|jo|vgl|bijv|resp|ca|zgn|\p{L}\.\p{L}|\p{Lu})\.$/u.test(
				voor
			)
		)
			continue;
		return voor;
	}
	return s;
}

const persoon = (a: Record<string, unknown>) => {
	const name = textOf(a.name);
	if (!name) return null;
	const faction = textOf(a.faction);
	return faction ? `${name} (${faction})` : name;
};

/** `Ingediend door X (fractie), mede namens Y (fractie)`, from a stuk's `actors`. */
export function indieners(actors: unknown): string | null {
	if (!Array.isArray(actors) || actors.length === 0) return null;
	const list = actors as Record<string, unknown>[];
	const lead = eersteIndiener(list);
	const door = lead ? persoon(lead) : null;
	if (!door) return null;
	const mede = list
		.filter((a) => a !== lead && !isEersteIndiener(a.role))
		.map(persoon)
		.filter((x): x is string => !!x);
	const namens = mede.map((m, i) => `${separatorBefore(i, mede.length)}${m}`).join('');
	return mede.length ? `Ingediend door ${door}, mede namens ${namens}` : `Ingediend door ${door}`;
}

/** `Aangenomen, 137 voor en 13 tegen`, from a decision's props as the API gives them. */
export function uitslagVan(props: Record<string, unknown>): string | null {
	const besluit =
		textOf(props.decision_text)?.replace(/\.$/, '') ??
		(props.passed === true ? 'Aangenomen' : props.passed === false ? 'Verworpen' : null);
	if (!besluit) return null;
	const tally = (props.tally ?? {}) as Record<string, unknown>;
	const voor = typeof tally.Voor === 'number' ? tally.Voor : null;
	const tegen = typeof tally.Tegen === 'number' ? tally.Tegen : null;
	return voor != null && tegen != null ? `${besluit}, ${voor} voor en ${tegen} tegen` : besluit;
}

const clip = (s: string | null) =>
	s && s.length > PREVIEW_CHARS ? `${s.slice(0, PREVIEW_CHARS).trimEnd()}…` : s;

/** The card of a bron from its node: the name, the kind, a date, and what it says first. */
export function previewFromNode(
	collection: Collection,
	displayName: string | null,
	props: Record<string, unknown>
): Preview {
	const kind = bronLabel(collection);
	const name = textOf(displayName) ?? textOf(props.name) ?? textOf(props.title) ?? kind;
	// A judgment and a stemming are named as their heading and tab name them, not by the
	// display name with its ISO date ("Hoge Raad 2026-08-25 / 24/01299").
	const asHeading = () =>
		tabTitle({ collection, label: name, raw: { display_name: displayName, props } as never });
	switch (collection) {
		case 'judgments': {
			const court = courtName(textOf(props.court) ?? textOf(props.court_code));
			return {
				kicker: court ? `${kind}, ${court}` : kind,
				title: asHeading(),
				// Cited by its ECLI, the title carries the day already: HR 25 augustus 2026.
				date: textOf(props.ecli) ? null : langeDatum(textOf(props.date)) || null,
				lines: clip(eersteZin(textOf(props.summary)))
			};
		}
		case 'dossiers': {
			// As its reader heads it: "Dossier, Kamerstuk 36764", the name it is known by, the
			// long title under it.
			const { outcome, current_phase } = props;
			const d = dossierUitProps(props);
			const naam = dossierName(d);
			return {
				kicker: d.number ? `${kind}, ${kamerstukNummer(d.number)}` : kind,
				title: naam === d.number ? name : naam,
				date: langeDatum(textOf(props.opened_on)) || null,
				lines: dossierStatus({
					outcome: isOutcome(outcome) ? outcome : null,
					current_phase: typeof current_phase === 'string' ? current_phase : null
				}),
				extra: clip(dossierVolledigeTitel(d, naam))
			};
		}
		case 'instruments': {
			// A law by its citeertitel and its kind, "Wet", the official title under it: the kind
			// tells it from the dossier of the same name.
			const title = textOf(props.citation_title) ?? textOf(props.title) ?? name;
			const official = textOf(props.official_title);
			return {
				kicker: kindName(textOf(props.kind)) ?? kind,
				title,
				date: null,
				lines: null,
				extra: official && official !== title ? clip(official) : null
			};
		}
		case 'documents': {
			const soort = textOf(props.kind)?.replace(/\s*\(.*\)\s*$/, '') ?? kind;
			const number =
				textOf(props.number) ?? (props.sequence != null ? String(props.sequence) : null);
			const nr = number ? (/^\d/.test(number) ? `nr. ${number}` : number) : null;
			const dn = textOf(props.dossier_number);
			return {
				kicker: nr ? `${soort}, ${nr}` : soort,
				title: textOf(props.title) ?? name,
				date: langeDatum(textOf(props.date)) || null,
				lines: null,
				dossier: dn
					? dossierLabel({
							number: dn,
							title: textOf(props.dossier_title),
							short_title: textOf(props.dossier_short_title)
						})
					: null,
				wie: indieners(props.actors)
			};
		}
		case 'members':
			return {
				kicker: kind,
				title: textOf(props.name) ?? name,
				date: null,
				lines: textOf(props.party)
			};
		case 'factions':
			return {
				kicker: kind,
				title: textOf(props.name) ?? name,
				date: null,
				lines: textOf(props.seats) ? `${textOf(props.seats)} zetels` : null
			};
		case 'cabinets': {
			const from = langeDatum(textOf(props.from_date));
			const to = langeDatum(textOf(props.to_date));
			return {
				kicker: kind,
				title: name,
				date: from ? (to ? `${from} tot ${to}` : `sinds ${from}`) : null,
				lines: null
			};
		}
		case 'decisions':
			// The title carries the Kamer and the day: "Eerste Kamer, 29 september 2026: …".
			return {
				kicker: kind,
				title: asHeading(),
				date: null,
				lines: null
			};
		case 'activities':
			// "Stemmingen (2026-09-29)": the kind, with its day on the date line.
			return {
				kicker: kind,
				title: textOf(props.kind) ?? name.replace(/\s*\(\d{4}-\d{2}-\d{2}\)$/, ''),
				date: langeDatum(textOf(props.date)) || null,
				lines: null
			};
		case 'articles':
			return { kicker: kind, title: articleTitle(name, props), date: null, lines: null };
		default:
			return { kicker: kind, title: name, date: null, lines: null };
	}
}

/** The card of a bron, asked for once per bron and position; null for none to show. */
export function loadPreview(
	ref: BronRef | string,
	at: string | null = null
): Promise<Preview | null> {
	const id = focusOf(ref);
	if (!id) return Promise.resolve(null);
	return once(`preview/${id}#${at ?? ''}`, () => fetchPreview(id, at));
}

async function fetchPreview(id: string, at: string | null): Promise<Preview | null> {
	const slash = id.indexOf('/');
	const collection = id.slice(0, slash);
	const key = id.slice(slash + 1);
	if (!isCollection(collection)) return null;
	if (collection === 'dossiers') {
		const data = await ifExists(getDossier(key));
		return data
			? previewFromNode('dossiers', data.title ?? null, {
					label: data.number,
					title: data.title,
					short_title: data.short_title ?? null,
					opened_on: data.opened_on,
					outcome: data.outcome,
					current_phase: data.current_phase
				})
			: null;
	}
	// The light node, kept as a record: a click on the bron after the card opens its
	// reader and the heads of its panel at once (`peekNode`, Verbonden's preview).
	const data = await ifExists(getNodeFirst(collection, key));
	const node = data?.node;
	if (!node) return null;
	const props = (node.props ?? {}) as Record<string, unknown>;
	const preview = previewFromNode(collection, node.display_name ?? null, props);
	if (collection === 'documents') {
		// The vote on a motie or amendement is a decision on its zaak, the one whose primary
		// case it is; the last of them where it was voted on more than once.
		if (!/motie|amendement/i.test(textOf(props.kind) ?? '')) return preview;
		const zaak = data.neighbors?.buckets?.find((b) => b.collection === 'cases')?.items?.[0];
		const caseId = Array.isArray(props.case_ids) ? textOf(props.case_ids[0]) : null;
		if (!zaak?.key || !caseId) return preview;
		const besluiten = await getNodeGraph('cases', zaak.key, {
			limit: 20,
			relations: 'ABOUT',
			nodeTypes: 'decision'
		});
		const eigen = (besluiten.neighbors?.buckets ?? [])
			.flatMap((b) => b.items ?? [])
			.map((i) => (i.props ?? {}) as Record<string, unknown>)
			.filter((p) => p.primary_case_id === caseId && (p.passed != null || textOf(p.decision_text)))
			.sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
		const laatste = eigen.at(-1);
		return laatste ? { ...preview, uitslag: uitslagVan(laatste) } : preview;
	}
	if (collection === 'judgments' && isOverwegingAnker(at)) {
		// At an r.o., the overweging the reference means, not the summary (the detail the
		// reader shares).
		const u = await laadUitspraak(key);
		const t = u ? tekstVanOverweging(u, at, PREVIEW_CHARS) : null;
		return t ? { ...preview, lines: t } : preview;
	}
	if (collection !== 'articles') return preview;
	// An article shows its text, or the part the reference names.
	const bwb = textOf(props.bwb_id) ?? textOf(props.celex);
	const number = textOf(props.article_number);
	if (!bwb || !number) return preview;
	const { article } = await getArticleDetail(bwb, number);
	const whole = article.text ?? '';
	const parts = parseArticleParts(whole);
	// Without a position, the first lid: the article as it opens.
	const part = partText(whole, parts, at ?? 'lid-1');
	return {
		...preview,
		title: article.heading ? `${preview.title}. ${article.heading}` : preview.title,
		lines: clip(part || whole || null)
	};
}
