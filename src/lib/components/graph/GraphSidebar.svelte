<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphFilters } from '$lib/graph/graph-store';
	import {
		kindsForLayer,
		LAYER_SUB_KINDS,
		type EdgeCategory,
		type GraphNode,
		type GraphNodeKind
	} from '$lib/graph/types';
	import type { Overlay } from '$lib/stores/overlay';
	import { HEAT_PERIODS } from '$lib/stores/overlay';
	import { nodeId } from '$lib/vocabulary';
	import { EDGE_COLOR, shapeFor, strokeFor, type NodeShape } from './nodeSprites';
	import Hemicycle from '$lib/components/explore/Hemicycle.svelte';

	type KindCounts = Partial<Record<GraphNodeKind, number>>;

	// Mini-Hemicycle at the bottom of the sidebar. The section stays empty
	// when the request fails.
	let seats = $state<Schema<'ParliamentSeatsResponse'> | null>(null);
	onMount(() => {
		const controller = new AbortController();
		unwrap(api.GET('/api/parliament/seats', { signal: controller.signal }))
			.then((response) => (seats = response))
			.catch(() => {});
		return () => controller.abort();
	});
	function openFaction(key: string) {
		goto(`/explore?mode=split&focus=${encodeURIComponent(nodeId('factions', key))}`);
	}

	// Legend glyph outline for the non-circular shapes, in a 12x12 box. `r` is
	// the inscribed radius, so a parent (r=5) and a sub kind (r=3.5) keep their
	// size relation across shapes.
	function legendPoints(shape: NodeShape, r: number): string {
		if (shape === 'diamond') return `6,${6 - r} ${6 + r},6 6,${6 + r} ${6 - r},6`;
		if (shape === 'hexagon') {
			const dy = r * 0.866;
			const hx = r * 0.5;
			return `${6 + r},6 ${6 + hx},${6 - dy} ${6 - hx},${6 - dy} ${6 - r},6 ${6 - hx},${6 + dy} ${6 + hx},${6 + dy}`;
		}
		return `${6 - r},${6 - r} ${6 + r},${6 - r} ${6 + r},${6 + r} ${6 - r},${6 + r}`;
	}

	// Name of every kind in the toggles.
	const KIND_LABEL: Record<GraphNodeKind, string> = {
		instrument: 'Wetgeving',
		article: 'Artikel',
		judgment: 'Rechterlijk',
		dossier: 'Dossier',
		document: 'Publicatie',
		activity: 'Activiteit',
		committee: 'Commissie',
		member: 'Kamerlid',
		faction: 'Fractie',
		other: 'Overig'
	};
	// Toggle rows: a layer kind next to its sub kind ([instrument, article], ...).
	const TOGGLE_ROWS = (Object.keys(LAYER_SUB_KINDS) as GraphNodeKind[]).map(kindsForLayer);

	const EDGE_LEGEND: Record<EdgeCategory, { label: string; title: string }> = {
		structural: {
			label: 'Vaste verwijzing',
			title: 'Structurele verwijzingen: artikelen die formeel worden aangehaald in de wettekst.'
		},
		mutation: {
			label: 'Wijziging via Kamer',
			title: 'Wijzigingen via parlementaire behandeling: de wetsgeschiedenis van dit artikel.'
		},
		semantic: {
			label: 'Inhoudelijk verband',
			title: 'Semantische verbanden: thematische of inhoudelijke overlap, niet formeel geciteerd.'
		}
	};
	const EDGE_CATEGORIES = Object.keys(EDGE_LEGEND) as EdgeCategory[];

	let {
		filters,
		instruments = [] as { bwbId: string; label: string; count: number }[],
		collapseToLaws,
		overlay = { kind: 'none' } as Overlay,
		inFluxCount = 0,
		pinnedNodes = [] as GraphNode[],
		onFilterChange,
		onInstrumentToggle,
		onCollapseToLawsChange,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		onUnpin,
		onClearPins,
		onLoadGlobal,
		onLoadJudgments,
		onLoadDossiers,
		onLoadCommittees,
		onLoadFactions,
		onLoadMembers,
		onDeloadLayer,
		onResetGraph,
		kindCounts = {} as KindCounts,
		potentialCounts = {} as KindCounts,
		hasSelection = false,
		hiddenCount = 0,
		onRevealHidden,
		loadingGlobal = false,
		loadingJudgments = false,
		loadingDossiers = false,
		loadingCommittees = false,
		loadingFactions = false,
		loadingMembers = false,
		activatedLayers
	}: {
		filters: GraphFilters;
		instruments?: { bwbId: string; label: string; count: number }[];
		collapseToLaws: boolean;
		overlay?: Overlay;
		/** Number of in-flux nodes, shown in the Mutatie block while that overlay is active. */
		inFluxCount?: number;
		pinnedNodes?: GraphNode[];
		onFilterChange: (patch: Partial<GraphFilters>) => void;
		onInstrumentToggle?: (bwbId: string) => void;
		onCollapseToLawsChange: (v: boolean) => void;
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		onUnpin?: (nodeId: string) => void;
		onClearPins?: () => void;
		onLoadGlobal?: () => void;
		onLoadJudgments?: () => void;
		onLoadDossiers?: () => void;
		onLoadCommittees?: () => void;
		onLoadFactions?: () => void;
		onLoadMembers?: () => void;
		/** Remove every node of the given kind from the canvas. */
		onDeloadLayer?: (kind: GraphNodeKind) => void;
		/** Remove all nodes and edges. */
		onResetGraph?: () => void;
		/** Nodes per kind on the canvas. Drives the active state of the layer buttons. */
		kindCounts?: KindCounts;
		/** Known neighbours per kind that are not on the canvas yet. Shown on an
		 *  inactive layer button as "+N", what a click would add. */
		potentialCounts?: KindCounts;
		hasSelection?: boolean;
		/** Nodes the neighbourhood fetch returned that the convergence prune removed. */
		hiddenCount?: number;
		/** Fetch the focal node's neighbourhood again without the convergence prune. */
		onRevealHidden?: () => void;
		loadingGlobal?: boolean;
		loadingJudgments?: boolean;
		loadingDossiers?: boolean;
		loadingCommittees?: boolean;
		loadingFactions?: boolean;
		loadingMembers?: boolean;
		/** Layers the user activated. A layer button reads as active when its kind
		 *  is in here, even when the layer added no nodes. */
		activatedLayers?: ReadonlySet<GraphNodeKind>;
	} = $props();

	const layers: {
		kind: GraphNodeKind;
		label: string;
		glyph: string;
		load?: () => void;
		loading: boolean;
	}[] = $derived([
		{ kind: 'instrument', label: 'Wetten', glyph: '§', load: onLoadGlobal, loading: loadingGlobal },
		{
			kind: 'judgment',
			label: 'Arresten',
			glyph: '¶',
			load: onLoadJudgments,
			loading: loadingJudgments
		},
		{
			kind: 'dossier',
			label: 'Dossiers',
			glyph: '∮',
			load: onLoadDossiers,
			loading: loadingDossiers
		},
		{
			kind: 'committee',
			label: 'Commissies',
			glyph: '‡',
			load: onLoadCommittees,
			loading: loadingCommittees
		},
		{
			kind: 'faction',
			label: 'Fracties',
			glyph: '※',
			load: onLoadFactions,
			loading: loadingFactions
		},
		{ kind: 'member', label: 'Leden', glyph: '◉', load: onLoadMembers, loading: loadingMembers }
	]);

	// Open by default: the toggles are the legend of the node shapes and colours.
	let advancedOpen = $state(true);
	let confirmClear = $state(false);
	let clearTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingDeload = $state<GraphNodeKind | null>(null);

	function requestClear() {
		confirmClear = true;
		clearTimer = setTimeout(() => {
			confirmClear = false;
		}, 4000);
	}
	function cancelClear() {
		confirmClear = false;
		if (clearTimer) {
			clearTimeout(clearTimer);
			clearTimer = null;
		}
	}
	function executeClear() {
		cancelClear();
		onResetGraph?.();
	}
	function cancelDeload() {
		pendingDeload = null;
	}

	function toggleNode(kind: GraphNodeKind) {
		onFilterChange({
			nodeTypeToggles: { ...filters.nodeTypeToggles, [kind]: !filters.nodeTypeToggles[kind] }
		});
	}
	function toggleEdge(category: EdgeCategory) {
		const key = `${category}Enabled` as const;
		onFilterChange({ [key]: !filters[key] });
	}

	// {@const} can't be a direct child of <section>, so derive these here.
	const mutOn = $derived(overlay.kind === 'open' || overlay.kind === 'dossier');
	const heatOn = $derived(overlay.kind === 'heat');
</script>

<!-- One toggle: legend glyph (shape and colour as on the canvas) and name. -->
{#snippet kindToggle(kind: GraphNodeKind, r: number, cls: string)}
	{@const on = filters.nodeTypeToggles[kind]}
	{@const shape = shapeFor(kind)}
	{@const fill = on ? strokeFor(kind) : '#FFFDF4'}
	{@const stroke = on ? strokeFor(kind) : '#C8C0B4'}
	<button
		type="button"
		class="sb-tog {cls}"
		class:sb-tog--off={!on}
		aria-pressed={on}
		onclick={() => toggleNode(kind)}
		title={KIND_LABEL[kind]}
	>
		<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="sb-node-icon">
			{#if shape === 'circle'}
				<circle cx="6" cy="6" {r} {fill} {stroke} stroke-width="1.5" />
			{:else}
				<polygon points={legendPoints(shape, r)} {fill} {stroke} stroke-width="1.5" />
			{/if}
		</svg>
		<span class="sb-tog-label">{KIND_LABEL[kind]}</span>
	</button>
{/snippet}

<aside class="graph-sidebar">
	<!-- Layers: bulk overviews, reachable at any time, not only on an empty canvas. -->
	{#if layers.some((l) => l.load)}
		{@const anyLoaded = layers.some((l) => (kindCounts[l.kind] ?? 0) > 0)}
		<section class="sb-section sb-section--lagen">
			<div class="sb-head sb-head--with-action">
				<span>Inhoud laden</span>
				{#if onResetGraph && anyLoaded}
					{#if confirmClear}
						<span class="sb-clear-confirm">
							<button
								type="button"
								class="sb-head-action sb-head-action--danger"
								onclick={executeClear}>Ja, wis</button
							>
							<button type="button" class="sb-head-action" onclick={cancelClear}>Nee</button>
						</span>
					{:else}
						<button
							type="button"
							class="sb-head-action"
							onclick={requestClear}
							title="Verwijder alles van het netwerk"
						>
							Wis netwerk
						</button>
					{/if}
				{/if}
			</div>
			<div class="sb-lagen-grid">
				{#each layers as l (l.kind)}
					{#if l.load}
						<!-- Count = nodes of this layer on the canvas, sub kinds included
                 (LAYER_SUB_KINDS in $lib/graph/types). -->
						{@const directCount = kindCounts[l.kind] ?? 0}
						{@const subKinds = LAYER_SUB_KINDS[l.kind] ?? []}
						{@const implicitCount = subKinds.reduce((s, k) => s + (kindCounts[k] ?? 0), 0)}
						{@const totalCount = directCount + implicitCount}
						<!-- Wetten keeps its special "articles imply wets" semantics
                 (clicking when only articles are loaded promotes them by
                 fetching the instrument hubs, not deloading). Other layers
                 treat the union as a single set: any member present ⇒ active
                 and clickable to deload the whole layer. -->
						{@const isInstrumentLayer = l.kind === 'instrument'}
						{@const active = totalCount > 0 || (activatedLayers?.has(l.kind) ?? false)}
						<!-- Potential = cached neighbours that would arrive on a click.
                 Shown on inactive buttons as "+N" so the user knows how
                 much (if anything) clicking will pull in. Includes sub-kinds
                 too so the preview matches the load behaviour. -->
						{@const potential =
							(potentialCounts[l.kind] ?? 0) +
							subKinds.reduce((s, k) => s + (potentialCounts[k] ?? 0), 0)}
						{#if pendingDeload === l.kind}
							<div class="sb-deload-confirm">
								<span class="sb-deload-confirm__text">Verwijder {l.label}?</span>
								<button
									type="button"
									class="sb-deload-confirm__btn sb-deload-confirm__btn--yes"
									onclick={() => {
										pendingDeload = null;
										onDeloadLayer?.(l.kind);
									}}>Ja</button
								>
								<button type="button" class="sb-deload-confirm__btn" onclick={cancelDeload}
									>Nee</button
								>
							</div>
						{:else}
							<button
								type="button"
								class="sb-lagen-btn"
								class:sb-lagen-btn--active={active}
								onclick={() => {
									if (l.loading) return;
									const shouldDeload = isInstrumentLayer ? directCount > 0 : totalCount > 0;
									if (shouldDeload && onDeloadLayer) {
										pendingDeload = l.kind;
									} else l.load?.();
								}}
								disabled={l.loading}
								aria-pressed={active}
								title={active
									? `${l.label} verwijderen uit het netwerk`
									: potential > 0
										? `Voeg ${potential} ${l.label.toLowerCase()} toe`
										: `Laad ${l.label.toLowerCase()}`}
							>
								<span class="sb-lagen-glyph" aria-hidden="true">{l.glyph}</span>
								<span>{l.loading ? 'Laden…' : active ? l.label : `+ Laad ${l.label}`}</span>
								{#if isInstrumentLayer && directCount === 0 && implicitCount > 0}
									<span class="sb-lagen-count" aria-label="{implicitCount} impliciet via artikelen">
										≈{implicitCount}
									</span>
								{:else if totalCount > 0}
									<span class="sb-lagen-count" aria-label="{totalCount} op het netwerk">
										{totalCount}
									</span>
								{:else if potential > 0}
									<span
										class="sb-lagen-count sb-lagen-count--potential"
										aria-label="{potential} beschikbaar om toe te voegen">+{potential}</span
									>
								{/if}
							</button>
						{/if}
						<!-- Wetten-only: detail-niveau sub-toggle. Only relevant when the
                 Wetten layer is loaded, so we tuck it inside that row instead
                 of having a separate "Detail-niveau" section. -->
						{#if l.kind === 'instrument' && active}
							{@const articlesAvailable = (kindCounts['article'] ?? 0) > 0}
							<div class="sb-lagen-sub" role="tablist" aria-label="Detail-niveau">
								<button
									type="button"
									class="sb-lagen-sub-btn"
									class:sb-lagen-sub-btn--active={!collapseToLaws && articlesAvailable}
									class:sb-lagen-sub-btn--disabled={!articlesAvailable}
									role="tab"
									aria-selected={!collapseToLaws && articlesAvailable}
									aria-disabled={!articlesAvailable}
									disabled={!articlesAvailable}
									onclick={() => articlesAvailable && onCollapseToLawsChange(false)}
									title={articlesAvailable
										? 'Toon individuele artikelen'
										: 'Geen artikelen geladen. Klik een wet aan om artikelen uit te klappen.'}
								>
									<span class="sb-lagen-sub-glyph" aria-hidden="true">❡</span>
									<span>Artikelen</span>
								</button>
								<button
									type="button"
									class="sb-lagen-sub-btn"
									class:sb-lagen-sub-btn--active={collapseToLaws || !articlesAvailable}
									role="tab"
									aria-selected={collapseToLaws || !articlesAvailable}
									onclick={() => onCollapseToLawsChange(true)}
									title="Eén bron per wet"
								>
									<span class="sb-lagen-sub-glyph" aria-hidden="true">§</span>
									<span>Wetten</span>
								</button>
							</div>
						{/if}
					{/if}
				{/each}
			</div>
		</section>
	{/if}

	<!-- ── Geavanceerd toggle ─────────────────────────────────────────────── -->
	<button
		type="button"
		class="sb-adv-toggle"
		onclick={() => (advancedOpen = !advancedOpen)}
		aria-expanded={advancedOpen}
	>
		<span>Filters &amp; overlays</span>
		<span class="sb-adv-chev" class:sb-adv-chev--open={advancedOpen}>›</span>
	</button>

	{#if advancedOpen}
		<!-- ── Bronnen ───────────────────────────────────────────────────────────── -->
		<section class="sb-section">
			<div class="sb-head">Bronnen</div>
			<div class="sb-tog-grid">
				{#each TOGGLE_ROWS as [parent, sub] (parent)}
					{@render kindToggle(parent, 5, 'sb-tog--parent')}
					{@render kindToggle(sub, 3.5, 'sb-tog--sub')}
				{/each}
				<!-- Judgment has no sub kind and spans both columns. -->
				{@render kindToggle('judgment', 5, 'sb-tog--parent sb-tog--full')}
			</div>
		</section>

		<!-- ── Verbindingen: one toggle per edge category ─────────────────────────── -->
		<section class="sb-section">
			<div class="sb-head">Verbindingen</div>

			{#each EDGE_CATEGORIES as category (category)}
				{@const on = filters[`${category}Enabled`]}
				{@const color = on ? EDGE_COLOR[category] : '#C8C0B4'}
				<button
					type="button"
					class="sb-leg-row sb-leg-row--btn"
					class:sb-leg-row--off={!on}
					aria-pressed={on}
					title={EDGE_LEGEND[category].title}
					onclick={() => toggleEdge(category)}
				>
					<svg width="44" height="12" aria-hidden="true" class="sb-edge-icon">
						<defs>
							<marker
								id="sb-leg-m-{category}"
								markerWidth="3"
								markerHeight="3"
								refX="2"
								refY="1.5"
								orient="auto"
							>
								<path d="M0,0 L0,3 L3,1.5 z" fill={color} />
							</marker>
						</defs>
						<line
							x1="2"
							y1="6"
							x2="38"
							y2="6"
							stroke={color}
							stroke-width="2"
							stroke-linecap="round"
							marker-end="url(#sb-leg-m-{category})"
						/>
					</svg>
					<span class="sb-leg-label">{EDGE_LEGEND[category].label}</span>
				</button>
			{/each}
		</section>

		<!-- ── Overlays — single triple-state segmented control. The two overlays
       are mutually exclusive at the store level, so a three-position
       selector (Geen / Mutatie / Activiteit) reads more naturally than two
       independent buttons that hide a radio relationship. -->
		<section class="sb-section">
			<div class="sb-head">Overlays</div>
			<div class="sb-seg" role="radiogroup" aria-label="Overlay">
				<button
					type="button"
					class="sb-seg-btn"
					class:sb-seg-btn--active={!mutOn && !heatOn}
					role="radio"
					aria-checked={!mutOn && !heatOn}
					onclick={() => {
						if (mutOn) onToggleMutatie?.();
						else if (heatOn) onToggleHeat?.();
					}}
					title="Geen overlay">Geen</button
				>
				<button
					type="button"
					class="sb-seg-btn sb-seg-btn--mutatie"
					class:sb-seg-btn--active={mutOn}
					role="radio"
					aria-checked={mutOn}
					disabled={!onToggleMutatie}
					onclick={() => {
						if (!mutOn) onToggleMutatie?.();
					}}
					title={overlay.kind === 'dossier'
						? `Open mutaties binnen dossier ${overlay.id}`
						: 'Open wetsvoorstellen die deze bronnen willen wijzigen'}
				>
					Mutatie{#if mutOn && inFluxCount > 0}<span class="sb-seg-count">{inFluxCount}</span>{/if}
				</button>
				<button
					type="button"
					class="sb-seg-btn sb-seg-btn--heat"
					class:sb-seg-btn--active={heatOn}
					role="radio"
					aria-checked={heatOn}
					disabled={!onToggleHeat}
					onclick={() => {
						if (!heatOn) onToggleHeat?.();
					}}
					title="Hitte-halo schaalt met citaties per maand">Activiteit</button
				>
			</div>

			{#if heatOn}
				<div class="sb-heat-period" role="group" aria-label="Periode">
					{#each HEAT_PERIODS as m, i (i)}
						<button
							type="button"
							class="sb-heat-period-btn"
							class:sb-heat-period-btn--active={overlay.kind === 'heat' && overlay.months === m}
							onclick={() => onHeatPeriodChange?.(m)}
							disabled={!onHeatPeriodChange}>{m}m</button
						>
					{/each}
				</div>
			{/if}
		</section>
	{/if}<!-- /advancedOpen -->

	<!-- ── Vastgepind ──────────────────────────────────────────────────────── -->
	{#if pinnedNodes.length > 0}
		<section class="sb-section">
			<div class="sb-head sb-head--pin">
				<span>Vastgepind ({pinnedNodes.length})</span>
				{#if onClearPins}
					<button type="button" class="sb-head-action" onclick={onClearPins}>Wissen</button>
				{/if}
			</div>
			<ul class="sb-pin-list">
				{#each pinnedNodes as p (p.id)}
					<li class="sb-pin-item">
						<span class="sb-pin-glyph" aria-hidden="true">★</span>
						<span class="sb-pin-label" title={p.label}>{p.label}</span>
						{#if onUnpin}
							<button
								type="button"
								class="sb-pin-x"
								onclick={() => onUnpin(p.id)}
								aria-label="Losmaken">✕</button
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ── Verborgen bronnen ────────────────────────────────────────────────── -->
	{#if hasSelection && hiddenCount > 0}
		<section class="sb-section sb-section--focus">
			<div class="sb-focus-row">
				<span class="sb-focus-num">{hiddenCount}</span>
				<span class="sb-focus-label">bronnen niet zichtbaar</span>
			</div>
			{#if onRevealHidden}
				<button type="button" class="sb-focus-action" onclick={() => onRevealHidden?.()}>
					Toon alle →
				</button>
			{/if}
		</section>
	{/if}

	<!-- ── Parlement ─────────────────────────────────────────────────────────
       Zetelverdeling als navigatie naar fracties: een stoel of chip opent die
       fractie in Gesplitst. Boven Wetten, zodat de flex-grow van die sectie
       deze niet onder de vouw drukt. -->
	{#if seats}
		<section class="sb-section sb-section--parl">
			<div class="sb-head">
				<span>Parlement</span>
			</div>
			<div class="sb-parl-hemicycle">
				<Hemicycle data={seats} onSelect={openFaction} />
			</div>
			<div class="sb-parl-links">
				<a class="sb-parl-link" href="/explore?mode=index&kind=dossiers">Dossiers</a>
				<a class="sb-parl-link" href="/explore?mode=index&kind=members">Kamerleden</a>
				<a class="sb-parl-link" href="/explore?mode=index&kind=decisions">Stemmingen</a>
			</div>
		</section>
	{/if}

	<!-- ── Wetten ────────────────────────────────────────────────────────────── -->
	{#if instruments.length > 1}
		<section class="sb-section sb-section--grow">
			<div class="sb-head">Wetten</div>
			<div class="sb-inst-list">
				{#each instruments as inst (inst.bwbId)}
					{@const isActive =
						filters.activeInstruments.size > 0 && filters.activeInstruments.has(inst.bwbId)}
					<button
						type="button"
						class="sb-inst-row"
						class:sb-inst-row--active={isActive}
						onclick={() => onInstrumentToggle?.(inst.bwbId)}
						aria-pressed={isActive}
					>
						<span class="sb-inst-label">{inst.label}</span>
						<span class="sb-inst-count">{inst.count}</span>
					</button>
				{/each}
			</div>
		</section>
	{/if}
</aside>

<style>
	.graph-sidebar {
		width: 200px;
		flex-shrink: 0;
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--rule);
		background: var(--paper-2);
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}

	/* ── Sections ────────────────────────────────────────────────────────── */
	.sb-section {
		padding: var(--s-4) 0 var(--s-3);
		border-bottom: 1px solid var(--rule);
		flex-shrink: 0;
	}

	.sb-section--grow {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.sb-head {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--fg-3);
		padding: 0 var(--s-4) var(--s-2);
	}

	.sb-node-icon,
	.sb-edge-icon {
		flex-shrink: 0;
		overflow: visible;
	}

	/* 2-column grid of the kind toggles. Equal cells
     give a uniform reading rhythm. */
	.sb-tog-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px 4px;
		padding: 2px var(--s-3) 0;
	}
	.sb-tog {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
		background: none;
		border: none;
		border-radius: var(--r-1);
		cursor: pointer;
		text-align: left;
		min-width: 0;
		transition: background var(--dur-1) var(--ease);
	}
	.sb-tog:hover:not(:disabled) {
		background: var(--paper-3);
	}
	.sb-tog:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.sb-tog-label {
		font-family: var(--font-serif);
		font-size: 12px;
		color: var(--ink-2);
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		flex: 1;
	}
	.sb-tog--off .sb-tog-label {
		color: var(--ink-4);
		text-decoration: line-through;
		text-decoration-color: var(--ink-4);
	}
	/* Parent stays at the standard weight. Sub is muted (smaller font, thinner
     label colour, indented icon) so the hierarchy reads without a header
     row. A faint left border tethers the sub visually to its parent. */
	.sb-tog--parent .sb-tog-label {
		color: var(--ink-2);
	}
	.sb-tog--sub {
		padding-left: 10px;
		border-left: 1px solid var(--rule);
		border-radius: 0 var(--r-1) var(--r-1) 0;
	}
	.sb-tog--sub .sb-tog-label {
		font-size: 11px;
		color: var(--ink-3);
	}
	.sb-tog--sub.sb-tog--off .sb-tog-label {
		color: var(--ink-4);
	}
	/* Full-width row (judgment has no sub kind). */
	.sb-tog--full {
		grid-column: 1 / -1;
	}

	.sb-leg-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px var(--s-4);
		width: 100%;
	}
	/* Button variant — toggleable filter row. */
	.sb-leg-row--btn {
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		transition: background var(--dur-1) var(--ease);
	}
	.sb-leg-row--btn:hover {
		background: var(--paper-3);
	}
	.sb-leg-row--off .sb-leg-label {
		color: var(--ink-4);
		text-decoration: line-through;
		text-decoration-color: var(--ink-4);
	}
	.sb-leg-label {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1.2;
	}

	/* ── Instrument list ─────────────────────────────────────────────────── */
	.sb-inst-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}

	.sb-inst-row {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 5px var(--s-4);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		gap: var(--s-2);
		transition: background var(--dur-1) var(--ease);
	}

	.sb-inst-row:hover {
		background: var(--paper-3);
	}

	.sb-inst-row--active {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.sb-inst-row--active:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}

	.sb-inst-label {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sb-inst-row--active .sb-inst-label {
		color: var(--accent);
	}

	.sb-inst-count {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-3);
		flex-shrink: 0;
	}

	.sb-inst-row--active .sb-inst-count {
		color: var(--accent);
	}

	/* ── Filters and overlays toggle ────────────────────────────────────── */
	.sb-adv-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		width: 100%;
		padding: 4px var(--s-4);
		background: none;
		border: none;
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--fg-3);
		text-align: left;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
		flex-shrink: 0;
	}
	.sb-adv-toggle:hover {
		background: var(--paper-3);
		color: var(--ink);
	}
	.sb-adv-chev {
		display: inline-block;
		font-size: 14px;
		line-height: 1;
		transition: transform var(--dur-1) var(--ease);
		color: var(--ink-4);
	}
	.sb-adv-chev--open {
		transform: rotate(90deg);
	}

	/* Section heading with a trailing action (e.g. "Wis netwerk"). */
	.sb-head--with-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	/* ── Vastgepind ──────────────────────────────────────────────────────── */
	.sb-head--pin {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.sb-head-action {
		background: none;
		border: none;
		font-family: var(--font-sans);
		font-size: 10px;
		text-transform: none;
		letter-spacing: normal;
		color: var(--ink-4);
		cursor: pointer;
		padding: 0;
	}
	.sb-head-action:hover {
		color: var(--spine);
	}

	.sb-pin-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.sb-pin-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px var(--s-4);
	}
	.sb-pin-glyph {
		color: var(--spine);
		font-size: 11px;
		flex-shrink: 0;
	}
	.sb-pin-label {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: 12px;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sb-pin-x {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--ink-4);
		font-size: 11px;
		padding: 0 4px;
	}
	.sb-pin-x:hover {
		color: var(--spine);
	}

	/* ── Layers grid ────────────────────────────────────────────────────── */
	.sb-section--lagen {
		padding-top: var(--s-3);
	}

	/* ── Hidden sources section ─────────────────────────────────────────────── */
	.sb-section--focus {
		padding-bottom: var(--s-3);
	}
	.sb-focus-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 0 var(--s-3);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
	}
	.sb-focus-num {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
		min-width: 26px;
		text-align: right;
	}
	.sb-focus-label {
		color: var(--ink-4);
		letter-spacing: 0.02em;
	}
	.sb-focus-action {
		width: calc(100% - 2 * var(--s-3));
		margin: 8px var(--s-3) 0;
		padding: 6px 10px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.sb-focus-action:hover {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	.sb-clear-confirm {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.sb-head-action--danger {
		color: var(--spine);
	}
	.sb-head-action--danger:hover {
		color: var(--spine);
		opacity: 0.75;
	}

	.sb-deload-confirm {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 11px;
	}
	.sb-deload-confirm__text {
		flex: 1;
		color: var(--ink-2);
	}
	.sb-deload-confirm__btn {
		background: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 10px;
		color: var(--ink-3);
		cursor: pointer;
		padding: 2px 7px;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.sb-deload-confirm__btn:hover {
		background: var(--paper-3);
		color: var(--ink);
	}
	.sb-deload-confirm__btn--yes {
		color: var(--spine);
		border-color: var(--spine);
	}
	.sb-deload-confirm__btn--yes:hover {
		background: var(--spine);
		color: var(--paper);
	}

	.sb-lagen-grid {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0 var(--s-3);
	}
	.sb-lagen-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-width: 0;
		padding: 7px 10px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
		text-align: left;
		overflow: hidden;
	}
	.sb-lagen-btn > span:not(.sb-lagen-glyph):not(.sb-lagen-count) {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sb-lagen-btn:hover:not(:disabled) {
		background: var(--paper-2);
		color: var(--ink);
		border-color: var(--ink-3);
	}
	.sb-lagen-btn:disabled {
		opacity: 0.5;
		cursor: progress;
	}
	.sb-lagen-btn--active {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	.sb-lagen-btn--active:hover:not(:disabled) {
		background: var(--spine);
		color: var(--paper);
		border-color: var(--spine);
	}
	.sb-lagen-btn--active .sb-lagen-glyph {
		color: var(--paper);
	}
	.sb-lagen-glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		line-height: 1;
		color: var(--spine);
		width: 14px;
		text-align: center;
	}
	.sb-lagen-count {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		font-size: 10px;
		opacity: 0.85;
	}
	/* Quiet down the zero state so the user reads it as "nothing here" rather
     than a normal count. Still legible. */
	.sb-lagen-btn:not(.sb-lagen-btn--active) .sb-lagen-count {
		opacity: 0.4;
	}
	/* Potential count gets its own colour — different semantic (preview of a
     load) so it should read as an invitation, not the zero state. */
	.sb-lagen-btn:not(.sb-lagen-btn--active) .sb-lagen-count--potential {
		opacity: 0.9;
		color: var(--spine);
	}
	/* Sub-toggle hugs the Wetten button above: shared horizontal extent, no
     gap above, slight inset on the sides so it visually attaches as a
     continuation rather than floating below. The segmented control inside
     uses the serif italic for the § / ❡ glyphs to match the rest of the
     legend (kind glyphs are serif throughout the sidebar). */
	.sb-lagen-sub {
		display: flex;
		margin: -2px 6px 2px 6px; /* nudge up, indent inside parent width */
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-top: 0; /* fuse with the Wetten button bottom edge */
		border-radius: 0 0 var(--r-1) var(--r-1);
		padding: 2px;
	}
	.sb-lagen-sub-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 4px 8px;
		background: transparent;
		border: 0;
		border-radius: calc(var(--r-1) - 1px);
		font-family: var(--font-sans);
		font-size: 10px;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
		white-space: nowrap;
	}
	.sb-lagen-sub-btn:hover:not(.sb-lagen-sub-btn--active) {
		color: var(--ink);
		background: var(--paper);
	}
	.sb-lagen-sub-btn--active {
		background: var(--ink);
		color: var(--paper);
		font-weight: 500;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
	}
	.sb-lagen-sub-btn--disabled,
	.sb-lagen-sub-btn:disabled {
		color: var(--ink-4);
		opacity: 0.45;
		cursor: not-allowed;
		text-decoration: line-through;
		text-decoration-color: var(--rule-strong);
		text-decoration-thickness: 1px;
	}
	.sb-lagen-sub-btn--disabled:hover,
	.sb-lagen-sub-btn:disabled:hover {
		color: var(--ink-4);
		background: transparent;
	}
	.sb-lagen-sub-glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 13px;
		line-height: 1;
	}
	/* Wetten button merges with its sub-toggle: square its bottom corners
     when the toggle is rendered directly beneath. */
	.sb-lagen-btn:has(+ .sb-lagen-sub) {
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
	}

	/* ── Overlay segmented control ───────────────────────────────────────── */
	.sb-seg {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		margin: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		overflow: hidden;
		background: var(--paper);
	}
	.sb-seg-btn {
		position: relative;
		padding: 5px 6px;
		background: var(--paper);
		border: 0;
		border-right: 1px solid var(--rule-strong);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		cursor: pointer;
		text-align: center;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.sb-seg-btn:last-child {
		border-right: 0;
	}
	.sb-seg-btn:hover:not(.sb-seg-btn--active):not(:disabled) {
		background: var(--paper-2);
		color: var(--ink);
	}
	.sb-seg-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.sb-seg-btn--active {
		background: var(--ink);
		color: var(--paper);
		font-weight: 500;
	}
	/* Methode-coloured active states for the two overlay positions. Spine red
     for Mutatie (the wet wijzigt — same colour the canvas uses on the in-flux
     halo); teal for Activiteit so it reads as a distinct, cooler "pulse"
     rather than competing with the warm spine. */
	.sb-seg-btn--mutatie.sb-seg-btn--active {
		background: var(--spine, #7a1f1a);
		border-color: var(--spine, #7a1f1a);
	}
	.sb-seg-btn--heat.sb-seg-btn--active {
		background: var(--teal, #1f5a56);
		border-color: var(--teal, #1f5a56);
	}
	.sb-seg-count {
		margin-left: 4px;
		padding: 0 4px;
		border-radius: 7px;
		background: color-mix(in srgb, currentColor 22%, transparent);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: 9px;
		line-height: 1.4;
	}

	/* ── Heat period selector ────────────────────────────────────────────── */
	.sb-heat-period {
		display: flex;
		gap: 4px;
		margin: 6px 2px 4px;
	}
	.sb-heat-period-btn {
		flex: 1;
		height: 22px;
		padding: 0 6px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-3);
		cursor: pointer;
	}
	.sb-heat-period-btn:hover {
		background: var(--paper-3);
		color: var(--ink);
	}
	.sb-heat-period-btn--active {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	/* ── Parlement-sectie (experimenteel) ──────────────────────────────────
     De Hemicycle is gebouwd voor de bredere index-weergave; in een 200px
     sidebar verbergen we de chip-legenda en de "lege" readout-regel om de
     stoelenkring zelf de hoogte te laten dragen. Hover blijft werken via
     de readout-regel die wel verschijnt. */
	.sb-section--parl {
		padding: var(--s-4) var(--s-3) var(--s-3);
	}
	.sb-parl-hemicycle :global(.hemicycle) {
		margin: 0;
		padding: 6px 0 0;
		background: transparent;
		border: none;
		gap: 4px;
	}
	.sb-parl-hemicycle :global(.hemicycle svg) {
		max-height: 130px;
	}
	.sb-parl-hemicycle :global(.legend) {
		display: none;
	}
	/* Sidebar-readout: vaste hoogte zodat de mini-Hemicycle niet hertekent
     bij hover. De empty-tekst is te lang voor 200px breedte, dus knip met
     ellipsis in plaats van display:none — dat zou de container laten
     springen wanneer de hover-readout verschijnt. */
	.sb-parl-hemicycle :global(.readout) {
		font-size: 10px;
		padding: 4px 0 0;
		height: 22px;
		gap: 6px;
	}
	.sb-parl-hemicycle :global(.readout--empty) {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}
	/* De viewBox is 440 breed; in een ~180px-sidebar schaalt alles met
     ~0.4. Met een normaal-ogend label van 16px in viewBox-eenheden komt
     dat neer op ~6.5px op het scherm. Bump het centrale getal flink en
     verberg het secundaire label — de sectie-kop "Parlement" geeft al
     genoeg context. */
	.sb-parl-hemicycle :global(.center-num) {
		font-size: 32px;
		font-weight: 500;
	}
	.sb-parl-hemicycle :global(.center-lbl) {
		display: none;
	}

	.sb-parl-links {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: var(--s-2);
		padding: 0;
	}
	.sb-parl-link {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-2);
		text-decoration: none;
		border-bottom: none;
		padding: 2px 0;
		transition: color var(--dur-1) var(--ease);
	}
	.sb-parl-link::before {
		content: '→';
		color: var(--ink-4);
		margin-right: 6px;
	}
	.sb-parl-link:hover {
		color: var(--accent);
	}
</style>
