<script lang="ts">
	// The articles a dossier changes, by number per wet: in the Zijpaneel when it is marked on the
	// lanes. The dossier reader tells the same changes in full (GewijzigdeArtikelen).
	import { getChangedArticles, getDossier } from '$lib/api/dossiers';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { naamVan } from '$lib/bron/menselijk';
	import {
		byArticle,
		lawsWithoutArticles,
		type ChangedLaw
	} from '$lib/components/parliamentary/changed-articles';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { load } from '$lib/util/load.svelte';

	let { number }: { number: string } = $props();

	const asked = load(
		() => number,
		async (n) => {
			const [data, dossier] = await Promise.all([getChangedArticles(n), getDossier(n)]);
			return { data, amends: dossier?.legal_effect?.amends ?? [] };
		},
		'Gewijzigde artikelen'
	);
	const lawName = (l: ChangedLaw) => l.law.display_name ?? l.law.bwb_id ?? l.law.celex ?? '';
	const onlyProposed = (l: ChangedLaw) => l.changes.every((c) => c.stage === 'proposed');
</script>

<LoadState state={asked.state} what="de gewijzigde artikelen" retry={asked.retry}>
	{#snippet children({ data, amends })}
		{@const bare = data ? lawsWithoutArticles(data, amends) : amends}
		{#if (data?.laws.length ?? 0) > 0 || bare.length > 0}
			<Sectie title="Gewijzigde artikelen" niveau={3} inklapbaar={false}>
				{#each data?.laws ?? [] as l, i (l.law.id ?? i)}
					<p class="law">
						{#if l.law.id}<BronLink ref={l.law.id}>{lawName(l)}</BronLink>{:else}{lawName(
								l
							)}{/if}{onlyProposed(l) ? ', voorgesteld' : ''}
					</p>
					<p class="numbers">
						art.
						{#each byArticle(l.changes) as { article }, j (article.id)}
							{j > 0 ? ', ' : ''}{#if article.key}<BronLink ref={`articles/${article.key}`}
									>{article.article_number ?? article.display_name}</BronLink
								>{:else}{article.article_number ?? article.display_name}{/if}
						{/each}
					</p>
				{/each}
				{#each bare as w (w.key)}
					<p class="law">
						<BronLink ref={`instruments/${w.key}`}>{w.name ?? w.short ?? naamVan('instruments', w)}</BronLink>
					</p>
					<p class="numbers stil">Geen gewijzigde artikelen in de gegevens.</p>
				{/each}
			</Sectie>
		{/if}
	{/snippet}
</LoadState>

<style>
	.law,
	.numbers {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.law {
		color: var(--ink);
	}
	.numbers {
		margin-bottom: var(--s-2);
		color: var(--ink-2);
	}
</style>
