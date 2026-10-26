<script lang="ts">
	// A row of Wetten die met deze wet verbonden zijn opened in place: the references between
	// the articles of the two laws, per referring article (wet-verwijzingen.ts). Asked when the
	// row opens, once per pair. Each article is a reference to it, with its card on hover; the
	// law itself is one step further, its title.
	import { getLawReferences } from '$lib/api/articles';
	import BronLink from '$lib/bron/BronLink.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { formatCount } from '$lib/text/getal';
	import { richtingKop, verwijzingenPerRichting, type Richting } from './wet-verwijzingen';

	let {
		van,
		naar,
		dit = 'deze wet'
	}: {
		/** The selected law, by its BWB id. */
		van: string;
		/** The law of the row. */
		naar: string;
		/** The selected law by its kind: `dit besluit`. */
		dit?: string;
	} = $props();

	/** Referring articles shown before Alle. */
	const GETOOND = 8;

	const loaded = load(
		() => `${van} ${naar}`,
		() => getLawReferences(van, naar).then((r) => verwijzingenPerRichting(r.items ?? [])),
		'Wetverwijzingen'
	);
	let alle = $state(false);
	const richtingen = $derived<Richting[]>(loaded.state.status === 'ready' ? loaded.state.data : []);

	const aantal = $derived(richtingen.reduce((n, r) => n + r.regels.length, 0));
	const getoond = $derived.by(() => {
		let rest = alle ? Infinity : GETOOND;
		return richtingen.map((r) => {
			const regels = r.regels.slice(0, Math.max(0, rest));
			rest -= regels.length;
			return { ...r, regels };
		});
	});
</script>

<div class="verwijzingen">
	<LoadState state={loaded.state} what="De verwijzingen" plural retry={loaded.retry}>
		{#each getoond as r (r.richting)}
			{#if r.regels.length}
				{#if getoond.length > 1}<p class="kop">{richtingKop(r.richting, dit)}</p>{/if}
				<ul>
					{#each r.regels as regel (regel.bron.key)}
						<li>
							<BronLink ref={{ collection: 'articles', key: regel.bron.key }}
								>{regel.bron.label}</BronLink
							>
							<span class="naar">verwijst naar</span>
							art.
							{#each regel.doelen as doel, i (doel.key)}{#if i > 0}{i === regel.doelen.length - 1
										? ' en '
										: ', '}{/if}<BronLink ref={{ collection: 'articles', key: doel.key }}
									>{doel.label}</BronLink
								>{/each}
						</li>
					{/each}
				</ul>
			{/if}
		{/each}
		{#if aantal > GETOOND}
			<p class="alle">
				<TekstLink onclick={() => (alle = !alle)}
					>{alle ? 'Minder' : `Alle ${formatCount(aantal)} artikelen`}</TekstLink
				>
			</p>
		{/if}
	</LoadState>
</div>

<style>
	.verwijzingen {
		padding: var(--s-2) 0 var(--s-2) var(--s-3);
		border-left: 2px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.5;
		color: var(--ink);
	}
	.kop {
		margin: var(--s-2) 0 var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.kop:first-child {
		margin-top: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li + li {
		margin-top: var(--s-1);
	}
	.naar {
		color: var(--ink-3);
	}
	.alle {
		margin: var(--s-2) 0 0;
		font-size: var(--t-micro);
	}
</style>
