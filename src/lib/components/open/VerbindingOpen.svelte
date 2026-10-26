<script lang="ts">
	// A row of the table opened under itself: the passage that names the bron, then the ways
	// on: Lees (the bron itself), Alleen de omgeving (the bron with what it touches, as a
	// double click on the canvas), and what the verbinding is.
	import { passageOf, type Row } from '../../verbonden/rows';
	import Picto from '$lib/components/ui/Picto.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Aanhaling from '../../verbonden/Aanhaling.svelte';

	let {
		row,
		openHref,
		openLabel,
		networkHref,
		onVerbinding
	}: {
		row: Row;
		openHref: string;
		openLabel: string;
		/** Where Alleen de omgeving goes: the bron with what it touches. */
		networkHref: string;
		onVerbinding: (row: Row) => void;
	} = $props();

	const p = $derived(passageOf(row));
</script>

<div class="open">
	{#if p}
		{#if row.position}<p class="where">{row.position}</p>{/if}
		<p class="passage">
			<Aanhaling passage={p} />
		</p>
	{/if}
	<div class="acts">
		<a href={openHref} data-sveltekit-noscroll class="btn is-primary"
			><Picto naam="tekst" size={13} />{openLabel}</a
		>
		<a href={networkHref} data-sveltekit-noscroll class="btn">Alleen verbonden bronnen</a>
		{#if row.relation}
			<TekstLink onclick={() => onVerbinding(row)}>Over deze verbinding</TekstLink>
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
	.acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin-top: var(--s-3);
	}
	.acts :global(.tekstlink) {
		margin-left: var(--s-2);
		font-size: var(--t-micro);
	}
</style>
