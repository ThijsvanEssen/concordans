// The amendments of a bill as a timetable (ux-voorstel, recommendation 3; Thijs, 10 Oct):
// a row per amendment as it came to the vote, a stop on the day of each paper it grew from
// ("ter vervanging van", REVISES between papers, #378), and at the end its outcome. The
// chains, their papers, submitters and decisions come from /api/dossiers/{number}/amendments
// (API 0.79.60); here only the columns of the timetable are made.
import { motionOrAmendment } from '$lib/text/document-kind';
import { getDossierAmendments } from '$lib/api/dossiers';
import type { Schema } from '$lib/api/types';
import { votesShort } from '$lib/votes/stemming';

/** A paper of an amendment: a stop in its route. `nieuw` where it replaces no other. */
export type Stuk = {
	id: string;
	nummer: string;
	datum: string;
	titel: string;
	nieuw?: boolean;
	/** The number of the paper that replaced it (REVISES), for its stop. */
	vervangenDoor?: string | null;
};

export type Uitslag = {
	id: string;
	/** The day of the vote. */
	datum: string;
	aangenomen: boolean | null;
	/** `92–58`; null for a decision without seats. */
	telling: string | null;
	/** Without a vote: what the Kamer decided instead, from its BesluitSoort (`ingetrokken`). */
	soort: string | null;
};

/** One amendment as it came to the vote, with the papers it grew from. */
export type Rij = {
	/** The last paper: the amendment as voted, or as it stood when nothing replaced it. */
	stuk: Stuk;
	/** Every paper of the chain, oldest first, the last one included. */
	haltes: Stuk[];
	/** The indiener and the number of medeindieners. */
	indiener: { naam: string; fractie: string | null; anderen: number } | null;
	/** Several papers merged into this one (more than one chain leads here). */
	samengevoegd: boolean;
	uitslag: Uitslag | null;
	/** No decision, and the zaak not done (`done: false`): not voted yet. */
	nogNiet: boolean;
};

export type Dienstregeling = {
	rijen: Rij[];
	/** The days (or weeks) of the columns, oldest first. */
	kolommen: string[];
	/** Whether the API gave any REVISES between the papers: without, each paper stands alone. */
	metVervanging: boolean;
};

type Antwoord = Schema<'AmendmentChainsResponse'>;
type Keten = Antwoord['chains'][number];

function stukVan(d: Keten['documents'][number]): Stuk {
	return { id: d.id, nummer: d.number ?? '', datum: d.date ?? '', titel: d.title ?? '' };
}

/**
 * What a decision without a vote says, from the TK's BesluitSoort as the API gives it
 * (`decision_kind`): `Stemmen - ingetrokken`, `Aanhouden`, `Uitstellen`, `Vervallen`. The
 * word, never "gestemd"; another kind by the part after its dash, lowercased.
 */
export function besluitSoort(kind: string | null | undefined): string | null {
	const k = (kind ?? '').trim().toLowerCase();
	if (!k) return null;
	if (/ingetrokken|intrekken/.test(k)) return 'ingetrokken';
	if (/aangehouden|aanhouden/.test(k)) return 'aangehouden';
	if (/uitgesteld|uitstellen/.test(k)) return 'uitgesteld';
	if (/vervallen|vervalt/.test(k)) return 'vervallen';
	if (/aangenomen|verworpen/.test(k)) return null;
	const deel =
		k
			.split(/\s+-\s+/)
			.at(-1)
			?.trim() ?? '';
	return deel && !/gestemd|stemmen/.test(deel) ? deel : null;
}

/** Above this many days the columns are weeks, so a long dossier stays one screen wide. */
const MAX_DAGEN = 14;

/** The Monday of the week of a day, as YYYY-MM-DD. */
export function maandagVan(dag: string): string {
	const d = new Date(`${dag}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
	return d.toISOString().slice(0, 10);
}

/** Without a vote the word of the decision: the API's outcome, else the BesluitSoort. */
function uitslagVan(b: Keten['decision']): Uitslag | null {
	if (!b) return null;
	return {
		id: b.id,
		datum: b.date ?? '',
		aangenomen: b.passed,
		telling: votesShort(b.tally),
		soort: b.passed === null ? (b.outcome ?? besluitSoort(b.decision_kind)) : null
	};
}

function rijVan(k: Keten): Rij {
	const nummer = new Map(k.documents.map((d) => [d.id, d.number ?? '']));
	const laatste = k.documents.find((d) => d.id === k.id) ?? k.documents.at(-1)!;
	const [eerste, ...anderen] = k.submitters;
	return {
		stuk: stukVan(laatste),
		haltes: k.documents.map((d) => ({
			...stukVan(d),
			nieuw: d.replaces.length === 0,
			vervangenDoor: d.replaced_by.length ? (nummer.get(d.replaced_by[0]) ?? null) : null
		})),
		indiener: eerste
			? { naam: eerste.name, fractie: eerste.faction, anderen: anderen.length }
			: null,
		samengevoegd: k.merged,
		uitslag: uitslagVan(k.decision),
		nogNiet: k.waiting
	};
}

export function dienstregeling(a: Antwoord): Dienstregeling {
	const rijen = a.chains.filter((k) => k.documents.length).map(rijVan);
	const dagen = [...new Set(rijen.flatMap((r) => r.haltes.map((h) => h.datum)))]
		.filter(Boolean)
		.sort();
	const kolommen = dagen.length > MAX_DAGEN ? [...new Set(dagen.map(maandagVan))].sort() : dagen;
	return {
		rijen,
		kolommen,
		metVervanging: a.chains.some((k) => k.documents.some((d) => d.replaces.length))
	};
}

/**
 * The stop that came to the vote: the paper the decision is about (the last of its row, by
 * the case of its paper), where the decision has an outcome. A row withdrawn, postponed or
 * not voted yet has none; its stops all stay open rings.
 */
export const inStemming = (r: Rij): string | null =>
	r.uitslag && r.uitslag.aangenomen !== null ? r.stuk.id : null;

/** The column of a day: the day itself, or its week where the columns are weeks. */
export const kolomVan = (d: Dienstregeling, dag: string) =>
	d.kolommen.includes(dag) ? dag : maandagVan(dag);

/** The timetable of a dossier by its number, asked once. */
export const getAmendementen = (number: string) =>
	getDossierAmendments(number).then(dienstregeling);

/** How many amendments a dossier has by its own counts per kind, without a request. */
export const aantalAmendementen = (perSoort: Record<string, number> | null | undefined) =>
	Object.entries(perSoort ?? {})
		.filter(([k]) => motionOrAmendment(k) === 'amendement')
		.reduce((n, [, v]) => n + v, 0);

/** One step of an amendment's route: what happened on a day, and the papers of it. */
type Stap = {
	wat: 'ingediend' | 'gewijzigd' | 'samengevoegd';
	datum: string;
	stukken: Stuk[];
};

/**
 * The route of an amendment, a step a day and a kind: the papers that replace none were
 * submitted, those that replace another changed it, and the last paper of chains that
 * meet merged them. Read from REVISES (`nieuw`), not from a title.
 */
export function stappen(r: Rij): Stap[] {
	const uit: Stap[] = [];
	const laatste = r.haltes.at(-1)?.id;
	for (const h of r.haltes) {
		const wat: Stap['wat'] = h.nieuw
			? 'ingediend'
			: h.id === laatste && r.samengevoegd
				? 'samengevoegd'
				: 'gewijzigd';
		const vorige = uit.at(-1);
		if (vorige && vorige.datum === h.datum && vorige.wat === wat) vorige.stukken.push(h);
		else uit.push({ wat, datum: h.datum, stukken: [h] });
	}
	return uit;
}
