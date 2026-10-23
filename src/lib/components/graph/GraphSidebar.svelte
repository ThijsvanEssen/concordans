<script lang="ts">
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import { NL } from '$lib/text/collator';
	// The legend of the network, which is also its filter: the bronnen that take part
	// (with counts and the preset), the verbindingen per relation with a line sample,
	// the depth from the focus, the lid, and one line with what is on the canvas and
	// what the filter hides. The overlays are under Meer.
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import { HEAT_PERIODS, type Overlay } from '$lib/selection/overlay';
	import type { Collection, Relation } from '$lib/vocabulary';
	import {
		FILTER_GROUPS,
		FILTER_GROUP_LABEL,
		PRESETS,
		activePreset,
		toggleFilterGroup,
		withPreset,
		type FilterGroup,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import type { VerbondenState } from '$lib/verbonden/data-source';
	import { allRows, lidCounts, relationCounts } from '$lib/verbonden/view';
	import {
		edgeColorFor,
		edgeStyleFor,
		hullColorFor,
		hullDashFor,
		lijnDikte,
		pijlLengte,
		PIJL_BREED
	} from './nodeSprites';
	import { EDGE_WEIGHT } from '$lib/graph/types';
	import { drawClassOf } from '$lib/graph/types';
	import { GROUP_LABEL, inLegend } from '$lib/graph/collection-role';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { BRON_LABEL, isCollection } from '$lib/vocabulary';
	import { formatCount } from '$lib/text/getal';
	import { FILTER_GROUP_VORM } from '$lib/bron/vormen';
	import type { ContainerKind } from '$lib/graph/container-membership';
	import { NEIGHBORHOOD_CAP, type NeighborhoodReach } from '$lib/graph/store/types';

	let {
		verbonden,
		filter,
		selectionCollection,
		onFilter,
		onOpenFilter,
		depth,
		onDepth,
		onAllesLaden,
		onLaadSoort,
		laadtSoort = new Set<string>(),
		allesGrens = null,
		hiddenRelations,
		onToggleRelation,
		hiddenGroups = new Set(),
		onToggleGroup,
		canvasCounts,
		overlay = { kind: 'none' } as Overlay,
		inFluxCount = 0,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		netwerkActive = false,
		hasNodes = false,
		reach = null
	}: {
		verbonden: VerbondenState;
		filter: VerbondenFilter;
		selectionCollection: Collection | null;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		depth: number;
		onDepth: (d: number) => void;
		onAllesLaden?: () => void;
		/** All the focus's direct neighbours of one kind (the per-kind step). */
		onLaadSoort?: (collection: Collection) => void;
		/** The kinds being loaded so. */
		laadtSoort?: ReadonlySet<string>;
		/** The most "Alles laden" asks at once; set once it has (the cap then stands as a label). */
		allesGrens?: { grens: number; geladen: boolean } | null;
		hiddenRelations: Set<Relation>;
		onToggleRelation: (r: Relation) => void;
		/** Groupings switched off: no hull around their bronnen. */
		hiddenGroups?: ReadonlySet<ContainerKind>;
		onToggleGroup?: (kind: ContainerKind) => void;
		canvasCounts: {
			kinds?: Partial<Record<FilterGroup, number>>;
			metGroep?: Partial<
				Record<FilterGroup, { count: number; van: number; groepen: ContainerKind[] }>
			>;
		};
		overlay?: Overlay;
		inFluxCount?: number;
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		/** With a netwerk, a depth adds context around the selection instead of setting the view. */
		netwerkActive?: boolean;
		hasNodes?: boolean;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
	} = $props();

	// The kinds count what is on the canvas, with a selection too: the legend is the key to
	// the drawing, open as closed; the focus's direct verbindingen are in Verbonden (besluit 29).
	const totals = $derived(canvasCounts.kinds ?? {});

	// Diepte: the steps that add nothing, as the API cut the neighbourhood off at its cap.
	const DEPTHS = [1, 2, 3];
	const grens = $derived(reach?.cap ?? NEIGHBORHOOD_CAP);
	const CAPPED_REASON = $derived(
		`Maximaal ${grens} bronnen getoond; een stap verder voegt niets toe.`
	);
	const beyondCap = (d: number) => !netwerkActive && !!reach?.capped && d > reach.depth;
	// What the network shows of the focus's direct neighbours, per kind the API cut off: "32 van
	// 1.483" as a label, not a sentence (Thijs, 10 Oct: "maak duidelijk dat we niet alles zien").
	const uitsnede = $derived(
		netwerkActive
			? []
			: (reach?.buckets ?? []).filter((b) => b.kept < b.total && isCollection(b.collection))
	);
	const uitsnedeTotaal = $derived(uitsnede.reduce((n, b) => n + b.total, 0));
	const NO_SELECTION_REASON = 'Kies eerst een bron in het netwerk.';
	const relations = $derived(
		selectionCollection
			? relationCounts(verbonden.groups, selectionCollection).filter((r) =>
					inLegend(r.relation as Relation)
				)
			: []
	);
	const CONTAINER_KIND_HINT: Record<ContainerKind, string> = {
		instrument: 'een omtrek om de artikelen van een wet of regeling',
		faction: 'een omtrek om de leden van een fractie',
		committee: 'een omtrek om de leden van een commissie',
		dossier: 'een omtrek om de stukken van een dossier'
	};

	// On the canvas a wet, dossier, fractie or commissie is a hull, never a bron: the kinds
	// are named by what does stand there (Thijs). Verbonden lists the wetten, dossiers and
	// fracties themselves, and keeps their names; the switch is the same.
	const OP_HET_NETWERK: Partial<Record<FilterGroup, { label: string; elders: string }>> = {
		wetten: { label: 'Publicaties', elders: 'Wetten' },
		dossiers: { label: 'Overige stukken', elders: 'Dossiers' },
		leden: { label: 'Leden', elders: 'Leden en fracties' }
	};
	const kindLabel = (k: FilterGroup) => OP_HET_NETWERK[k]?.label ?? FILTER_GROUP_LABEL[k];
	const kindTitle = (k: FilterGroup) => {
		const n = OP_HET_NETWERK[k];
		return n ? `${n.label} (in Verbonden: ${n.elders})` : undefined;
	};
	const lids = $derived(
		[...(verbonden.lidTellingen ?? lidCounts(allRows(verbonden.groups)))]
			.map(([k]) => k)
			.filter((k) => k !== '')
			.sort(NL.compare)
	);
	const isOn = (k: (typeof FILTER_GROUPS)[number]) =>
		filter.bronnen === null || filter.bronnen.has(k);

	// A kind whose bronnen all went with a grouping switched off stays, greyed: a click
	// switches that grouping on again (Thijs, 9 Oct). Partly hidden, the row is as ever.
	const metGroepUit = (k: FilterGroup): ContainerKind[] | null => {
		const m = canvasCounts.metGroep?.[k];
		return m && isOn(k) && m.count > 0 && m.count >= m.van ? m.groepen : null;
	};

	const mutOn = $derived(overlay.kind === 'open');
	const heatOn = $derived(overlay.kind === 'heat');

	// The line sample of a relation, in the colour of the edge from this bron.
	const sourceKind = (relation: Relation) =>
		drawClassOf(
			// A citation of the selected bron comes from the other end.
			relation === 'REFERS_TO' && selectionCollection === 'articles'
				? 'judgments'
				: (selectionCollection ?? 'articles')
		);
	const dash = (relation: Relation) => {
		const style = edgeStyleFor(relation, null);
		return style === 'dotted' ? '1 3' : style === 'dashed' ? '4 3' : undefined;
	};
</script>

<aside class="legend">
	<!-- Nothing on the canvas: nothing to filter, group or count yet. -->
	{#if !hasNodes}
		<p class="empty stil">Nog geen bronnen in het netwerk.</p>
	{:else}
		<section class="block">
			<div class="block__head">
				<h3 class="block__title">Bronnen</h3>
				<TekstMenu
					rechts
					label="Voorkeuze"
					tekst="Voorkeuze"
					waarde={activePreset(filter)?.id ?? null}
					opties={PRESETS.map((p) => ({ waarde: p.id, label: p.label }))}
					onSelect={(id) => {
						const p = PRESETS.find((x) => x.id === id);
						if (p) onFilter(withPreset(filter, p));
					}}
				>
					{#snippet onder(sluit)}
						<button
							type="button"
							role="menuitem"
							class="tekstmenu__item"
							onclick={() => {
								sluit();
								onOpenFilter();
							}}>Kies bronnen en verbindingen</button
						>
					{/snippet}
				</TekstMenu>
			</div>
			<!-- Articles are switched with their wet, under Groepering (Thijs, 9 Oct). -->
			{#each FILTER_GROUPS.filter((b) => b !== 'artikelen') as k (k)}
				{@const n = totals[k] ?? 0}
				{@const groepen = metGroepUit(k)}
				<FilterOptie
					label={kindLabel(k)}
					title={groepen
						? `Aan met ${groepen.map((g) => GROUP_LABEL[g]).join(' en ')}`
						: kindTitle(k)}
					wrap
					on={isOn(k)}
					onToggle={() =>
						groepen
							? groepen.forEach((g) => onToggleGroup?.(g))
							: onFilter(toggleFilterGroup(filter, k))}
					count={n}
					empty={n === 0}
					gedimd={!!groepen}
				>
					{#snippet voor()}<KindGlyph vorm={FILTER_GROUP_VORM[k]} size={11} />{/snippet}
				</FilterOptie>
			{/each}
		</section>

		{#if uitsnede.length}
			<!-- The focus's direct neighbours the network shows, of those there are. -->
			<section class="block">
				<h3 class="block__title">Getoond</h3>
				<ul class="uitsnede">
					{#each uitsnede as b (b.collection)}
						<li>
							<KindGlyph collection={b.collection as Collection} size={11} /><span
								class="uitsnede__soort">{BRON_LABEL[b.collection as Collection][1]}</span
							><span class="uitsnede__aantal"
								>{formatCount(b.kept)}
								<span class="uitsnede__van">van {formatCount(b.total)}</span></span
							>{#if onLaadSoort}<span class="uitsnede__laad"
									>{#if laadtSoort.has(b.collection)}<span class="stil">Laden…</span
										>{:else}<TekstLink
											onclick={() => onLaadSoort(b.collection as Collection)}
											aria-label="Alle {formatCount(b.total)} {BRON_LABEL[
												b.collection as Collection
											][1].toLowerCase()} laden">Alle laden</TekstLink
										>{/if}</span
								>{/if}
						</li>
					{/each}
				</ul>
				<!-- What the link loads, the API's cap in its words where the whole is more; once
				     loaded and still cut, the cap as a label (UX-toets 0.79.44, #43). -->
				{#if onAllesLaden}
					<p class="uitsnede__actie">
						<TekstLink onclick={onAllesLaden}
							>{allesGrens && uitsnedeTotaal > allesGrens.grens
								? `${formatCount(allesGrens.grens)} van ${formatCount(uitsnedeTotaal)} laden`
								: `Alle ${formatCount(uitsnedeTotaal)} laden`}</TekstLink
						>
					</p>
				{:else if allesGrens?.geladen}
					<p class="uitsnede__actie stil">Grens bereikt: {formatCount(allesGrens.grens)}</p>
				{/if}
			</section>
		{/if}

		<section class="block">
			<h3 class="block__title">Groepering</h3>
			{#each Object.keys(GROUP_LABEL) as ck (ck)}
				{@const kind = ck as ContainerKind}
				<FilterOptie
					label={GROUP_LABEL[kind]}
					title={`${GROUP_LABEL[kind]}: ${CONTAINER_KIND_HINT[kind]}${kind === 'instrument' ? '; uit verbergt ook de artikelen' : ''}`}
					on={kind === 'instrument' ? isOn('artikelen') : !hiddenGroups.has(kind)}
					count={kind === 'instrument' ? (totals.artikelen ?? 0) : null}
					onToggle={() =>
						kind === 'instrument'
							? onFilter(toggleFilterGroup(filter, 'artikelen'))
							: onToggleGroup?.(kind)}
				>
					<!-- As on the canvas: the colour of the group and its own line. -->
					{#snippet voor()}<svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
							<rect
								x="1"
								y="1"
								width="20"
								height="10"
								rx="5"
								fill={hullColorFor(kind)}
								fill-opacity="0.08"
								stroke={hullColorFor(kind)}
								stroke-width="1.5"
								stroke-dasharray={hullDashFor(kind)}
							/>
						</svg>{/snippet}
				</FilterOptie>
			{/each}
		</section>

		{#if relations.length > 0}
			<section class="block">
				<h3 class="block__title">Verbindingen</h3>
				{#each relations as r (r.relation)}
					{@const rel = r.relation as Relation}
					{@const on = !hiddenRelations.has(rel)}
					<FilterOptie label={r.label} {on} onToggle={() => onToggleRelation(rel)} count={r.count}>
						{#snippet voor()}
							<!-- As thick as on the canvas at the default zoom, with its arrowhead. -->
							{@const dik = Math.max(lijnDikte(EDGE_WEIGHT[rel]), 1.4)}
							{@const kop = dik * pijlLengte()}
							<svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"
								><line
									x1="1"
									y1="6"
									x2={27 - kop}
									y2="6"
									stroke={edgeColorFor(rel, sourceKind(rel))}
									stroke-width={dik}
									stroke-dasharray={dash(rel)}
								/><polygon
									points="{27 - kop},{6 - (kop * PIJL_BREED) / 2} 27,6 {27 - kop},{6 +
										(kop * PIJL_BREED) / 2}"
									fill={edgeColorFor(rel, sourceKind(rel))}
								/></svg
							>{/snippet}
					</FilterOptie>
				{/each}
			</section>
		{/if}

		<section class="block">
			<!-- The label says what the buttons do; the rest in a title (Thijs, 9 Oct: what the
			     interface makes clear is not written out under it). -->
			<div
				class="block__label"
				title={netwerkActive
					? 'De verbonden bronnen van de gekozen bron erbij; het netwerk blijft'
					: `Stappen vanaf de bron, per stap hooguit ${grens} bronnen`}
			>
				{netwerkActive ? 'Verbonden bronnen' : 'Aantal stappen'}
			</div>
			<Keuze
				label={netwerkActive ? 'Verbonden bronnen' : 'Aantal stappen'}
				waarde={netwerkActive ? null : String(depth)}
				opties={DEPTHS.map((d) => {
					const reden =
						netwerkActive && !selectionCollection
							? NO_SELECTION_REASON
							: beyondCap(d)
								? CAPPED_REASON
								: null;
					return { waarde: String(d), label: String(d), uit: !!reden, titel: reden ?? undefined };
				})}
				onSelect={(d) => onDepth(Number(d))}
			/>
		</section>

		{#if lids.length > 0}
			<section class="block">
				<div class="block__label">Lid</div>
				<TekstMenu
					label="Lid"
					waarde={filter.lid ?? ''}
					opties={[
						{ waarde: '', label: 'Alle leden' },
						...lids.map((lid) => ({ waarde: lid, label: `Lid ${lid}` })),
						{ waarde: 'geen', label: 'Lid niet genoemd' }
					]}
					onSelect={(v) => onFilter({ ...filter, lid: v === '' ? null : v })}
				/>
			</section>
		{/if}

		<section class="block">
			<div class="block__label">Toon erbij</div>
			<div class="block">
				<TekstMenu
					label="Toon erbij"
					waarde={mutOn ? 'mut' : heatOn ? 'heat' : 'geen'}
					opties={[
						{ waarde: 'geen', label: 'Geen' },
						{
							waarde: 'mut',
							label: `Openstaande dossiers${mutOn && inFluxCount > 0 ? ` (${inFluxCount})` : ''}`,
							uit: !onToggleMutatie,
							titel: 'Een ring om de bronnen die een wetsvoorstel wil wijzigen'
						},
						{
							waarde: 'heat',
							label: 'Verwijzingen per maand',
							uit: !onToggleHeat,
							titel: 'Hoe vaak een bron in de gekozen periode is aangehaald'
						}
					]}
					onSelect={(w) => {
						if (w === 'geen') {
							if (mutOn) onToggleMutatie?.();
							else if (heatOn) onToggleHeat?.();
						} else if (w === 'mut') {
							if (heatOn) onToggleHeat?.();
							if (!mutOn) onToggleMutatie?.();
						} else {
							if (mutOn) onToggleMutatie?.();
							if (!heatOn) onToggleHeat?.();
						}
					}}
				/>
				{#if heatOn}
					<div class="sub">
						<Keuze
							label="Periode"
							waarde={overlay.kind === 'heat' ? String(overlay.months) : null}
							opties={HEAT_PERIODS.map((m) => ({
								waarde: String(m),
								label: `${m} maanden`,
								uit: !onHeatPeriodChange
							}))}
							onSelect={(m) => onHeatPeriodChange?.(Number(m))}
						/>
					</div>
				{/if}
			</div>
		</section>
	{/if}
</aside>

<style>
	.legend {
		width: 250px;
		flex-shrink: 0;
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) var(--s-4);
		border-right: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}
	.block__head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		margin-bottom: var(--s-1);
	}
	.block__title {
		flex: 1;
		margin: 0 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.uitsnede {
		list-style: none;
		margin: 0;
		padding: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.uitsnede li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0 var(--s-2);
		padding: 2px 0;
	}
	.uitsnede__aantal {
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}
	/* "Alle laden" on its own line under the count, at every width: beside it, it squeezed
	   the kind's name into the count (Thijs, 11 Oct, variant A). */
	.uitsnede__laad {
		grid-column: 3;
		justify-self: end;
		font-size: var(--t-micro);
	}
	.uitsnede__actie {
		margin: var(--s-1) 0 0;
		font-size: var(--t-meta);
	}
	.uitsnede__van {
		color: var(--ink-3);
	}
	.block__head .block__title {
		margin: 0;
	}
	.block__label {
		display: flex;
		justify-content: space-between;
		margin-bottom: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.empty {
		margin: 0;
	}
	/* One line that says what a control does, or why it is off. */
	.sub {
		margin-top: var(--s-2);
	}
</style>
