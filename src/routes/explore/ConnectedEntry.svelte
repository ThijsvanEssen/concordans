<script lang="ts">
	// At the top of the text on a phone: what Verbonden, one tab away, holds. A wide screen has
	// Verbonden beside the text and no need of it. An article loads Verbonden with its text
	// (verbondenInView), so the line keeps its room until it comes; another bron says it once
	// Verbonden has been opened: it stays lazy.
	import type { GraphNode } from '$lib/graph/types';
	import { afterTick } from '$lib/util/after-tick';
	import { entryOf, type Connections } from '$lib/verbonden/entry';
	import { panel } from '$lib/verbonden/panel-groups.svelte';
	import { panelSettled } from '$lib/verbonden/view';
	import type { Panel } from './panels';

	let {
		tab = $bindable(),
		connected,
		selection
	}: { tab: Panel; connected: Connections; selection: GraphNode } = $props();

	const entry = $derived(entryOf(connected, selection.collection, selection.id, panel.groups));
	const pending = $derived(selection.collection === 'articles' && !panelSettled(connected));

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
{:else if pending}
	<div class="entry entry--held" aria-hidden="true"></div>
{/if}

<style>
	.entry {
		display: none;
	}
	@media (max-width: 768px) {
		.entry {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--s-2);
			box-sizing: border-box;
			width: 100%;
			min-height: var(--veld-h-raak);
			padding: 0 var(--s-4);
			border: 0;
			border-bottom: 1px solid var(--rule);
			background: none;
			font-family: var(--font-serif);
			font-size: var(--t-meta);
			text-align: left;
			color: var(--ink-2);
			cursor: pointer;
		}
		.entry--held {
			border-bottom-color: transparent;
			cursor: default;
		}
		.entry__text {
			min-width: 0;
		}
	}
</style>
