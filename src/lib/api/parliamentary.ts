// Parliamentary API types — match schemas.py on the backend.

export type LegislativeStage =
	| 'wetsvoorstel'
	| 'mvt'
	| 'advies_rvs'
	| 'nota'
	| 'verslag'
	| 'amendementen'
	| 'stemming'
	| 'afgehandeld';

// ── Dossier ───────────────────────────────────────────────────────────────────

/**
 * What kind of dossier this is. Stable across the dossier's lifetime.
 * Use this for the primary list/bucket axis. `null` for legacy dossiers
 * with no Zaak signal yet — treat as 'overig'.
 */
export type TrajectKind =
	| 'wetsvoorstel' // regering-initiated wet
	| 'initiatiefwetsvoorstel' // lid-initiated wet
	| 'begroting' // begrotingsstaat / Voorjaarsnota
	| 'motie' // standalone motie-traject
	| 'overig'; // brief regering, vragen, etc.

/** Single legislative stage. `huidige_fase` reports the latest one reached;
 *  `stages_present` lists every stage that has at least one matching signal. */
export type DossierStage =
	| 'wetsvoorstel'
	| 'mvt'
	| 'advies_rvs'
	| 'nota'
	| 'verslag'
	| 'amendementen'
	| 'stemming'
	| 'afgehandeld'
	| 'onbekend';

export interface DossierSummaryDTO {
	id: string;
	key: string;
	kamerstuknummer: string;
	titel: string | null;
	/** Latest recognised stage. Backend gebruikt `null` voor onbekend
	 *  (de 'onbekend'-string is in de huidige API afgeschaft). */
	huidige_fase: string | null;
	/** Every stage that has fired at least once, chronologically ordered.
	 *  Backend may not populate on older payloads — treat as optional. */
	stages_present?: DossierStage[] | null;
	/** What kind of dossier this is. Stable. Backend normaliseert `null`
	 *  inmiddels naar `'overig'` — frontend hoeft geen fallback meer. */
	traject_kind?: TrajectKind | null;
	afgedaan: boolean;
	geopend_op: string | null;
	gesloten_op: string | null;
}

/** Paginated wrapper voor GET /api/dossiers/open (sinds backend-bugfix). */
export interface DossierListResponse {
	total: number;
	items: DossierSummaryDTO[];
}

export interface DossierDetailResponse extends DossierSummaryDTO {
	document_count: number;
	activiteit_count: number;
	stemming_count: number;
	toezegging_count: number;
}

export interface DossierDocumentDTO {
	id: string;
	key: string;
	soort: string | null;
	titel: string | null;
	volgnummer: number | null;
	dossier_nummer: string | null;
	vergaderjaar: string | null;
	datum: string | null;
	tk_url: string | null;
	display_name: string | null;
}

export interface DossierDocumentsResponse {
	items: DossierDocumentDTO[];
	total: number;
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export interface TimelineEntryDTO {
	datum: string | null;
	soort: string;
	titel: string | null;
	node_id: string;
	node_type: string;
	body: Record<string, unknown>;
}

export interface DossierTimelineResponse {
	kamerstuknummer: string;
	total: number;
	order: string;
	entries: TimelineEntryDTO[];
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface DossierMutationNode {
	id: string;
	key: string;
	collection: string;
	type: string;
	display_name: string | null;
	labels: string[];
}

export interface DossierMutationEdge {
	from_id: string | null;
	to_id: string | null;
	relation: string | null;
	status: string | null;
	meta: Record<string, unknown> | null;
}

export interface DossierMutationsResponse {
	kamerstuknummer: string;
	nodes: DossierMutationNode[];
	edges: DossierMutationEdge[];
}

// ── Article legislative history ───────────────────────────────────────────────

export interface LegislativeHistoryEntry {
	dossier_id: string | null;
	dossier_nummer: string | null;
	dossier_titel: string | null;
	datum: string | null;
	soort: string | null;
	status: string | null;
	samenvatting: string | null;
	document_id: string | null;
}

export interface ArticleLegislativeHistoryResponse {
	article_id: string;
	entries: LegislativeHistoryEntry[];
	total: number;
}

export interface ArticleInFluxResponse {
	article_id: string;
	in_flux: boolean;
	open_dossier_count: number;
}

// ── Commissies ────────────────────────────────────────────────────────────────

export interface CommissieDTO {
	id: string;
	key: string;
	naam: string | null;
	afkorting: string | null;
	slug: string | null;
	active_dossier_count: number;
}

export interface Fractielidmaatschap {
	fractie_id: string;
	fractie_key: string;
	naam: string | null;
	afkorting: string | null;
	aliases: string[];
	van: string | null;
	tot_en_met: string | null;
	functie: string | null;
}

export interface LidDTO {
	id: string;
	key: string;
	naam: string | null;
	partij: string | null;
	actief: boolean;
	fractielidmaatschappen?: Fractielidmaatschap[];
	/** Commissie-membership validity from LID_VAN edge meta (geldig_van/geldig_tot). */
	geldig_van?: string | null;
	geldig_tot?: string | null;
}

export interface FractieDTO {
	id: string;
	key: string;
	naam: string | null;
	afkorting: string | null;
	/** Aliassen (alternatieve namen / afkortingen). */
	aliases?: string[];
	/** True wanneer de fractie nog in een kamertijdvak vertegenwoordigd is. */
	actief?: boolean | null;
	/** ISO-datum waarop de fractie voor het eerst actief was. */
	datum_actief?: string | null;
	/** ISO-datum waarop de fractie inactief werd. `null` betekent nog actief. */
	datum_inactief?: string | null;
	/** Cumulatief aantal leden ooit (niet zetelaantal). */
	member_count?: number | null;
	/** Huidig zetelaantal in de Tweede Kamer. */
	aantal_zetels?: number | null;
}

export interface CommissieDetailDTO extends CommissieDTO {
	leden: LidDTO[];
	dossiers: DossierSummaryDTO[];
}

/** GET /api/commissies/with-leden — all committees + their members in one
 *  call. Used by the parliamentary Lagen load to skip an N+1 waterfall. */
export interface CommissieWithLedenDTO extends CommissieDTO {
	leden: LidDTO[];
}

/** GET /api/parlement/zetels — current seat distribution across active fracties.
 *  Fracties are pre-sorted left-to-right per political seating order.
 */
export interface ZetelFractie {
	id: string;
	key: string;
	afkorting: string | null;
	naam: string | null;
	aantal_zetels: number;
	color: string;
	order: number;
}
export interface ZetelsResponse {
	total_seats: number;
	assigned_seats: number;
	as_of: string;
	fracties: ZetelFractie[];
}

// ── Leden ─────────────────────────────────────────────────────────────────────

export interface LidStemDTO {
	stemming_id: string;
	stemming_key?: string;
	besluit_id: string;
	datum: string | null;
	/** Short description of the decision, e.g. "Aangenomen." */
	onderwerp: string | null;
	aangenomen: boolean;
	/** "Voor" | "Tegen" | "Onthouden" */
	soort: string;
	aantal_zetels: number;
	/** Fractie the lid was a member of at the time of the vote. */
	partij_at_time?: string | null;
	fractie_key?: string | null;
}

/** Aggregated count of articles a lid (or fractie) has touched in a given
 *  instrument, grouped via {lid|fractie} → publication → article → instrument.
 *  Backend serves identical shape under
 *    /api/leden/{key}/touched-instruments
 *    /api/fracties/{key}/touched-instruments
 */
export interface TouchedInstrument {
	instrument_id: string;
	instrument_key: string;
	display_name: string | null;
	title: string | null;
	short_title: string | null;
	citation_title: string | null;
	bwb_id: string | null;
	celex: string | null;
	/** Number of (article × publication) hits — how often this actor's
	 *  publications touched any article in this instrument. */
	count: number;
}

export interface LidTouchedInstrumentsResponse {
	lid_id: string;
	items: TouchedInstrument[];
	/** Total number of distinct instruments touched. */
	count: number;
}

export interface FractieTouchedInstrumentsResponse {
	fractie_id: string;
	items: TouchedInstrument[];
	count: number;
}

export interface LidVotesResponse {
	lid_id: string;
	votes: LidStemDTO[];
	total: number;
}

// ── Watch persistence ─────────────────────────────────────────────────────────

/** POST /api/watches request body */
export interface WatchIn {
	node_id: string;
	label?: string | null;
	collection?: string | null;
}

/** GET /api/watches and POST /api/watches response */
export interface WatchOut {
	id: string;
	node_id: string;
	label: string | null;
	collection: string | null;
	created_at: string;
}

// ── Stemmingen ────────────────────────────────────────────────────────────────

export interface StemmingVoter {
	partij: string;
	aantal_zetels: number;
}

/** One item in GET /api/stemmingen list */
/**
 * Eén rij in de /api/stemmingen browserlijst.
 *
 * `voor_fracties` / `tegen_fracties` / `onthouding_fracties` tellen het
 * aantal *fracties* in elk kamp — meestal 10–17 in de Tweede Kamer.
 * `voor_zetels` / `tegen_zetels` / `onthouding_zetels` zijn de
 * gewogen totalen die optellen tot 150 — dat is het juiste cijfer om
 * de uitslag weer te geven.
 *
 * `besluit_id` identificeert uniek de motie binnen het debat; gebruik dat
 * voor links, niet `onderwerp` (debat-niveau, herhaalt zich).
 */
export interface StemmingSummaryDTO {
	id: string;
	key: string;
	datum: string | null;
	onderwerp: string | null;
	besluit_id: string | null;
	dossier_nummers: string[];
	aangenomen: boolean | null;
	voor_fracties: number;
	voor_zetels: number;
	tegen_fracties: number;
	tegen_zetels: number;
	onthouding_fracties: number;
	onthouding_zetels: number;
	chamber: string | null;
}

/** GET /api/stemmingen/{key} detail */
export interface StemmingDetailDTO {
	id: string;
	key: string;
	datum: string | null;
	onderwerp: string | null;
	dossier_nummers: string[];
	aangenomen: boolean;
	besluit_id: string | null;
	voor: StemmingVoter[];
	tegen: StemmingVoter[];
	onthouding: StemmingVoter[];
}

export interface StemmingListResponse {
	total: number;
	items: StemmingSummaryDTO[];
}

// ── Party colors ──────────────────────────────────────────────────────────────

export interface PartyColorsResponse {
	colors: Record<string, string>;
}

// ── Watch subscriptions ───────────────────────────────────────────────────────

export type WatchEntityType = 'instrument' | 'article' | 'dossier';

export interface WatchEntry {
	id: string;
	entityType: WatchEntityType;
	label: string;
	href: string;
	watchedAt: number;
}

// ── Graph overlay primitives ──────────────────────────────────────────────────
// Overlay state itself (heat / open / dossier scope) lives in
// `$lib/stores/overlay` and is encoded in the `?overlay=…` URL param.

export type InFluxMap = Map<string, number>;
export type HeatMap = Map<string, number>;

// ── Instruments (wetten) index ────────────────────────────────────────────────

/**
 * Jurisdictie van een instrument.
 * - `nl`: Nederlands recht.
 * - `eu`: Europese Unie (verordeningen, richtlijnen, kaderbesluiten).
 * - `eu/coe`: Council of Europe en aanverwante internationale verdragen
 *   (bv. EVRM). De OpenAPI-spec documenteert deze waarde nog niet
 *   expliciet; backend levert hem wel.
 */
export type InstrumentJurisdiction = 'nl' | 'eu' | 'eu/coe';

export interface InstrumentSummaryDTO {
	id: string;
	key: string;
	collection: 'instruments';
	bwb_id: string | null;
	celex: string | null;
	title: string | null;
	short_title: string | null;
	citation_title: string | null;
	jurisdiction: InstrumentJurisdiction | null;
	kind: string | null;
	article_count: number;
	judgment_citation_count?: number | null;
	last_article_mutation?: string | null;
}

export interface InstrumentListResponse {
	total: number;
	items: InstrumentSummaryDTO[];
}

// ── Judgments (arresten) index ────────────────────────────────────────────────

export type JudgmentTier = 'hoge_raad' | 'gerechtshof' | 'rechtbank' | 'bijzonder';

export interface JudgmentSummaryDTO {
	id: string;
	key: string;
	collection: 'judgments';
	ecli: string;
	display_name: string | null;
	court: string | null;
	tier: JudgmentTier | null;
	date: string | null;
	summary: string | null;
	inbound_citation_count: number;
	outbound_citation_count: number;
}

export interface JudgmentListResponse {
	total: number;
	items: JudgmentSummaryDTO[];
}
