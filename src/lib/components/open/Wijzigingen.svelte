<script lang="ts">
	// What a publication or an inwerkingtreding opens on in Actueel and Gevolgd (RijInhoud):
	// a publication its changes per law, `Wijzigt Telecommunicatiewet, art. 11a.3 en 11a.4`;
	// an inwerkingtreding the publication that brought it, `Stcrt. 2026, 35238, wijzigt 1
	// artikel, voegt 7 artikelen in`. One request when the row opens (wijzigingen.ts); each
	// law, article and publication a BronLink, so it opens in place.
	import BronLink from '$lib/bron/BronLink.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { changesOf } from './requests';
	import type { Brenger, WetRegel } from './wijzigingen';
	import type { MetInhoud } from './rij-inhoud';

	let { item, soort }: { item: MetInhoud; soort: 'wijzigingen' | 'inwerkingtreding' } = $props();

	const changes = load(
		() => `${soort}/${item.node.key}`,
		(_, signal) => changesOf(item, soort, signal),
		'Wijzigingen'
	);

	const isWet = (r: WetRegel | Brenger): r is WetRegel => 'werkwoord' in r;
	const tussen = (i: number, n: number, meer: number) =>
		i === 0 ? '' : i === n - 1 && !meer ? ' en ' : ', ';
</script>

<LoadState
	state={changes.state}
	what={soort === 'wijzigingen' ? 'De wijzigingen' : 'De publicatie'}
	retry={changes.retry}
>
	{#snippet empty()}
		<p class="stil">
			{soort === 'wijzigingen'
				? 'Wijzigingen niet in de gegevens.'
				: 'Publicatie niet in de gegevens.'}
		</p>
	{/snippet}
	{#snippet children(regels: WetRegel[] | Brenger[])}
		<ul class="wijzigingen">
			{#each regels as r, n (n)}
				<li>
					{#if isWet(r)}
						<span class="werkwoord">{r.werkwoord}</span>
						<BronLink ref={`instruments/${r.wet.key}`}>{r.wet.titel}</BronLink
						>{#if r.artikelen.length}, art. {#each r.artikelen as a, i (a.key)}{tussen(
									i,
									r.artikelen.length,
									r.meer
								)}<BronLink ref={`articles/${a.key}`}>{a.nummer}</BronLink
								>{/each}{#if r.meer}{` en ${r.meer} ${r.meer === 1 ? 'ander' : 'andere'}`}{/if}{/if}
					{:else}
						<BronLink ref={`instruments/${r.key}`}>{r.naam}</BronLink>{#if r.wat}, {r.wat}{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/snippet}
</LoadState>

<style>
	.wijzigingen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.werkwoord {
		font-weight: 600;
	}
	.wijzigingen :global(a) {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.wijzigingen :global(a:hover) {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>
