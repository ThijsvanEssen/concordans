<script lang="ts">
	import { naamVanId } from '$lib/bron/menselijk';
	import { naamVan } from '$lib/bron/menselijk';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	// The articles a bill changes, per law in the order of the law: each article once, with
	// a line per change, what it does and where it stands: in force since a day, by its
	// publication in the Staatsblad, or proposed in a paper of the dossier. An article, a law,
	// a publication and a paper are BronLinks: one click opens them in place.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { sinceDate } from '$lib/text/datum';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { subKey } from '$lib/components/ui/dicht.svelte';
	import {
		articleLabel,
		byArticle,
		changeHead,
		sharedEnactment,
		stageLead,
		zonderArtikelen,
		type ChangedArticles,
		type LegalEffectLaw
	} from './changed-articles';

	let {
		data,
		wijzigt = []
	}: {
		data: ChangedArticles;
		/** The laws the dossier changes, as the band names them: each one stands here too. */
		wijzigt?: readonly LegalEffectLaw[];
	} = $props();

	const zonder = $derived(zonderArtikelen(data, wijzigt));

	/** Articles shown per law before Alle. */
	const PREVIEW = 8;
	let open = $state<Record<string, boolean>>({});
</script>

<Sectie title="Gewijzigde artikelen" aantal={data.articles}>
	{#each data.laws as l, i (l.law.id ?? `buiten-${i}`)}
		{@const artikelen = byArticle(l.changes)}
		{@const key = l.law.id ?? `buiten-${i}`}
		{@const alle = open[key] ?? false}
		{@const gedeeld = sharedEnactment(l)}
		<!-- A law's heading opens and closes its articles; open until closed, kept per law. -->
		<Sectie
			niveau={4}
			title={l.law.id
				? naamVanId(l.law.id, l.law.display_name)
				: (l.law.display_name ?? l.law.bwb_id ?? l.law.celex ?? '')}
			aantal={artikelen.length}
			sleutel={subKey(`wet:${key}`)}
		>
			{#snippet naast()}{#if l.law.id}<BronLink ref={l.law.id}>Wet openen</BronLink>{/if}{/snippet}
			{#if gedeeld}
				<p class="samen">
					<BronLink ref={gedeeld.source.id}
						>{naamVanId(gedeeld.source.id, gedeeld.source.display_name)}</BronLink
					>{gedeeld.effective_date ? `, in werking ${sinceDate(gedeeld.effective_date)}.` : '.'}
				</p>
			{/if}
			<ul class="artikelen">
				{#each alle ? artikelen : artikelen.slice(0, PREVIEW) as a (a.article.id)}
					<li>
						<span class="artikel">
							{#if a.article.key}<BronLink ref={`articles/${a.article.key}`}
									>{articleLabel(l.law, a.article)}</BronLink
								>{:else}{articleLabel(l.law, a.article)}{/if}
						</span>
						{#each a.changes as c, j (j)}
							<span class="wijziging">
								{#if gedeeld}{changeHead(c)}{:else}{changeHead(c)}, {stageLead(c)}<BronLink
										ref={c.source.id}>{naamVanId(c.source.id, c.source.display_name)}</BronLink
									>{/if}
							</span>
						{/each}
					</li>
				{/each}
			</ul>
			{#if artikelen.length > PREVIEW}
				<p class="alle">
					<AlleN
						aantal={artikelen.length}
						noun="artikelen"
						open={alle}
						onclick={() => (open = { ...open, [key]: !alle })}
					/>
				</p>
			{/if}
		</Sectie>
	{/each}
	{#each zonder as w (w.key)}
		<Sectie niveau={4} inklapbaar={false} title={w.name ?? w.short ?? naamVan('instruments', w)}>
			{#snippet naast()}<BronLink ref={`instruments/${w.key}`}>Wet openen</BronLink>{/snippet}
			<p class="samen">Geen gewijzigde artikelen in de gegevens.</p>
		</Sectie>
	{/each}
</Sectie>

<style>
	/* The publication a law's changes share, or that it has none in the data: a state line. */
	.samen {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.artikelen {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}
	.artikelen li {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-2) 0;
		border-top: 1px solid var(--rule);
	}
	.artikel {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.wijziging {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.alle {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
</style>
