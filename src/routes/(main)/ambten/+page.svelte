<script lang="ts">
	// The ministers' offices (/ambten, B110): those of the cabinet in office, each with its
	// holder now, to its page with every holder and what is attributed to it. An office no
	// longer held is reached from its page under a later name, or by its address.
	import { getCabinet } from '$lib/api/records';
	import { getCabinets } from '$lib/api/government';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { load } from '$lib/util/load.svelte';
	import { ministerSeats, seatHref } from '$lib/offices/office';

	const cabinet = load(
		() => 'nu',
		async () => {
			const [newest] = await getCabinets();
			return newest ? getCabinet(newest.key) : null;
		},
		'Ambten'
	);
	const shown = $derived(cabinet.state.status === 'ready' ? cabinet.state.data : null);
</script>

<RouteKop />

<div class="blad blad--tekst">
	<header class="blad__kop"><h1 class="blad__titel">Ambten</h1></header>
	{#if cabinet.state.status !== 'ready'}
		<LoadState state={cabinet.state} what="De ambten" plural retry={cabinet.retry} />
	{:else if shown}
		<p class="stil kabinet">Ministers van het {shown.name}</p>
		<ul class="ambten">
			{#each ministerSeats(shown) as s (s.seat)}
				<li>
					<a class="ambt" href={seatHref(s.seat)}>{s.title}</a>
					{#if s.holders.length}<span class="houder">{s.holders.join(', ')}</span>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.kabinet {
		margin-bottom: var(--s-4);
	}
	.ambten {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ambten li {
		display: flex;
		flex-direction: column;
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
	}
	.ambt {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
	}
	.houder {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>
