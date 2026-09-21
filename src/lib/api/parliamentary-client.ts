// Dunne wrappers over de backend-endpoints. Elke functie is zo platgehouden
// dat een lezer aan de signature kan zien welke OpenAPI-parameters er
// daadwerkelijk doorgaan; geen logica of state hier.
//
// Het bestand heet "parliamentary" om historische redenen. Het bevat ook
// wrappers voor de corpus-endpoints (fetchInstruments, fetchJudgments en de
// node/heat/flux-maps). Een opsplitsing in `parliamentary-client.ts` +
// `corpus-client.ts` is een logische volgende stap; voor nu volstaat de
// sectie-indeling hieronder.
import { apiGet, apiPost, apiDelete } from './client';
import type { DossierDocumentsResponse } from './parliamentary';
import type {
	DossierDetailResponse,
	DossierTimelineResponse,
	DossierMutationsResponse,
	DossierSummaryDTO,
	ArticleLegislativeHistoryResponse,
	ArticleInFluxResponse,
	CommissieDTO,
	CommissieDetailDTO,
	LidDTO,
	FractieDTO,
	LidVotesResponse,
	LidTouchedInstrumentsResponse,
	FractieTouchedInstrumentsResponse,
	WatchIn,
	WatchOut,
	PartyColorsResponse,
	ZetelsResponse,
	InFluxMap,
	HeatMap,
	StemmingListResponse,
	StemmingDetailDTO,
	InstrumentListResponse,
	InstrumentJurisdiction,
	JudgmentListResponse,
	JudgmentTier
} from './parliamentary';

export async function fetchDossier(
	kamerstuknummer: string,
	signal?: AbortSignal
): Promise<DossierDetailResponse> {
	return apiGet<DossierDetailResponse>(`/api/dossiers/${kamerstuknummer}`, { signal });
}

export async function fetchDossierDocuments(
	kamerstuknummer: string,
	signal?: AbortSignal
): Promise<DossierDocumentsResponse> {
	return apiGet<DossierDocumentsResponse>(`/api/dossiers/${kamerstuknummer}/documents`, { signal });
}

/** Bulk variant: top-N documents per dossier for a list of kamerstuknummers
 *  in one round-trip. Replaces the N+1 fan-out during the parliamentary
 *  Lagen-load. Server returns ``{items: {kamerstuknummer: [docs]}}``; this
 *  wrapper unwraps to the flat map shape callers expect. */
export async function fetchDossierDocumentsBulk(
	nummers: string[],
	opts?: { perDossierLimit?: number; signal?: AbortSignal }
): Promise<Record<string, import('./parliamentary').DossierDocumentDTO[]>> {
	if (nummers.length === 0) return {};
	const resp = await apiGet<{
		items: Record<string, import('./parliamentary').DossierDocumentDTO[]>;
	}>('/api/dossiers/documents/bulk', {
		params: {
			nummers: nummers.join(','),
			per_dossier_limit: opts?.perDossierLimit ?? 8
		},
		signal: opts?.signal
	});
	return resp.items ?? {};
}

export async function fetchDossierMutations(
	kamerstuknummer: string,
	signal?: AbortSignal
): Promise<DossierMutationsResponse> {
	return apiGet<DossierMutationsResponse>(`/api/dossiers/${kamerstuknummer}/mutations`, { signal });
}

export async function fetchDossierTimeline(
	kamerstuknummer: string,
	opts: { order?: 'asc' | 'desc'; soort?: string | null; limit?: number; signal?: AbortSignal } = {}
): Promise<DossierTimelineResponse> {
	const { order = 'desc', soort, limit = 100, signal } = opts;
	return apiGet<DossierTimelineResponse>(`/api/dossiers/${kamerstuknummer}/timeline`, {
		params: { order, ...(soort ? { soort } : {}), limit },
		signal
	});
}

export async function fetchArticleLegislativeHistory(
	bwbId: string,
	articleNumber: string,
	signal?: AbortSignal
): Promise<ArticleLegislativeHistoryResponse> {
	return apiGet<ArticleLegislativeHistoryResponse>(
		`/api/articles/${encodeURIComponent(bwbId)}/${encodeURIComponent(articleNumber)}/legislative-history`,
		{ signal }
	);
}

export async function fetchArticleInFlux(
	bwbId: string,
	articleNumber: string,
	signal?: AbortSignal
): Promise<ArticleInFluxResponse> {
	return apiGet<ArticleInFluxResponse>(
		`/api/articles/${encodeURIComponent(bwbId)}/${encodeURIComponent(articleNumber)}/in-flux`,
		{ signal }
	);
}

export async function fetchCommissies(signal?: AbortSignal): Promise<CommissieDTO[]> {
	return apiGet<CommissieDTO[]>('/api/commissies', { signal });
}

export async function fetchCommissie(
	slug: string,
	signal?: AbortSignal
): Promise<CommissieDetailDTO> {
	return apiGet<CommissieDetailDTO>(`/api/commissies/${slug}`, { signal });
}

/** Bulk: every commissie + its leden in one call. Backs the parliamentary
 *  Lagen-load — replaces N parallel /api/commissies/{slug} fetches. */
export async function fetchCommissiesWithLeden(
	signal?: AbortSignal
): Promise<import('./parliamentary').CommissieWithLedenDTO[]> {
	return apiGet<import('./parliamentary').CommissieWithLedenDTO[]>('/api/commissies/with-leden', {
		signal
	});
}

export async function fetchPartyColors(signal?: AbortSignal): Promise<PartyColorsResponse> {
	return apiGet<PartyColorsResponse>('/api/partijen/kleuren', { signal });
}

export async function fetchStemmingen(
	opts: {
		limit?: number;
		offset?: number;
		aangenomen?: boolean;
		/** Filter op partij (afkorting of naam). */
		partij?: string;
		/** 'tk' (Tweede Kamer) of 'ek' (Eerste Kamer). */
		chamber?: string;
		signal?: AbortSignal;
	} = {}
): Promise<StemmingListResponse> {
	const { limit = 50, offset = 0, aangenomen, partij, chamber, signal } = opts;
	return apiGet<StemmingListResponse>('/api/stemmingen', {
		params: {
			limit,
			offset,
			...(aangenomen !== undefined ? { aangenomen } : {}),
			...(partij ? { partij } : {}),
			...(chamber ? { chamber } : {})
		},
		signal
	});
}

export async function fetchStemming(key: string, signal?: AbortSignal): Promise<StemmingDetailDTO> {
	return apiGet<StemmingDetailDTO>(`/api/stemmingen/${encodeURIComponent(key)}`, { signal });
}

export async function fetchLid(key: string, signal?: AbortSignal): Promise<LidDTO> {
	return apiGet<LidDTO>(`/api/leden/${encodeURIComponent(key)}`, { signal });
}

export async function fetchLeden(
	opts: {
		limit?: number;
		offset?: number;
		/** Vrije-tekst over naam (case-insensitive). */
		q?: string;
		/** Partij-afkorting of -naam. */
		partij?: string;
		/** Alleen actieve leden (default: server geeft alleen actieve terug). */
		actief?: boolean;
		/** Server-default is alleen leden van het zittende Kamertijdvak;
		 *  `include_all=true` haalt ook historische leden op. */
		include_all?: boolean;
		signal?: AbortSignal;
	} = {}
): Promise<LidDTO[]> {
	const { limit = 200, offset, q, partij, actief, include_all, signal } = opts;
	return apiGet<LidDTO[]>('/api/leden', {
		params: {
			limit,
			...(offset !== undefined ? { offset } : {}),
			...(q ? { q } : {}),
			...(partij ? { partij } : {}),
			...(actief !== undefined ? { actief } : {}),
			...(include_all ? { include_all: true } : {})
		},
		signal
	});
}

export async function fetchZetels(signal?: AbortSignal): Promise<ZetelsResponse> {
	return apiGet<ZetelsResponse>('/api/parlement/zetels', { signal });
}

/** `/api/fracties` retourneert de volledige lijst in één keer; er is geen
 *  paginering server-side. Alleen `q` en `actief` zijn als filter
 *  beschikbaar; alle andere sort-/zoek-bewerkingen draaien client-side. */
export async function fetchFracties(
	opts: {
		/** Vrije-tekst over naam/afkorting (case-insensitive). */
		q?: string;
		/** Alleen (in)actieve fracties. */
		actief?: boolean;
		signal?: AbortSignal;
	} = {}
): Promise<FractieDTO[]> {
	const { q, actief, signal } = opts;
	return apiGet<FractieDTO[]>('/api/fracties', {
		params: {
			...(q ? { q } : {}),
			...(actief !== undefined ? { actief } : {})
		},
		signal
	});
}

export async function fetchLidVotes(
	key: string,
	opts: { limit?: number; signal?: AbortSignal } = {}
): Promise<LidVotesResponse> {
	return apiGet<LidVotesResponse>(`/api/leden/${encodeURIComponent(key)}/votes`, {
		params: { limit: opts.limit ?? 50 },
		signal: opts.signal
	});
}

export async function fetchLidTouchedInstruments(
	key: string,
	opts: { limit?: number; signal?: AbortSignal } = {}
): Promise<LidTouchedInstrumentsResponse> {
	return apiGet<LidTouchedInstrumentsResponse>(
		`/api/leden/${encodeURIComponent(key)}/touched-instruments`,
		{ params: { limit: opts.limit ?? 10 }, signal: opts.signal }
	);
}

export async function fetchFractie(key: string, signal?: AbortSignal): Promise<FractieDTO> {
	// Backend currently returns the raw graph-node shape
	// ({ _id, _key, type, labels, props: { naam, afkorting, ... } }) for this
	// endpoint, while every other /api/{collection}/{key} endpoint returns a
	// flat DTO. Normalize here so callers stay on FractieDTO regardless.
	const raw = await apiGet<Record<string, unknown>>(`/api/fracties/${encodeURIComponent(key)}`, {
		signal
	});

	const props = (raw['props'] as Record<string, unknown> | undefined) ?? raw;
	const id =
		(raw['id'] as string | undefined) ?? (raw['_id'] as string | undefined) ?? `fracties/${key}`;
	const k = (raw['key'] as string | undefined) ?? (raw['_key'] as string | undefined) ?? key;
	const zetels = props['aantal_zetels'];

	return {
		id,
		key: k,
		naam: (props['naam'] as string | null | undefined) ?? null,
		afkorting: (props['afkorting'] as string | null | undefined) ?? null,
		aantal_zetels: typeof zetels === 'number' ? zetels : zetels == null ? null : Number(zetels)
	};
}

export async function fetchFractieTouchedInstruments(
	key: string,
	opts: { limit?: number; signal?: AbortSignal } = {}
): Promise<FractieTouchedInstrumentsResponse> {
	return apiGet<FractieTouchedInstrumentsResponse>(
		`/api/fracties/${encodeURIComponent(key)}/touched-instruments`,
		{ params: { limit: opts.limit ?? 10 }, signal: opts.signal }
	);
}

export async function fetchRecentDossiers(
	opts: { days?: number; limit?: number; signal?: AbortSignal } = {}
): Promise<DossierSummaryDTO[]> {
	return apiGet<DossierSummaryDTO[]>('/api/dossiers/recent', {
		params: { days: opts.days ?? 30, limit: opts.limit ?? 80 },
		signal: opts.signal
	});
}

/** `/api/dossiers/open` retourneert sinds de backend-bugfix een
 *  `{total, items}`-wrapper met echte `offset`-paginering. Filters:
 *  `commissie`, `onderwerp` (vrije tekst over titel), `fase` (één
 *  `huidige_fase`) en `has_stage` (komma-gescheiden, AND-semantiek).
 *  Max-`limit` is 500. */
export async function fetchOpenDossiers(
	opts: {
		/** Vrije-tekst filter over dossier-titel. */
		onderwerp?: string;
		/** Filter op commissie-slug. */
		commissie?: string;
		/** Eén `huidige_fase`-waarde (bv. 'wetsvoorstel'). */
		fase?: string;
		/** Komma-gescheiden lijst van stages; alleen dossiers die ze allemaal bevatten. */
		has_stage?: string;
		/** 1–500 (default 100 server-side). */
		limit?: number;
		/** Overslaan vanaf begin van de gefilterde set. */
		offset?: number;
		signal?: AbortSignal;
	} = {}
): Promise<import('./parliamentary').DossierListResponse> {
	const { onderwerp, commissie, fase, has_stage, limit = 200, offset = 0, signal } = opts;
	return apiGet<import('./parliamentary').DossierListResponse>('/api/dossiers/open', {
		params: {
			limit,
			offset,
			...(onderwerp ? { onderwerp } : {}),
			...(commissie ? { commissie } : {}),
			...(fase ? { fase } : {}),
			...(has_stage ? { has_stage } : {})
		},
		signal
	});
}

export async function fetchInFluxMap(signal?: AbortSignal): Promise<InFluxMap> {
	const raw = await apiGet<Record<string, number>>('/api/nodes/in-flux', { signal });
	return new Map(Object.entries(raw));
}

export async function fetchHeatMap(
	months: number,
	signal?: AbortSignal,
	opts?: { minCount?: number }
): Promise<HeatMap> {
	// min_count=2 halves the response without affecting the visible overlay —
	// count-of-1 halos are barely perceptible against the saturation ceiling.
	const raw = await apiGet<Record<string, number>>('/api/nodes/heat', {
		params: { months, min_count: opts?.minCount ?? 2 },
		signal
	});
	return new Map(Object.entries(raw));
}

// Fetch a dossier's pending-mutation subgraph and reduce its edges into the
// same nodeId→count shape as /api/nodes/in-flux. Each edge's to_id is a node
// the dossier targets; the count reflects how many open proposals touch it
// from this single dossier (usually 1, but a dossier may revisit the same
// article multiple times).
export async function fetchDossierInFluxMap(
	kamerstuknummer: string,
	signal?: AbortSignal
): Promise<InFluxMap> {
	const res = await apiGet<{ edges: { to_id: string | null }[] }>(
		`/api/dossiers/${encodeURIComponent(kamerstuknummer)}/mutations`,
		{ signal }
	);
	const map: InFluxMap = new Map();
	for (const e of res.edges) {
		if (!e.to_id) continue;
		map.set(e.to_id, (map.get(e.to_id) ?? 0) + 1);
	}
	return map;
}

// ── Instruments (wetten) index ────────────────────────────────────────────────

export async function fetchInstruments(
	opts: {
		limit?: number;
		offset?: number;
		q?: string;
		jurisdiction?: InstrumentJurisdiction;
		kind?: string;
		article_count_min?: number;
		sort?: 'title' | 'article_count' | 'recent_mutation';
		signal?: AbortSignal;
	} = {}
): Promise<InstrumentListResponse> {
	const { limit = 50, offset = 0, q, jurisdiction, kind, article_count_min, sort, signal } = opts;
	return apiGet<InstrumentListResponse>('/api/instruments', {
		params: {
			limit,
			offset,
			...(q ? { q } : {}),
			...(jurisdiction ? { jurisdiction } : {}),
			...(kind ? { kind } : {}),
			...(article_count_min != null ? { article_count_min } : {}),
			...(sort ? { sort } : {})
		},
		signal
	});
}

// ── Judgments (arresten) index ────────────────────────────────────────────────

export async function fetchJudgments(
	opts: {
		limit?: number;
		offset?: number;
		q?: string;
		court?: string;
		tier?: JudgmentTier;
		from?: string;
		to?: string;
		cited_by_min?: number;
		sort?: 'date_desc' | 'date_asc' | 'citation_count';
		signal?: AbortSignal;
	} = {}
): Promise<JudgmentListResponse> {
	const { limit = 50, offset = 0, q, court, tier, from, to, cited_by_min, sort, signal } = opts;
	return apiGet<JudgmentListResponse>('/api/judgments', {
		params: {
			limit,
			offset,
			...(q ? { q } : {}),
			...(court ? { court } : {}),
			...(tier ? { tier } : {}),
			...(from ? { from } : {}),
			...(to ? { to } : {}),
			...(cited_by_min != null ? { cited_by_min } : {}),
			...(sort ? { sort } : {})
		},
		signal
	});
}

// ── Watch persistence API ─────────────────────────────────────────────────────

export async function getWatches(signal?: AbortSignal): Promise<WatchOut[]> {
	return apiGet<WatchOut[]>('/api/watches', { signal });
}

export async function createWatch(body: WatchIn, signal?: AbortSignal): Promise<WatchOut> {
	return apiPost<WatchOut>('/api/watches', body, { signal });
}

export async function deleteWatch(id: string, signal?: AbortSignal): Promise<void> {
	return apiDelete(`/api/watches/${encodeURIComponent(id)}`, { signal });
}
