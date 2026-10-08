<script lang="ts">
	// One option of a filter, the same in Bladeren, Actueel, the legend of the network and
	// the filter sheet of Verbonden: a box (or a colour swatch), what it shows before the
	// label (a glyph, a line), the label, and its count at the right edge. Every option of
	// every filter stands on the same columns, so boxes, labels and counts line up.
	import type { Snippet } from 'svelte';
	import { formatCount } from '$lib/verbonden/filter';

	let {
		label,
		on,
		onToggle,
		count,
		swatch,
		voor,
		indent = false,
		empty = false,
		bezig = false,
		wrap = false,
		gedimd = false,
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
		/** Under a heading of the same group; `deep` under an option of it. */
		indent?: boolean | 'deep';
		/** Nothing of this kind: the option stays, quieter. */
		empty?: boolean;
		/** Its count is still being read: "…" in its place. */
		bezig?: boolean;
		/** A long label runs on to a second line instead of being cut ("Europees en internationaal"). */
		wrap?: boolean;
		/** On, but nothing of it shown for another switch (its grouping off): all of it grey. */
		gedimd?: boolean;
		title?: string;
	} = $props();
</script>

<button
	type="button"
	class="optie"
	class:aan={on}
	class:leeg={empty}
	class:gedimd
	class:in={indent}
	class:diep={indent === 'deep'}
	aria-pressed={on}
	title={title ?? label}
	onclick={onToggle}
>
	{#if swatch}
		<span class="kleur" style:background={swatch} aria-hidden="true"></span>
	{:else}
		<span class="vak" aria-hidden="true">{on ? '✓' : ''}</span>
	{/if}
	{#if voor}<span class="voor">{@render voor()}</span>{/if}
	<span class="label" class:wrap>{label}</span>
	{#if bezig}<span class="aantal" aria-label="wordt geteld">…</span>{:else if count != null}<span
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
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.optie:hover {
		color: var(--ink);
	}
	.optie:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.aan {
		color: var(--ink);
		font-weight: 500;
	}
	.leeg {
		color: var(--ink-3);
	}
	.gedimd,
	.gedimd .aantal {
		color: var(--ink-3);
		font-weight: 400;
	}
	.gedimd .vak {
		background: var(--rule-strong);
		border-color: var(--rule-strong);
	}
	.gedimd .voor {
		opacity: 0.5;
	}
	.in {
		padding-left: var(--s-3);
	}
	.diep {
		padding-left: var(--s-5);
	}
	.vak {
		display: grid;
		place-items: center;
		width: var(--s-3);
		height: var(--s-3);
		flex: none;
		box-sizing: border-box;
		border: 1px solid var(--rule-strong);
		border-radius: 2px;
		font-size: var(--t-glyph);
		line-height: 1;
		color: var(--paper);
	}
	.aan .vak {
		background: var(--ink);
		border-color: var(--ink);
	}
	.kleur {
		width: var(--s-3);
		height: var(--s-3);
		flex: none;
		border-radius: 50%;
	}
	.aan .kleur {
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
	.aantal {
		margin-left: auto;
		padding-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
</style>
