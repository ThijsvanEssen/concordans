// What a row of Verbonden says about its verbinding, at a glance (Thijs, 10 Oct: "weinig over
// wát er verbonden wordt of hóé; dat is nou juist interessant om in één oogopslag te kunnen
// zien"). One line in legal or parliamentary words, the verb fixed per relation and direction,
// the rest read from the edge: the lid, the places, the count, the day, the vote. Under it the
// passage that carries the verbinding, and where the verbinding comes from (shown on hover or
// focus). "Deze" and "dit" are the selected bron, as in the group labels.
import { relationLabel, type Collection } from '$lib/vocabulary';
import { langeDatum } from '$lib/text/datum';
import { passageOf, type Row } from './rows';
import { uitsnede, type Passage } from './passage';
import { confidenceWord } from './filter';

export type Hoe = {
	/** The verb, in weight: `Haalt aan`, `Wijzigt`, `Door de Kamer verbonden`. */
	werkwoord: string | null;
	/**
	 * What follows it: `lid 3, in r.o. 4.3 en 5.1`, `dit artikel, in werking 1 juli 2024`. A
	 * statement rather than a verb carries its own sign: `: 2 zaken`, `, 27 voor en 123 tegen`.
	 */
	rest: string | null;
	/** Derived or below full confidence: the line in italics, with "afgeleid". */
	afgeleid: boolean;
	/** The passage of the source with the words that name the selected bron. */
	citaat: Passage | null;
	/**
	 * The words in `rest` that name the paragraph the passage is in (`r.o. 3.4`), and its
	 * anchor: a link that opens the citing judgment there.
	 */
	plaats: { text: string; at: string } | null;
	/** Where the verbinding comes from, for hover and focus. */
	herkomst: string | null;
};

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const keer = (n: number | null) => (n && n > 1 ? `${n} keer` : null);
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ') || null;
const erbij = (teken: string, s: string | null) => (s ? `${teken}${s}` : null);
const groot = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `Stb.2021-162` and `stb_2021_162` as they are cited: `Stb. 2021, 162`. */
export const publicatie = (s: string | null) =>
	s
		?.replace(/^(stb|stcrt|trb)_(\d{4})_(\d+)$/i, (_, k: string, j, n) => `${groot(k)}.${j}-${n}`)
		.replace(/^(Stb|Stcrt|Trb)\.?\s*(\d{4})-(\d+)$/, '$1. $2, $3') ?? null;

const HERKOMST_REDEN: Record<string, string> = {
	bwb_xml_ref: 'Verwijzing in de wettekst, wetten.overheid.nl',
	bwb_article: 'Herkend in de tekst',
	ecli: 'ECLI genoemd in de tekst'
};

/**
 * The words of `rest` that name the paragraph `at` (`rov-3.4`): `r.o. 3.4` in `in r.o. 3.4`,
 * `5.1` in `in r.o. 3.4 en 5.1`. Null where the line does not name it.
 */
export function plaatsIn(
	rest: string | null,
	at: string | null | undefined
): { text: string; at: string } | null {
	if (!rest || !at?.startsWith('rov-')) return null;
	const nr = at.slice(4);
	const n = nr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const m =
		new RegExp(`(?:r\\.o\\.|onder|§)\\s*${n}(?![\\w.])`).exec(rest) ??
		new RegExp(`(?<=\\s)${n}(?![\\w.])`).exec(rest);
	return m ? { text: m[0], at } : null;
}

/** Where an edge comes from by its `basis`, where it has no `reason`. */
const HERKOMST_BASIS: Partial<Record<string, string>> = {
	subject: 'Onderwerp van het Kamerstuk'
};

/** The words of a change to an article, by the effect wetten.overheid.nl gives it. */
const WIJZIGING: Record<string, string> = {
	wijziging: 'Wijzigt',
	nieuw: 'Voegt in',
	vervallen: 'Laat vervallen',
	vernummering: 'Vernummert'
};

/**
 * The line of a row: what the verbinding between the selected bron (`selected`, its
 * collection) and the row's bron is. Null where the group's label says all (a Kamerstuk in
 * its dossier, a lid of a fractie) and the edge adds nothing.
 */
export function hoeVan(row: Row, selected: Collection): Hoe | null {
	const edge = row.edge ?? {};
	const props = (row.props ?? {}) as Record<string, unknown>;
	const other = row.ref.collection;
	const inbound = row.direction === 'inbound';
	// Derived, or below high confidence: as the filter Betrouwbaarheid grades it (0.9 and up
	// is high; a citation recognised in the text has 0.95).
	const afgeleid = confidenceWord(row.confidence, !!row.derived) !== 'hoog';
	const p = passageOf(row);
	const citaat = p?.mark ? uitsnede(p) : null;
	const lid = row.lid ? `lid ${row.lid}` : null;
	// The place in the citing text: `in r.o. 4.3 en 5.1`.
	const plaats = row.position && row.position !== lid ? `in ${row.position}` : null;
	const reden = text(edge.reason);
	const uit = (s: string | null) => (s ? (HERKOMST_REDEN[s] ?? null) : null);
	const formeel = text(edge.basis) === 'formal_relation' ? 'Rechtspraak.nl, formele relatie' : null;
	const regel = (werkwoord: string | null, rest: string | null, herkomst: string | null) =>
		({
			werkwoord,
			rest,
			afgeleid,
			citaat,
			plaats: citaat ? plaatsIn(rest, row.passageAt) : null,
			herkomst
		}) satisfies Hoe;

	switch (row.relation) {
		case 'RELATED_TO': {
			if (other !== 'dossiers' || selected !== 'dossiers') break;
			const zaken = num(edge.cases);
			const soorten = Array.isArray(edge.case_kinds)
				? edge.case_kinds.filter((k): k is string => typeof k === 'string').join('; ')
				: null;
			return regel(
				'Door de Kamer verbonden',
				erbij(
					': ',
					join(zaken ? `${zaken} ${zaken === 1 ? 'zaak' : 'zaken'}` : null, soorten?.toLowerCase())
				),
				'Tweede Kamer, zaak gerelateerd aan zaak'
			);
		}
		case 'APPEAL_OF': {
			const aard = row.aard ?? text(edge.procedure_type)?.toLowerCase() ?? 'hoger beroep';
			return inbound
				? regel(`${groot(aard)} tegen`, 'deze uitspraak', formeel)
				: regel('Bestreden', `in ${aard} met deze uitspraak`, formeel);
		}
		case 'BASED_ON':
			// A regulation under a law: the articles of the law its Gelet op names, `art. 16, 21`.
			if (inbound && selected === 'instruments' && row.position)
				return regel('Gebaseerd op', row.position, uit(reden));
			break;
		case 'ADVISES_ON':
			return inbound
				? regel('Conclusie bij', 'deze uitspraak', formeel)
				: regel('Uitspraak op', 'deze conclusie', formeel);
		case 'AMENDS':
		case 'INTRODUCES':
		case 'REPEALS': {
			const effect = text(edge.effect);
			// A row from the legislative history carries its change in its own meta line.
			if (!effect && !text(edge.effective_date) && !text(edge.source_publication)) return null;
			const werkwoord =
				(effect && WIJZIGING[effect]) ??
				(row.relation === 'INTRODUCES'
					? 'Voegt in'
					: row.relation === 'REPEALS'
						? 'Laat vervallen'
						: 'Wijzigt');
			const datum = text(edge.effective_date);
			const pub = publicatie(text(edge.source_publication));
			return regel(
				werkwoord,
				join(
					inbound ? `dit ${selected === 'articles' ? 'artikel' : 'onderdeel'}` : null,
					lid,
					datum ? `in werking ${langeDatum(datum)}` : row.proposed ? 'voorgesteld' : null
				),
				pub ? `Wetten.overheid.nl, ${pub}` : row.proposed ? 'Voorstel van wet' : null
			);
		}
		case 'LEGISLATED_IN': {
			if (inbound)
				return regel(
					'Tot stand gekomen',
					'in dit dossier',
					text(edge.dossier_number) ? 'Dossiernummer in de publicatie' : null
				);
			// The dossiers of a wet: the bill that made it, or a bill whose publication amended
			// it (`via`, /api/instruments/{bwb}/dossiers). What the dossier is to the wet, in the
			// Kamer's words; its kind and number stand under it ("Kamerstuk 36764").
			const pub = publicatie(text(edge.publication));
			return text(edge.via) === 'amending_publication'
				? regel('Wijzigt', join('deze wet', pub), null)
				: regel('Wetsvoorstel', 'van deze wet', null);
		}
		case 'ANSWERS':
			// A letter of the government and the motion its subject names: read as the
			// reference it is. A prejudiciële beslissing says it in its group's label.
			if (other !== 'documents' || selected !== 'documents') break;
		// falls through
		case 'REFERS_TO': {
			const vaak = keer(num(edge.mention_count) ?? (row.mentions?.length || null));
			// The words of the source, where they are not the passage under the line.
			const woorden = !citaat && text(edge.text) ? `als ‘${text(edge.text)}’` : null;
			const herkomst =
				uit(reden) ??
				HERKOMST_BASIS[text(edge.basis) ?? ''] ??
				(text(edge.cited_ecli)
					? HERKOMST_REDEN.ecli
					: row.snippet || row.match
						? 'Herkend in de tekst'
						: null);
			if (inbound) {
				const werkwoord =
					other === 'judgments' ? 'Haalt aan' : other === 'articles' ? 'Verwijst naar' : 'Noemt';
				return regel(
					werkwoord,
					[join(lid, plaats, vaak), woorden].filter(Boolean).join(' ') || null,
					herkomst
				);
			}
			// The selected bron cites the row's: a judgment or a law cites, a paper names.
			return regel(
				selected === 'documents' ? 'Genoemd' : 'Aangehaald',
				[join(lid, plaats, vaak), woorden].filter(Boolean).join(' ') || null,
				herkomst
			);
		}
		case 'ABOUT': {
			if (other !== 'decisions') break;
			const besluit =
				text(props.decision_text)?.replace(/\.$/, '') ??
				(props.passed === true ? 'Aangenomen' : props.passed === false ? 'Verworpen' : null);
			if (!besluit) break;
			const tally = (props.tally ?? {}) as Record<string, unknown>;
			const voor = num(tally.Voor);
			const tegen = num(tally.Tegen);
			return regel(
				besluit,
				voor != null && tegen != null ? `, ${voor} voor en ${tegen} tegen` : null,
				'Besluit van de Kamer'
			);
		}
	}
	// The group's label names it (a Kamerstuk in its dossier, a lid in a fractie): only
	// what the edge adds, else nothing.
	if (afgeleid || citaat || lid || plaats) {
		const label = row.relation ? relationLabel(row.relation, inbound ? other : selected) : null;
		return regel(label ? groot(label) : null, join(lid, plaats), uit(reden));
	}
	return null;
}
