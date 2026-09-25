<script lang="ts">
	// All verbindingen of the selected bron as a table, under the same bronfilter:
	// bron, verbinding, plaats in de bron, plaats in dit artikel, aard, status,
	// betrouwbaarheid, datum. Fifty rows per page.
	import { menu } from '$lib/actions/menu';
	import { onControl } from '$lib/actions/outside';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { page } from '$app/state';
	import { bronHref } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { relationLabel } from '$lib/vocabulary';
	import { csvName, download, rowsToCsv } from './export';
	import { formatCount, type VerbondenFilter } from './filter';
	import { mentionRows, shortDate, type Row } from './rows';
	import type { VerbondenState } from './source';
	import { betrouwbaarheid } from './verbinding';
	import { allRows, countLine, filterGroups, mentionLine } from './view';

	let {
		verbonden,
		selection,
		filter,
		onOpenFilter,
		onRow,
		backHref,
		onRetry
	}: {
		verbonden: VerbondenState;
		selection: GraphNode;
		filter: VerbondenFilter;
		onOpenFilter: () => void;
		/** A row opens the card Verbinding. */
		onRow: (row: Row) => void;
		backHref: string;
		/** Loads the verbindingen again after a failed load; without it no Opnieuw is offered. */
		onRetry?: () => void;
	} = $props();

	type Column = {
		id: string;
		label: string;
		value: (r: Row) => string;
		sort?: (r: Row) => string | number;
	};

	const source = (r: Row) => (r.direction === 'inbound' ? r.ref.collection : selection.collection);

	const COLUMNS: Column[] = [
		{ id: 'bron', label: 'Bron', value: (r) => r.title, sort: (r) => r.title },
		{
			id: 'verbinding',
			label: 'Verbinding',
			value: (r) => (r.relation ? relationLabel(r.relation, source(r)) : ''),
			sort: (r) => (r.relation ? relationLabel(r.relation, source(r)) : '')
		},
		{
			id: 'plaats',
			label: 'Plaats in de bron',
			value: (r) => r.position ?? '',
			sort: (r) => r.position ?? ''
		},
		{
			id: 'lid',
			label: 'Plaats in dit artikel',
			value: (r) => (r.lid ? `lid ${r.lid}` : ''),
			sort: (r) => r.lid ?? 'zz'
		},
		{ id: 'aard', label: 'Aard', value: (r) => r.aard ?? '', sort: (r) => r.aard ?? '' },
		{
			id: 'status',
			label: 'Status',
			value: (r) => (r.proposed ? 'voorgesteld' : 'vastgesteld'),
			sort: (r) => (r.proposed ? 1 : 0)
		},
		{
			id: 'betrouwbaarheid',
			label: 'Betrouwbaarheid',
			value: (r) => betrouwbaarheid(r.confidence, !!r.derived, null).word,
			sort: (r) => r.confidence ?? (r.derived ? 0.5 : 1)
		},
		{
			id: 'datum',
			label: 'Datum',
			value: (r) => shortDate(r.date ?? null) ?? '',
			sort: (r) => r.date ?? ''
		}
	];

	const PAGE = 50;

	let sortBy = $state('datum');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let hiddenColumns = $state(new Set<string>());
	let shown = $state(PAGE);
	let columnsOpen = $state(false);
	let sortOpen = $state(false);

	const rows = $derived(mentionRows(allRows(filterGroups(verbonden.groups, filter))));
	const mentions = $derived(mentionLine(filterGroups(verbonden.groups, filter)));
	const sorted = $derived.by(() => {
		const col = COLUMNS.find((c) => c.id === sortBy);
		const key = col?.sort ?? col?.value;
		if (!key) return rows;
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...rows].sort((a, b) => {
			const x = key(a);
			const y = key(b);
			if (x === y) return 0;
			if (x === '' || x == null) return 1;
			if (y === '' || y == null) return -1;
			return (x < y ? -1 : 1) * dir;
		});
	});
	const visibleColumns = $derived(COLUMNS.filter((c) => !hiddenColumns.has(c.id)));

	function sortOn(id: string) {
		if (sortBy === id) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortBy = id;
			sortDir = id === 'datum' ? 'desc' : 'asc';
		}
	}

	function toggleColumn(id: string) {
		const next = new Set(hiddenColumns);
		if (!next.delete(id)) next.add(id);
		hiddenColumns = next;
	}

	const sortLabel = $derived.by(() => {
		const col = COLUMNS.find((c) => c.id === sortBy);
		const dir =
			sortBy === 'datum'
				? sortDir === 'desc'
					? 'nieuwste eerst'
					: 'oudste eerst'
				: sortDir === 'asc'
					? 'oplopend'
					: 'aflopend';
		return `${col?.label ?? ''}, ${dir}`;
	});

	const title = $derived(
		selection.collection === 'articles'
			? `Verbindingen van ${selection.raw?.display_name?.replace(/^Artikel/, 'artikel') ?? selection.label}`
			: `Verbindingen van ${selection.raw?.display_name ?? selection.label}`
	);

	function exportCsv() {
		download(
			csvName(selection.label, selection.key),
			rowsToCsv(sorted, selection.collection, page.url.origin)
		);
	}
</script>

<div class="tabel">
	<div class="toolbar">
		<h2 class="toolbar__title">{title}</h2>
		<span class="toolbar__count"
			>{countLine(verbonden.groups, filter)}{#if mentions}; {mentions}{/if}</span
		>
		<span class="toolbar__space"></span>
		<a href={backHref} class="toolbar__back" data-sveltekit-noscroll>← Terug naar de tekst</a>
		<button type="button" class="btn" onclick={onOpenFilter}>Filter</button>
		<div class="menu" use:menu={{ open: sortOpen, close: () => (sortOpen = false) }}>
			<button
				type="button"
				class="btn"
				aria-haspopup="menu"
				aria-expanded={sortOpen}
				onclick={() => (sortOpen = !sortOpen)}>{sortLabel}<Caret open={sortOpen} /></button
			>
			{#if sortOpen}
				<div class="menu__list" role="menu">
					{#each COLUMNS as c (c.id)}
						<button
							type="button"
							role="menuitemradio"
							aria-checked={sortBy === c.id}
							class="menu__item"
							class:is-active={sortBy === c.id}
							onclick={() => {
								sortOn(c.id);
								sortOpen = false;
							}}>{c.label}</button
						>
					{/each}
				</div>
			{/if}
		</div>
		<div class="menu" use:menu={{ open: columnsOpen, close: () => (columnsOpen = false) }}>
			<button
				type="button"
				class="btn"
				aria-haspopup="menu"
				aria-expanded={columnsOpen}
				onclick={() => (columnsOpen = !columnsOpen)}>Kolommen<Caret open={columnsOpen} /></button
			>
			{#if columnsOpen}
				<div class="menu__list" role="menu">
					{#each COLUMNS as c (c.id)}
						{@const on = !hiddenColumns.has(c.id)}
						<button
							type="button"
							role="menuitemcheckbox"
							aria-checked={on}
							class="menu__item"
							onclick={() => toggleColumn(c.id)}
							><span class="menu__box" aria-hidden="true">{on ? '✓' : ''}</span>{c.label}</button
						>
					{/each}
				</div>
			{/if}
		</div>
		<button type="button" class="btn" onclick={exportCsv}>Exporteer</button>
	</div>

	<div class="scroll" aria-busy={verbonden.loading}>
		{#if verbonden.failed}
			<p class="note">
				Verbindingen niet geladen.
				{#if onRetry}
					<button type="button" class="btn is-text" onclick={onRetry}>Opnieuw</button>
				{/if}
			</p>
		{:else if sorted.length === 0}
			<p class="note">
				{verbonden.loading ? 'Laden…' : 'Geen verbindingen binnen de gekozen bronnen en filters.'}
			</p>
		{:else}
			<table>
				<thead>
					<tr>
						{#each visibleColumns as c (c.id)}
							<th
								aria-sort={sortBy === c.id
									? sortDir === 'asc'
										? 'ascending'
										: 'descending'
									: 'none'}
							>
								<button type="button" class="th" onclick={() => sortOn(c.id)}>
									{c.label}{#if sortBy === c.id}<span aria-hidden="true">
											{sortDir === 'asc' ? '↑' : '↓'}</span
										>{/if}
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sorted.slice(0, shown) as r (`${r.ref.collection}/${r.ref.key}#${r.at ?? ''}#${r.edgeId ?? ''}`)}
						<!-- A click on the row opens the card Verbinding, for the mouse; the
						     keyboard has the button under the title. -->
						<tr
							onclick={(e) => {
								if (!onControl(e)) onRow(r);
							}}
						>
							{#each visibleColumns as c (c.id)}
								{#if c.id === 'bron'}
									<td class="cell-bron">
										<span class="bron">
											<KindGlyph collection={r.ref.collection} size={11} />
											<a href={bronHref(r.ref, { at: r.at })} data-sveltekit-noscroll>{r.title}</a>
											<button type="button" class="bron__card" onclick={() => onRow(r)}
												>Over deze verbinding</button
											>
										</span>
										{#if r.identifier || r.context}
											<span class="bron__sub">{r.identifier ?? r.context}</span>
										{/if}
									</td>
								{:else if c.id === 'betrouwbaarheid'}
									{@const b = betrouwbaarheid(r.confidence, !!r.derived, null)}
									<td><span class="conf conf--{b.word}" aria-hidden="true"></span> {b.word}</td>
								{:else if c.id === 'status'}
									<td class:is-proposed={r.proposed}>{c.value(r)}</td>
								{:else}
									<td>{c.value(r)}</td>
								{/if}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="foot">
		<span
			>{sorted.length === 0 ? '0' : `1 tot ${formatCount(Math.min(shown, sorted.length))}`} van {formatCount(
				sorted.length
			)}</span
		>
		{#if shown < sorted.length}
			<button type="button" class="btn" onclick={() => (shown += PAGE)}
				>Volgende {Math.min(PAGE, sorted.length - shown)}</button
			>
		{/if}
	</div>
</div>

<style>
	.tabel {
		display: flex;
		flex-direction: column;
		height: 100%;
		font-family: var(--font-sans);
		font-size: 12.5px;
		color: var(--ink);
	}
	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		padding: 18px var(--s-5) 12px;
	}
	.toolbar__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 20px;
		font-weight: 500;
	}
	.toolbar__count,
	.toolbar__back {
		color: var(--ink-3);
	}
	.toolbar__space {
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
		min-width: 180px;
		padding: 6px 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
	}
	.menu__item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 12px;
		border: 0;
		background: none;
		font: inherit;
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
	.menu__box {
		width: 14px;
		height: 14px;
		display: grid;
		place-items: center;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: 10px;
		line-height: 1;
		color: var(--paper);
		flex: none;
	}
	.menu__item[aria-checked='true'] .menu__box {
		background: var(--ink);
		border-color: var(--ink);
	}
	.scroll {
		flex: 1;
		overflow: auto;
		padding: 0 var(--s-5);
	}
	.note {
		padding: var(--s-5) 0;
		color: var(--ink-3);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		padding: 10px 10px;
		border-bottom: 1px solid var(--rule-strong);
		text-align: left;
		white-space: nowrap;
	}
	.th {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		cursor: pointer;
	}
	.th:hover {
		color: var(--ink);
	}
	td {
		padding: 9px 10px;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
		color: var(--ink-2);
	}
	tr:hover td {
		background: var(--paper-2);
	}
	tbody tr {
		cursor: pointer;
	}
	.cell-bron {
		font-family: var(--font-serif);
		font-size: 14.5px;
		color: var(--ink);
		min-width: 220px;
	}
	.bron {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.bron__sub {
		display: block;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The card of the row, for the keyboard and touch: shown on hover and focus. */
	.bron__card {
		flex: none;
		padding: 2px 4px;
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
		opacity: 0;
	}
	.bron__card:hover {
		color: var(--accent);
	}
	tr:hover .bron__card,
	tr:focus-within .bron__card {
		opacity: 1;
	}
	@media (hover: none) {
		.bron__card {
			opacity: 1;
		}
	}
	td.is-proposed {
		color: var(--accent);
	}
	.conf {
		display: inline-block;
		width: 7px;
		height: 7px;
		margin-right: 1px;
		border: 1.3px solid var(--ink-3);
		border-radius: 50%;
		vertical-align: 0;
	}
	.conf--hoog {
		background: var(--ink-3);
	}
	.conf--matig {
		background: linear-gradient(90deg, var(--ink-3) 50%, transparent 50%);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px var(--s-5);
		border-top: 1px solid var(--rule);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>
