// Ontwerpstudie ronde 4 (prototype): de tijdlijn van een dossier als procedure, in drie
// groepen (Raad van State, Tweede Kamer, Eerste Kamer). Alleen wat gebeurd is; wat nog kan
// volgen staat als één gestippelde regel die zegt dat het kan volgen. Moties, amendementen,
// brieven en procedurevergaderingen worden geteld en staan achter één knop.
import type { Schema } from '$lib/api/types';
import { bronHref } from '$lib/bron/href';
import { stand } from '$lib/components/parliamentary/stand';
import type { TijdGroep, TijdRegel } from './tijdlijn';

type Detail = Schema<'DossierDetailResponse'>;
type Entry = Schema<'DossierTimelineResponse'>['entries'][number];
type Body = Record<string, unknown>;

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const bodyOf = (e: Entry) => (e.body ?? {}) as Body;
const nrOf = (e: Entry): string | null => {
	const m = (e.title ?? '').match(/nr\. (\d+)/);
	if (m) return m[1];
	const seq = bodyOf(e).sequence;
	return typeof seq === 'string' && seq ? seq : null;
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

function regelsVan(entries: Entry[], groep: 'rvs' | 'tk' | 'ek', dossier: string): TijdRegel[] {
	const out: TijdRegel[] = [];
	const asc = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
	// Stukken van één dag in één regel.
	const byDay = Map.groupBy(
		asc.filter((e) => e.node_type === 'document'),
		(e) => e.date?.slice(0, 10) ?? ''
	);
	for (const e of asc) {
		if (e.node_type === 'decision') {
			const b = bodyOf(e);
			const passed = b.passed !== false && b.result !== 'Verworpen';
			const method = typeof b.method === 'string' ? b.method : '';
			const how =
				method === 'Hamerstuk'
					? ' als hamerstuk'
					: method.startsWith('Stemming bij zitten')
						? ' bij zitten en opstaan'
						: (e.kind ?? '').includes('zonder stemming') || (e.title ?? '').includes('zonder stemming')
							? ' zonder stemming'
							: '';
			out.push({
				id: e.node_id,
				datum: e.date,
				teken: passed ? 'ja' : 'nee',
				soort: 'decisions',
				label: groep === 'ek' ? 'Stemming Eerste Kamer' : 'Stemming Tweede Kamer',
				zin: `${passed ? 'Aangenomen' : 'Verworpen'}${how}`,
				href: bronHref(e.node_id, { keepMode: false, mode: 'read' }),
				groot: true
			});
		} else if (e.node_type === 'activity') {
			const b = bodyOf(e);
			out.push({
				id: e.node_id,
				datum: e.date,
				teken: 'activiteit',
				soort: 'activities',
				label: null,
				zin: typeof b.agenda_title === 'string' ? b.agenda_title : (e.kind ?? ''),
				href: bronHref(e.node_id, { keepMode: false, mode: 'read' })
			});
		}
	}
	for (const [day, docs] of byDay) {
		let kinds = [...new Set(docs.map((d) => d.kind ?? ''))].filter((k) => k !== 'Bijgewerkte tekst');
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
			meta:
				nummers.length
					? `Kamerstuk${groep === 'ek' ? ' I' : ''} ${dossier}, ${groep === 'ek' ? nummers.join(', ') : nrs(nummers)}`
					: null,
			href: bronHref(first.node_id, { keepMode: false, mode: 'read' })
		});
	}
	return out.sort((a, b) => (a.datum ?? '').localeCompare(b.datum ?? ''));
}

const TK_NOG = ['verslag', 'nota naar aanleiding van het verslag', 'nota van wijziging', 'plenaire behandeling', 'stemming'];
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
const MEERVOUD: Record<string, string> = {
	amendement: 'amendementen',
	motie: 'moties',
	'brief regering': 'brieven van de regering',
	procedurevergadering: 'procedurevergaderingen',
	'regeling van werkzaamheden': 'regelingen van werkzaamheden',
	'technische briefing': 'technische briefings',
	'plenair debat': 'plenaire debatten',
	'inbreng verslag': 'inbrengen voor het verslag'
};

export function procedure(d: Detail, entries: Entry[], metOverig: boolean) {
	const st = stand(d);
	const procedureEntries = entries.filter((e) => metOverig || isProcedure(e));
	const overig = entries.filter((e) => !isProcedure(e));
	const telling = Map.groupBy(overig, (e) => (e.kind ?? '').replace(/ \(.*\)$/, ''));
	const overigZin = [...telling]
		.sort((a, b) => b[1].length - a[1].length)
		.map(([k, v]) => `${v.length} ${v.length > 1 ? (MEERVOUD[lower(k)] ?? lower(k)) : lower(k)}`)
		.join(', ');

	const per = Map.groupBy(procedureEntries, instantie);
	const groepen: TijdGroep[] = [];
	const state = st?.bodies.map((b) => b.state) ?? ['open', 'now', 'open'];

	const rvs = regelsVan(per.get('rvs') ?? [], 'rvs', d.number);
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
		for (const r of tk) if (r.teken === 'ja' && r.zin === 'Aangenomen') r.zin = 'Aangenomen zonder stemming';
	if (state[1] === 'now') {
		const i = FASE_PLAATS[d.current_phase ?? ''] ?? -1;
		// Een nota van wijziging kan steeds opnieuw komen; ze blijft in de lijst.
		const nog = TK_NOG.slice(i + 1).concat(i === 2 ? [] : []).filter((x, k, a) => a.indexOf(x) === k);
		if (i === 2) nog.unshift('nog een nota van wijziging');
		tk.push({ id: 'tk-nog', datum: null, teken: 'verwacht', zin: `Kan nog volgen: ${reeks(nog)}.` });
	}
	groepen.push({
		id: 'tk',
		titel: 'Tweede Kamer',
		regels: tk,
		noot: overig.length && !metOverig ? `Ook in de gegevens: ${overigZin}.` : null
	});

	const ek = regelsVan(per.get('ek') ?? [], 'ek', d.number);
	if (state[2] === 'now')
		ek.push({ id: 'ek-nog', datum: null, teken: 'verwacht', zin: 'Kan nog volgen: verslag of plenaire behandeling, en stemming.' });
	if (state[2] === 'open')
		ek.push({ id: 'ek-open', datum: null, teken: 'verwacht', zin: 'Aan de orde na aanneming door de Tweede Kamer.' });
	if (ek.length) groepen.push({ id: 'ek', titel: 'Eerste Kamer', regels: ek });

	// Het jaar staat in de kop van de groep, niet bij elke datum.
	for (const g of groepen) {
		const jaren = [...new Set(g.regels.flatMap((r) => (r.datum ? [r.datum.slice(0, 4)] : [])))].sort();
		g.sub = jaren.length ? (jaren.length > 1 ? `${jaren[0]}–${jaren.at(-1)}` : jaren[0]) : null;
	}
	return { groepen, overig: overig.length };
}
