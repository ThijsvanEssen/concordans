<script lang="ts">
	// The filters of a list page (besluit 40, A205 variant A: the filterbalk), the one form on
	// Bladeren, Actueel and Zoeken. Over the list, which keeps the full width, a row of framed
	// buttons, each a quiet menu of options with their counts (a frame means a menu, E2). A
	// button whose filter holds a choice wears an ink frame and the square; the first three
	// dimensions of a list have a button of their own, the rest stand under Meer. Under the row
	// one head line: the count, and every filter chosen as a chip that takes it off; it is one
	// control high, so nothing moves when the counts come. On a phone the row is one button,
	// Filter (n), that opens the filters as a sheet, its groups folded (A192), ending in Toon.
	// The Kamer is a choice, not a filter: the first of the row, on a phone its own line over it, never a chip.
	import type { Snippet } from 'svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import type { Option } from '$lib/components/ui/option';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Blad from '$lib/components/ui/Blad.svelte';
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { isOpen } from '$lib/components/ui/dicht.svelte';
	import { afterTick } from '$lib/util/after-tick';
	import FacetMenu from './FacetMenu.svelte';
	import {
		activeFilters,
		barLayout,
		facetButtons,
		type FacetButton,
		type FacetGroup
	} from './facets';

	let {
		groups,
		chamber = null,
		pending = false,
		stale = false,
		show,
		list,
		onClear,
		end,
		count,
		countEnd,
		between
	}: {
		groups: FacetGroup[];
		/** The Kamer of the list, where it has one: the first of the row. */
		chamber?: { value: string; options: Option[]; onChoose: (v: string) => void } | null;
		/** The first answer is still on its way: no counts yet, rather than zeros. */
		pending?: boolean;
		/** The counts did not come for these filters. */
		stale?: boolean;
		/** What Toon says at the foot of the sheet: `Toon 2.442 uitspraken`. */
		show: string;
		/** The list the filters filter, brought into view by Toon. */
		list: () => HTMLElement | null | undefined;
		/** Every filter off (the order stays). */
		onClear: () => void;
		/** At the right of the row: the order of the list. */
		end?: Snippet;
		/** The head line's count, before the chips. */
		count?: Snippet;
		/** At the right of the head line: where the list comes from, its feed. */
		countEnd?: Snippet;
		/** Between the row and the head line (the hall of a Kamer, counts that did not come). */
		between?: Snippet;
	} = $props();
	const uid = $props.id();

	const layout = $derived(barLayout(groups));
	const all = $derived(facetButtons(groups));
	const chips = $derived(activeFilters(groups));
	const chosen = (b: FacetButton) => activeFilters(b.groups);
	const words = (b: FacetButton) =>
		chosen(b)
			.map((c) => c.short)
			.join(', ');
	const moreChosen = $derived(layout.more.some((b) => chosen(b).length > 0));

	// ── The sheet of a phone ────────────────────────────────────────────
	let open = $state(false);
	let opener = $state<HTMLElement | null>(null);
	/** Closed: the focus back on Filter, or with Toon on the list, brought into view. */
	function close(toList = false) {
		open = false;
		afterTick(() => {
			if (!toList) return opener?.focus();
			const el = list();
			if (!el) return;
			el.scrollIntoView({ block: 'start' });
			if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
			el.focus({ preventScroll: true });
		});
	}
	/** A fold of the sheet stands open as in A192: the first, one with a choice, or as left. */
	const standsOpen = (b: FacetButton, n: number) =>
		chosen(b).length > 0 || isOpen(`facet:${b.label}`, n === 0);
</script>

{#snippet face(label: string, on: boolean)}
	{label}<span class="mark" class:is-active={on} aria-hidden="true"></span>
{/snippet}

<div class="filterbar">
	<div class="line">
		{#if chamber}
			<span class="chamber">
				<Keuze
					label="Kamer"
					waarde={chamber.value}
					opties={chamber.options}
					onSelect={chamber.onChoose}
				/>
			</span>
		{/if}
		<div class="row">
			<span class="wide">
				{#each layout.bar as b (b.id)}
					{@const on = chosen(b).length > 0}
					<TekstMenu label={b.label} tekst={words(b) || b.label} gekozen={on} breed>
						{#snippet knop()}{@render face(b.label, on)}{/snippet}
						{#snippet inhoud(done)}
							<div class="menu">
								<FacetMenu button={b} {pending} {stale} menu close={done} />
							</div>
						{/snippet}
					</TekstMenu>
				{/each}
				{#if layout.more.length}
					<TekstMenu
						label="Meer"
						tekst={layout.more
							.map(words)
							.filter((w) => w)
							.join(', ') || 'Meer'}
						gekozen={moreChosen}
						breed
					>
						{#snippet knop()}{@render face('Meer', moreChosen)}{/snippet}
						{#snippet inhoud(done)}
							<div class="menu">
								{#each layout.more as b (b.id)}
									<div class="rest">
										<FacetMenu button={b} {pending} {stale} menu heads folds close={done} />
									</div>
								{/each}
							</div>
						{/snippet}
					</TekstMenu>
				{/if}
			</span>
			{#if all.length}
				<button
					type="button"
					class="btn narrow"
					aria-haspopup="dialog"
					aria-expanded={open}
					bind:this={opener}
					onclick={() => (open = true)}>Filter{chips.length ? ` (${chips.length})` : ''}</button
				>
			{/if}
			{#if end}<span class="end">{@render end()}</span>{/if}
		</div>
	</div>

	{@render between?.()}

	{#if count || chips.length || countEnd}
		<div class="head">
			{@render count?.()}
			{#each chips as c (c.id)}
				<button type="button" class="chip" aria-label="{c.label} wissen" onclick={c.onRemove}
					>{c.label}<span class="x" aria-hidden="true">×</span></button
				>
			{/each}
			{#if chips.length > 1}<TekstLink onclick={onClear}>Wis alles</TekstLink>{/if}
			{#if countEnd}<span class="head-end">{@render countEnd()}</span>{/if}
		</div>
	{/if}
</div>

{#if open}
	<Blad titel="Filter" hoog opener={() => opener} onClose={() => close()}>
		<div class="sheet-body">
			{#each all as b, n (b.id)}
				{@const unfolded = standsOpen(b, n)}
				<section class="fold" aria-labelledby="{uid}-f-{b.id}">
					<h3 class="fold-head" id="{uid}-f-{b.id}">
						<FoldButton sleutel="facet:{b.label}" open={unfolded} controls="{uid}-o-{b.id}"
							>{b.label}</FoldButton
						>
						{#if words(b)}<span class="fold-chosen">{words(b)}</span>{/if}
					</h3>
					{#if unfolded}
						<div class="fold-body" id="{uid}-o-{b.id}">
							<FacetMenu button={b} {pending} {stale} />
						</div>
					{/if}
				</section>
			{/each}
		</div>
		{#snippet voet()}
			{#if chips.length}<TekstLink onclick={onClear}>Wis alles</TekstLink>{/if}
			<button type="button" class="btn is-primary show" onclick={() => close(true)}>{show}</button>
		{/snippet}
	</Blad>
{/if}

<style>
	.filterbar {
		min-width: 0;
	}
	/* The Kamer and the row of buttons on one line, the order at its right. */
	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin: 0 0 var(--s-4);
	}
	.row {
		display: contents;
	}
	.wide {
		display: contents;
	}
	.narrow {
		display: none;
	}
	.end {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		margin-left: auto;
	}
	/* The house's marker on a button whose filter holds a choice: a square in ink. */
	.mark {
		width: 6px;
		height: 6px;
		margin-left: var(--s-1);
		background: var(--ink);
		visibility: hidden;
	}
	.mark.is-active {
		visibility: visible;
	}
	.menu {
		padding: var(--s-2) var(--s-3);
	}
	.rest + .rest {
		margin-top: var(--s-3);
	}

	/* The head line: the count, the chips, on the ink rule that opens the list. One control
	   high at rest, so nothing under it moves when the count comes. */
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-3);
		min-height: var(--s-7);
		margin: 0 0 var(--s-3);
		padding-bottom: var(--s-2);
		border-bottom: 2px solid var(--ink);
	}
	.head-end {
		display: inline-flex;
		align-items: center;
		gap: var(--s-3);
		margin-left: auto;
	}
	button.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		height: var(--veld-h);
		padding: 0 var(--s-2) 0 var(--s-3);
		border: 0;
		border-radius: var(--r-rond);
		background: var(--paper-2);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
		cursor: pointer;
	}
	.x {
		display: inline-grid;
		place-items: center;
		width: var(--s-5);
		height: var(--s-5);
		border-radius: var(--r-rond);
		color: var(--ink-2);
	}
	.chip:hover .x,
	.chip:focus-visible .x {
		background: var(--paper);
	}

	/* A phone: Filter (n) in place of the row, a finger's 44 px for every control. */
	@media (max-width: 768px) {
		.wide {
			display: none;
		}
		.narrow {
			display: inline-flex;
		}
		/* On a phone the Kamer stands on its own line, the width of the page; the row under it
		   stays at the top while the list scrolls. Without a box of the bar's own, the row's
		   sticky reaches as far as the box of the list, not the bar's 200 px. */
		.filterbar,
		.line {
			display: contents;
		}
		.chamber {
			display: block;
			margin-bottom: var(--s-3);
		}
		/* The width of the page, every option as wide and a step closer, so Tweede Kamer stays
		   on one line (Keuze vol). */
		.chamber :global(.keuze) {
			display: flex;
		}
		.chamber :global(.keuze button) {
			flex: 1 1 0;
			min-width: max-content;
			justify-content: center;
			padding: 0 var(--s-1);
		}
		.row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: var(--s-2);
			position: sticky;
			top: var(--filterbar-top, var(--balk-h));
			z-index: var(--z-raised);
			margin: 0 calc(-1 * var(--s-4)) var(--s-3);
			padding: var(--s-2) var(--s-4);
			background: var(--paper);
		}
		.row :global(.btn),
		button.chip {
			height: var(--veld-h-raak);
		}
	}

	/* The sheet of a phone (Blad): the folds between its head and foot. */
	.sheet-body {
		padding: 0 var(--s-4);
	}
	.fold {
		border-bottom: 1px solid var(--rule);
	}
	.fold-head {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		min-height: var(--veld-h-raak);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
	}
	.fold-chosen {
		margin-left: auto;
		min-width: 0;
		font-size: var(--t-meta);
		font-weight: 400;
		color: var(--ink-2);
		text-align: right;
	}
	.fold-body {
		padding: 0 0 var(--s-3);
	}
	.show {
		flex: 1;
		justify-content: center;
		height: var(--veld-h-raak);
	}
</style>
