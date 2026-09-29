<script lang="ts">
	// A row opened under itself, the same in Verbonden and in the table: the passage that
	// names the bron, then how to open it, show it in the network, or read the verbinding.
	import { passageOf, type Row } from './rows';

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
		/** Where Toon in het netwerk goes when there is no onShowInNetwork. */
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
	<div class="links">
		<a href={openHref} data-sveltekit-noscroll class="link is-accent">{openLabel}</a>
		{#if row.relation}
			{#if onShowInNetwork}
				<button type="button" class="link" onclick={() => onShowInNetwork(row)}
					>Toon in het netwerk</button
				>
			{:else}
				<a href={networkHref} class="link">Toon in het netwerk</a>
			{/if}
			<button type="button" class="link" onclick={() => onVerbinding(row)}
				>Over deze verbinding</button
			>
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
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
		margin-top: var(--s-2);
	}
	.link {
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
	.link.is-accent {
		color: var(--accent);
	}
</style>
