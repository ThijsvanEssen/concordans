<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { GraphFilters } from '$lib/graph/graph-store';
	import type { GraphNode, GraphNodeKind } from '$lib/graph/types';
	import { LAYER_SUB_KINDS } from '$lib/graph/types';
	import type { Overlay } from '$lib/stores/overlay';
	import { HEAT_PERIODS } from '$lib/stores/overlay';
	import { shapeFor, type NodeShape } from './nodeSprites';
	import Hemicycle from '$lib/components/explore/Hemicycle.svelte';
	import { fetchZetels } from '$lib/api/parliamentary-client';
	import type { ZetelsResponse } from '$lib/api/parliamentary';

	// Experimenteel: mini-Hemicycle onderaan de zijbalk. Lazy fetch zodat de
	// primaire grafiek-flow geen onnodige API-call krijgt; faalt stil als de
	// endpoint niet bereikbaar is.
	let sbZetels = $state<ZetelsResponse | null>(null);
	onMount(() => {
		fetchZetels()
			.then((r) => {
				sbZetels = r;
			})
			.catch(() => {
				/* keep null */
			});
	});
	function openSidebarFractie(key: string) {
		goto(`/explore?mode=split&focus=${encodeURIComponent(`fracties/${key}`)}`);
	}

	// Inline shape primitive for legend glyphs. The legend mirrors the
	// canvas: same shape per kind, same fill/stroke logic as before. `r` is
	// the inscribed radius so parent (r=5) and sub (r=3.5) keep their size
	// hierarchy across shapes.
	function legendPoints(shape: NodeShape, r: number): string {
		if (shape === 'diamond') return `6,${6 - r} ${6 + r},6 6,${6 + r} ${6 - r},6`;
		if (shape === 'hexagon') {
			const dy = r * 0.866;
			const hx = r * 0.5;
			return `${6 + r},6 ${6 + hx},${6 - dy} ${6 - hx},${6 - dy} ${6 - r},6 ${6 - hx},${6 + dy} ${6 + hx},${6 + dy}`;
		}
		return '';
	}

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
		onLoadCommissies,
		onLoadFracties,
		onLoadLeden,
		onDeloadLayer,
		onResetGraph,
		kindCounts = {} as Record<string, number>,
		potentialCounts = {} as Record<string, number>,
		hasSelection = false,
		hiddenCount = 0,
		onRevealHidden,
		loadingGlobal = false,
		loadingJudgments = false,
		loadingDossiers = false,
		loadingCommissies = false,
		loadingFracties = false,
		loadingLeden = false,
		activatedLayers
	}: {
		filters: GraphFilters;
		instruments?: { bwbId: string; label: string; count: number }[];
		collapseToLaws: boolean;
		overlay?: Overlay;
		/** Count of in-flux nodes (size of the inFluxMap) shown in the Mutatie
		 *  block when the overlay is active. Provided by the parent so the sidebar
		 *  doesn't need to hold the full map. */
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
		onLoadCommissies?: () => void;
		onLoadFracties?: () => void;
		onLoadLeden?: () => void;
		/** Remove every node of the given kind from the canvas. */
		onDeloadLayer?: (kind: import('$lib/graph/types').GraphNodeKind) => void;
		/** Clear all nodes/edges so the user can start clean. */
		onResetGraph?: () => void;
		/** Live count of nodes per kind. Drives the active state on Lagen buttons. */
		kindCounts?: Record<string, number>;
		/** Direct-neighbour count per kind for the focused selection. When a
		 *  selection is active, Lagen counts shift to "attached to selection"
		 *  semantics — the user sees what's already linked. */
		/** Per-kind count of cached-but-not-on-canvas neighbours. Shown on
		 *  inactive Lagen buttons as a "+N" preview of what a click would add. */
		potentialCounts?: Record<string, number>;
		hasSelection?: boolean;
		/** Direct neighbours of the focused node still on canvas. */
		/** Convergence neighbours (multi-source-reachable) still on canvas. */
		/** Nodes the BFS fetched but the convergence prune removed. When > 0,
		 *  the Rond-focus section renders and offers "Maak ze zichtbaar". */
		hiddenCount?: number;
		/** Re-fetch the focal node's full neighbourhood without the convergence
		 *  prune. Surfaces every weggeknipt node. */
		onRevealHidden?: () => void;
		loadingGlobal?: boolean;
		loadingJudgments?: boolean;
		loadingDossiers?: boolean;
		loadingCommissies?: boolean;
		loadingFracties?: boolean;
		loadingLeden?: boolean;
		/** Set of layers the user has explicitly activated. Lagen buttons read
		 *  as "active" when their kind is in here, even if zero nodes of that
		 *  kind are currently on canvas — so a layer that returned 0 attached
		 *  newcomers still reads as on. */
		activatedLayers?: ReadonlySet<import('$lib/graph/types').GraphNodeKind>;
	} = $props();

	// Open by default — Knooppunten daarin is de gezaghebbende legenda voor
	// de node-shapes/kleuren. Verbergen achter een collapsible was de reden
	// dat we per ongeluk een tweede legenda op de canvas zetten; nu zit de
	// echte legenda altijd in zicht en hoeft de gebruiker niets uit te
	// klappen voor de essentiële vorm/kleur-info.
	let advancedOpen = $state(true);
	let confirmClear = $state(false);
	let clearTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingDeload = $state<string | null>(null);

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

	type NodeKey = keyof GraphFilters['nodeTypeToggles'];
	function toggleNode(key: NodeKey) {
		onFilterChange({
			nodeTypeToggles: { ...filters.nodeTypeToggles, [key]: !filters.nodeTypeToggles[key] }
		});
	}

	// Overlay state shortcuts — {@const} can't be a direct child of <section>,
	// so derive these here and reference them in the template.
	const mutOn = $derived(overlay.kind === 'open' || overlay.kind === 'dossier');
	const heatOn = $derived(overlay.kind === 'heat');
	function toggleEdge(cat: 'structural' | 'mutation' | 'semantic') {
		if (cat === 'structural') onFilterChange({ structuralEnabled: !filters.structuralEnabled });
		if (cat === 'mutation') onFilterChange({ mutationEnabled: !filters.mutationEnabled });
		if (cat === 'semantic') onFilterChange({ semanticEnabled: !filters.semanticEnabled });
	}

	// Three-category edge palette — mirrors /docs/methode §iiib and GraphCanvas
	// CAT_RGB. Mutation lines are heavier and spine-coloured because they carry
	// the load (changing the law). Structural and semantic share ink-2 — the
	// semantic line is rendered dashed to signal "afgeleid uit tekst".
</script>

<aside class="graph-sidebar">
	<!-- ── Lagen ──────────────────────────────────────────────────────────────
       Top-of-sidebar shortcuts to bulk overviews. Always accessible — not
       only when the canvas is empty, so the user can pivot to any layer
       (Wetten, Arresten, Dossiers, Commissies, Fracties, Leden) at any time. -->
	{#if onLoadGlobal || onLoadJudgments || onLoadDossiers || onLoadCommissies || onLoadFracties || onLoadLeden}
		{@const lagen = [
			{
				kind: 'instrument' as const,
				label: 'Wetten',
				glyph: '§',
				on: onLoadGlobal,
				loading: loadingGlobal
			},
			{
				kind: 'judgment' as const,
				label: 'Arresten',
				glyph: '¶',
				on: onLoadJudgments,
				loading: loadingJudgments
			},
			{
				kind: 'dossier' as const,
				label: 'Dossiers',
				glyph: '∮',
				on: onLoadDossiers,
				loading: loadingDossiers
			},
			{
				kind: 'commissie' as const,
				label: 'Commissies',
				glyph: '‡',
				on: onLoadCommissies,
				loading: loadingCommissies
			},
			{
				kind: 'fractie' as const,
				label: 'Fracties',
				glyph: '※',
				on: onLoadFracties,
				loading: loadingFracties
			},
			{ kind: 'lid' as const, label: 'Leden', glyph: '◉', on: onLoadLeden, loading: loadingLeden }
		]}
		{@const anyLoaded = lagen.some((l) => (kindCounts[l.kind] ?? 0) > 0)}
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
				{#each lagen as l (l.kind)}
					{#if l.on}
						<!-- Count = nodes of this layer currently on the graph. Layers
                 group a primary kind with its sub-kinds (Dossier+Publicatie,
                 Commissie+Activiteit, Fractie+Lid, Wet+Artikel) — see
                 LAYER_SUB_KINDS in $lib/graph/types. -->
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
									} else l.on?.();
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
		<!-- ── Knooppunten ──────────────────────────────────────────────────────── -->
		<section class="sb-section">
			<div class="sb-head">Knooppunten</div>
			<div class="sb-tog-grid">
				{#each [{ parent: { key: 'instrument' as NodeKey, label: 'Wetgeving', color: '#1A1814', r: 5 }, sub: { key: 'article' as NodeKey, label: 'Artikel', color: '#1A1814', r: 3.5 } }, { parent: { key: 'dossier' as NodeKey, label: 'Dossier', color: '#7A1F1A', r: 5 }, sub: { key: 'tkstuk' as NodeKey, label: 'Publicatie', color: '#7A1F1A', r: 3.5 } }, { parent: { key: 'commissie' as NodeKey, label: 'Commissie', color: '#8A6B3A', r: 5 }, sub: { key: 'activity' as NodeKey, label: 'Activiteit', color: '#8A6B3A', r: 3 } }, { parent: { key: 'fractie' as NodeKey, label: 'Fractie', color: '#44505E', r: 5 }, sub: { key: 'lid' as NodeKey, label: 'Kamerlid', color: '#44505E', r: 3.5 } }] as pair, i (i)}
					{@const pOn = filters.nodeTypeToggles[pair.parent.key]}
					{@const sOn = filters.nodeTypeToggles[pair.sub.key]}
					{@const pShape = shapeFor(pair.parent.key as GraphNodeKind)}
					{@const sShape = shapeFor(pair.sub.key as GraphNodeKind)}
					<button
						type="button"
						class="sb-tog sb-tog--parent"
						class:sb-tog--off={!pOn}
						aria-pressed={pOn}
						onclick={() => toggleNode(pair.parent.key)}
						title={pair.parent.label}
					>
						<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="sb-node-icon">
							{#if pShape === 'circle'}
								<circle
									cx="6"
									cy="6"
									r={pair.parent.r}
									fill={pOn ? pair.parent.color : '#FFFDF4'}
									stroke={pOn ? pair.parent.color : '#C8C0B4'}
									stroke-width="1.5"
								/>
							{:else if pShape === 'roundedRect'}
								<rect
									x={6 - pair.parent.r}
									y={6 - pair.parent.r}
									width={2 * pair.parent.r}
									height={2 * pair.parent.r}
									rx={pair.parent.r * 0.4}
									ry={pair.parent.r * 0.4}
									fill={pOn ? pair.parent.color : '#FFFDF4'}
									stroke={pOn ? pair.parent.color : '#C8C0B4'}
									stroke-width="1.5"
								/>
							{:else}
								<polygon
									points={legendPoints(pShape, pair.parent.r)}
									fill={pOn ? pair.parent.color : '#FFFDF4'}
									stroke={pOn ? pair.parent.color : '#C8C0B4'}
									stroke-width="1.5"
								/>
							{/if}
						</svg>
						<span class="sb-tog-label">{pair.parent.label}</span>
					</button>
					<button
						type="button"
						class="sb-tog sb-tog--sub"
						class:sb-tog--off={!sOn}
						aria-pressed={sOn}
						onclick={() => toggleNode(pair.sub.key)}
						title={pair.sub.label}
					>
						<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="sb-node-icon">
							{#if sShape === 'circle'}
								<circle
									cx="6"
									cy="6"
									r={pair.sub.r}
									fill={sOn ? pair.sub.color : '#FFFDF4'}
									stroke={sOn ? pair.sub.color : '#C8C0B4'}
									stroke-width="1.5"
								/>
							{:else if sShape === 'roundedRect'}
								<rect
									x={6 - pair.sub.r}
									y={6 - pair.sub.r}
									width={2 * pair.sub.r}
									height={2 * pair.sub.r}
									rx={pair.sub.r * 0.4}
									ry={pair.sub.r * 0.4}
									fill={sOn ? pair.sub.color : '#FFFDF4'}
									stroke={sOn ? pair.sub.color : '#C8C0B4'}
									stroke-width="1.5"
								/>
							{:else}
								<polygon
									points={legendPoints(sShape, pair.sub.r)}
									fill={sOn ? pair.sub.color : '#FFFDF4'}
									stroke={sOn ? pair.sub.color : '#C8C0B4'}
									stroke-width="1.5"
								/>
							{/if}
						</svg>
						<span class="sb-tog-label">{pair.sub.label}</span>
					</button>
				{/each}
				<!-- Rechterlijk: leaf with no sub, spans both columns. -->
				<button
					type="button"
					class="sb-tog sb-tog--parent sb-tog--full"
					class:sb-tog--off={!filters.nodeTypeToggles['judgment']}
					aria-pressed={filters.nodeTypeToggles['judgment']}
					onclick={() => toggleNode('judgment')}
					title="Rechterlijk"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" class="sb-node-icon">
						<rect
							x="1.5"
							y="1.5"
							width="9"
							height="9"
							rx="2"
							ry="2"
							fill={filters.nodeTypeToggles['judgment'] ? '#2B3A5C' : '#FFFDF4'}
							stroke={filters.nodeTypeToggles['judgment'] ? '#2B3A5C' : '#C8C0B4'}
							stroke-width="1.5"
						/>
					</svg>
					<span class="sb-tog-label">Rechterlijk</span>
				</button>
			</div>
		</section>

		<!-- ── Relaties — drie categorieën, methode §iiib — toggleable filters ── -->
		<section class="sb-section">
			<div class="sb-head">Relaties</div>

			{#each [{ cat: 'structural' as const, label: 'Vaste verwijzing', color: '#3D5C3A', title: 'Structurele verwijzingen: artikelen die formeel worden aangehaald in de wettekst.' }, { cat: 'mutation' as const, label: 'Wijziging via Kamer', color: '#7A1F1A', title: 'Wijzigingen via parlementaire behandeling: de wetsgeschiedenis van dit artikel.' }, { cat: 'semantic' as const, label: 'Inhoudelijk verband', color: '#44505E', title: 'Semantische verbanden: thematische of inhoudelijke overlap, niet formeel geciteerd.' }] as r, i (i)}
				{@const on =
					r.cat === 'structural'
						? filters.structuralEnabled
						: r.cat === 'mutation'
							? filters.mutationEnabled
							: filters.semanticEnabled}
				<button
					type="button"
					class="sb-leg-row sb-leg-row--btn"
					class:sb-leg-row--off={!on}
					aria-pressed={on}
					title={r.title}
					onclick={() => toggleEdge(r.cat)}
				>
					<svg width="44" height="12" aria-hidden="true" class="sb-edge-icon">
						<defs>
							<marker
								id="sb-leg-m-{r.cat}"
								markerWidth="3"
								markerHeight="3"
								refX="2"
								refY="1.5"
								orient="auto"
							>
								<path d="M0,0 L0,3 L3,1.5 z" fill={on ? r.color : '#C8C0B4'} />
							</marker>
						</defs>
						<line
							x1="2"
							y1="6"
							x2="38"
							y2="6"
							stroke={on ? r.color : '#C8C0B4'}
							stroke-width="2"
							stroke-linecap="round"
							marker-end="url(#sb-leg-m-{r.cat})"
						/>
					</svg>
					<span class="sb-leg-label">{r.label}</span>
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
						: 'Open wetsvoorstellen die deze knooppunten willen wijzigen'}
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

	<!-- ── Parlement (experimenteel) ─────────────────────────────────────────
       Mini-Hemicycle als persistente navigatie naar fracties. Klik op een
       stoel of chip opent die fractie in Gesplitst. Lazy-loaded; verschijnt
       pas als de zetels-endpoint resultaat geeft. Geplaatst boven Wetten
       zodat de flex-grow van die sectie deze niet onder de vouw drukt. -->
	{#if sbZetels}
		<section class="sb-section sb-section--parl">
			<div class="sb-head">
				<span>Parlement</span>
			</div>
			<div class="sb-parl-hemicycle">
				<Hemicycle data={sbZetels} onSelect={openSidebarFractie} />
			</div>
			<div class="sb-parl-links">
				<a class="sb-parl-link" href="/explore?mode=index&kind=dossiers">Dossiers</a>
				<a class="sb-parl-link" href="/explore?mode=index&kind=leden">Kamerleden</a>
				<a class="sb-parl-link" href="/explore?mode=index&kind=stemmingen">Stemmingen</a>
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

	/* ── Rows ────────────────────────────────────────────────────────────── */
	.sb-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px var(--s-4);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background var(--dur-1) var(--ease);
	}

	.sb-row:hover {
		background: var(--paper-3);
	}

	.sb-row--static {
		cursor: default;
		opacity: 0.75;
	}
	.sb-row--static:hover {
		background: none;
	}

	.sb-node-icon,
	.sb-edge-icon {
		flex-shrink: 0;
		overflow: visible;
	}

	/* Legend rows — read-only listing of node + edge types. */
	.sb-domain {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 11px;
		color: var(--ink-3);
		padding: 6px var(--s-4) 2px;
	}
	.sb-domain:first-child {
		padding-top: 0;
	}
	.sb-cluster-row {
		display: flex;
		align-items: center;
	}
	.sb-cluster-row .sb-leg-row--master {
		flex: 1;
	}

	.sb-leg-row--master {
		font-weight: 500;
		padding-right: 4px;
	}
	.sb-leg-row--master .sb-leg-label {
		font-weight: 500;
	}
	.sb-leg-row--mixed .sb-leg-label::after {
		content: ' · gemengd';
		font-size: 10px;
		font-style: italic;
		color: var(--ink-4);
		font-weight: 400;
	}
	.sb-cluster-expand {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: 0;
		color: var(--ink-3);
		cursor: pointer;
		padding: 2px 8px;
		margin-right: var(--s-3);
		line-height: 1;
		transition: color 80ms;
	}
	.sb-cluster-expand:hover {
		color: var(--ink);
	}
	.sb-cluster-expand-chev {
		display: inline-block;
		font-size: 14px;
		line-height: 1;
		transition: transform 120ms;
	}
	.sb-cluster-expand-chev--open {
		transform: rotate(90deg);
	}
	.sb-cluster-children {
		padding: 4px 0 6px;
		margin: 2px var(--s-4) 4px calc(var(--s-4) + 14px);
		border-left: 2px solid var(--spine-faint, var(--rule-strong));
		background: color-mix(in srgb, var(--paper-2) 60%, transparent);
		border-radius: 0 var(--r-1) var(--r-1) 0;
	}
	.sb-leg-row--child {
		padding-left: 10px;
		font-size: 12px;
	}
	.sb-leg-row--child .sb-leg-label {
		font-size: 12px;
	}

	/* Shared 2-col toggle grid used by Knooppunten and Overlays. Equal cells
     give a uniform reading rhythm; the same .sb-tog button drives both
     sections so they look and behave identically. */
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
	.sb-tog--mixed .sb-tog-label::after {
		content: ' ·';
		color: var(--ink-4);
	}
	.sb-tog--active {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.sb-tog--active:hover {
		background: color-mix(in srgb, var(--ink) 14%, transparent);
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
	/* Full-width row (Rechterlijk — no sub). */
	.sb-tog--full {
		grid-column: 1 / -1;
	}
	.sb-tog-count {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: 10px;
		color: var(--ink-3);
		flex-shrink: 0;
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
	.sb-leg-glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 13px;
		line-height: 1;
		width: 12px;
		text-align: center;
		flex-shrink: 0;
	}
	.sb-leg-label {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1.2;
	}

	.sb-label {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1;
	}

	.sb-label--dim {
		font-size: 11.5px;
		color: var(--fg-2);
		font-family: var(--font-sans);
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

	/* ── Zicht (visible / total) ─────────────────────────────────────────── */
	.sb-section--zicht {
		padding-top: var(--s-3);
	}

	.sb-zicht-row {
		display: flex;
		align-items: baseline;
		gap: 4px;
		padding: 0 var(--s-4) 4px;
		font-family: var(--font-sans);
	}
	.sb-zicht-num {
		font-family: var(--font-mono);
		font-size: 16px;
		font-weight: 600;
		color: var(--ink);
	}
	.sb-zicht-sep {
		color: var(--ink-4);
	}
	.sb-zicht-total {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--ink-3);
	}
	.sb-zicht-label {
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		margin-left: 4px;
	}

	/* ── Geavanceerd toggle ─────────────────────────────────────────────── */
	.sb-adv-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--s-2) var(--s-4);
		background: none;
		border: none;
		border-bottom: 1px solid var(--rule);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--fg-3);
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
		flex-shrink: 0;
	}
	.sb-adv-toggle:hover {
		background: var(--paper-3);
		color: var(--ink-2);
	}
	.sb-adv-chev {
		font-size: 14px;
		line-height: 1;
		transition: transform 150ms var(--ease);
		display: inline-block;
	}
	.sb-adv-chev--open {
		transform: rotate(90deg);
	}

	.sb-stepper {
		display: grid;
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		gap: 0;
		margin: 0 var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		overflow: hidden;
	}
	.sb-stepper-btn {
		font-family: var(--font-sans);
		font-size: 11px;
		padding: 4px 6px;
		background: var(--paper);
		color: var(--ink-3);
		border: none;
		border-right: 1px solid var(--rule-strong);
		cursor: pointer;
		line-height: 1.3;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.sb-stepper-btn:last-child {
		border-right: none;
	}
	.sb-stepper-btn:hover:not(.is-active) {
		background: var(--paper-2);
		color: var(--ink);
	}
	.sb-stepper-btn.is-active {
		background: var(--ink);
		color: var(--paper);
		font-weight: 500;
	}

	.sb-zicht-hint {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 11px;
		line-height: 1.45;
		color: var(--ink-4);
		margin: 4px var(--s-4) 0;
	}

	/* Section heading with a trailing action (e.g. "Wis grafiek"). */
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

	/* ── Geavanceerd (removed) ──────────────────────────────────────────── */
	.sb-adv-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		background: none;
		border: none;
		padding: 4px var(--s-4);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--fg-3);
		text-align: left;
	}
	.sb-adv-toggle:hover {
		color: var(--ink);
	}
	.sb-adv-chev {
		display: inline-block;
		transition: transform var(--dur-1) var(--ease);
		color: var(--ink-4);
	}
	.sb-adv-chev--open {
		transform: rotate(90deg);
	}

	.sb-adv-body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 4px var(--s-4) var(--s-2);
	}
	.sb-adv-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-2);
		cursor: pointer;
	}
	.sb-adv-row--col {
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		cursor: default;
	}
	.sb-adv-label {
		font-size: 11px;
		color: var(--ink-3);
	}
	.sb-adv-select {
		height: 24px;
		padding: 0 6px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink);
	}

	/* ── Lagen grid ─────────────────────────────────────────────────────── */
	.sb-section--lagen {
		padding-top: var(--s-3);
	}

	/* ── Rond focus section ─────────────────────────────────────────────── */
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

	/* ── Detail-niveau toggle (Artikel ↔ Wet) ───────────────────────────── */
	.sb-level-toggle {
		display: flex;
		margin: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		overflow: hidden;
		background: var(--paper);
	}
	.sb-level-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 8px;
		background: var(--paper);
		border: 0;
		border-right: 1px solid var(--rule-strong);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.sb-level-btn:last-child {
		border-right: 0;
	}
	.sb-level-btn:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
	.sb-level-btn--active {
		background: var(--ink);
		color: var(--paper);
		font-weight: 500;
	}
	.sb-level-btn--active:hover {
		background: var(--ink-2);
	}
	.sb-level-glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 13px;
		line-height: 1;
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
	.sb-parl-flag {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 400;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--ink-4);
		font-style: italic;
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
