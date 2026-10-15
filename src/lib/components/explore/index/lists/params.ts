// The address of Bronnen as the lists read it: every filter, the sort and the open row are in
// the URL, so a view can be shared. A value the site does not know is left out, so the list
// shows as without it.
import { COURT_KINDS, TIERS } from '$lib/vocabulary';
import {
	OUTCOME_LABEL,
	isDossierKind,
	isPhase,
	type Outcome
} from '$lib/components/parliamentary/stages';
import { chamberFromParam } from '$lib/components/parliamentary/chamber';
import { COMMITMENT_STATUSES, POSTS } from '../government';
import { MINISTRY_KEYS, choiceOf } from '$lib/util/choice';

const OUTCOMES = Object.keys(OUTCOME_LABEL) as Outcome[];
const DOSSIER_NUMBER = /^\d{5}(-[a-z0-9()]+)?$/i;

/** The parameters of the filters, the sort and the views; a tab and Wis alle filters drop them. */
export const FILTER_PARAMS = [
	'q',
	'phase',
	'has_phase',
	'track',
	'soort',
	'passed',
	'from',
	'to',
	'dossier',
	'party',
	'jurisdiction',
	'court',
	'tier',
	'court_kind',
	'subject',
	'subject_area',
	'procedure',
	'legal_area',
	'policy_domain',
	'leeg',
	'source',
	'sort',
	'dir',
	'only_active',
	'include_inactive',
	'ministry',
	'cabinet',
	'member',
	'post',
	'weergave',
	'status',
	'overdue',
	'coalition',
	'stand',
	'outcome'
];

/** The address of a list in Bronnen, read. */
export function readParams(params: URLSearchParams) {
	const get = (name: string) => params.get(name) ?? '';
	const q = get('q');
	const dossierStatus = choiceOf(params.get('stand'), ['open', 'closed', 'all'] as const);
	const track = get('track');
	return {
		q,
		// One phase or several: the dossiers whose current phase is one of them.
		phases: get('phase').split(',').filter(isPhase),
		/** Phases a dossier must all have passed, comma-separated. */
		hasPhase: get('has_phase').split(',').filter(isPhase).join(','),
		// A dossier's kind keeps the URL name `track`: `kind` is the tab.
		track: isDossierKind(track) ? track : ('' as const),
		/** The kind of the zaak a besluit decides, as the Kamer writes it (`Motie`, `Wetgeving`). */
		decisionKind: get('soort'),
		/** The kind of a stuk, as the Kamer writes it (`Motie`, `Brief regering`). */
		documentKind: get('soort'),
		// The Kamer whose parliament is listed; no filter but a choice, so it stays across tabs.
		kamer: chamberFromParam(params.get('kamer')) ?? ('TK' as const),
		ministry: choiceOf(params.get('ministry'), MINISTRY_KEYS) ?? ('' as const),
		cabinet: get('cabinet'),
		member: get('member'),
		post: choiceOf(params.get('post'), POSTS),
		// Bewindspersonen: one cabinet's posts, or the ministers of six cabinets side by side.
		sideBySide: params.get('weergave') === 'naast',
		commitmentStatus: choiceOf(params.get('status'), COMMITMENT_STATUSES),
		overdue: params.get('overdue') === '1',
		coalition: get('coalition'),
		// Dossiers: the open ones unless asked otherwise; a number searched for is looked up in all.
		dossierStatus,
		dossierScope: dossierStatus ?? (DOSSIER_NUMBER.test(q.trim()) ? 'all' : 'open'),
		outcome: choiceOf(params.get('outcome'), OUTCOMES),
		passed: choiceOf(params.get('passed'), ['true', 'false'] as const),
		from: get('from'),
		to: get('to'),
		dossier: get('dossier'),
		party: get('party'),
		jurisdiction: choiceOf(params.get('jurisdiction'), ['nl', 'eu'] as const),
		// A kind of wet as the source names it; the treaties for now (Thijs, 10 Oct: "ook
		// verdragen een plekje"): the BWBV and the Verdragenbank, kind `verdrag`.
		treaty: choiceOf(params.get('soort'), ['verdrag'] as const),
		court: get('court'),
		// TODO(backend G14): the lists hold records without text or articles; until they can
		// be left out by a parameter, a wet needs an article and a judgment a source.
		withEmpty: params.get('leeg') === '1',
		source: choiceOf(params.get('source'), ['echr'] as const),
		tier: choiceOf(params.get('tier'), TIERS),
		courtKind: choiceOf(params.get('court_kind'), COURT_KINDS),
		// Rechtsgebied and procedure as rechtspraak.nl gives them (API 0.74, BE-44).
		subject: get('subject'),
		// The main area of law (BE-57, API 0.75): `Bestuursrecht` holds `Bestuursrecht; Belastingrecht`.
		subjectArea: get('subject_area'),
		// The registers of the BWB (TOOI): a legal area, main or specific, and a theme, by slug.
		legalArea: get('legal_area'),
		policyDomain: get('policy_domain'),
		procedure: get('procedure'),
		sort: params.get('sort'),
		dir: choiceOf(params.get('dir'), ['asc', 'desc'] as const),
		onlyActive: params.get('only_active') === '1',
		// Members and factions are the sitting ones unless historical ones are asked for.
		includeInactive: params.get('include_inactive') === '1',
		/** The open row, `<collection>/<key>`. */
		open: params.get('open')
	};
}

export type IndexParams = ReturnType<typeof readParams>;
