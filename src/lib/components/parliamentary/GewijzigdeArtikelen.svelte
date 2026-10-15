<script lang="ts">
	import { naamVanId } from '$lib/bron/menselijk';
	import { naamVan } from '$lib/bron/menselijk';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	// The articles a bill changes, per law in the order of the law: each article once, with
	// a line per change, what it does and where it stands: in force since a day, by its
	// publication in the Staatsblad, or proposed in a paper of the dossier. An article, a law,
	// a publication and a paper are BronLinks: one click opens them in place.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { langeDatum } from '$lib/text/datum';
	import BronLink from '$lib/bron/BronLink.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { isOpen, subKey } from '$lib/components/ui/dicht.svelte';
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

<Sectie titel="Gewijzigde artikelen" collection="articles" aantal={data.articles}>
	{#each data.laws as l, i (l.law.id ?? `buiten-${i}`)}
		{@const artikelen = byArticle(l.changes)}
		{@const key = l.law.id ?? `buiten-${i}`}
		{@const alle = open[key] ?? false}
		{@const gedeeld = sharedEnactment(l)}
		<!-- A law's heading opens and closes its articles; open until closed, kept per law. -->
		{@const wetSleutel = subKey(`wet:${key}`)}
		{@const wetOpen = isOpen(wetSleutel, true)}
		<div class="wet">
			<h4 class="wet-naam">
				<KindGlyph collection="instruments" size={12} />
				{#if l.law.id}<BronLink ref={l.law.id}>{naamVanId(l.law.id, l.law.display_name)}</BronLink
					>{:else}{l.law.display_name ?? l.law.bwb_id ?? l.law.celex}{/if}
				<FoldButton
					sleutel={wetSleutel}
					open={wetOpen}
					quiet
					label="{wetOpen ? 'Artikelen verbergen' : 'Artikelen tonen'}: {l.law.display_name ??
						l.law.bwb_id ??
						''}">{artikelen.length}</FoldButton
				>
			</h4>
			{#if wetOpen}
				{#if gedeeld}
					<p class="samen">
						<BronLink ref={gedeeld.source.id}
							>{naamVanId(gedeeld.source.id, gedeeld.source.display_name)}</BronLink
						>{gedeeld.effective_date
							? `, in werking sinds ${langeDatum(gedeeld.effective_date)}.`
							: '.'}
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
			{/if}
		</div>
	{/each}
	{#each zonder as w (w.key)}
		<div class="wet">
			<h4 class="wet-naam">
				<KindGlyph collection="instruments" size={12} />
				<BronLink ref={`instruments/${w.key}`}
					>{w.name ?? w.short ?? naamVan('instruments', w)}</BronLink
				>
			</h4>
			<p class="samen">Geen gewijzigde artikelen in de gegevens.</p>
		</div>
	{/each}
</Sectie>

<style>
	.wet {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.wet-naam {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
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
