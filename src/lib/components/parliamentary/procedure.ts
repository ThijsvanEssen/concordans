// De tijdlijn van een dossier als procedure, in drie
// groepen (Raad van State, Tweede Kamer, Eerste Kamer). Alleen wat gebeurd is; wat nog kan
// volgen staat als één gestippelde regel die zegt dat het kan volgen. Moties, amendementen,
// brieven en procedurevergaderingen worden geteld en staan achter één knop.
import { outcomeWord } from '$lib/text/outcome';
import { carriesBillTitle, motionOrAmendment, shortKind } from '$lib/text/document-kind';
import { forAgainst } from './stemming';
import { capitalize, count, joinAnd, lowerFirst } from '$lib/text/words';
import { noneHeld } from '$lib/text/coverage';
import type { Schema } from '$lib/api/types';
import { bronHref } from '$lib/bron/href';
import { parseNodeId } from '$lib/vocabulary';
import { citationRecord } from '$lib/text/citation-record';
import { stand } from './stand';
import { CHAMBER_NAME } from './chamber';
import { BILL_KINDS, INITIATIVE_BILL, methodPhrase, stepsToCome } from './stages';
import {
	enigJaar,
	sorteer,
	type TijdGroep,
	type TijdRegel
} from '$lib/components/tijdlijn/tijdlijn';
import { voteOf, type MetInhoud } from '$lib/components/open/rij-inhoud';
import { isGeneriek } from '$lib/bron/generiek';
import { withoutKamerstuk } from '$lib/text/kamerstuk';
import type { CoalitieBij } from './coalitie';

type Detail = Schema<'DossierDetailResponse'>;
import { naarAmendementen, naarStemmingen } from './naar';
type Entry = Schema<'DossierTimelineResponse'>['entries'][number];
/** A line of the procedure: a vote of the Tweede Kamer carries what the coalition did. */
type Regel = TijdRegel<CoalitieBij>;
type Groep = TijdGroep<CoalitieBij>;

/** The coalition block of a decision entry and its fracties, where the timeline gives it. */
function coalitieVan(e: Entry): CoalitieBij | null {
	const b = e.body as {
		coalition?: Schema<'CoalitionVoteDTO'> | null;
		coalition_factions?: Schema<'CoalitionFactionDTO'>[] | null;
	} | null;
	return b?.coalition ? { blok: b.coalition, fracties: b.coalition_factions ?? [] } : null;
}
type Body = Record<string, unknown>;

/**
 * What a line of the procedure opens in place (Tijdlijn `inhoud`): a paper its opening, the
 * vote on the bill its bar, a day's papers of the bill the papers by kind and number. A line
 * not in the map (an activity, the Eerste Kamer's own page) has none: its title is the bron.
 */
type ProcedureInhoud =
	| { soort: 'opening' | 'stemming'; item: MetInhoud }
	| { soort: 'stukken'; stukken: { ref: string; zin: string }[] };
type Inhouden = Map<string, ProcedureInhoud>;

const bodyOf = (e: Entry) => (e.body ?? {}) as Body;
const dayOf = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : null);
/**
 * The day of a line: an advice of the Raad van State by the day of the advice (`advice_date`,
 * not the day it was filed), an activity by the day it takes place (`effective_date`, a debat
 * moved to another day); else the entry's own day. Null-safe: the fields come with the API.
 */
const dayOfEntry = (e: Entry): string | null =>
	dayOf(bodyOf(e).advice_date) ?? dayOf(bodyOf(e).effective_date) ?? e.date?.slice(0, 10) ?? null;
/**
 * The number of a paper in its dossier: the Eerste Kamer's letter (`number`, API 0.73,
 * BE-2), the Tweede Kamer's number in the title or as `sequence`.
 */
export const nrOf = (e: { title?: string | null; body?: unknown }): string | null => {
	const b = (e.body ?? {}) as Body;
	if (typeof b.number === 'string' && b.number.trim()) return b.number.trim();
	const m = (e.title ?? '').match(/nr\. (\d+)/);
	if (m) return m[1];
	const seq = b.sequence;
	return typeof seq === 'number' || (typeof seq === 'string' && seq) ? String(seq) : null;
};
const instantie = (e: Entry): 'rvs' | 'tk' | 'ek' => {
	if ((e.kind ?? '').startsWith('Advies Afdeling advisering')) return 'rvs';
	return bodyOf(e).chamber === 'EK' ? 'ek' : 'tk';
};
/** Een stuk dat de procedure draagt; de rest wordt geteld. */
const PROCEDURE = [
	'Koninklijke boodschap',
	'Voorstel van wet',
	'Memorie van toelichting',
	'Advies Afdeling advisering',
	'Verslag',
	'Nota n.a.v.',
	'Nota van wijziging',
	'Eindtekst',
	'Memorie van antwoord',
	'Nadere memorie',
	'Plenair debat (wetgeving)',
	'Wetgevingsoverleg'
];
const isProcedure = (e: Entry) =>
	e.node_type === 'decision' || PROCEDURE.some((p) => (e.kind ?? '').startsWith(p));

const NAAM: Record<string, string> = {
	'Nota n.a.v. het (nader/tweede nader/enz.) verslag': 'nota naar aanleiding van het verslag',
	'Verslag (initiatief)wetsvoorstel (nader)': 'verslag',
	'Advies Afdeling advisering Raad van State en Nader rapport': 'advies en nader rapport',
	'Advies Afdeling advisering Raad van State': 'advies'
};
const naam = (kind: string) => NAAM[kind] ?? lowerFirst(kind);

/** An activity by its agenda title; where that only names the kind, the kind. */
function activiteitZin(e: Entry, b: Body): string {
	const agenda = typeof b.agenda_title === 'string' ? b.agenda_title.trim() : '';
	const kind = e.kind ?? '';
	if (agenda && !isGeneriek(agenda, kind)) return agenda;
	const zin = agenda || kind;
	return capitalize(zin);
}

/**
 * A paper that is not one of the bill's: by its own title (`Brief van de minister van J&V
 * over …`), its kind small above it, its number under it. A title that only names the kind
 * gives way to the kind; the number and the day still tell it apart.
 */
const opening = (e: Entry): ProcedureInhoud => ({
	soort: 'opening',
	item: {
		kind: 'Brief regering',
		node: { collection: 'documents', key: parseNodeId(e.node_id)?.key ?? '' },
		summary: null,
		vote: null
	}
});

function eigenStuk(e: Entry, groep: 'rvs' | 'tk' | 'ek', dossier: string): Regel {
	const kind = shortKind(e.kind ?? '');
	const title = e.title ? withoutKamerstuk(e.title).trim() : '';
	const eigen = title && !isGeneriek(title, e.kind) ? title : null;
	const nr = nrOf(e);
	return {
		id: e.node_id,
		datum: dayOfEntry(e),
		teken: 'stuk',
		soort: 'documents',
		label: eigen ? kind || null : null,
		zin: eigen ?? (kind || title || 'Stuk'),
		nummers: nr ? [nr] : null,
		meta: nr
			? (citationRecord({
					kind: 'kamerstuk',
					chamber: groep === 'ek' ? 'EK' : 'TK',
					date: e.date,
					dossier_number: dossier,
					number: nr
				})?.short ?? null)
			: null,
		href: bronHref(e.node_id, { keepMode: false, mode: 'read' }),
		ref: e.node_id
	};
}

/**
 * The votes of one day on what is not the bill itself (amendementen, moties) as one line:
 * "Stemmingen: 33 besluiten" (Thijs, 10 Oct). It leads to the amendementen in the reader
 * where the day has any, else to the votes in Verbonden. The vote on the bill keeps its line.
 */
function stemdagen(decisions: Entry[]): Regel[] {
	const perDag = Map.groupBy(decisions, (e) => e.date?.slice(0, 10) ?? '');
	return [...perDag].map(([dag, besluiten]) => ({
		id: `stemmingen-${dag}`,
		datum: dag || null,
		teken: 'activiteit',
		soort: 'decisions',
		label: null,
		zin: `Stemmingen: ${count(besluiten.length, 'besluit', 'besluiten')}`,
		actie: besluiten.some((e) => motionOrAmendment(e.kind) === 'amendement')
			? naarAmendementen
			: naarStemmingen
	}));
}

function regelsVan(
	entries: Entry[],
	groep: 'rvs' | 'tk' | 'ek',
	dossier: string,
	inhoud: Inhouden
): Regel[] {
	const out: Regel[] = [];
	const overig: Entry[] = [];
	const asc = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
	// The papers of the bill of one day on one line: they carry the bill's title, their kind and
	// number tell them apart. Any other paper (a brief, a motie) on a line of its own, by its title.
	const docs = asc.filter((e) => e.node_type === 'document');
	const byDay = Map.groupBy(
		docs.filter((e) => carriesBillTitle(e.kind)),
		(e) => dayOfEntry(e) ?? ''
	);
	for (const e of asc) {
		// A decision on what the dossier's kind is not (a motie, an amendement) counts per day.
		if (e.node_type === 'decision' && e.kind && !BILL_KINDS.has(e.kind)) {
			overig.push(e);
			continue;
		}
		if (e.node_type === 'decision') {
			const b = bodyOf(e);
			const uitslag = uitslagVan(b);
			const tally = (b.tally ?? {}) as Record<string, number>;
			const { voor, tegen } = forAgainst(tally);
			if (voor + tegen > 0)
				inhoud.set(e.node_id, {
					soort: 'stemming',
					item: {
						kind: 'stemming',
						node: { collection: 'decisions', key: parseNodeId(e.node_id)?.key ?? '' },
						summary: null,
						vote: voteOf({ chamber: groep === 'ek' ? 'EK' : 'TK', passed: uitslag, tally })
					}
				});
			const method = typeof b.method === 'string' ? b.method : null;
			const how = methodPhrase(method, `${e.kind ?? ''} ${e.title ?? ''}`);
			out.push({
				id: e.node_id,
				datum: e.date,
				teken: uitslag === null ? 'open' : uitslag ? 'ja' : 'nee',
				soort: 'decisions',
				label: groep === 'ek' ? 'Stemming Eerste Kamer' : 'Stemming Tweede Kamer',
				zin: uitslag === null ? capitalize(noneHeld('uitslag')) : (outcomeWord(uitslag, how) ?? ''),
				href: bronHref(e.node_id, { keepMode: false, mode: 'read' }),
				ref: e.node_id,
				groot: true,
				// What the coalition did on it (API 0.79.45, #559; Thijs, 10 Oct): the Tweede Kamer only.
				bij: coalitieVan(e)
			});
		} else if (e.node_type === 'activity') {
			const b = bodyOf(e);
			out.push({
				id: e.node_id,
				datum: dayOfEntry(e),
				teken: 'activiteit',
				soort: 'activities',
				// Its agenda title where that says more than its kind; the committee under it.
				label: null,
				zin: activiteitZin(e, b),
				meta: e.committee?.name ?? null,
				href: bronHref(e.node_id, { keepMode: false, mode: 'read' }),
				ref: e.node_id
			});
		}
	}
	for (const [day, docs] of byDay) {
		let kinds = [...new Set(docs.map((d) => d.kind ?? ''))].filter(
			(k) => k !== 'Bijgewerkte tekst'
		);
		// Advies en nader rapport bevat het advies: één keer noemen.
		if (kinds.some((k) => k.endsWith('en Nader rapport')))
			kinds = kinds.filter((k) => k !== 'Advies Afdeling advisering Raad van State');
		if (!kinds.length) continue;
		const nummers = [...new Set(docs.map(nrOf).filter((n): n is string => !!n))].sort(
			(a, b) => Number(a) - Number(b) || a.localeCompare(b)
		);
		const first = docs.find((d) => nrOf(d)) ?? docs[0];
		const zin = joinAnd(kinds.map(naam));
		const id = `d-${groep}-${day}`;
		// One paper opens its text; several open as a list, each by its kind and number.
		const eigen = docs
			.filter((d) => d.kind !== 'Bijgewerkte tekst')
			.sort((a, b) => {
				const [x, y] = [nrOf(a) ?? '', nrOf(b) ?? ''];
				return Number(x) - Number(y) || x.localeCompare(y);
			});
		inhoud.set(
			id,
			eigen.length === 1
				? opening(eigen[0])
				: {
						soort: 'stukken',
						stukken: eigen.map((d) => {
							const nr = nrOf(d);
							const k = naam(d.kind ?? '');
							return {
								ref: d.node_id,
								zin: `${capitalize(k)}${nr ? `, ${groep === 'ek' ? nr : `nr. ${nr}`}` : ''}`
							};
						})
					}
		);
		out.push({
			id,
			datum: day,
			teken: 'stuk',
			soort: 'documents',
			label: null,
			zin: capitalize(zin),
			nummers: nummers.length ? nummers : null,
			meta: nummers.length
				? (citationRecord({
						kind: 'kamerstuk',
						chamber: groep === 'ek' ? 'EK' : 'TK',
						date: day,
						dossier_number: dossier,
						numbers: nummers
					})?.short ?? null)
				: null,
			href: bronHref(first.node_id, { keepMode: false, mode: 'read' }),
			ref: first.node_id
		});
	}
	// After the bill's papers, so on one day the bill comes first (the sort keeps the order).
	for (const e of docs.filter((e) => !carriesBillTitle(e.kind))) {
		out.push(eigenStuk(e, groep, dossier));
		inhoud.set(e.node_id, opening(e));
	}
	out.push(...stemdagen(overig));
	return out.sort((a, b) => (a.datum ?? '').localeCompare(b.datum ?? ''));
}

type EkStep = Schema<'EkStepDTO'>;

/** Een stap van de Eerste Kamer, zoals de zin hem noemt. */
const STAP: Record<string, string> = {
	'Schriftelijke voorbereiding': 'schriftelijke voorbereiding',
	Plenair: 'plenaire behandeling',
	Afkondiging: 'afkondiging'
};
const stapNaam = (s: EkStep) => (s.phase ? (STAP[s.phase] ?? lowerFirst(s.phase)) : '');

/**
 * De voortgang zoals de pagina van het wetsvoorstel op eerstekamer.nl hem toont (API 0.76):
 * de stukken van de Eerste Kamer per stap, en waar het voorstel nu staat. De eerste stap is
 * die van de Tweede Kamer en staat hierboven al. Een stuk dat de tijdlijn al heeft (dezelfde
 * letter) en een stemming die als besluit in de gegevens staat, komen niet dubbel.
 * Null zonder pagina: dan blijft de algemene regel staan.
 */
function ekVoortgang(d: Detail, ek: Regel[]): Regel[] | null {
	const steps = (d.senate?.progress ?? []).filter((s) => s.phase);
	if (!steps.length) return null;
	const letters = new Set(ek.flatMap((r) => r.nummers ?? []));
	const besluit = !!d.ek_outcome || ek.some((r) => r.soort === 'decisions');
	const out: Regel[] = [];
	// The publication of the wet is its Staatsblad page, where that stands (not the pdf of the
	// Eerste Kamer): the one publication of the day the paper names.
	const stb = (p: { kind?: string | null; date?: string | null }) => {
		if (!/^publicatie wet$/i.test(p.kind ?? '')) return null;
		const dag = (d.enacted ?? []).filter((e) => e.path && e.published_on === p.date);
		return dag.length === 1 ? dag[0].path : null;
	};
	for (const step of steps)
		for (const [i, p] of (step.papers ?? []).entries()) {
			const letter = p.number?.match(/^EK, (.+)$/)?.[1] ?? null;
			if (letter && letters.has(letter)) continue;
			if (besluit && /^stemming/i.test(p.kind ?? '')) continue;
			const kind = p.kind ?? stapNaam(step);
			out.push({
				id: `ek-${step.phase}-${i}`,
				datum: p.date ?? null,
				teken: 'stuk',
				soort: 'documents',
				label: null,
				zin: capitalize(kind),
				meta: letter
					? (citationRecord({
							kind: 'kamerstuk',
							chamber: 'EK',
							date: p.date,
							dossier_number: d.number,
							number: letter
						})?.short ?? null)
					: null,
				href: stb(p) ?? p.url ?? null
			});
		}
	const nu = steps.find((s) => s.state === 'geblokt');
	const nog = steps.filter((s) => s.state === 'leeg').map(stapNaam);
	if (nu || nog.length)
		out.push({
			id: 'ek-nu',
			datum: null,
			teken: 'verwacht',
			soort: 'activities',
			zin: [
				nu ? `Nu: ${stapNaam(nu)}.` : '',
				nog.length ? `Volgende stappen: ${joinAnd(nog)}.` : ''
			]
				.filter(Boolean)
				.join(' ')
		});
	return out;
}

/**
 * The outcome of a vote as the source gives it: aangenomen (true), verworpen (false), or
 * none (null) for a vote that was postponed or has no result yet. The Tweede Kamer gives
 * `passed`, the Eerste Kamer also `result`; a missing value is no "Aangenomen".
 */
export function uitslagVan(b: { passed?: unknown; result?: unknown }): boolean | null {
	if (b.passed === true || b.result === 'Aangenomen') return true;
	if (b.passed === false || b.result === 'Verworpen') return false;
	return null;
}

/**
 * The kinds of dossier that run the procedure of a bill, as the API names them from the
 * dossier's zaak (`kind`; the phases exist for these alone). Another dossier, a verzameldossier
 * such as Huurbeleid, has no steps to come: no advice, no Eerste Kamer.
 */
const isWetsvoorstel = (d: Pick<Detail, 'kind'>) => BILL_KINDS.has(d.kind ?? '');

export function procedure(d: Detail, entries: Entry[], metOverig: boolean) {
	const st = stand(d);
	const procedureEntries = entries.filter((e) => metOverig || isProcedure(e));
	const overig = entries.filter((e) => !isProcedure(e));

	const per = Map.groupBy(procedureEntries, instantie);
	const inhoud: Inhouden = new Map();
	const groepen: Groep[] = [];
	const wetsvoorstel = isWetsvoorstel(d);
	// Without a bill nothing is to come: no state per Kamer, so no line of what can follow.
	const state = st?.bodies.map((b) => b.state) ?? (wetsvoorstel ? ['open', 'now', 'open'] : []);

	const rvs = regelsVan(per.get('rvs') ?? [], 'rvs', d.number, inhoud);
	if (rvs.length || wetsvoorstel)
		groepen.push({
			id: 'rvs',
			titel: 'Raad van State',
			regels: rvs.length
				? rvs
				: [
						{
							id: 'rvs-nog',
							datum: null,
							teken: 'verwacht',
							soort: 'activities',
							zin:
								d.kind === INITIATIVE_BILL
									? 'Het advies kan nog volgen.'
									: `${capitalize(noneHeld('advies'))}.`
						}
					]
		});

	const tk = regelsVan(per.get('tk') ?? [], 'tk', d.number, inhoud);
	// The way is in tk_decision, not in the decision itself.
	const how = methodPhrase(null, d.tk_decision?.kind);
	if (how) for (const r of tk) if (r.teken === 'ja' && r.zin === 'Aangenomen') r.zin += ` ${how}`;
	if (state[1] === 'now')
		tk.push({
			id: 'tk-nog',
			datum: null,
			teken: 'verwacht',
			soort: 'activities',
			zin: `Volgende stappen: ${joinAnd(stepsToCome(d.current_phase))}.`
		});
	groepen.push({
		id: 'tk',
		titel: CHAMBER_NAME.TK,
		regels: tk
	});

	let ek = regelsVan(per.get('ek') ?? [], 'ek', d.number, inhoud);
	const voortgang = ekVoortgang(d, ek);
	// The papers of the Eerste Kamer's own page between the others, by their day.
	if (voortgang) ek = sorteer([...ek, ...voortgang], 'oplopend');
	else if (state[2] === 'now')
		ek.push({
			id: 'ek-nog',
			datum: null,
			teken: 'verwacht',
			soort: 'activities',
			zin: 'Volgende stappen: verslag of plenaire behandeling, en stemming.'
		});
	if (state[2] === 'open')
		ek.push({
			id: 'ek-open',
			datum: null,
			teken: 'verwacht',
			soort: 'activities',
			zin: 'Volgt na aanneming door de Tweede Kamer.'
		});
	if (ek.length) groepen.push({ id: 'ek', titel: CHAMBER_NAME.EK, regels: ek });

	// Het jaar staat in de kop van de groep, en niet nog eens onder elke dag.
	for (const g of groepen) {
		const jaren = [
			...new Set(g.regels.flatMap((r) => (r.datum ? [r.datum.slice(0, 4)] : [])))
		].sort();
		g.sub = jaren.length ? (jaren.length > 1 ? `${jaren[0]}–${jaren.at(-1)}` : jaren[0]) : null;
		g.jaar = enigJaar(g.regels);
	}
	return { groepen, overig: overig.length, inhoud };
}
