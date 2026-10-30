<script lang="ts">
	// The right column of ⌘K on a wide screen (Thijs, 30 Oct: twee kolommen, "intuitief en
	// gebruiksvriendelijk"): the row the keys are on, what Enter does with it, and the other things
	// to do with a bron, each with its key. A phone has the one column without it.
	import KeyCaps from '$lib/keys/KeyCaps.svelte';
	import { SHORTCUTS } from '$lib/keys/register';
	import type { DoRow } from '$lib/keys/doen.svelte';

	let {
		row = null,
		bron = null,
		actions = [],
		ondo
	}: {
		/** A row Doen or Hier the keys are on. */
		row?: DoRow | null;
		/** Else the bron of the result the keys are on. */
		bron?: string | null;
		/** What else can be done with that bron (keten, netwerk, verband, toevoegen). */
		actions?: readonly DoRow[];
		ondo: (row: DoRow) => void;
	} = $props();

	const comboOf = (id: string | undefined) => SHORTCUTS.find((s) => s.id === id)?.keys[0];
</script>

{#snippet keyOf(r: DoRow)}{@const combo = comboOf(r.key)}{#if combo}<span class="toets"
			><KeyCaps {combo} /></span
		>{/if}{/snippet}

<aside class="preview" aria-label="Voorbeeld">
	{#if row}
		<p class="kop">{row.label}</p>
		{#if row.why}
			<p class="regel stil">{row.why}</p>
		{:else if row.now}
			<p class="regel stil">Zo staat het nu.</p>
		{:else}
			<p class="regel">
				<kbd>Enter</kbd>
				{row.fill !== undefined ? 'en typ verder' : 'doet dit'}
			</p>
		{/if}
		{#if row.key || row.word}
			<p class="regel stil">
				{#if row.key}Of {@render keyOf(row)}{/if}{#if row.key && row.word}, typ{:else if row.word}Typ{/if}
				{#if row.word}<code>{row.word}</code>{/if}
			</p>
		{/if}
	{:else if bron}
		<p class="kop">{bron}</p>
		<p class="regel"><kbd>Enter</kbd> leest</p>
		{#if actions.length}
			<ul class="acties">
				{#each actions as a (a.id)}
					<li>
						<button type="button" tabindex="-1" onclick={() => ondo(a)}>{a.label}</button>
						{@render keyOf(a)}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</aside>

<style>
	.preview {
		flex: 1;
		padding: var(--s-3) var(--s-4);
		border-left: 1px solid var(--rule);
		background: var(--paper-2);
		overflow-y: auto;
		font-family: var(--font-serif);
	}
	.kop {
		margin: 0 0 var(--s-2);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.regel {
		margin: 0 0 var(--s-2);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.stil {
		color: var(--ink-3);
	}
	.acties {
		list-style: none;
		margin: var(--s-3) 0 0;
		padding: var(--s-2) 0 0;
		border-top: 1px solid var(--rule);
	}
	.acties li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
		padding: var(--s-1) 0;
	}
	.acties button {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-meta);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.acties button:hover {
		text-decoration: underline;
	}
	.toets {
		flex-shrink: 0;
		font-size: var(--t-micro);
	}
	code {
		font-family: var(--font-serif);
	}
</style>
