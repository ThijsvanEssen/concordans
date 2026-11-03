<script lang="ts">
	// At the top of the text on a phone: what Verbonden, one tab away, holds. A wide screen has
	// Verbonden beside the text and no need of it. An article loads Verbonden with its text
	// (verbondenInView), so the line keeps its room until it comes; another bron says it once
	// Verbonden has been opened: it stays lazy.
	import type { GraphNode } from '$lib/graph/types';
	import { afterTick } from '$lib/util/after-tick';
	import type { VerbondenState } from '$lib/verbonden/data-source';
	import { ingangOf } from '$lib/verbonden/ingang';
	import { panel } from '$lib/verbonden/panel-groups.svelte';
	import { panelSettled } from '$lib/verbonden/view';
	import type { Panel } from './panels';

	let {
		tab = $bindable(),
		verbonden,
		selection
	}: { tab: Panel; verbonden: VerbondenState; selection: GraphNode } = $props();

	const ingang = $derived(ingangOf(verbonden, selection.collection, selection.id, panel.groups));
	const wacht = $derived(selection.collection === 'articles' && !panelSettled(verbonden));

	function open() {
		tab = 'verbonden';
		// This button goes with the text: the focus to the tab that is now chosen.
		afterTick(() =>
			document.querySelector<HTMLElement>('.lees-tabs button[aria-pressed="true"]')?.focus()
		);
	}
</script>

{#if ingang}
	<button type="button" class="ingang" onclick={open}>
		<span class="ingang__tekst">{ingang.line}</span><span aria-hidden="true">›</span>
	</button>
{:else if wacht}
	<div class="ingang ingang--plek" aria-hidden="true"></div>
{/if}

<style>
	.ingang {
		display: none;
	}
	@media (max-width: 768px) {
		.ingang {
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
		.ingang--plek {
			border-bottom-color: transparent;
			cursor: default;
		}
		.ingang__tekst {
			min-width: 0;
		}
	}
</style>
