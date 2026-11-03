<script lang="ts">
	// Under the text on a phone, in view above the tab bar: what Verbonden, one tab away, holds.
	// It lies over the text and moves nothing when it comes. A wide screen has Verbonden beside
	// the text and no need of it. An article loads Verbonden with its text (verbondenInView);
	// another bron says it once Verbonden has been opened: it stays lazy.
	import type { GraphNode } from '$lib/graph/types';
	import { afterTick } from '$lib/util/after-tick';
	import { entryOf, type Connections } from '$lib/verbonden/entry';
	import { panel } from '$lib/verbonden/panel-groups.svelte';
	import type { Panel } from './panels';

	let {
		tab = $bindable(),
		connected,
		selection
	}: { tab: Panel; connected: Connections; selection: GraphNode } = $props();

	const entry = $derived(entryOf(connected, selection.collection, selection.id, panel.groups));

	function open() {
		tab = 'verbonden';
		// This button goes with the text: the focus to the tab that is now chosen.
		afterTick(() =>
			document.querySelector<HTMLElement>('.lees-tabs button[aria-pressed="true"]')?.focus()
		);
	}
</script>

{#if entry}
	<button type="button" class="entry" onclick={open}>
		<span class="entry__text">{entry.line}</span><span aria-hidden="true">›</span>
	</button>
{/if}

<style>
	.entry {
		display: none;
	}
	@media (max-width: 768px) {
		.entry {
			position: sticky;
			bottom: 0;
			z-index: 1;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--s-2);
			box-sizing: border-box;
			width: 100%;
			min-height: var(--veld-h-raak);
			padding: 0 var(--s-4);
			border: 0;
			border-top: 1px solid var(--rule);
			background: var(--paper);
			font-family: var(--font-serif);
			font-size: var(--t-meta);
			text-align: left;
			color: var(--ink-2);
			cursor: pointer;
		}
		.entry__text {
			min-width: 0;
		}
	}
</style>
