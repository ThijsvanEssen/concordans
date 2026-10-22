// The groups of the panel Verbonden, per kind of bron. This table is the one definition:
// the panel renders it, the table lists it, and the legend of the network counts it.
// The name of a group states the direction: "Uitspraken die dit artikel aanhalen".
//
// A group is filled from the node response of the selected bron (`match`: relation,
// direction, collection) or, where no edge says it, by a named loader (`load`).
import { capitalize, joinAnd } from '$lib/text/words';
import { langeDatum } from '$lib/text/datum';
import { kindName, lawKind } from '$lib/components/explore/law-head';
import { bucketKey, type Bucket } from '$lib/api/nodes';
import {
	CHANGE_RELATIONS,
	isChangeRelation,
	isInternational,
	isRelation,
	type Collection
} from '$lib/vocabulary';
import { atLeast, formatCount } from '$lib/text/getal';
import { rowOfNeighbor, type Row } from './rows';
import { type Neighbor } from '$lib/api/nodes';
import type { JudgmentOrder } from './loaders';
import { chamberOfDocument } from './document-chamber';
import { CHAMBER_NAME, type Chamber } from '$lib/components/parliamentary/chamber';

import { choiceRank } from '$lib/components/parliamentary/stemming';

export type Match = Bucket & {
	where?: (n: Neighbor) => boolean;
	/** The bucket is divided over several groups by `where`: none of them takes its total. */
	split?: boolean;
};

export type Loader =
	| 'dossier-laws'
	| 'dossier-same-number'
	| 'document-same-case'
	| 'dossier-committees'
	| 'dossier-documents-tk'
	| 'dossier-documents-ek'
	| 'dossier-decisions-tk'
	| 'dossier-international'
	| 'article-explanatory'
	| 'article-judgments'
	| 'article-cited-by'
	| 'article-changes'
	| 'article-delegated'
	| 'instrument-international'
	| 'judgment-articles'
	| 'instrument-dossiers'
	| 'instrument-related'
	| 'instrument-delegated'
	| 'instrument-basis'
	| 'instrument-aard'
	| 'instrument-amended-by'
	| 'instrument-proposals'
	| 'decision-subject'
	| 'instrument-articles'
	| 'instrument-judgments'
	| 'committee-dossiers'
	| 'committee-activities'
	| 'member-instruments'
	| 'faction-instruments'
	| 'member-dossiers'
	| 'faction-dossiers';

type GroupDef = {
	id: string;
	label: string;
	/** The bronnen of the group in the plural, for "Alle 1.064 uitspraken". */
	noun?: string;
	/** Printed above the first group that carries it: "Tweede Kamer", "Eerste Kamer". */
	section?: string;
	match?: Match[];
	load?: Loader;
	/** A row opens beside the selected bron instead of replacing it. */
	inPlace?: boolean;
	/**
	 * The buckets a loader reads, where the light node counts them: a group whose buckets are
	 * empty keeps no place while its loader runs, one that may have rows does (`wachtend`).
	 */
	bakken?: { relation: string; direction: 'inbound' | 'outbound'; collection: string }[];
	/** Its edges with the places a judgment cites (`edge_meta=passages`): the row shows the passage. */
	passages?: boolean;
	/** A name that follows the rows shown: the functions a lid signed in. */
	labelOf?: (rows: Row[]) => string;
	/** The order of its rows, where the API's is not the one to read them in. */
	rowOrder?: (a: Neighbor, b: Neighbor) => number;
	/** The orders the reader can choose, asked of the API by its loader (`LoaderOptions`). */
	orders?: readonly { value: JudgmentOrder; label: string }[];
};

export type Group = GroupDef & {
	rows: Row[];
	/** The number of bronnen where the API states it; `rows` may hold fewer. */
	total?: number;
	/** The places these bronnen name the selected one, where a row bundles several. */
	mentions?: number;
	/** The years of all its bronnen, as the API counts them; else counted from the rows. */
	years?: { year: number; count: number }[];
	/** Rows are missing that the API has (a bucket split over groups, a page that failed): `30+`. */
	capped: boolean;
	/** Its loader is still under way: the group keeps its place with "laden…". */
	laden?: boolean;
	/** Its loader failed: the group keeps its place with "kon niet laden" and Opnieuw. */
	failed?: boolean;
	/** Why its loader failed: slow or broken, for failureText. */
	error?: unknown;
};

const national = (n: Neighbor) => !isInternational(n);
/** A motie `MADE_IN` the debate it was submitted in (`meta.reason` `ingediend`), not its record. */
const ingediend = (n: Neighbor) => n.meta?.reason === 'ingediend';

// What a lid signed a stuk as (`meta.capacity` of AUTHORED): as Kamerlid, as
// bewindspersoon, or in another function (vicepresident van de Raad van State).
type Capacity = 'kamerlid' | 'bewindspersoon' | 'overig';
/** A vote of the one Kamer or the other: the API's `chamber`, else the key (`ek_…`). */
const votedIn = (chamber: Chamber) => (n: Neighbor) =>
	chamberOfDocument({
		key: n.key,
		chamber: (n.props as Record<string, unknown> | null)?.chamber as string
	}) === chamber;

const signedAs = (capacity: Capacity) => (n: Neighbor) => n.meta?.capacity === capacity;

/** The fracties of a vote as its block of Fracties lists them: Voor, then Tegen, by seats. */
const choiceOf = (n: Neighbor) => capitalize(String(n.meta?.choice ?? '').toLowerCase());
const seatsOf = (n: Neighbor) => Number(n.meta?.seats ?? 0);
const byChoice = (a: Neighbor, b: Neighbor) =>
	choiceRank(choiceOf(a)) - choiceRank(choiceOf(b)) || seatsOf(b) - seatsOf(a);

/** `a`, `a en b`, `a, b en c`; beyond three, `a, b en 2 andere functies`. */
function functionList(rows: Row[]): string {
	const counts = new Map<string, number>();
	for (const r of rows) if (r.function) counts.set(r.function, (counts.get(r.function) ?? 0) + 1);
	const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
	if (names.length > 3)
		return joinAnd(names.slice(0, 2), {
			n: names.length - 2,
			one: 'andere functie',
			many: 'andere functies'
		});
	return joinAnd(names);
}

const authored = (
	capacity: Capacity,
	label: string,
	labelOf?: (rows: Row[]) => string
): GroupDef => ({
	id: `authored-${capacity}`,
	label,
	noun: 'stukken',
	match: [
		{
			relation: 'AUTHORED',
			direction: 'outbound',
			collection: 'documents',
			where: signedAs(capacity),
			split: true
		}
	],
	labelOf
});

export const EUROPEAN: GroupDef = {
	id: 'international',
	label: 'Europees en internationaal',
	noun: 'Europese en internationale bronnen',
	match: [
		{ relation: 'IMPLEMENTS', collection: 'instruments' },
		{
			relation: ['REFERS_TO', 'BASED_ON'],
			collection: ['instruments', 'articles'],
			where: isInternational
		},
		// The judgments that cite a bron come in one bucket, Dutch and of the EHRM together
		// (art. 8 EVRM: 435, of which 92 of the EHRM): the bucket's total is not this group's.
		{
			relation: 'REFERS_TO',
			direction: 'inbound',
			collection: 'judgments',
			where: isInternational,
			split: true
		}
	]
};

export const GROUPS: Partial<Record<Collection, GroupDef[]>> = {
	dossiers: [
		{ id: 'laws', label: 'Wet uit dit dossier', noun: 'wetten', load: 'dossier-laws' },
		{
			id: 'same-number',
			label: 'Dossiers onder hetzelfde nummer',
			noun: 'dossiers',
			load: 'dossier-same-number'
		},
		// A change in the Grondwet is read twice; the memorie van toelichting is in the
		// dossier of the first reading, the second only refers to it.
		{
			id: 'first-reading',
			label: 'Eerste lezing van deze grondwetsherziening',
			noun: 'dossiers',
			match: [{ relation: 'SECOND_READING_OF', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'second-reading',
			label: 'Tweede lezing van deze grondwetsherziening',
			noun: 'dossiers',
			match: [{ relation: 'SECOND_READING_OF', direction: 'inbound', collection: 'dossiers' }]
		},
		{
			id: 'revises',
			label: 'Begrotingen die dit dossier wijzigt',
			noun: 'dossiers',
			match: [{ relation: 'REVISES', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'revised-by',
			label: 'Dossiers die deze begroting wijzigen',
			noun: 'dossiers',
			match: [{ relation: 'REVISES', direction: 'inbound', collection: 'dossiers' }]
		},
		{
			id: 'accompanies',
			label: 'Nota waarmee dit dossier is ingediend',
			noun: 'dossiers',
			match: [{ relation: 'ACCOMPANIES', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'accompanied-by',
			label: 'Dossiers ingediend met deze nota',
			noun: 'dossiers',
			match: [{ relation: 'ACCOMPANIES', direction: 'inbound', collection: 'dossiers' }]
		},
		{
			id: 'related',
			label: 'Dossiers die de Kamer met dit dossier verbindt',
			noun: 'dossiers',
			match: [{ relation: 'RELATED_TO', collection: 'dossiers' }]
		},
		{
			id: 'committees',
			label: 'Commissie',
			section: CHAMBER_NAME.TK,
			load: 'dossier-committees'
		},
		{
			id: 'documents-tk',
			// Named by the Kamer, as the stemmingen: "Kamerstukken" and "Stukken" under the two
			// headings read as two kinds of papers (UX-toets 10 Oct).
			label: 'Kamerstukken in de Tweede Kamer',
			noun: 'stukken',
			section: CHAMBER_NAME.TK,
			load: 'dossier-documents-tk'
		},
		{
			id: 'decisions',
			// Named by the Kamer: the section heading alone does not tell the two apart.
			label: 'Stemmingen in de Tweede Kamer',
			noun: 'stemmingen',
			section: CHAMBER_NAME.TK,
			load: 'dossier-decisions-tk'
		},
		{
			id: 'commitments',
			label: 'Toezeggingen over dit dossier',
			noun: 'toezeggingen',
			section: CHAMBER_NAME.TK,
			match: [{ relation: 'ABOUT', direction: 'inbound', collection: 'commitments' }]
		},
		{
			id: 'documents-ek',
			label: 'Kamerstukken in de Eerste Kamer',
			noun: 'stukken',
			section: CHAMBER_NAME.EK,
			load: 'dossier-documents-ek'
		},
		{
			id: 'decisions-ek',
			label: 'Stemmingen in de Eerste Kamer',
			noun: 'stemmingen',
			section: CHAMBER_NAME.EK,
			match: [
				{
					relation: 'ABOUT',
					direction: 'inbound',
					collection: 'decisions',
					where: votedIn('EK'),
					split: true
				}
			]
		},
		{ ...EUROPEAN, match: undefined, load: 'dossier-international' }
	],
	instruments: [
		{
			// A publication in the Staatsblad or Staatscourant is an instrument that changes
			// articles; a law has no such edges, so the group shows for publications only.
			id: 'changes',
			label: 'Artikelen die deze publicatie wijzigt',
			noun: 'artikelen',
			match: [
				{
					relation: [...CHANGE_RELATIONS],
					direction: 'outbound',
					collection: ['articles', 'instruments']
				}
			]
		},
		{
			id: 'dossiers',
			label: 'Dossiers die deze wet raken',
			noun: 'dossiers',
			load: 'instrument-dossiers'
		},
		{
			id: 'articles',
			label: 'Artikelen van deze wet',
			noun: 'artikelen',
			load: 'instrument-articles'
		},
		{
			// The laws whose articles the preamble of this regulation names (Gelet op), as their
			// grondslag (`/basis`): on an AMvB "Grondslag van dit besluit".
			id: 'basis',
			label: 'Grondslag van deze wet',
			noun: 'wetten',
			load: 'instrument-basis'
		},
		{
			// The AMvB's and regelingen whose Gelet op names an article of the law (Thijs, 13 Oct).
			id: 'based-on',
			label: 'Gebaseerd op deze wet',
			noun: 'regelingen',
			load: 'instrument-delegated'
		},
		{
			id: 'implemented-by',
			label: 'Regelingen die deze wet implementeren',
			noun: 'regelingen',
			match: [{ relation: 'IMPLEMENTS', direction: 'inbound', collection: 'instruments' }]
		},
		{ ...EUROPEAN, match: undefined, load: 'instrument-international' },
		{
			id: 'amended-by',
			// The rows are publications in the Staatsblad (`/amended-by`), not bills.
			label: 'Publicaties die deze wet wijzigen',
			noun: 'publicaties',
			load: 'instrument-amended-by'
		},
		{
			// The bills and amendments of an open dossier that would change it (`/amended-by`,
			// `proposals`, API 0.79.55): proposed, not enacted.
			id: 'proposals',
			label: 'Voorstellen die deze wet wijzigen',
			noun: 'voorstellen',
			load: 'instrument-proposals'
		},
		{
			id: 'aard',
			label: 'Verwijzingen vanuit deze wet, naar aard',
			noun: 'verwijzingen',
			load: 'instrument-aard'
		},
		{
			id: 'related',
			label: 'Wetten die met deze wet verbonden zijn',
			noun: 'wetten',
			load: 'instrument-related'
		},
		{
			id: 'judgments',
			label: 'Uitspraken die deze wet aanhalen',
			noun: 'uitspraken',
			load: 'instrument-judgments',
			orders: [
				{ value: 'date', label: 'Datum' },
				{ value: 'cited', label: 'Meeste artikelen' }
			]
		},
		// A treaty and the Tractatenbladen the Verdragenbank lists for it: its text, its
		// approval, its entry into force.
		{
			id: 'published-in',
			label: 'Gepubliceerd in het Tractatenblad',
			noun: 'publicaties',
			match: [{ relation: 'PUBLISHED_IN', direction: 'outbound', collection: 'instruments' }]
		},
		{
			id: 'publishes',
			label: 'Verdragen in dit Tractatenblad',
			noun: 'verdragen',
			match: [{ relation: 'PUBLISHED_IN', direction: 'inbound', collection: 'instruments' }]
		}
	],
	articles: [
		{
			id: 'judgments',
			label: 'Uitspraken die dit artikel aanhalen',
			noun: 'uitspraken',
			load: 'article-judgments',
			orders: [
				{ value: 'date', label: 'Datum' },
				{ value: 'cited', label: 'Meest aangehaald' }
			],
			// Read beside the article, at the r.o. that cites it, as the Toelichting is.
			inPlace: true,
			bakken: [{ relation: 'REFERS_TO', direction: 'inbound', collection: 'judgments' }]
		},
		{
			id: 'cited-by',
			label: 'Artikelen die naar dit artikel verwijzen',
			noun: 'artikelen',
			load: 'article-cited-by',
			bakken: [
				{ relation: 'REFERS_TO', direction: 'inbound', collection: 'articles' },
				{ relation: 'BASED_ON', direction: 'inbound', collection: 'articles' }
			]
		},
		{
			// The AMvB's and regelingen whose Gelet op names the article (Thijs, 12 Oct).
			id: 'based-on',
			label: 'Gebaseerd op dit artikel',
			noun: 'regelingen',
			load: 'article-delegated',
			bakken: [{ relation: 'BASED_ON', direction: 'inbound', collection: 'instruments' }]
		},
		{
			id: 'explanatory',
			label: 'Toelichting',
			noun: 'toelichtingen',
			load: 'article-explanatory',
			inPlace: true
		},
		{
			// Enacted and proposed: the publication that changed it, or the bill that would.
			id: 'changes',
			label: 'Wijzigingen van dit artikel',
			noun: 'wijzigingen',
			load: 'article-changes'
		},
		{
			id: 'refers-to',
			label: 'Artikelen waarnaar dit artikel verwijst',
			noun: 'artikelen',
			match: [
				{
					relation: ['REFERS_TO', 'BASED_ON'],
					direction: 'outbound',
					collection: ['articles', 'instruments', 'annexes'],
					where: national
				}
			]
		},
		{
			id: 'documents',
			// A Kamerstuk noemt; a judgment haalt aan (relation-words.ts).
			label: 'Kamerstukken die dit artikel noemen',
			noun: 'Kamerstukken',
			match: [
				{
					relation: 'REFERS_TO',
					direction: 'inbound',
					collection: 'documents',
					where: (n) => !isChangeRelation(n.relation)
				}
			]
		},
		{
			id: 'law',
			label: 'Wet',
			match: [{ relation: 'PART_OF', direction: 'outbound', collection: 'instruments' }]
		},
		EUROPEAN
	],
	judgments: [
		// The Rechtspraak published many old arresten again under a new ECLI: the kept
		// publication and the replaced ones point at each other.
		{
			id: 'same-as',
			label: 'Zelfde uitspraak, ook gepubliceerd als',
			match: [{ relation: 'SAME_AS', collection: 'judgments' }]
		},
		{
			id: 'articles',
			label: 'Artikelen die hier worden aangehaald',
			noun: 'artikelen',
			load: 'judgment-articles',
			// The bucket its loader reads: counted by the light node, so it keeps its place from
			// the first paint and an empty one never shows (UX-toets e7a2f95, #36).
			bakken: [{ relation: 'REFERS_TO', direction: 'outbound', collection: 'articles' }]
		},
		{
			id: 'conclusion',
			label: 'Conclusie in dezelfde zaak',
			match: [{ relation: 'ADVISES_ON', direction: 'inbound', collection: 'judgments' }]
		},
		{
			id: 'advised',
			label: 'Uitspraak in dezelfde zaak',
			match: [{ relation: 'ADVISES_ON', direction: 'outbound', collection: 'judgments' }]
		},
		// The row says which remedy: `cassatie` or `hoger beroep`.
		{
			id: 'earlier-instance',
			label: 'Uitspraak in eerdere aanleg',
			match: [{ relation: 'APPEAL_OF', direction: 'outbound', collection: 'judgments' }]
		},
		{
			id: 'later-instance',
			label: 'Hoger beroep of cassatie tegen deze uitspraak',
			match: [{ relation: 'APPEAL_OF', direction: 'inbound', collection: 'judgments' }]
		},
		// A prejudiciële beslissing and the decision that asked its questions.
		{
			id: 'answers',
			label: 'Beantwoordt prejudiciële vragen van',
			match: [{ relation: 'ANSWERS', direction: 'outbound', collection: 'judgments' }]
		},
		{
			id: 'answered',
			label: 'Prejudiciële beslissing op vragen uit deze uitspraak',
			match: [{ relation: 'ANSWERS', direction: 'inbound', collection: 'judgments' }]
		},
		// One case at one court: the final judgment continues the interim one.
		{
			id: 'continues',
			label: 'Vervolg op',
			match: [{ relation: 'CONTINUES', direction: 'outbound', collection: 'judgments' }]
		},
		{
			id: 'continued',
			label: 'Voortgezet in',
			match: [{ relation: 'CONTINUES', direction: 'inbound', collection: 'judgments' }]
		},
		// After cassation with referral: the decision of the court the Hoge Raad sent it to.
		{
			id: 'referred-by',
			label: 'Verwezen door',
			match: [{ relation: 'REFERRED_BY', direction: 'outbound', collection: 'judgments' }]
		},
		{
			id: 'referred-to',
			label: 'Verwezen naar',
			match: [{ relation: 'REFERRED_BY', direction: 'inbound', collection: 'judgments' }]
		},
		{
			id: 'judgments',
			// Not `die deze uitspraak aanhaalt`: one letter from the group below, which is the other way.
			label: 'Uitspraken die hier worden aangehaald',
			noun: 'uitspraken',
			passages: true,
			match: [{ relation: 'REFERS_TO', direction: 'outbound', collection: 'judgments' }]
		},
		{
			id: 'cited-by',
			label: 'Uitspraken die deze uitspraak aanhalen',
			noun: 'uitspraken',
			passages: true,
			match: [{ relation: 'REFERS_TO', direction: 'inbound', collection: 'judgments' }]
		},
		// Cases its summary names as connected: "Samenhang met 24/03860 E".
		{
			id: 'related',
			label: 'Samenhangende zaken',
			noun: 'uitspraken',
			match: [{ relation: 'RELATED_TO', collection: 'judgments' }]
		}
	],
	documents: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'PART_OF', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'same-case',
			label: 'Stukken van dezelfde zaak',
			noun: 'stukken',
			load: 'document-same-case'
		},
		// The papers a subject names by dossier and number, "(Kamerstuk 25424-795)": a letter
		// of the government answers the motion; any other paper names it.
		{
			id: 'answers',
			label: 'Moties waarop deze brief ingaat',
			noun: 'moties',
			match: [{ relation: 'ANSWERS', direction: 'outbound', collection: 'documents' }]
		},
		{
			id: 'answered-by',
			label: 'Brieven van de regering over deze motie',
			noun: 'brieven',
			match: [{ relation: 'ANSWERS', direction: 'inbound', collection: 'documents' }]
		},
		{
			id: 'fulfils',
			label: 'Toezeggingen die deze brief nakomt',
			noun: 'toezeggingen',
			match: [{ relation: 'ANSWERS', direction: 'outbound', collection: 'commitments' }]
		},
		{
			id: 'names',
			// Not `die dit stuk noemt`: one letter from the group below, which is the other way.
			label: 'Kamerstukken die hier worden genoemd',
			noun: 'Kamerstukken',
			match: [{ relation: 'REFERS_TO', direction: 'outbound', collection: 'documents' }]
		},
		{
			id: 'named-by',
			label: 'Kamerstukken die dit stuk noemen',
			noun: 'Kamerstukken',
			match: [{ relation: 'REFERS_TO', direction: 'inbound', collection: 'documents' }]
		},
		{
			id: 'explains',
			label: 'Artikelen die dit stuk toelicht',
			noun: 'artikelen',
			match: [
				{ relation: 'EXPLAINS', direction: 'outbound', collection: ['articles', 'instruments'] }
			]
		},
		{
			id: 'changes',
			label: 'Artikelen die dit stuk wijzigt',
			noun: 'artikelen',
			match: [
				{
					relation: [...CHANGE_RELATIONS],
					direction: 'outbound',
					collection: ['articles', 'instruments']
				}
			]
		},
		{
			id: 'refers-to',
			label: 'Artikelen die dit stuk noemt',
			noun: 'artikelen',
			match: [
				{ relation: 'REFERS_TO', direction: 'outbound', collection: ['articles', 'instruments'] }
			]
		},
		{
			id: 'authors',
			label: 'Indieners',
			noun: 'indieners',
			match: [{ relation: 'AUTHORED', direction: 'inbound', collection: ['members', 'factions'] }]
		},
		// An amended motie or amendement and the one it replaces, "ter vervanging van nr. 19".
		{
			id: 'replaces',
			label: 'Vervangt',
			match: [{ relation: 'REVISES', direction: 'outbound', collection: 'documents' }]
		},
		{
			id: 'replaced-by',
			label: 'Vervangen door',
			match: [{ relation: 'REVISES', direction: 'inbound', collection: 'documents' }]
		},
		// A bijlage and the letter it was sent with.
		{
			id: 'attachment-of',
			label: 'Bijlage bij',
			match: [{ relation: 'ACCOMPANIES', direction: 'outbound', collection: 'documents' }]
		},
		{
			id: 'attachments',
			label: 'Bijlagen bij dit stuk',
			noun: 'bijlagen',
			match: [{ relation: 'ACCOMPANIES', direction: 'inbound', collection: 'documents' }]
		},
		// A stenogram and the debate it is the record of; a motie and the debate it was
		// submitted in (`ingediend`, API 0.79.55).
		{
			id: 'record-of',
			label: 'Verslag van',
			match: [
				{
					relation: 'MADE_IN',
					direction: 'outbound',
					collection: 'activities',
					where: (n) => !ingediend(n),
					split: true
				}
			]
		},
		{
			id: 'submitted-in',
			label: 'Ingediend in',
			match: [
				{
					relation: 'MADE_IN',
					direction: 'outbound',
					collection: 'activities',
					where: ingediend,
					split: true
				}
			]
		}
	],
	committees: [
		{
			id: 'members',
			label: 'Leden van deze commissie',
			noun: 'leden',
			match: [{ relation: 'MEMBER_OF', direction: 'inbound', collection: 'members' }]
		},
		{
			id: 'dossiers',
			label: 'Dossiers van deze commissie',
			noun: 'dossiers',
			load: 'committee-dossiers'
		},
		{
			id: 'activities',
			label: 'Activiteiten van deze commissie',
			noun: 'activiteiten',
			load: 'committee-activities'
		}
	],
	cabinets: [
		{
			id: 'bewindspersonen',
			label: 'Bewindspersonen',
			noun: 'bewindspersonen',
			match: [{ relation: 'SERVED_IN', direction: 'inbound', collection: 'members' }]
		}
	],
	members: [
		{
			id: 'factions',
			label: 'Fractie',
			match: [{ relation: 'MEMBER_OF', direction: 'outbound', collection: 'factions' }]
		},
		{
			id: 'committees',
			label: 'Commissies van dit lid',
			noun: 'commissies',
			match: [{ relation: 'MEMBER_OF', direction: 'outbound', collection: 'committees' }]
		},
		// A person signs as what they are at that moment: Kamerlid, bewindspersoon, or
		// in another function. The name follows the functions of the rows shown.
		authored('kamerlid', 'Stukken die dit lid als Kamerlid indiende'),
		authored('bewindspersoon', 'Stukken ondertekend als bewindspersoon', (rows) =>
			rows.length
				? `Stukken ondertekend als ${functionList(rows)}`
				: 'Stukken ondertekend als bewindspersoon'
		),
		authored('overig', 'Stukken ondertekend in een andere functie', (rows) =>
			rows.length
				? `Stukken ondertekend als ${functionList(rows)}`
				: 'Stukken ondertekend in een andere functie'
		),
		{
			id: 'dossiers',
			label: 'Dossiers van dit lid',
			noun: 'dossiers',
			load: 'member-dossiers'
		},
		{
			id: 'instruments',
			label: 'Wetten waaraan dit lid werkte',
			noun: 'wetten',
			load: 'member-instruments'
		}
	],
	factions: [
		{
			id: 'members',
			label: 'Leden van deze fractie',
			noun: 'leden',
			match: [{ relation: 'MEMBER_OF', direction: 'inbound', collection: 'members' }]
		},
		{
			id: 'authored',
			label: 'Stukken die deze fractie indiende',
			noun: 'stukken',
			match: [{ relation: 'AUTHORED', direction: 'outbound', collection: 'documents' }]
		},
		{
			id: 'dossiers',
			label: 'Dossiers van deze fractie',
			noun: 'dossiers',
			load: 'faction-dossiers'
		},
		{
			id: 'instruments',
			label: 'Wetten waaraan deze fractie werkte',
			noun: 'wetten',
			load: 'faction-instruments'
		}
	],
	decisions: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			// The Kamerstuk itself (`primary_document`), which opens on its text, before the zaak
			// it is a stuk of; without one, what the vote was about as the edges give it.
			id: 'subject',
			label: 'Stuk waarover is gestemd',
			load: 'decision-subject',
			bakken: [
				{ relation: 'ABOUT', direction: 'outbound', collection: 'documents' },
				{ relation: 'ABOUT', direction: 'outbound', collection: 'cases' },
				{ relation: 'ABOUT', direction: 'outbound', collection: 'activities' },
				{ relation: 'MADE_IN', direction: 'outbound', collection: 'activities' }
			]
		},
		{
			id: 'votes',
			label: 'Fracties die stemden',
			noun: 'fracties',
			match: [{ relation: 'VOTED', direction: 'inbound', collection: 'factions' }],
			rowOrder: byChoice
		}
	],
	activities: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'committee',
			label: 'Commissie',
			match: [{ relation: 'LED_BY', direction: 'outbound', collection: 'committees' }]
		},
		{
			id: 'decisions',
			label: 'Stemmingen in deze activiteit',
			noun: 'stemmingen',
			match: [{ relation: 'MADE_IN', direction: 'inbound', collection: 'decisions' }]
		},
		{
			id: 'records',
			label: 'Verslag van deze activiteit',
			noun: 'verslagen',
			match: [
				{
					relation: 'MADE_IN',
					direction: 'inbound',
					collection: 'documents',
					where: (n) => !ingediend(n),
					split: true
				}
			]
		},
		{
			id: 'motions',
			label: 'Moties ingediend in deze activiteit',
			noun: 'moties',
			match: [
				{
					relation: 'MADE_IN',
					direction: 'inbound',
					collection: 'documents',
					where: ingediend,
					split: true
				}
			]
		},
		{
			id: 'commitments',
			label: 'Toezeggingen in deze activiteit',
			noun: 'toezeggingen',
			match: [{ relation: 'MADE_IN', direction: 'inbound', collection: 'commitments' }]
		},
		{
			id: 'cases',
			label: 'Zaken',
			noun: 'zaken',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'cases' }]
		}
	],
	commitments: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'activity',
			label: 'Activiteit waarin de toezegging is gedaan',
			match: [{ relation: 'MADE_IN', direction: 'outbound', collection: 'activities' }]
		},
		{
			id: 'fulfilled-by',
			label: 'Brieven die deze toezegging nakomen',
			noun: 'brieven',
			match: [{ relation: 'ANSWERS', direction: 'inbound', collection: 'documents' }]
		}
	],
	cases: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'PART_OF', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'documents',
			label: 'Stukken van deze zaak',
			noun: 'stukken',
			match: [{ relation: 'PART_OF', direction: 'inbound', collection: 'documents' }]
		},
		{
			id: 'decisions',
			label: 'Stemmingen over deze zaak',
			noun: 'stemmingen',
			match: [{ relation: 'ABOUT', direction: 'inbound', collection: 'decisions' }]
		},
		// Who brought it in (an amendement, a motie) and the zaak it goes with: the wetsvoorstel
		// of an amendement (`RELATED_TO`); the API gave them, Verbonden left them out.
		{
			id: 'authors',
			label: 'Indieners',
			noun: 'indieners',
			match: [{ relation: 'AUTHORED', direction: 'inbound', collection: ['members', 'factions'] }]
		},
		{
			id: 'related',
			label: 'Samenhangende zaken',
			noun: 'zaken',
			match: [{ relation: 'RELATED_TO', collection: 'cases' }]
		}
	]
};

const among = <T>(one: T | T[], value: unknown) =>
	Array.isArray(one) ? one.includes(value as T) : one === value;

/** Whether a neighbour falls in a bucket of a group. */
export const matches = (m: Match, n: Neighbor) =>
	among(m.relation, n.relation) &&
	among(m.collection, n.collection) &&
	(!m.direction || m.direction === n.direction) &&
	(!m.where || m.where(n));

/**
 * The decision a judgment says it appeals from, where the dataset lacks it
 * (`unresolved_appeal_targets`): a line under Uitspraak in eerdere aanleg, without a link.
 * Rechtbank Gelderland, 9 juli 2025, 24/6811, niet in de dataset.
 */
export function withUnresolvedAppeals(groups: Group[], props: Record<string, unknown>): Group[] {
	const targets = Array.isArray(props.unresolved_appeal_targets)
		? (props.unresolved_appeal_targets as Record<string, unknown>[])
		: [];
	if (targets.length === 0) return groups;
	const rows = targets.map((t): Row => {
		const court = typeof t.court === 'string' ? t.court.trim() : '';
		const day = typeof t.date === 'string' ? t.date : '';
		const number = typeof t.case_number === 'string' ? t.case_number : '';
		return {
			ref: { collection: 'judgments', key: `unresolved:${court}:${day}:${number}` },
			title: [capitalize(court), day && (langeDatum(day) || day), number]
				.filter(Boolean)
				.join(', '),
			context: null,
			filterGroup: 'uitspraken',
			missing: true
		};
	});
	return groups.map((g) =>
		g.id === 'earlier-instance'
			? {
					...g,
					rows: [...g.rows, ...rows],
					total: g.total != null ? g.total + rows.length : undefined
				}
			: g
	);
}

/**
 * The groups of a bron that its node response fills, in the order of the table. Groups
 * with a loader come back empty, for the caller to fill. A neighbour lands in the first
 * group that matches it, also when several relations bring it: the conclusion of the
 * Advocaat-Generaal is an ADVISES_ON and a REFERS_TO neighbour of the judgment, and
 * shows once, as the conclusion.
 */
export function buildGroups(
	collection: Collection,
	neighbors: Neighbor[],
	/** Per bucket (`relation/collection/direction`), what the database holds; see `bucketTotals`. */
	totals: Map<string, number> = new Map()
): Group[] {
	const defs = GROUPS[collection] ?? [];
	const groups = defs.map<Group>((def) => ({ ...def, rows: [], capped: false }));
	const counted = new Map<string, number>();
	for (const n of neighbors) {
		const bucket = bucketKey(n.relation, n.collection, n.direction);
		counted.set(bucket, (counted.get(bucket) ?? 0) + 1);
	}
	const seen = new Set<string>();
	const summed = new Set<string>();
	// Rows a split group took from a bucket that another group takes the total of.
	const claimed = new Map<string, number>();
	// Per group and bucket, the neighbours it counts that an earlier group shows.
	const shownElsewhere = new Map<string, number>();
	const placed = neighbors
		.map((n) => ({ n, at: groups.findIndex((g) => g.match?.some((m) => matches(m, n))) }))
		.filter((p) => p.at >= 0)
		.sort((a, b) => a.at - b.at || (groups[a.at].rowOrder?.(a.n, b.n) ?? 0));
	for (const { n, at } of placed) {
		const group = groups[at];
		const bucket = bucketKey(n.relation, n.collection, n.direction);
		if (seen.has(n.id)) {
			const key = `${group.id}:${bucket}`;
			shownElsewhere.set(key, (shownElsewhere.get(key) ?? 0) + 1);
			continue;
		}
		const row = rowOfNeighbor(n);
		if (!row) continue;
		seen.add(n.id);
		group.rows.push(row);
		const total = totals.get(bucket);
		// A bucket split over several groups states no total for any one of them: each
		// counts its rows, capped while the bucket holds more than was loaded.
		if (total != null && group.match?.some((m) => m.split && matches(m, n))) {
			if ((counted.get(bucket) ?? 0) < total) group.capped = true;
			claimed.set(bucket, (claimed.get(bucket) ?? 0) + 1);
		} else if (total != null && !summed.has(`${group.id}:${bucket}`)) {
			// A bucket counts for its group once; a `where` may leave some of it out.
			summed.add(`${group.id}:${bucket}`);
			group.total = (group.total ?? 0) + total;
		}
	}
	for (const key of summed) {
		const [id, bucket] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
		const g = groups.find((x) => x.id === id);
		if (g?.total != null) g.total -= (claimed.get(bucket) ?? 0) + (shownElsewhere.get(key) ?? 0);
	}
	for (const g of groups) {
		if (g.total != null && g.total < g.rows.length) g.total = g.rows.length;
		if (g.labelOf) g.label = g.labelOf(g.rows);
	}
	// A relation the API gained before this list did: shown, not dropped without a word.
	const other: Group = { id: 'other', label: 'Andere verbindingen', rows: [], capped: false };
	for (const n of neighbors) {
		if (isRelation(n.relation) || seen.has(n.id)) continue;
		const row = rowOfNeighbor(n);
		if (!row) continue;
		seen.add(n.id);
		other.rows.push(row);
	}
	return other.rows.length ? [...groups, other] : groups;
}

/** The number of bronnen of a group: what the API states, else what is loaded. */
export const groupCount = (group: Pick<Group, 'rows' | 'total'>) =>
	group.total != null && group.total >= group.rows.length ? group.total : group.rows.length;

/** `12`, `1.064`, or `meer dan 30` for a group the API cut off. */
export const countLabel = (group: Pick<Group, 'rows' | 'capped' | 'total'>) =>
	group.total != null && group.total >= group.rows.length
		? formatCount(group.total)
		: atLeast(group.rows.length, !!group.capped);

/** A de-word and a het-word: "deze richtlijn", "dit verdrag". */
const DIT: Record<string, string> = {
	richtlijn: 'deze richtlijn',
	verordening: 'deze verordening',
	verdrag: 'dit verdrag',
	besluit: 'dit besluit',
	kaderbesluit: 'dit kaderbesluit'
};

/** Of the BWB's kinds, those a lawyer calls a besluit or a regeling: an AMvB is a besluit. */
const DIT_SOORT: Record<string, string> = {
	AMvB: 'dit besluit',
	'Ministeriële regeling': 'deze regeling'
};

/**
 * The instrument by its kind, as "deze wet" names it in a label or a line: "dit besluit" for
 * an AMvB, "deze regeling" for a ministerial regulation, "deze richtlijn"; null for a wet or
 * another regeling, which keeps "deze wet".
 */
export function ditVan(props: Record<string, unknown> | null | undefined): string | null {
	const p = (props ?? {}) as Record<string, unknown>;
	const eigen = DIT_SOORT[kindName(typeof p.kind === 'string' ? p.kind : null) ?? ''];
	if (eigen) return eigen;
	const soort = lawKind(p as never)
		.toLowerCase()
		.split(' ')
		.at(-1)!;
	return DIT[soort] ?? null;
}

/**
 * The groups of an instrument named by its kind, as its head names it (`ditVan`): a
 * richtlijn has "Artikelen van deze richtlijn", an AMvB "Grondslag van dit besluit", not
 * "van deze wet". A wet or another regeling keeps "deze wet".
 */
export function naarSoort<G extends { label: string }>(
	groups: G[],
	props: Record<string, unknown> | null | undefined
): G[] {
	const dit = ditVan(props);
	if (!dit) return groups;
	return groups.map((g) => ({ ...g, label: g.label.replace(/\bdeze wet\b/, dit) }));
}
