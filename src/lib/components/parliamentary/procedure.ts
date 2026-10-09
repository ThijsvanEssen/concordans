// De tijdlijn van een dossier als procedure, in drie
// groepen (Raad van State, Tweede Kamer, Eerste Kamer). Alleen wat gebeurd is; wat nog kan
// volgen staat als één gestippelde regel die zegt dat het kan volgen. Moties, amendementen,
// brieven en procedurevergaderingen worden geteld en staan achter één knop.
import type { Schema } from '$lib/api/types';
import { bronHref } from '$lib/bron/href';
import { stand } from './stand';
import type { TijdGroep, TijdRegel } from '$lib/components/tijdlijn/tijdlijn';
import { draagtWetstitel, isGeneriek } from '$lib/bron/generiek';
import { withoutKamerstuk } from './kamerstuk';

type Detail = Schema<'DossierDetailResponse'>;
import { naarAmendementen, naarStemmingen } from './naar';
type Entry = Schema<'DossierTimelineResponse'>['entries'][number];
type Body = Record<string, unknown>;

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const bodyOf = (e: Entry) => (e.body ?? {}) as Body;
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
const naam = (kind: string) => NAAM[kind] ?? lower(kind);
const reeks = (namen: string[]) =>
	namen.length < 2 ? namen.join('') : `${namen.slice(0, -1).join(', ')} en ${namen.at(-1)}`;
const nrs = (n: string[]) =>
	n.length === 0 ? '' : n.length === 1 ? `nr. ${n[0]}` : `nrs. ${n[0]}–${n.at(-1)}`;

/** An activity by its agenda title; where that only names the kind, the kind. */
function activiteitZin(e: Entry, b: Body): string {
	const agenda = typeof b.agenda_title === 'string' ? b.agenda_title.trim() : '';
	const kind = e.kind ?? '';
	if (agenda && !isGeneriek(agenda, kind)) return agenda;
	const zin = agenda || kind;
	return zin.charAt(0).toUpperCase() + zin.slice(1);
}

/**
 * A paper that is not one of the bill's: by its own title (`Brief van de minister van J&V
 * over …`), its kind small above it, its number under it. A title that only names the kind
 * gives way to the kind; the number and the day still tell it apart.
 */
function eigenStuk(e: Entry, groep: 'rvs' | 'tk' | 'ek', dossier: string): TijdRegel {
	const kind = (e.kind ?? '').replace(/\s*\(.*\)\s*$/, '');
	const title = e.title ? withoutKamerstuk(e.title).trim() : '';
	const eigen = title && !isGeneriek(title, e.kind) ? title : null;
	const nr = nrOf(e);
	return {
		id: e.node_id,
		datum: e.date?.slice(0, 10) ?? null,
		teken: 'stuk',
		soort: 'documents',
		label: eigen ? kind || null : null,
		zin: eigen ?? (kind || title || 'Stuk'),
		meta: nr
			? `Kamerstuk${groep === 'ek' ? ' I' : ''} ${dossier}, ${groep === 'ek' ? nr : `nr. ${nr}`}`
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
function stemdagen(decisions: Entry[]): TijdRegel[] {
	const perDag = Map.groupBy(decisions, (e) => e.date?.slice(0, 10) ?? '');
	return [...perDag].map(([dag, besluiten]) => ({
		id: `stemmingen-${dag}`,
		datum: dag || null,
		teken: 'activiteit',
		soort: 'decisions',
		label: null,
		zin: `Stemmingen: ${besluiten.length} ${besluiten.length === 1 ? 'besluit' : 'besluiten'}`,
		actie: besluiten.some((e) => /^amendement/i.test(e.kind ?? ''))
			? naarAmendementen
			: naarStemmingen
	}));
}

function regelsVan(entries: Entry[], groep: 'rvs' | 'tk' | 'ek', dossier: string): TijdRegel[] {
	const out: TijdRegel[] = [];
	const overig: Entry[] = [];
	const asc = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
	// The papers of the bill of one day on one line: they carry the bill's title, their kind and
	// number tell them apart. Any other paper (a brief, a motie) on a line of its own, by its title.
	const docs = asc.filter((e) => e.node_type === 'document');
	const byDay = Map.groupBy(
		docs.filter((e) => draagtWetstitel(e.kind)),
		(e) => e.date?.slice(0, 10) ?? ''
	);
	for (const e of asc) {
		// A decision on what the dossier's kind is not (a motie, an amendement) counts per day.
		if (e.node_type === 'decision' && e.kind && !WETSVOORSTEL.has(e.kind)) {
			overig.push(e);
			continue;
		}
		if (e.node_type === 'decision') {
			const b = bodyOf(e);
			const uitslag = uitslagVan(b);
			const method = typeof b.method === 'string' ? b.method : '';
			const how =
				method === 'Hamerstuk'
					? ' als hamerstuk'
					: method.startsWith('Stemming bij zitten')
						? ' bij zitten en opstaan'
						: (e.kind ?? '').includes('zonder stemming') ||
							  (e.title ?? '').includes('zonder stemming')
							? ' zonder stemming'
							: '';
			out.push({
				id: e.node_id,
				datum: e.date,
				teken: uitslag === null ? 'open' : uitslag ? 'ja' : 'nee',
				soort: 'decisions',
				label: groep === 'ek' ? 'Stemming Eerste Kamer' : 'Stemming Tweede Kamer',
				zin:
					uitslag === null
						? 'Geen uitslag in de gegevens'
						: `${uitslag ? 'Aangenomen' : 'Verworpen'}${how}`,
				href: bronHref(e.node_id, { keepMode: false, mode: 'read' }),
				ref: e.node_id,
				groot: true
			});
		} else if (e.node_type === 'activity') {
			const b = bodyOf(e);
			out.push({
				id: e.node_id,
				datum: e.date,
				teken: 'activiteit',
				soort: 'activities',
				// Its agenda title where that says more than its kind; the committee under it.
				label: null,
				zin: activiteitZin(e, b),
				meta: e.node_type === 'activity' ? (e.committee?.name ?? null) : null,
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
		const zin = reeks(kinds.map(naam));
		out.push({
			id: `d-${groep}-${day}`,
			datum: day,
			teken: 'stuk',
			soort: 'documents',
			label: null,
			zin: zin.charAt(0).toUpperCase() + zin.slice(1),
			meta: nummers.length
				? `Kamerstuk${groep === 'ek' ? ' I' : ''} ${dossier}, ${groep === 'ek' ? nummers.join(', ') : nrs(nummers)}`
				: null,
			href: bronHref(first.node_id, { keepMode: false, mode: 'read' }),
			ref: first.node_id
		});
	}
	// After the bill's papers, so on one day the bill comes first (the sort keeps the order).
	for (const e of docs.filter((e) => !draagtWetstitel(e.kind)))
		out.push(eigenStuk(e, groep, dossier));
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
const stapNaam = (s: EkStep) => (s.phase ? (STAP[s.phase] ?? lower(s.phase)) : '');

/**
 * De voortgang zoals de pagina van het wetsvoorstel op eerstekamer.nl hem toont (API 0.76):
 * de stukken van de Eerste Kamer per stap, en waar het voorstel nu staat. De eerste stap is
 * die van de Tweede Kamer en staat hierboven al. Een stuk dat de tijdlijn al heeft (dezelfde
 * letter) en een stemming die als besluit in de gegevens staat, komen niet dubbel.
 * Null zonder pagina: dan blijft de algemene regel staan.
 */
function ekVoortgang(d: Detail, ek: TijdRegel[]): TijdRegel[] | null {
	const steps = (d.senate?.progress ?? []).filter((s) => s.phase);
	if (!steps.length) return null;
	const letters = new Set(ek.flatMap((r) => (r.meta ? r.meta.split(', ').slice(1) : [])));
	const besluit = !!d.ek_outcome || ek.some((r) => r.soort === 'decisions');
	const out: TijdRegel[] = [];
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
				zin: kind.charAt(0).toUpperCase() + kind.slice(1),
				meta: letter ? `Kamerstuk I ${d.number}, ${letter}` : null,
				href: p.url ?? null
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
			zin: [nu ? `Nu: ${stapNaam(nu)}.` : '', nog.length ? `Kan nog volgen: ${reeks(nog)}.` : '']
				.filter(Boolean)
				.join(' ')
		});
	return out;
}

const TK_NOG = [
	'verslag',
	'nota naar aanleiding van het verslag',
	'nota van wijziging',
	'plenaire behandeling',
	'stemming'
];
/** De fase waar het voorstel is, als plaats in TK_NOG; wat erna komt kan nog volgen. */
const FASE_PLAATS: Record<string, number> = {
	'Voorstel van wet': -1,
	'Memorie van toelichting': -1,
	'Advies Raad van State': -1,
	Verslag: 0,
	'Nota n.a.v. het verslag': 1,
	'Nota van wijziging / Amendement': 2,
	Stemmingen: 4
};
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
const WETSVOORSTEL = new Set(['Wetgeving', 'Initiatiefwetgeving', 'Begroting']);
export const isWetsvoorstel = (d: Pick<Detail, 'kind'>) => WETSVOORSTEL.has(d.kind ?? '');

export function procedure(d: Detail, entries: Entry[], metOverig: boolean) {
	const st = stand(d);
	const procedureEntries = entries.filter((e) => metOverig || isProcedure(e));
	const overig = entries.filter((e) => !isProcedure(e));

	const per = Map.groupBy(procedureEntries, instantie);
	const groepen: TijdGroep[] = [];
	const wetsvoorstel = isWetsvoorstel(d);
	// Without a bill nothing is to come: no state per Kamer, so no line of what can follow.
	const state = st?.bodies.map((b) => b.state) ?? (wetsvoorstel ? ['open', 'now', 'open'] : []);

	const rvs = regelsVan(per.get('rvs') ?? [], 'rvs', d.number);
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
								d.kind === 'Initiatiefwetgeving'
									? 'Het advies kan nog volgen.'
									: 'Geen advies in de gegevens.'
						}
					]
		});

	const tk = regelsVan(per.get('tk') ?? [], 'tk', d.number);
	// De wijze staat in tk_decision, niet in het besluit zelf.
	if (d.tk_decision?.kind?.includes('zonder stemming'))
		for (const r of tk)
			if (r.teken === 'ja' && r.zin === 'Aangenomen') r.zin = 'Aangenomen zonder stemming';
	if (state[1] === 'now') {
		const i = FASE_PLAATS[d.current_phase ?? ''] ?? -1;
		// Een nota van wijziging kan steeds opnieuw komen; ze blijft in de lijst.
		const nog = TK_NOG.slice(i + 1)
			.concat(i === 2 ? [] : [])
			.filter((x, k, a) => a.indexOf(x) === k);
		if (i === 2) nog.unshift('nog een nota van wijziging');
		tk.push({
			id: 'tk-nog',
			datum: null,
			teken: 'verwacht',
			soort: 'activities',
			zin: `Kan nog volgen: ${reeks(nog)}.`
		});
	}
	groepen.push({
		id: 'tk',
		titel: 'Tweede Kamer',
		regels: tk
	});

	const ek = regelsVan(per.get('ek') ?? [], 'ek', d.number);
	const voortgang = ekVoortgang(d, ek);
	if (voortgang) ek.push(...voortgang);
	else if (state[2] === 'now')
		ek.push({
			id: 'ek-nog',
			datum: null,
			teken: 'verwacht',
			soort: 'activities',
			zin: 'Kan nog volgen: verslag of plenaire behandeling, en stemming.'
		});
	if (state[2] === 'open')
		ek.push({
			id: 'ek-open',
			datum: null,
			teken: 'verwacht',
			soort: 'activities',
			zin: 'Aan de orde na aanneming door de Tweede Kamer.'
		});
	if (ek.length) groepen.push({ id: 'ek', titel: 'Eerste Kamer', regels: ek });

	// Het jaar staat in de kop van de groep, niet bij elke datum.
	for (const g of groepen) {
		const jaren = [
			...new Set(g.regels.flatMap((r) => (r.datum ? [r.datum.slice(0, 4)] : [])))
		].sort();
		g.sub = jaren.length ? (jaren.length > 1 ? `${jaren[0]}–${jaren.at(-1)}` : jaren[0]) : null;
	}
	return { groepen, overig: overig.length };
}
