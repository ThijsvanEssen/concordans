<script lang="ts">
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import Vinkje from '$lib/components/ui/Vinkje.svelte';
	import { rowClick, terPlekke } from '$lib/actions/klik';
	// All verbindingen of the selected bron as a table, under the same bronfilter:
	// bron, verbinding, plaats in de bron, plaats in dit artikel, aard, status,
	// betrouwbaarheid, datum. Fifty rows per page.
	import { menu } from '$lib/actions/menu';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { page } from '$app/state';
	import { bronHref } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { TABLE_COLUMNS, csvName, download, exportRows, rowsToCsv } from './export';
	import { type VerbondenFilter } from './filter';
	import { formatCount } from '$lib/text/getal';
	import { ankerVanRij, dossierVanRij, openLabelOf, rowKey, type Row } from './rows';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import RowOpen from './RowOpen.svelte';
	import { isEscape } from '$lib/actions/keys';
	import type { VerbondenState } from './source';
	import { betrouwbaarheid } from './verbinding';
	import { countLine, filterGroups, mentionLine } from './view';

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

	const ctx = $derived({ selection: selection.collection, origin: page.url.origin });

	const PAGE = 50;

	let sortBy = $state('datum');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let hiddenColumns = $state(new Set<string>());
	let shown = $state(PAGE);
	let columnsOpen = $state(false);

	const rows = $derived(exportRows(verbonden.groups, filter));
	const mentions = $derived(mentionLine(filterGroups(verbonden.groups, filter)));
	const sorted = $derived.by(() => {
		const col = TABLE_COLUMNS.find((c) => c.id === sortBy);
		const key = col?.sort ?? col?.value;
		if (!key) return rows;
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...rows].sort((a, b) => {
			const x = key(a, ctx);
			const y = key(b, ctx);
			if (x === y) return 0;
			if (x === '' || x == null) return 1;
			if (y === '' || y == null) return -1;
			return (x < y ? -1 : 1) * dir;
		});
	});
	const visibleColumns = $derived(TABLE_COLUMNS.filter((c) => !hiddenColumns.has(c.id)));

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

	/** The directions under the columns, in the words of the column chosen. */
	const richtingen = $derived<{ dir: 'asc' | 'desc'; label: string }[]>(
		sortBy === 'datum'
			? [
					{ dir: 'desc', label: 'Nieuwste eerst' },
					{ dir: 'asc', label: 'Oudste eerst' }
				]
			: [
					{ dir: 'asc', label: 'Oplopend' },
					{ dir: 'desc', label: 'Aflopend' }
				]
	);

	const sortLabel = $derived.by(() => {
		const col = TABLE_COLUMNS.find((c) => c.id === sortBy);
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

	// The row opened under itself; one at a time, closed by Escape.
	let openRow = $state<string | null>(null);
	function onKey(e: KeyboardEvent) {
		if (openRow && isEscape(e)) {
			e.preventDefault();
			openRow = null;
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="tabel">
	<div class="toolbar">
		<h2 class="toolbar__title">{title}</h2>
		<span class="toolbar__count"
			>{countLine(verbonden.groups, filter)}{#if mentions}; {mentions}{/if}</span
		>
		<span class="toolbar__space"></span>
		<a href={backHref} class="toolbar__back" data-sveltekit-noscroll>← Terug naar de tekst</a>
		<button type="button" class="btn" onclick={onOpenFilter}>Filter</button>
		<!-- The order: one TekstMenu, the columns as its options and the direction under the
		     rule (Thijs, 10 Oct); choosing the same column again changes nothing. -->
		<TekstMenu
			label="Volgorde"
			tekst={sortLabel}
			opties={TABLE_COLUMNS.map((c) => ({ waarde: c.id, label: c.label }))}
			waarde={sortBy}
			onKies={(id) => {
				sortBy = id;
				sortDir = id === 'datum' ? 'desc' : 'asc';
			}}
		>
			{#snippet onder(dicht)}
				{#each richtingen as r (r.dir)}
					<button
						type="button"
						role="menuitemradio"
						class="tekstmenu__item"
						aria-checked={sortDir === r.dir}
						onclick={() => {
							sortDir = r.dir;
							dicht();
						}}>{r.label}</button
					>
				{/each}
			{/snippet}
		</TekstMenu>
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
					{#each TABLE_COLUMNS as c (c.id)}
						{@const on = !hiddenColumns.has(c.id)}
						<button
							type="button"
							role="menuitemcheckbox"
							aria-checked={on}
							class="tekstmenu__item menu__vink"
							onclick={() => toggleColumn(c.id)}><Vinkje aan={on} />{c.label}</button
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
				De verbindingen konden niet worden geladen.
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
					{#each sorted.slice(0, shown) as r (rowKey(r))}
						{@const id = rowKey(r)}
						{@const open = openRow === id}
						<!-- A click on the row opens it under itself, as in Verbonden; the card
						     Verbinding is the button under the title. -->
						<tr
							class:is-open={open}
							onclick={(e) => rowClick(e, () => (openRow = open ? null : id))}
						>
							{#each visibleColumns as c (c.id)}
								{#if c.id === 'bron'}
									<td class="cell-bron">
										<span class="bron">
											<KindGlyph collection={r.ref.collection} size={11} />
											{#if r.missing}
												<span class="bron__missing">{r.title}</span>
											{:else}
												<a
													href={bronHref(r.ref, { at: r.at })}
													data-sveltekit-noscroll
													onclick={(e) => terPlekke(e, () => (openRow = open ? null : id))}
													>{#if dossierVanRij(r)}<DossierNaam
															dossier={dossierVanRij(r)!}
															vorm="naam"
														/>{:else}{r.title}{/if}</a
												>
												<button
													type="button"
													class="bron__toggle"
													aria-expanded={open}
													aria-label={open ? 'Verberg passage' : 'Toon passage'}
													onclick={() => (openRow = open ? null : id)}><Caret {open} /></button
												>
												<button type="button" class="bron__card" onclick={() => onRow(r)}
													>Over deze verbinding</button
												>
											{/if}
										</span>
										{#if r.identifier || r.context}
											<span class="bron__sub">{r.identifier ?? r.context}</span>
										{/if}
									</td>
								{:else if c.id === 'betrouwbaarheid'}
									{@const b = betrouwbaarheid(r.confidence, !!r.derived, null)}
									<td><span class="conf conf--{b.word}" aria-hidden="true"></span> {b.word}</td>
								{:else if c.id === 'status'}
									<td class:is-proposed={r.proposed}>{c.value(r, ctx)}</td>
								{:else}
									<td>{c.value(r, ctx)}</td>
								{/if}
							{/each}
						</tr>
						{#if open}
							<tr class="open-row">
								<td colspan={visibleColumns.length}>
									<RowOpen
										row={r}
										openHref={bronHref(r.ref, { at: ankerVanRij(r) })}
										openLabel={openLabelOf(r)}
										networkHref={bronHref(r.ref, { keepMode: false, mode: 'graph' })}
										onVerbinding={onRow}
									/>
								</td>
							</tr>
						{/if}
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink);
	}
	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--s-3);
		padding: var(--s-4) var(--s-5) var(--s-3);
	}
	.toolbar__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 600;
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
		top: calc(100% + var(--s-1));
		right: 0;
		z-index: var(--z-float);
		min-width: 200px;
		padding: var(--s-1) 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
	}
	.menu__vink {
		display: flex;
		align-items: center;
		gap: var(--s-2);
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
		padding: var(--s-2) var(--s-3);
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
		font-weight: 600;
		color: var(--ink-3);
		cursor: pointer;
	}
	.th:hover {
		color: var(--ink);
	}
	td {
		padding: var(--s-2) var(--s-3);
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
		font-size: var(--t-body-2);
		color: var(--ink);
		min-width: 220px;
	}
	.bron {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	.bron__missing {
		color: var(--ink-3);
	}
	.bron__sub {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The card of the row, for the keyboard and touch: shown on hover and focus. */
	.bron__card {
		flex: none;
		padding: 2px var(--s-1);
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
		opacity: 0;
	}
	.bron__card:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
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
		color: var(--ink);
		/* In ink, as everything at rest but "nee" (Thijs, 10 Oct); the weight keeps it seen. */
		font-weight: 600;
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
		gap: var(--s-3);
		padding: var(--s-3) var(--s-5);
		border-top: 1px solid var(--rule);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.bron__toggle {
		padding: 0 var(--s-1);
		border: 0;
		background: none;
		color: var(--ink-3);
		cursor: pointer;
	}
	tr.is-open td {
		background: var(--paper-2);
	}
	.open-row td {
		padding: 0 var(--s-3) var(--s-3);
		background: var(--paper-2);
	}
</style>
