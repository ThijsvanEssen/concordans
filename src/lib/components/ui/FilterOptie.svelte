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
		title
	}: {
		label: string;
		on: boolean;
		onToggle: () => void;
		/** Left out while counts are loading, rather than a column of zeros. */
		count?: number | null;
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
	aria-pressed={on}
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
			class="aantal">{formatCount(count)}</span
		>{/if}
</button>

<style>
	.optie {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		width: 100%;
		min-height: var(--veld-h-klein);
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
		flex: none;
		border-radius: 50%;
	}
	.is-active .kleur {
		box-shadow:
			0 0 0 2px var(--paper),
			0 0 0 3px var(--ink);
	}
	.voor {
		display: inline-flex;
		align-items: center;
		flex: none;
		color: var(--ink);
	}
	.label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.label.wrap {
		white-space: normal;
		line-height: var(--lh-snug);
	}
	/* A label of more lines: the box and the swatch on its first line, not in its middle. */
	.optie:has(.label.wrap) {
		align-items: flex-start;
	}
	.optie:has(.label.wrap) > :global(.vinkje),
	.optie:has(.label.wrap) > .kleur {
		margin-top: calc((var(--lh-snug) * 1em - var(--s-3)) / 2);
	}
	.aantal {
		margin-left: auto;
		padding-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
</style>
