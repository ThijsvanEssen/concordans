<script lang="ts">
	// A row opened under itself, the same in Verbonden and in the table: the passage that
	// names the bron, then the ways on: Lees (the bron itself), Alleen de omgeving (the bron
	// with what it touches, as a double click on the canvas), In netwerk (one of the chosen
	// bronnen), and what the verbinding is.
	import { passageOf, type Row } from './rows';
	import Picto from '$lib/components/ui/Picto.svelte';

	let {
		row,
		openHref,
		openLabel,
		networkHref,
		onNaarNetwerk,
		onShowInNetwork,
		onVerbinding,
		onAdd,
		added = false
	}: {
		row: Row;
		openHref: string;
		openLabel: string;
		/** Where Alleen de omgeving goes: the bron with what it touches. */
		networkHref: string;
		/** Alleen de omgeving was followed: on a phone, the Netwerk tab shows it. */
		onNaarNetwerk?: () => void;
		onShowInNetwork?: (row: Row) => void;
		onVerbinding: (row: Row) => void;
		/** Put the bron among the chosen bronnen of the netwerk. */
		onAdd?: () => void;
		/** It is there already. */
		added?: boolean;
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
	<div class="acts">
		<a href={openHref} data-sveltekit-noscroll class="btn is-primary"
			><Picto naam="tekst" size={13} />{openLabel}</a
		>
		<a href={networkHref} data-sveltekit-noscroll class="btn" onclick={() => onNaarNetwerk?.()}
			><Picto naam="omgeving" size={13} />Alleen de omgeving</a
		>
		{#if onAdd}
			<button type="button" class="btn" disabled={added} onclick={onAdd}
				><Picto naam="plus" size={13} />{added ? 'Staat in netwerk' : 'In netwerk'}</button
			>
		{:else if onShowInNetwork}
			<button type="button" class="btn" onclick={() => onShowInNetwork(row)}
				><Picto naam="plus" size={13} />In netwerk</button
			>
		{/if}
		{#if row.relation}
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
		font-family: var(--font-serif);
	}
	.where {
		margin: 0 0 var(--s-1);
		font-size: var(--t-micro);
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
