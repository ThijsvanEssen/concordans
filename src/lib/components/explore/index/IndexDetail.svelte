<script lang="ts">
	import NameLink from '$lib/bron/NameLink.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	// Inline detail of an opened row: header, stat tiles, a phase path for
	// dossiers and the links that open the source. Shows only what the list
	// item carries.
	import type { Schema } from '$lib/api/types';
	import { bronHref, isReadable } from '$lib/bron/href';
	import { OUTCOME_LABEL, openedOnBasis } from '$lib/components/parliamentary/stages';
	import LegislativeStepper from '$lib/components/parliamentary/LegislativeStepper.svelte';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import { collectionOf, type IndexCategory } from './categories';
	import { judgmentKind } from './judgment-kind';
	import { decisionMethod, decisionOutcome, isHammer } from './decision-kind';
	import { chamberName } from '$lib/components/parliamentary/chamber';
	import { kamerstukCitation, kamerstukLabel } from '$lib/components/parliamentary/kamerstuk';

	let {
		category,
		record,
		bron,
		chamber = 'TK'
	}: {
		category: IndexCategory;
		record:
			| Schema<'InstrumentListItemDTO'>
			| Schema<'JudgmentListItemDTO'>
			| Schema<'DossierSummaryDTO'>
			| Schema<'CommitteeDTO'>
			| Schema<'MemberDTO'>
			| Schema<'FactionDTO'>
			| Schema<'DecisionSummaryDTO'>
			| Schema<'DocumentListItemDTO'>;
		/** What a link names: `judgments/<key>`, `dossiers/<number>`. */
		bron: string;
		/** The Kamer the list shows: a member may sit in both, the list says which. */
		chamber?: string;
	} = $props();

	function fmtDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		return new Intl.DateTimeFormat('nl-NL', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(new Date(iso));
	}

	const KIND_LABEL: Record<IndexCategory, string> = {
		instruments: 'Wet · regelgeving',
		judgments: 'Uitspraak · jurisprudentie',
		dossiers: 'Dossier · kamerstukken',
		committees: 'Commissie',
		members: 'Kamerlid',
		factions: 'Fractie',
		decisions: 'Stemming · Tweede Kamer',
		cabinets: 'Kabinet · regering',
		ministers: 'Bewindspersoon · regering',
		commitments: 'Toezegging · regering',
		documents: 'Stuk'
	};

	// Only a bron with a text of its own is read at full width; the rest reads beside the network.
	const readHref = $derived(
		isReadable(collectionOf(category)) ? bronHref(bron, { keepMode: false, mode: 'read' }) : null
	);
	const networkHref = $derived(bronHref(bron, { keepMode: false, mode: 'graph' }));

	// The category says which record it is; the parent passes matching pairs.
	const w = $derived(
		category === 'instruments' ? (record as Schema<'InstrumentListItemDTO'>) : null
	);
	const j = $derived(category === 'judgments' ? (record as Schema<'JudgmentListItemDTO'>) : null);
	const d = $derived(category === 'dossiers' ? (record as Schema<'DossierSummaryDTO'>) : null);
	const c = $derived(category === 'committees' ? (record as Schema<'CommitteeDTO'>) : null);
	const m = $derived(category === 'members' ? (record as Schema<'MemberDTO'>) : null);
	const f = $derived(category === 'factions' ? (record as Schema<'FactionDTO'>) : null);
	const s = $derived(category === 'decisions' ? (record as Schema<'DecisionSummaryDTO'>) : null);
	const doc = $derived(category === 'documents' ? (record as Schema<'DocumentListItemDTO'>) : null);

	// Seats for and against; abstentions take no side. Any other choice gets its own tile.
	const inFavour = $derived(s?.tally?.['Voor'] ?? 0);
	const against = $derived(s?.tally?.['Tegen'] ?? 0);
	const inFavourPct = $derived(
		inFavour + against > 0 ? (inFavour / (inFavour + against)) * 100 : 0
	);
	const otherChoices = $derived(
		Object.entries(s?.tally ?? {}).filter(([choice]) => choice !== 'Voor' && choice !== 'Tegen')
	);
	const voterUnit = $derived(s?.vote_kind === 'member' ? 'leden' : 'fracties');

	const kindLabel = $derived(
		j
			? `${judgmentKind(j.decision_kind, j.tier)} · jurisprudentie`
			: s
				? `Stemming · ${chamberName(s.chamber)}`
				: c || f || doc
					? `${KIND_LABEL[category]} · ${chamberName((c ?? f ?? doc)?.chamber)}`
					: m
						? `${KIND_LABEL[category]} · ${chamberName(chamber)}`
						: KIND_LABEL[category]
	);
	/** An Eerste Kamer member as its site describes it, when the list is the Eerste Kamer's. */
	const ek = $derived(chamber === 'EK' ? (m?.ek ?? null) : null);
	const citedBy = $derived(j?.inbound_citation_count ?? 0);
	const cites = $derived(j?.outbound_citation_count ?? 0);
</script>

<div class="detail-inner">
	<div class="detail-head">
		<div class="detail-head-left">
			<div class="detail-kind">
				<span>{kindLabel}</span>
				{#if w}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-id">{(w.bwb_id ?? w.celex ?? '').toUpperCase()}</span>
				{:else if j && j.display_name && j.ecli}
					<!-- The ECLI once, here; without a name it is the title. -->
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-id detail-ecli">{j.ecli}</span>
				{:else if d}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-id">Kamerstuk {d.number}</span>
				{:else if c}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-id">{c.abbreviation ?? c.slug}</span>
				{:else if f}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-id">{f.abbreviation}</span>
				{:else if doc && kamerstukLabel(doc)}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-id">{kamerstukLabel(doc)}</span>
				{:else if s}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-id"
						>{fmtDate(s.date)}{s.dossier_numbers?.[0] ? ` · ${s.dossier_numbers[0]}` : ''}</span
					>
				{/if}
			</div>

			<h3 class="detail-title">
				{#if w}
					{w.citation_title ?? w.short_title ?? w.title ?? w.key}
				{:else if j}
					{j.display_name ?? j.ecli ?? j.key}
				{:else if d}
					{d.title ?? d.number}
				{:else if c}
					{c.name ?? c.key}
				{:else if m}
					{m.name ?? m.key}
				{:else if f}
					{f.name ?? f.abbreviation}
				{:else if s}
					{s.subject ?? '—'}
				{:else if doc}
					{doc.title ?? doc.kind ?? doc.key}
				{/if}
			</h3>

			<!-- Chips: per-categorie eigen status-indicatoren -->
			<div class="detail-chips">
				{#if w}
					<span class="tag tag--outline" class:tag--eu={w.jurisdiction === 'eu'}>
						{w.jurisdiction === 'eu' ? 'Europese Unie' : 'Nederlands recht'}
					</span>
				{:else if j}
					<span class="tag tag--outline">{j.court ?? 'Onbekende instantie'}</span>
					{#if citedBy > 0}
						<span class="tag"
							>Aangehaald door {citedBy.toLocaleString('nl-NL')}
							{citedBy === 1 ? 'uitspraak' : 'uitspraken'}</span
						>
					{/if}
					{#if cites > 0}
						<span class="tag"
							>Haalt {cites.toLocaleString('nl-NL')}
							{cites === 1 ? 'uitspraak' : 'uitspraken'} aan</span
						>
					{/if}
				{:else if d}
					{#if d.kind}
						<span class="tag tag--outline">{d.kind}</span>
					{/if}
					{#if d.outcome}
						<span
							class="tag"
							class:tag--passed={d.outcome === 'aangenomen'}
							class:tag--rejected={d.outcome === 'verworpen'}
							><span class="tag-dot"></span>{OUTCOME_LABEL[d.outcome]}</span
						>
					{:else if d.current_phase}
						<span class="tag tag--pending"><span class="tag-dot"></span>nu: {d.current_phase}</span>
					{/if}
				{:else if c}
					{#if (c.active_dossier_count ?? 0) > 0}
						<span class="tag tag--active"><span class="tag-dot"></span>Actief</span>
					{:else}
						<span class="tag tag--outline">Geen lopende dossiers</span>
					{/if}
				{:else if m && m.party}
					<span class="tag tag--outline">
						<span class="party-dot" style:background={partyColor(m.party)}></span><NameLink
							collection="factions"
							name={m.party}
						/>
					</span>
				{:else if f}
					<span class="tag tag--outline">
						<span class="party-dot" style:background={partyColor(f.abbreviation ?? '')}></span>
						{f.abbreviation}{f.seats != null ? ` · ${f.seats} zetels` : ''}
					</span>
				{:else if s && decisionOutcome(s)}
					<span
						class="tag"
						class:tag--passed={s.passed === true}
						class:tag--rejected={s.passed === false}
					>
						<span class="tag-dot"></span>{decisionOutcome(s)}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Dossier: the phases of a bill -->
	{#if d?.phases?.length}
		<LegislativeStepper phases={d.phases} current={d.current_phase ?? null} ek={d.ek_outcome} />
	{/if}

	<!-- Stat tiles: only what the item carries; an empty field shows '—' -->
	<div class="tiles">
		{#if w}
			<div class="tile">
				<div class="tile-num">
					{w.article_count > 0 ? w.article_count.toLocaleString('nl-NL') : '—'}
				</div>
				<div class="tile-lbl">Artikelen</div>
			</div>
			<div class="tile">
				<div class="tile-num">{w.jurisdiction === 'eu' ? 'EU' : 'NL'}</div>
				<div class="tile-lbl">Jurisdictie</div>
			</div>
			{#if w.celex}
				<div class="tile">
					<div class="tile-id">{w.celex}</div>
					<div class="tile-lbl">CELEX</div>
				</div>
			{/if}
			{#if w.bwb_id}
				<div class="tile">
					<div class="tile-id">{w.bwb_id.toUpperCase()}</div>
					<div class="tile-lbl">BWB-id</div>
				</div>
			{/if}
		{:else if j}
			<div class="tile">
				<div class="tile-num">{fmtDate(j.date)}</div>
				<div class="tile-lbl">Datum</div>
			</div>
			<div class="tile">
				<div class="tile-num">{j.court ?? '—'}</div>
				<div class="tile-lbl">Instantie</div>
			</div>
		{:else if d}
			<div class="tile">
				<div class="tile-id">{d.number}</div>
				<div class="tile-lbl">Kamerstuk</div>
			</div>
			{#if d.opened_on}
				<div class="tile" title={openedOnBasis(d.opened_on_basis)}>
					<div class="tile-num">{fmtDate(d.opened_on)}</div>
					<div class="tile-lbl">Geopend</div>
				</div>
			{/if}
			{#if d.outcome}
				<div class="tile">
					<div class="tile-num">{OUTCOME_LABEL[d.outcome]}</div>
					<div class="tile-lbl">{fmtDate(d.closed_on)}</div>
				</div>
			{:else}
				<div class="tile">
					<div class="tile-num">{d.current_phase ?? '—'}</div>
					<div class="tile-lbl">Huidige fase</div>
				</div>
			{/if}
			<div class="tile">
				<div class="tile-num">{d.kind ?? '—'}</div>
				<div class="tile-lbl">Soort</div>
			</div>
		{:else if c}
			<div class="tile">
				<div class="tile-num">{c.active_dossier_count ?? 0}</div>
				<div class="tile-lbl">Actieve dossiers</div>
			</div>
			<div class="tile">
				<div class="tile-id">{c.abbreviation ?? ''}</div>
				<div class="tile-lbl">Afkorting</div>
			</div>
		{:else if doc}
			{@const citation = kamerstukCitation(doc)}
			{#if citation}
				<div class="tile">
					<div class="tile-id">{citation}</div>
					<div class="tile-lbl">Citeervorm</div>
				</div>
			{/if}
			<div class="tile">
				<div class="tile-num">{fmtDate(doc.date)}</div>
				<div class="tile-lbl">Datum</div>
			</div>
			{#if doc.kind}
				<div class="tile">
					<div class="tile-id">{doc.kind}</div>
					<div class="tile-lbl">Soort</div>
				</div>
			{/if}
		{:else if m && ek}
			<div class="tile">
				<div class="tile-num">
					{#if ek.faction}<BronLink ref={{ collection: 'factions', key: ek.faction }}
							>{ek.abbreviation ?? ek.faction}</BronLink
						>{/if}
				</div>
				<div class="tile-lbl">Fractie</div>
			</div>
			{#if ek.seniority_days != null}
				<div class="tile">
					<div class="tile-num">{ek.seniority_days.toLocaleString('nl-NL')}</div>
					<div class="tile-lbl">Anciënniteit</div>
					<div class="tile-sub">dagen</div>
				</div>
			{/if}
			{#if ek.residence}
				<div class="tile">
					<div class="tile-id">{ek.residence}</div>
					<div class="tile-lbl">Woonplaats</div>
				</div>
			{/if}
		{:else if m}
			<div class="tile">
				<div class="tile-num">
					{#if m.party}<NameLink collection="factions" name={m.party} />{/if}
				</div>
				<div class="tile-lbl">Fractie</div>
			</div>
		{:else if f}
			<div class="tile">
				<div class="tile-num">{f.seats ?? '—'}</div>
				<div class="tile-lbl">Zetels</div>
			</div>
			<div class="tile">
				<div class="tile-id">{f.abbreviation ?? ''}</div>
				<div class="tile-lbl">Afkorting</div>
			</div>
			<div class="tile">
				<div class="tile-num">{f.member_count ?? '—'}</div>
				<div class="tile-lbl">Leden</div>
			</div>
		{:else if s && s.chamber === 'EK'}
			<!-- The Eerste Kamer gives no seats: how it decided, and the outcome. -->
			{#if decisionMethod(s)}
				<div class="tile">
					<div class="tile-id">{decisionMethod(s)}</div>
					<div class="tile-lbl">Wijze van stemmen</div>
				</div>
			{/if}
			{#if s.passed != null}
				<div class="tile">
					<div class="tile-num">{s.passed ? '✓' : '✗'}</div>
					<div class="tile-lbl">Uitslag</div>
					<div class="tile-sub">{s.passed ? 'aangenomen' : 'verworpen'}</div>
				</div>
			{/if}
		{:else if s}
			<div class="tile">
				<div class="tile-num">{inFavour.toLocaleString('nl-NL')}</div>
				<div class="tile-lbl">Voor</div>
				<div class="tile-sub">zetels · {s.voters?.['Voor'] ?? 0} {voterUnit}</div>
			</div>
			<div class="tile">
				<div class="tile-num">{against.toLocaleString('nl-NL')}</div>
				<div class="tile-lbl">Tegen</div>
				<div class="tile-sub">zetels · {s.voters?.['Tegen'] ?? 0} {voterUnit}</div>
			</div>
			{#each otherChoices as [choice, seats] (choice)}
				<div class="tile">
					<div class="tile-num">{seats.toLocaleString('nl-NL')}</div>
					<div class="tile-lbl">{choice}</div>
					<div class="tile-sub">zetels · {s.voters?.[choice] ?? 0} {voterUnit}</div>
				</div>
			{/each}
			{#if s.passed != null}
				<div class="tile">
					<div class="tile-num">{s.passed ? '✓' : '✗'}</div>
					<div class="tile-lbl">Uitslag</div>
					<div class="tile-sub">
						{isHammer(s) ? 'zonder stemming' : s.passed ? 'meerderheid' : 'geen meerderheid'}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Decisions: bar of seats for and against over the full width -->
	{#if s && inFavour + against > 0}
		<div class="vote-bar-wrap">
			<span class="vote-side vote-side--v">{inFavour}</span>
			<span class="vote-bar">
				<span class="vote-bar-v" style:width="{inFavourPct}%"></span>
				<span class="vote-bar-t" style:width="{100 - inFavourPct}%"></span>
			</span>
			<span class="vote-side vote-side--t">{against}</span>
		</div>
	{/if}

	<!-- The ways of opening the source: its text, and the source in the network -->
	<div class="detail-acts">
		{#if readHref}
			<a class="detail-act detail-act--primary" href={readHref} data-sveltekit-noscroll>
				Lezen <span class="arrow" aria-hidden="true">→</span>
			</a>
		{/if}
		<a
			class="detail-act"
			class:detail-act--primary={!readHref}
			href={networkHref}
			data-sveltekit-noscroll
		>
			Toon in netwerk <span class="arrow" aria-hidden="true">→</span>
		</a>
	</div>
</div>

<style>
	.detail-inner {
		padding: 22px 28px 26px;
		border-left: 2px solid var(--ink-2);
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.detail-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 18px;
	}
	.detail-head-left {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		min-width: 0;
	}
	.detail-kind {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		flex-wrap: wrap;
	}
	.detail-sep {
		color: var(--ink-3);
	}
	.detail-id {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	/* An ECLI is not broken inside: it goes to the next line whole. */
	.detail-ecli {
		white-space: nowrap;
	}
	.detail-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: var(--t-h3);
		line-height: var(--lh-snug);
		color: var(--ink);
		margin: 0;
		text-wrap: pretty;
	}
	.detail-chips {
		display: inline-flex;
		gap: var(--s-3);
		margin-top: 6px;
		flex-wrap: wrap;
	}

	/* Qualities are words: the outcome of a vote in ink-2, the rest in ink-3. */
	.tag {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
		line-height: 22px;
	}
	.tag-dot {
		display: none;
	}
	.tag--passed,
	.tag--rejected {
		color: var(--ink-2);
		font-weight: 500;
	}

	.party-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		vertical-align: middle;
	}

	/* Tiles */
	.tiles {
		display: grid;
		gap: var(--s-3);
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	}
	.tile {
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 14px var(--s-4) var(--s-3);
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.tile-num {
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 500;
		color: var(--ink);
		line-height: 1;
		font-feature-settings: 'lnum';
	}
	.tile-id {
		font-family: var(--font-sans);
		font-size: var(--t-body-2);
		color: var(--ink-2);
		line-height: 1.2;
		/* An identifier is not broken: what does not fit is cut off. */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tile-lbl {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.tile-sub {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-meta);
		color: var(--ink-3);
		margin-top: 2px;
	}

	/* Vote bar: seats for in ink-2, seats against in rule-strong; the numbers say which is which. */
	.vote-bar-wrap {
		display: grid;
		grid-template-columns: 60px 1fr 60px;
		gap: var(--s-3);
		align-items: center;
	}
	.vote-side {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
	}
	.vote-side--v {
		text-align: right;
	}
	.vote-side--t {
		text-align: left;
	}
	.vote-bar {
		height: 10px;
		background: var(--paper-2);
		border-radius: var(--r-1);
		overflow: hidden;
		display: flex;
	}
	.vote-bar-v {
		background: var(--ink-2);
	}
	.vote-bar-t {
		background: var(--rule-strong);
	}

	/* The three ways of opening the source. */
	.detail-acts {
		display: flex;
		gap: var(--s-2);
		flex-wrap: wrap;
		align-items: center;
		padding-top: 14px;
		border-top: 1px solid var(--rule);
	}
	.detail-act {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 30px;
		padding: 0 var(--s-3);
		background: transparent;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
		white-space: nowrap;
		text-decoration: none;
	}
	.detail-act:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
	.detail-act .arrow {
		font-family: var(--font-serif);
		opacity: 0.7;
	}
	.detail-act--primary {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	.detail-act--primary:hover {
		background: var(--ink-2);
		border-color: var(--ink-2);
		color: var(--paper);
	}
</style>
