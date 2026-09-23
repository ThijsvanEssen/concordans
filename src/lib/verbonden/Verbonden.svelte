<script lang="ts">
	// The panel Verbonden: the verbindingen of the selected bron, in the groups of the
	// table in groups.ts, under the bronfilter. In the network each group can put its
	// bronnen on the canvas or take them off.
	import { page } from '$app/state';
	import { bronHref, refId } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import type { GraphStore } from '$lib/graph/graph-store';
	import type { CanvasRow } from '$lib/graph/store/types';
	import type { GraphNode } from '$lib/graph/types';
	import { anchorLabel } from '$lib/text/qualifier';
	import {
		BRON_KIND_LABEL,
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
	import { download, rowsToCsv, rowsToText } from './export';
	import { metaParts, type Row } from './rows';
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
		tableHref
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
	} = $props();

	const PREVIEW = 3;

	let grouping = $state<Grouping>('soort');
	let expanded = $state(new Set<string>());
	let openRow = $state<string | null>(null);
	let menu = $state<'bronnen' | 'grouping' | null>(null);
	let copied = $state(false);

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

	const openLabel = (g: Group, row: Row) =>
		g.inPlace
			? 'Open naast het artikel'
			: row.position
				? `Open bij ${row.position}`
				: row.at
					? `Open bij ${anchorLabel(row.at)}`
					: 'Open de bron';

	/** The passage with the cited phrase marked. */
	function passage(row: Row): { before: string; mark: string; after: string } | null {
		if (!row.snippet) return null;
		const i = row.match ? row.snippet.indexOf(row.match) : -1;
		if (i < 0) return { before: row.snippet, mark: '', after: '' };
		return {
			before: row.snippet.slice(0, i),
			mark: row.match!,
			after: row.snippet.slice(i + row.match!.length)
		};
	}

	const years = (g: Group) =>
		grouping === 'soort' && g.rows[0]?.kind === 'uitspraken' && g.rows.length > 5
			? yearHistogram(g.rows)
			: [];

	function chooseYear(year: number) {
		onFilter({ ...filter, jaar: filter.jaar === year ? null : year });
	}

	async function copyAll() {
		try {
			await navigator.clipboard.writeText(rowsToText(allRows(shown)));
			copied = true;
			setTimeout(() => (copied = false), 1000);
		} catch {
			// The clipboard is unavailable in some contexts.
		}
	}

	function exportCsv() {
		download(
			`verbindingen-${selection.key}.csv`,
			rowsToCsv(allRows(shown), selection.collection, page.url.origin)
		);
	}

	const inNetworkHref = (row: Row) => bronHref(row.ref, { keepMode: false, mode: 'graph' });
</script>

<svelte:window onclick={() => (menu = null)} />

<aside class="verbonden" aria-label="Verbonden">
	<div class="head">
		<h2 class="head__title">Verbonden</h2>
		{#if verbonden.groups.length > 0}
			<span class="head__count">{countLine(verbonden.groups, filter)}</span>
		{/if}
		<span class="head__space"></span>
		<div class="menu" onclick={(e) => e.stopPropagation()} role="presentation">
			<button
				type="button"
				class="btn is-text"
				aria-haspopup="menu"
				aria-expanded={menu === 'bronnen'}
				onclick={() => (menu = menu === 'bronnen' ? null : 'bronnen')}
				>{bronnenLabel(filter)} <span class="caret" aria-hidden="true">▾</span></button
			>
			{#if menu === 'bronnen'}
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
								menu = null;
							}}>{p.label}</button
						>
					{/each}
					<button
						type="button"
						role="menuitem"
						class="menu__item menu__item--more"
						onclick={() => {
							menu = null;
							onOpenFilter();
						}}>Kies bronnen en verbindingen</button
					>
				</div>
			{/if}
		</div>
		<div class="menu" onclick={(e) => e.stopPropagation()} role="presentation">
			<button
				type="button"
				class="btn is-text"
				aria-haspopup="menu"
				aria-expanded={menu === 'grouping'}
				onclick={() => (menu = menu === 'grouping' ? null : 'grouping')}
				>{GROUPINGS.find((g) => g.id === grouping)?.label}
				<span class="caret" aria-hidden="true">▾</span></button
			>
			{#if menu === 'grouping'}
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
								menu = null;
							}}>{g.label}</button
						>
					{/each}
				</div>
			{/if}
		</div>
		<button type="button" class="btn is-text" onclick={onOpenFilter}>Filter</button>
	</div>

	<div class="body">
		{#if verbonden.failed}
			<p class="note">Verbindingen niet geladen.</p>
		{:else if verbonden.loading && verbonden.groups.length === 0}
			<p class="note">Laden</p>
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
							onclick={() => toggleLayer(g)}>{isLayerOn(g) ? '✓' : ''}</button
						>
					{/if}
				</div>
				{#if bars.length > 0}
					<div class="group__years">
						<span class="group__years-edge">{bars[0].year}</span>
						<svg
							class="years"
							width={bars.length * 8}
							height="16"
							viewBox="0 0 {bars.length * 8} 16"
							role="img"
							aria-label="Uitspraken per jaar, {bars[0].year} tot {bars.at(-1)?.year}"
						>
							{#each bars as b, j (b.year)}
								{@const max = Math.max(...bars.map((x) => x.count), 1)}
								{@const h = b.count ? Math.max(2, Math.round((b.count / max) * 16)) : 0}
								<rect
									x={j * 8}
									y={16 - h}
									width="6"
									height={h}
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
									aria-label="{b.year}: {b.count}"><title>{b.year}: {b.count}</title></rect
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
								onclick={() => onFilter(withPreset(filter, PRESETS[4]))}>Alleen Hoge Raad</button
							>
						</p>
					{/if}
				{/if}
				<ul class="rows">
					{#each all ? g.rows : g.rows.slice(0, PREVIEW) as row (rowId(row))}
						{@const id = rowId(row)}
						{@const open = openRow === id}
						{@const p = open ? passage(row) : null}
						<li class="row" class:is-open={open}>
							<div
								class="row__main"
								role="button"
								tabindex="0"
								aria-expanded={open}
								onclick={() => (openRow = open ? null : id)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										openRow = open ? null : id;
									}
								}}
							>
								<KindGlyph collection={row.ref.collection} size={11} />
								<span class="row__text">
									<a
										class="row__title"
										href={openHref(g, row)}
										data-sveltekit-noscroll
										onclick={(e) => e.stopPropagation()}>{row.title}</a
									>
									<span class="row__meta">
										{#each metaParts(row) as part, k (k)}
											{#if k > 0}<span class="row__sep" aria-hidden="true"> · </span>{/if}
											<span class="row__part row__part--{part.kind}">{part.text}</span>
										{/each}
										{#if row.proposed && onProposedText}
											<span class="row__sep" aria-hidden="true"> · </span>
											<button
												type="button"
												class="link"
												onclick={(e) => {
													e.stopPropagation();
													onProposedText(row);
												}}>toon voorgestelde tekst</button
											>
										{/if}
									</span>
								</span>
							</div>
							{#if open}
								<div class="row__open">
									{#if p}
										{#if row.position}<p class="row__where">{row.position}</p>{/if}
										<p class="row__passage">
											{p.before}{#if p.mark}<mark>{p.mark}</mark>{/if}{p.after}
										</p>
									{/if}
									<div class="row__links">
										<a href={openHref(g, row)} data-sveltekit-noscroll class="link is-accent"
											>{openLabel(g, row)}</a
										>
										{#if row.relation}
											{#if onShowInNetwork}
												<button type="button" class="link" onclick={() => onShowInNetwork(row)}
													>Toon in het netwerk</button
												>
											{:else}
												<a href={inNetworkHref(row)} class="link">Toon in het netwerk</a>
											{/if}
											<button type="button" class="link" onclick={() => onVerbinding(row)}
												>Over deze verbinding</button
											>
										{/if}
									</div>
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
				{hidden
					.map((h) => `${formatCount(h.count)} ${BRON_KIND_LABEL[h.kind].toLowerCase()}`)
					.join(', ')} verborgen.
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
					>{copied ? 'Gekopieerd' : 'Verzamel'}</button
				>
				<button type="button" class="link" onclick={exportCsv}>Exporteer</button>
			</div>
		{/if}
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
		font-size: 17px;
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
		padding: 6px 12px;
		border: 0;
		background: none;
		font: inherit;
		font-size: 12.5px;
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
		margin-top: 4px;
		border-top: 1px solid var(--rule);
		padding-top: 8px;
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
		margin-top: 8px;
		border-top: 1px solid var(--rule);
	}
	.section {
		margin: var(--s-4) 0 0;
		padding: 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: 13px;
		font-weight: 500;
		font-style: italic;
		color: var(--ink-3);
	}
	.group__head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 16px var(--s-4) 4px;
	}
	.group__label {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 15px;
		font-weight: 500;
		color: var(--ink);
	}
	.group__count {
		color: var(--ink-3);
	}
	.layer {
		width: 14px;
		height: 14px;
		margin-left: auto;
		align-self: center;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: none;
		font-size: 10px;
		line-height: 1;
		color: var(--paper);
		cursor: pointer;
		flex: none;
	}
	.layer.is-on {
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
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	.years {
		flex: none;
	}
	.years rect {
		fill: var(--rule-strong);
		cursor: pointer;
	}
	.years rect:hover {
		fill: var(--ink-3);
	}
	.years rect.is-active {
		fill: var(--accent);
	}
	.group__caption {
		margin: 0;
		padding: 0 var(--s-4) 4px;
		font-size: 11.5px;
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
		padding: 8px var(--s-4);
		cursor: pointer;
	}
	.row__main :global(.kind-glyph) {
		margin-top: 4px;
	}
	.row__main:hover,
	.row__main:focus-visible {
		background: var(--paper-2);
		outline: none;
	}
	.row.is-open .row__main {
		background: var(--accent-soft);
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
		margin: 0 var(--s-4) 10px calc(var(--s-4) + 21px);
		padding: 12px 14px;
		border-left: 2px solid var(--rule-strong);
	}
	.row__where {
		margin: 0 0 6px;
		font-size: 11.5px;
		color: var(--ink-3);
	}
	.row__passage {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 14.5px;
		line-height: 1.5;
		color: var(--ink);
	}
	.row__passage mark {
		background: var(--accent-soft);
		color: inherit;
	}
	.row__links {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		margin-top: 10px;
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
		gap: 16px;
		padding: 18px var(--s-4) 20px;
		font-size: 12.5px;
	}
</style>
