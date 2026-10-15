// A bron in words, from what a list or a node response says of it: its title, the line under
// it, its identifier, date and court. Every list names a bron through here: Verbonden, the
// band, a map, Actueel.
import { carriesBillTitle, shortKind } from '$lib/text/document-kind';
import { textOf } from '$lib/text/words';
import { isRauw, menselijkeNaam } from '$lib/bron/menselijk';
import { langeDatum } from '$lib/text/datum';
import { articleTitle } from '$lib/text/bw';
import { authorCite } from '$lib/text/judgment-cite';
import { courtName } from '$lib/text/court';
import { isGeneriek } from '$lib/bron/generiek';
import { dossierOwnName, dossierUitProps, kamerstukNummer } from '$lib/bron/dossier-naam';
import { kindName } from '$lib/components/explore/law-head';
import { withoutKamerstuk, kamerstukName } from '$lib/components/parliamentary/kamerstuk';

/** What a list says of a bron: its title, the words under it, and what identifies it. */
type BronDescription = {
	title: string;
	/** Words about the bron that no other field carries: party, abbreviation, the place in the law. */
	context: string | null;
	/** ECLI, Kamerstuk number, BWB id. */
	identifier?: string | null;
	/** ISO date of the source. */
	date?: string | null;
	/** The court of a judgment. */
	court?: string | null;
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ') || null;

/** The dossier numbers of a node (`37020-XV`), in either chamber. */
export function dossierNumbersOf(props: Record<string, unknown> | null | undefined): string[] {
	const raw = props?.dossier_numbers;
	return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string' && !!n) : [];
}

/** The dossier a Kamerstuk or vote is numbered in: `dossier_number` where the API gives it
 *  (`explained-by`, a light node), else the first of `dossier_numbers`. */
export const dossierNumberOf = (props: Record<string, unknown> | null | undefined): string | null =>
	textOf(props?.dossier_number) ?? dossierNumbersOf(props)[0] ?? null;

/**
 * The name and the line under it of a Kamerstuk, by what tells it apart: its own title where
 * that says more than its kind (`Motie van het lid Krul c.s. over …`); else its kind or title
 * with its number (`Verslag, Kamerstuk I 36547, C`); else with its date. Never the kind alone
 * where something else is known. The line under it names the kind and the number the title
 * leaves out.
 */
function documentName(
	props: Record<string, unknown>,
	name: string
): { title: string; context: string | null } {
	const kind = textOf(props.kind);
	const short = kind ? shortKind(kind) : null;
	const title = textOf(props.title) ? withoutKamerstuk(textOf(props.title)!) : null;
	const dossier = dossierNumberOf(props);
	const given = textOf(props.sequence != null ? String(props.sequence) : null);
	// The Eerste Kamer numbers its papers with a letter (`C`, `AB`), without `nr.`; the data
	// gives it as the number, or as the sequence.
	const sequence = given && /^\d/.test(given) ? given : null;
	const letter = sequence ? null : (given ?? textOf(props.number));
	const chamber = props.chamber === 'EK' || letter ? 'EK' : 'TK';
	const stuk =
		kamerstukName({
			chamber,
			dossier_number: dossier,
			dossier_suffix: textOf(props.dossier_suffix),
			number: sequence ?? letter
		}) ?? (sequence ? `nr. ${sequence}` : letter);
	if (!kind && !title) return { title: name, context: null };
	// The dossier's name on the line under it (API 0.79.30), where the title does not carry
	// it already: the number in the title is how a Kamerstuk is cited.
	const dossierNaam = textOf(props.dossier_short_title);
	const naamOnder = dossierNaam && !(title ?? '').includes(dossierNaam) ? dossierNaam : null;
	// A paper of a bill by its kind and number: its title is the bill's, the same for all.
	// `Blanco verslag` says more than the kind `Verslag`.
	if (carriesBillTitle(kind) && stuk)
		return {
			title: join(title && isGeneriek(title, kind) ? title : short, stuk)!,
			context: naamOnder
		};
	if (title && !isGeneriek(title, kind)) return { title, context: join(short, stuk, naamOnder) };
	const lead = title ?? short!;
	const where = stuk ?? langeDatum(textOf(props.date));
	return { title: join(lead, where) ?? lead, context: naamOnder };
}

/**
 * An activity, a zaak or a toezegging by what tells it apart: its agenda or own title where
 * that says more than its kind (`Procedures en brieven`); else the name the source gives it,
 * which names the committee and the day (`Commissie voor Justitie en Veiligheid (J&V)
 * (2026-03-24)`); else its kind with its date (`Stemmingen, 29 september 2026`). The kind goes
 * on the line under it.
 */
function activityName(
	props: Record<string, unknown>,
	displayName: string | null | undefined,
	name: string
): { title: string; context: string | null } {
	const kind = textOf(props.kind);
	const own = textOf(props.agenda_title) ?? textOf(props.title) ?? textOf(props.text);
	const context = kind && own?.toLowerCase() !== kind.toLowerCase() ? kind : null;
	if (own && !isGeneriek(own, kind)) return { title: own, context };
	const given = textOf(displayName);
	if (given && !isGeneriek(given.replace(/\s*\(\d{4}-\d{2}-\d{2}\)$/, ''), kind))
		return { title: given, context };
	const lead = own ?? kind ?? name;
	return { title: join(lead, langeDatum(textOf(props.date))) ?? lead, context };
}

/** A bron the data gives no name: said so, never shown by its database key. */
export const UNNAMED = 'Naam niet in de gegevens';

/**
 * Title, context, identifier, date and court of a bron, from what a list or node
 * response says about it.
 */
export function describeBron(
	collection: string,
	key: string,
	displayName: string | null | undefined,
	props: Record<string, unknown> = {}
): BronDescription {
	// Never the key: the reader's name of the bron where the data gives none ($lib/bron/menselijk).
	const eigen = textOf(displayName);
	// A bijlage by the reader's name ("Bijlage II"), not the data's "Annex II" (#30).
	const name =
		eigen && !isRauw(eigen) && collection !== 'annexes'
			? eigen
			: menselijkeNaam({ collection, key, display_name: displayName, props });
	const date = textOf(props.date);
	switch (collection) {
		case 'judgments': {
			const ecli = textOf(props.ecli);
			const court = courtName(textOf(props.court) ?? textOf(props.court_code));
			// The name a judgment is known by: "Hoge Raad, 20 december 2019 (Urgenda)".
			const names = Array.isArray(props.names)
				? props.names.filter((n): n is string => typeof n === 'string')
				: [];
			const known = names.length ? ` (${names.join(', ')})` : '';
			// A conclusion by its author (API 0.74): "Conclusie A-G Niessen, 2 augustus 2018".
			const ag = textOf(props.advocate_general);
			const role = textOf(props.advocate_general_role) ?? '';
			const author = ag
				? authorCite(ag, /procureur-generaal/i.test(role) ? ['procureur-generaal'] : [])
				: null;
			return {
				title: author
					? (join(`Conclusie ${author}`, langeDatum(date)) ?? `Conclusie ${author}`) + known
					: (court ? (join(court, langeDatum(date)) ?? court) : name) + known,
				// A judgment known only as cited: its ECLI and court, nothing more. A translation
				// the Rechtspraak published under its own ECLI says so (in its name, as the source
				// gives it): HR Urgenda cites the English one of the Rechtbank, not its procesgang.
				context:
					props.stub === true
						? 'niet in de gegevens'
						: textOf(props.translation_of) || /\(English translation\)\s*$/i.test(name ?? '')
							? 'Engelse vertaling'
							: null,
				identifier: ecli ?? (court ? null : name),
				date,
				court
			};
		}
		case 'dossiers': {
			// By the name it is known by, its kind and number under it: "Cyberbeveiligingswet",
			// "Kamerstuk 36764", never the bare number or the title of three lines (Thijs, 13 Oct).
			// Where the props lack the short title, the row asks it (DossierNaam).
			const d = dossierUitProps({ display_name: name, ...props }, key);
			return {
				title: dossierOwnName(d) ?? name,
				context: null,
				identifier: d.number ? kamerstukNummer(d.number) : null,
				date
			};
		}
		case 'documents':
			return { ...documentName(props, name), identifier: null, date };
		case 'decisions':
			return {
				title: textOf(props.subject) ?? textOf(props.title) ?? name,
				context: props.passed === true ? 'aangenomen' : props.passed === false ? 'verworpen' : null,
				date
			};
		case 'activities':
		case 'commitments':
		case 'cases':
			return { ...activityName(props, displayName, name), date };
		case 'members':
			return {
				title: textOf(props.name) ?? textOf(displayName) ?? UNNAMED,
				context: textOf(props.party)
			};
		case 'committees':
		case 'factions':
			// Its abbreviation is its name again ("D66" under "Democraten 66", UX-toets #16).
			return { title: textOf(props.name) ?? name, context: null };
		case 'instruments': {
			// A law by its citeertitel and its kind, "Cyberbeveiligingswet", "Wet": the kind is
			// what tells it from the dossier of the same name. The BWB id only without a kind.
			const soort = kindName(textOf(props.kind));
			return {
				title: textOf(props.citation_title) ?? textOf(props.title) ?? name,
				context: soort,
				identifier: soort ? null : (textOf(props.bwb_id) ?? textOf(props.celex))
			};
		}
		// An article of the BW by its book: "Artikel 6:162 BW".
		case 'articles':
			return { title: articleTitle(name, props), context: null };
		case 'annexes':
			return { title: name, context: null };
		default:
			return { title: textOf(displayName) ?? UNNAMED, context: null };
	}
}
