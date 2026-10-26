<script lang="ts">
	import Vinkje from './Vinkje.svelte';
	// One option of a filter, the same in Bladeren, Actueel, the legend of the network and
	// the filter sheet of Verbonden: a box (or a colour swatch), what it shows before the
	// label (a glyph, a line), the label, and its count at the right edge. Every option of
	// every filter stands on the same columns, so boxes, labels and counts line up.
	import type { Snippet } from 'svelte';
	import { formatCount } from '$lib/text/getal';

	let {
		label,
		on,
		onToggle,
		count,
		swatch,
		voor,
		indent = false,
		empty = false,
		loading = false,
		wrap = false,
		gedimd = false,
		inline = false,
		menu = false,
		title
	}: {
		label: string;
		on: boolean;
		onToggle: () => void;
		/** Left out while counts are loading, rather than a column of zeros; text (`meer dan 50`) as given. */
		count?: number | string | null;
		/** A colour in place of the box: a fractie. */
		swatch?: string | null;
		/** Before the label, after the box: the glyph of a kind, the line of a verbinding. */
		voor?: Snippet;
		/** Under an option of the same group: a specific area under its rechtsgebied. */
		indent?: boolean;
		/** Nothing of this kind: the option stays, quieter. */
		empty?: boolean;
		/** Its count is still being read: "…" in its place. */
		loading?: boolean;
		/** A long label runs on to a second line instead of being cut ("Europees en internationaal"). */
		wrap?: boolean;
		/** On, but nothing of it shown for another switch (its grouping off): all of it grey. */
		gedimd?: boolean;
		/** On a line with other things, as wide as its label: "netwerk" in a group's heading. */
		inline?: boolean;
		/** An item of a menu (FilterBar): checked as a menu item, not pressed as a button. */
		menu?: boolean;
		title?: string;
	} = $props();
</script>

<button
	type="button"
	class="optie"
	class:is-active={on}
	class:leeg={empty}
	class:is-dim={gedimd}
	class:in={indent}
	class:inline
	role={menu ? 'menuitemcheckbox' : undefined}
	aria-pressed={menu ? undefined : on}
	aria-checked={menu ? on : undefined}
	title={title ?? label}
	onclick={onToggle}
>
	{#if swatch}
		<span class="kleur" style:background={swatch} aria-hidden="true"></span>
	{:else}
		<Vinkje aan={on} {gedimd} />
	{/if}
	{#if voor}<span class="voor">{@render voor()}</span>{/if}
	<span class="label" class:wrap>{label}</span>
	{#if loading}<span class="aantal" aria-label="wordt geteld"></span>{:else if count != null}<span
			class="aantal">{typeof count === 'string' ? count : formatCount(count)}</span
		>{/if}
</button>

<style>
	/* One grid for every option: box, mark, label and count each in a column of their own, every
	   small part centred on the label's first line, so a label of two lines moves nothing beside
	   it (Thijs, 23 Oct: "checkboxes die niet zo goed uitlijnen"). */
	.optie {
		--optie-h: calc(var(--lh-snug) * 1em);
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto;
		align-items: start;
		align-content: center;
		gap: 0 var(--s-2);
		width: 100%;
		min-height: var(--tik-h);
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.optie:hover {
		color: var(--ink);
	}
	.optie:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	.optie.inline {
		display: inline-grid;
		width: auto;
		min-height: 0;
		font-size: var(--t-micro);
	}
	.is-active {
		color: var(--ink);
		font-weight: 600;
	}
	.leeg {
		color: var(--ink-3);
	}
	.is-dim,
	.is-dim .aantal {
		color: var(--ink-3);
		font-weight: 400;
	}
	.is-dim .voor {
		opacity: 0.5;
	}
	.in {
		padding-left: var(--s-3);
	}
	.kleur {
		width: var(--s-3);
		height: var(--s-3);
		margin-top: calc((var(--optie-h) - var(--s-3)) / 2);
		border-radius: 50%;
	}
	.optie > :global(.vinkje) {
		margin-top: calc((var(--optie-h) - var(--vink)) / 2);
	}
	.is-active .kleur {
		box-shadow:
			0 0 0 2px var(--paper),
			0 0 0 3px var(--ink);
	}
	/* As wide as its block asks (--optie-voor: the legend's line samples), so the names of every
	   block start in one column. */
	.voor {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--optie-voor, 0);
		height: var(--optie-h);
		color: var(--ink);
	}
	/* Without a mark, the label takes its column: no empty track. */
	.optie:not(:has(.voor)) .label {
		grid-column: 2 / 4;
	}
	.label {
		min-width: 0;
		line-height: var(--lh-snug);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.label.wrap {
		white-space: normal;
	}
	.aantal {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		height: var(--optie-h);
		font-size: var(--t-micro);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
</style>
