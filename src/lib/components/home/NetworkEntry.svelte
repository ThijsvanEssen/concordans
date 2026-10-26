<script lang="ts">
	// A way in to the network on the start page (besluit 36, M2 variant c): two bronnen opened
	// big in it, and the choosing of another. The same canvas as the Netwerk button of the bar
	// and "In het netwerk" in Verbonden; the examples are those of the start page (start.json).
	import Picto from '$lib/components/ui/Picto.svelte';
	import { NETWORK_MODE } from '$lib/bron/href';
	import { START } from './start';

	const { article, vote } = START;
	/** A bron's readable address, asked for on the canvas. */
	const big = (href: string) => `${href}?mode=${NETWORK_MODE}&paneel=netwerk`;
	const entries = [
		{ href: big(article.href), label: article.title },
		{ href: big(vote.href), label: vote.title },
		{ href: '/explore', label: 'Een andere bron kiezen' }
	];
</script>

<section class="ingang" aria-labelledby="ingang-netwerk">
	<h2 id="ingang-netwerk">Zie hoe het samenhangt</h2>
	<ul>
		{#each entries as entry (entry.href)}
			<li>
				<Picto naam="netwerk-o" size={14} /><a class="raak-rij" href={entry.href}>{entry.label}</a>
			</li>
		{/each}
	</ul>
</section>

<style>
	.ingang {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-3) 0 0;
		border-top: 1px solid var(--ink);
	}
	h2 {
		margin: 0;
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink-3);
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--t-meta);
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		color: var(--ink-2);
	}
	/* Links at least 24 px high, as the rows of the entrances. */
	a {
		display: inline-block;
		padding: var(--s-1) 0;
		color: var(--ink);
	}
</style>
