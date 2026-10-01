<script lang="ts">
	// A row opened under itself, the same in Verbonden and in the table: the passage that
	// names the bron, then how to open it, show it in the network, or read the verbinding.
	import { passageOf, type Row } from './rows';
	import Picto from '$lib/components/r5/Picto.svelte';

	let {
		row,
		openHref,
		openLabel,
		networkHref,
		onShowInNetwork,
		onVerbinding
	}: {
		row: Row;
		openHref: string;
		openLabel: string;
		/** Where Toon in netwerk goes when there is no onShowInNetwork. */
		networkHref: string;
		onShowInNetwork?: (row: Row) => void;
		onVerbinding: (row: Row) => void;
	} = $props();

	const p = $derived(passageOf(row));
</script>

<div class="open">
	{#if p}
		{#if row.position}<p class="where">{row.position}</p>{/if}
		<p class="passage">
			{p.before}{#if p.mark}<mark>{p.mark}</mark>{/if}{p.after}
		</p>
	{/if}
	<!-- Ronde 5: dezelfde twee knoppen als de open rij in Bladeren (r4/OpenRij). -->
	<div class="acts">
		<a href={openHref} data-sveltekit-noscroll class="act act--pri"><Picto naam="tekst" size={13} />{openLabel}</a>
		{#if onShowInNetwork}
			<button type="button" class="act" onclick={() => onShowInNetwork(row)}
				><Picto naam="netwerk" size={13} />In het netwerk</button
			>
		{:else}
			<a href={networkHref} class="act"><Picto naam="netwerk" size={13} />In het netwerk</a>
		{/if}
		{#if row.relation}
			<button type="button" class="link" onclick={() => onVerbinding(row)}>Over deze verbinding</button>
		{/if}
	</div>
</div>

<style>
	.open {
		padding: var(--s-3);
		border-left: 2px solid var(--rule-strong);
		font-family: var(--font-sans);
	}
	.where {
		margin: 0 0 var(--s-1);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.passage {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.5;
		color: var(--ink);
		white-space: normal;
	}
	.passage mark {
		background: var(--accent-soft);
		color: inherit;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin-top: var(--s-3);
	}
	.act {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-1) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font: inherit;
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink);
		text-decoration: none;
		cursor: pointer;
	}
	.act:hover {
		border-color: var(--ink);
	}
	.act--pri {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}
	.link {
		margin-left: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
	}
	.link:hover {
		color: var(--accent);
	}
</style>
