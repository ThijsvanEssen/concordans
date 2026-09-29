<script lang="ts">
	import RowOpen from './RowOpen.svelte';
	import { isEscape } from '$lib/actions/keys';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	// The panel Verbonden: the verbindingen of the selected bron, in the groups of the
	// table in groups.ts, under the bronfilter. In the network each group can put its
	// bronnen on the canvas or take them off.
	import { menu } from '$lib/actions/menu';
	import { onControl } from '$lib/actions/outside';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getCoverage, type Coverage } from '$lib/api/stats';
	import { coverageFor } from './coverage';
	import { bronHref, refId } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import type { GraphStore } from '$lib/graph/graph-store';
	import type { CanvasRow } from '$lib/graph/store/types';
	import type { GraphNode } from '$lib/graph/types';
	import {
		kindCount,
		BRON_KIND_NOUN,
		PRESETS,
		activePreset,
		bronnenLabel,
		formatCount,
		withKind,
		withPreset,
		type VerbondenFilter
	} from './filter';
	import { countLabel, groupCount, type Group } from './groups';
	import { csvName, download, rowsToCsv, rowsToText } from './export';
	import {
		caseNumberOf,
		longDate,
		mentionRows,
		metaParts,
		openLabelOf,
		repeatedTitles,
		type Row
	} from './rows';
	import type { VerbondenState } from './source';
	import {
		GROUPINGS,
		allRows,
		countLine,
		filterGroups,
		hiddenLine,
		regroup,
		totalCount,
		yearHistogram,
		type Grouping
	} from './view';

	let {
		verbonden,
		selection,
		filter,
		store,
		network = false,
		onFilter,
		onOpenFilter,
		onVerbinding,
		onShowInNetwork,
		onProposedText,
		tableHref,
		onRetry
	}: {
		verbonden: VerbondenState;
		selection: GraphNode;
		filter: VerbondenFilter;
		store: GraphStore;
		/** The canvas is on screen: groups carry their layer control. */
		network?: boolean;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		/** Opens the card Verbinding for a row. */
		onVerbinding: (row: Row) => void;
		onShowInNetwork?: (row: Row) => void;
		/** A wetsvoorstel row: show the proposed wording next to the current text. */
		onProposedText?: (row: Row) => void;
		tableHref: string;
		/** Loads the verbindingen again after a failed load; without it no Opnieuw is offered. */
		onRetry?: () => void;
	} = $props();

	const PREVIEW = 3;

	let grouping = $state<Grouping>('soort');
	let expanded = $state(new Set<string>());
	let openRow = $state<string | null>(null);
	let openMenu = $state<'bronnen' | 'grouping' | null>(null);
	/** What Verzamel did, for the button and the live region. */

	let onCanvas = $state(new Set<string>());
	$effect(() => store.nodes.subscribe((ns) => (onCanvas = new Set(ns.map((n) => n.id)))));

	// A new bron starts closed.
	$effect(() => {
		void verbonden.id;
		expanded = new Set();
		openRow = null;
	});

	const filtered = $derived(filterGroups(verbonden.groups, filter));
	const shown = $derived(regroup(filtered, grouping, selection.collection));
	const hidden = $derived(hiddenLine(verbonden.groups, filter));
	const total = $derived(totalCount(verbonden.groups));

	const rowId = (row: Row) => `${refId(row.ref)}#${row.at ?? ''}`;

	function toggle(set: Set<string>, id: string) {
		const next = new Set(set);
		if (!next.delete(id)) next.add(id);
		return next;
	}

	const drawable = (rows: Row[]) => rows.filter((r) => r.relation && r.direction);
	const isLayerOn = (g: Group) => {
		const rows = drawable(g.rows);
		return rows.length > 0 && rows.every((r) => onCanvas.has(refId(r.ref)));
	};

	function toggleLayer(g: Group) {
		const rows = drawable(g.rows);
		if (isLayerOn(g)) store.hideRows(rows.map((r) => refId(r.ref)));
		else store.showRows(selection.id, rows as CanvasRow[]);
	}

	// A row of an in-place group opens beside the selected bron, which stays selected.
	function inPlaceHref(row: Row) {
		const url = new URL(page.url);
		url.searchParams.set('naast', refId(row.ref));
		url.hash = row.at ?? '';
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/').replaceAll('%2C', ',')}${url.hash}`;
	}

	const openHref = (g: Group, row: Row) =>
		g.inPlace ? inPlaceHref(row) : bronHref(row.ref, { at: row.at });

	const years = (g: Group) =>
		grouping === 'soort' && g.rows[0]?.kind === 'uitspraken' && g.rows.length > 5
			? yearHistogram(g.rows)
			: [];

	function chooseYear(year: number) {
		onFilter({ ...filter, jaar: filter.jaar === year ? null : year });
	}

	const copier = createCopier();
	const copyAll = () => copier.copy(rowsToText(allRows(shown)), 'all');

	function exportCsv() {
		download(
			csvName(selection.label, selection.key),
			rowsToCsv(mentionRows(allRows(shown)), selection.collection, page.url.origin)
		);
	}

	const inNetworkHref = (row: Row) => bronHref(row.ref, { keepMode: false, mode: 'graph' });

	// Under a short list of judgments: how many the network holds of the rechter the
	// filter names, and since when, so that a small number reads as a property of the
	// selection, not of the case law. Only the first such list carries the line.
	const FEW = 50;
	const coverageGroup = $derived(
		shown.find((g) => g.noun === 'uitspraken' && groupCount(g) < FEW)?.id ?? null
	);
	let coverage = $state<Coverage | null>(null);
	onMount(() => {
		getCoverage()
			.then((c) => (coverage = c))
			.catch(() => {});
	});
	const span = $derived(coverage ? coverageFor(coverage, filter.rechter) : null);

	// Escape closes the row opened under itself.
	function onKey(e: KeyboardEvent) {
		if (openRow && isEscape(e)) {
			e.preventDefault();
			openRow = null;
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<aside class="verbonden" aria-label="Verbonden">
	<div class="head">
		<h2 class="head__title">Verbonden</h2>
		{#if verbonden.groups.length > 0}
			<span class="head__count">{countLine(verbonden.groups, filter)}</span>
		{/if}
		<span class="head__space"></span>
		<div class="menu" use:menu={{ open: openMenu === 'bronnen', close: () => (openMenu = null) }}>
			<button
				type="button"
				class="btn is-text"
				aria-haspopup="menu"
				aria-expanded={openMenu === 'bronnen'}
				onclick={() => (openMenu = openMenu === 'bronnen' ? null : 'bronnen')}
				>{bronnenLabel(filter)}<Caret open={openMenu === 'bronnen'} /></button
			>
			{#if openMenu === 'bronnen'}
				<div class="menu__list" role="menu">
					{#each PRESETS as p (p.id)}
						<button
							type="button"
							role="menuitemradio"
							aria-checked={activePreset(filter)?.id === p.id}
							class="menu__item"
							class:is-active={activePreset(filter)?.id === p.id}
							onclick={() => {
								onFilter(withPreset(filter, p));
								openMenu = null;
							}}>{p.label}</button
						>
					{/each}
					<button
						type="button"
						role="menuitem"
						class="menu__item menu__item--more"
						onclick={() => {
							openMenu = null;
							onOpenFilter();
						}}>Kies bronnen en verbindingen</button
					>
				</div>
			{/if}
		</div>
		<div class="menu" use:menu={{ open: openMenu === 'grouping', close: () => (openMenu = null) }}>
			<button
				type="button"
				class="btn is-text"
				aria-haspopup="menu"
				aria-expanded={openMenu === 'grouping'}
				onclick={() => (openMenu = openMenu === 'grouping' ? null : 'grouping')}
				>{GROUPINGS.find((g) => g.id === grouping)?.label}<Caret
					open={openMenu === 'grouping'}
				/></button
			>
			{#if openMenu === 'grouping'}
				<div class="menu__list" role="menu">
					{#each GROUPINGS as g (g.id)}
						<button
							type="button"
							role="menuitemradio"
							aria-checked={grouping === g.id}
							class="menu__item"
							class:is-active={grouping === g.id}
							onclick={() => {
								grouping = g.id;
								openMenu = null;
							}}>{g.label}</button
						>
					{/each}
				</div>
			{/if}
		</div>
		<button type="button" class="btn is-text" onclick={onOpenFilter}>Filter</button>
	</div>

	<div class="body" aria-busy={verbonden.loading}>
		{#if verbonden.failed}
			<p class="note">
				Verbindingen niet geladen.
				{#if onRetry}
					<button type="button" class="link is-accent" onclick={onRetry}>Opnieuw</button>
				{/if}
			</p>
		{:else if verbonden.loading && verbonden.groups.length === 0}
			<p class="note">Laden…</p>
		{/if}

		{#each shown as g, i (g.id)}
			{@const all = expanded.has(g.id)}
			{@const bars = years(g)}
			{@const count = groupCount(g)}
			{#if g.section && g.section !== shown[i - 1]?.section}
				<h3 class="section">{g.section}</h3>
			{/if}
			<section class="group">
				<div class="group__head">
					<h3 class="group__label">{g.label}</h3>
					<span class="group__count">{countLabel(g)}</span>
					{#if network && drawable(g.rows).length > 0}
						<button
							type="button"
							class="layer"
							class:is-on={isLayerOn(g)}
							role="checkbox"
							aria-checked={isLayerOn(g)}
							aria-label="{g.label} op het doek"
							title={isLayerOn(g) ? 'Van het doek halen' : 'Op het doek zetten'}
							onclick={() => toggleLayer(g)}
							><span class="layer__box" aria-hidden="true">{isLayerOn(g) ? '✓' : ''}</span>op doek</button
						>
					{/if}
				</div>
				{#if bars.length > 0}
					<div class="group__years">
						<span class="group__years-edge">{bars[0].year}</span>
						<!-- The bars are 16 high; each year takes the full 24 of the drawing and its
						     8 of width as its target, so the pointer need not hit the bar. -->
						<svg
							class="years"
							width={bars.length * 8}
							height="24"
							viewBox="0 0 {bars.length * 8} 24"
							role="group"
							aria-label="Uitspraken per jaar, {bars[0].year} tot {bars.at(-1)?.year}"
						>
							{#each bars as b, j (b.year)}
								{@const max = Math.max(...bars.map((x) => x.count), 1)}
								{@const h = b.count ? Math.max(2, Math.round((b.count / max) * 16)) : 0}
								<g
									class="year"
									class:is-active={filter.jaar === b.year}
									onclick={() => chooseYear(b.year)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											chooseYear(b.year);
										}
									}}
									role="button"
									tabindex="0"
									aria-pressed={filter.jaar === b.year}
									aria-label="{b.year}: {b.count}"
									><title>{b.year}: {b.count}</title><rect
										class="year__hit"
										x={j * 8}
										y="0"
										width="8"
										height="24"
									/><rect class="year__bar" x={j * 8} y={20 - h} width="6" height={h} /></g
								>
							{/each}
						</svg>
						<span class="group__years-edge">{bars.at(-1)?.year}</span>
					</div>
					{#if filter.jaar}
						<p class="group__caption">
							<button type="button" class="link" onclick={() => chooseYear(filter.jaar!)}
								>Alle jaren</button
							>
						</p>
					{:else if !filter.rechter}
						<p class="group__caption">
							<button
								type="button"
								class="link"
								onclick={() => onFilter({ ...filter, rechter: 'hr' })}>Alleen Hoge Raad</button
							>
						</p>
					{/if}
				{/if}
				<ul class="rows">
					{#each all ? g.rows : g.rows.slice(0, PREVIEW) as row (rowId(row))}
						{@const id = rowId(row)}
						{@const sister = repeatedTitles(g.rows).has(row.title) ? caseNumberOf(row) : null}
						{@const open = openRow === id}
						<li class="row" class:is-open={open}>
							<!-- A click beside the title opens the row too, for the mouse; the
							     keyboard has the toggle at the end of the row. -->
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<div
								class="row__main"
								onclick={(e) => {
									if (!onControl(e) && !row.missing) openRow = open ? null : id;
								}}
							>
								<KindGlyph collection={row.ref.collection} size={11} />
								<span class="row__text">
									{#if row.missing}
										<span class="row__title row__title--missing">{row.title}</span>
									{:else}
										<a class="row__title" href={openHref(g, row)} data-sveltekit-noscroll
											>{row.title}{#if sister}<span class="row__case">, {sister}</span>{/if}</a
										>
									{/if}
									<span class="row__meta">
										{#each metaParts(row) as part, k (k)}
											{#if k > 0}<span class="row__sep" aria-hidden="true"> · </span>{/if}
											<span class="row__part row__part--{part.kind}">{part.text}</span>
										{/each}
										{#if row.proposed && onProposedText}
											<span class="row__sep" aria-hidden="true"> · </span>
											<button type="button" class="link" onclick={() => onProposedText(row)}
												>toon voorgestelde tekst</button
											>
										{/if}
									</span>
								</span>
								{#if !row.missing}
									<button
										type="button"
										class="row__toggle"
										aria-expanded={open}
										aria-controls="open-{id}"
										aria-label={open ? 'Verberg passage' : 'Toon passage'}
										onclick={() => (openRow = open ? null : id)}><Caret {open} /></button
									>
								{/if}
							</div>
							{#if open}
								<div class="row__open" id="open-{id}">
									<RowOpen
										{row}
										openHref={openHref(g, row)}
										openLabel={openLabelOf(row, g.inPlace)}
										networkHref={inNetworkHref(row)}
										{onShowInNetwork}
										{onVerbinding}
									/>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
				{#if g.rows.length > PREVIEW}
					<button
						type="button"
						class="group__more"
						onclick={() => (expanded = toggle(expanded, g.id))}
					>
						{all ? 'Minder' : `Alle ${formatCount(count)} ${g.noun ?? 'verbindingen'}`}
					</button>
				{/if}
				{#if all && count > g.rows.length}
					<p class="group__caption">
						{formatCount(g.rows.length)} van {formatCount(count)} geladen.
						<a href={tableHref} class="link">Alle in een tabel</a>
					</p>
				{/if}
				{#if span && g.id === coverageGroup}
					<p class="group__caption">
						Het netwerk bevat {formatCount(span.count)}
						{span.of}{#if span.first && span.last}, van {span.first.slice(0, 4)} tot {longDate(
								span.last
							)}{/if}.
						<a href="/docs#dekking" class="link">Dekking</a>
					</p>
				{/if}
			</section>
		{/each}

		{#if !verbonden.loading && !verbonden.failed && shown.length === 0 && verbonden.groups.length > 0}
			<p class="note">Geen verbindingen binnen de gekozen bronnen en filters.</p>
		{/if}
		{#if !verbonden.loading && !verbonden.failed && verbonden.groups.length === 0 && verbonden.id}
			<p class="note">Geen verbindingen bekend voor deze bron.</p>
		{/if}

		{#if hidden.length > 0}
			<p class="hidden">
				{hidden.map((h) => kindCount(h.count, h.kind)).join(', ')} verborgen.
				{#each hidden as h, k (h.kind)}
					{#if k > 0}<span aria-hidden="true"> · </span>{/if}
					<button
						type="button"
						class="link is-accent"
						onclick={() => onFilter(withKind(filter, h.kind))}
						>Toon ook {BRON_KIND_NOUN[h.kind]}</button
					>
				{/each}
			</p>
		{/if}

		{#if verbonden.groups.length > 0}
			<div class="foot">
				<a href={tableHref} class="link is-accent" data-sveltekit-noscroll
					>Alle {formatCount(total)} in een tabel</a
				>
				<button type="button" class="link" onclick={copyAll}
					>{copier.label('all', 'Verzamel')}</button
				>
				<button type="button" class="link" onclick={exportCsv}>Exporteer</button>
			</div>
		{/if}
		<p class="sr-only" aria-live="polite">{copier.announcement}</p>
	</div>
</aside>

<style>
	.verbonden {
		display: flex;
		flex-direction: column;
		height: 100%;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
	}
	.head {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 6px;
		padding: 18px var(--s-4) 10px;
		border-bottom: 1px solid var(--rule);
	}
	.head__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 500;
		color: var(--ink);
	}
	.head__count {
		color: var(--ink-3);
	}
	.head__space {
		flex: 1;
	}
	.menu {
		position: relative;
	}
	.menu__list {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: var(--z-float);
		min-width: 200px;
		padding: 6px 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
	}
	.menu__item {
		display: block;
		width: 100%;
		padding: 6px var(--s-3);
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.menu__item:hover {
		background: var(--paper-2);
	}
	.menu__item.is-active {
		font-weight: 600;
	}
	.menu__item--more {
		margin-top: var(--s-1);
		border-top: 1px solid var(--rule);
		padding-top: var(--s-2);
		color: var(--ink-2);
	}
	.body {
		flex: 1;
		overflow-y: auto;
		padding-bottom: var(--s-6);
	}
	.note,
	.hidden {
		margin: 0;
		padding: 14px var(--s-4);
		color: var(--ink-3);
		line-height: 1.4;
	}
	.hidden {
		margin-top: var(--s-2);
		border-top: 1px solid var(--rule);
	}
	.section {
		margin: var(--s-4) 0 0;
		padding: 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 500;
		font-style: italic;
		color: var(--ink-3);
	}
	.group__head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: var(--s-4) var(--s-4) var(--s-1);
	}
	.group__label {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		color: var(--ink);
	}
	.group__count {
		color: var(--ink-3);
	}
	/* Whether the group is drawn on the canvas, said in words beside its box. */
	.layer {
		position: relative;
		margin-left: auto;
		align-self: center;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
		white-space: nowrap;
	}
	.layer::before {
		content: '';
		position: absolute;
		inset: -5px;
	}
	.layer:hover {
		color: var(--ink-2);
	}
	.layer__box {
		width: 12px;
		height: 12px;
		display: grid;
		place-items: center;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: var(--t-glyph);
		line-height: 1;
		color: var(--paper);
	}
	.layer.is-on {
		color: var(--ink);
	}
	.layer.is-on .layer__box {
		background: var(--ink);
		border-color: var(--ink);
	}
	.group__years {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 var(--s-4) 2px;
		overflow-x: auto;
	}
	.group__years-edge {
		flex: none;
		font-size: var(--t-label);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	.years {
		flex: none;
		margin: -4px 0;
	}
	.year {
		cursor: pointer;
		outline: none;
	}
	.year__hit {
		fill: transparent;
	}
	.year__bar {
		fill: var(--rule-strong);
	}
	.year:hover .year__bar {
		fill: var(--ink-3);
	}
	.year:focus-visible .year__hit {
		fill: var(--accent-soft);
	}
	.year.is-active .year__bar {
		fill: var(--accent);
	}
	.group__caption {
		margin: 0;
		padding: 0 var(--s-4) var(--s-1);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row__main {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: var(--s-2) var(--s-4);
		cursor: pointer;
	}
	.row__main :global(.kind-glyph) {
		margin-top: var(--s-1);
	}
	.row__main:hover,
	.row__main:focus-within {
		background: var(--paper-2);
	}
	.row.is-open .row__main {
		background: var(--accent-soft);
	}
	.row__toggle {
		flex: none;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		margin: -2px -6px 0 0;
		padding: 0;
		border: 0;
		border-radius: var(--r-1);
		background: none;
		color: var(--ink-3);
		cursor: pointer;
	}
	.row__toggle :global(.caret) {
		margin-left: 0;
	}
	.row__toggle:hover {
		color: var(--ink);
	}
	.row__text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.row__title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.3;
		color: var(--ink);
	}
	/* A law the title names that the dataset lacks: read, not followed. */
	.row__title--missing {
		color: var(--ink-3);
	}
	/* The case number that tells sister cases apart, in the title where the eye looks. */
	.row__case {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
	}
	.row__meta {
		margin-top: 2px;
		color: var(--ink-3);
		line-height: 1.35;
	}
	.row__part--lid {
		font-weight: 500;
		color: var(--ink-2);
	}
	.row__part--proposed {
		color: var(--accent);
	}
	.row__part--derived {
		font-style: italic;
	}
	.row__open {
		margin: 0 var(--s-4) var(--s-2) calc(var(--s-4) + 21px);
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
	}
	.link:hover {
		color: var(--accent);
	}
	.link.is-accent {
		color: var(--accent);
	}
	.group__more {
		display: block;
		padding: 6px var(--s-4) 2px;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--accent);
		cursor: pointer;
	}
	.foot {
		display: flex;
		gap: var(--s-4);
		padding: 18px var(--s-4) 20px;
		font-size: var(--t-micro);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
