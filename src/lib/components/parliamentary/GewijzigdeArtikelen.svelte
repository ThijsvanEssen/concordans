<script lang="ts">
	// The articles a bill changes, per law in the order of the law: each article once, with
	// a line per change, what it does and where it stands: in force since a day, by its
	// publication in the Staatsblad, or proposed in a paper of the dossier. An article, a law,
	// a publication and a paper are BronLinks: one click opens them in place.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { langeDatum } from '$lib/text/datum';
	import BronLink from '$lib/bron/BronLink.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { isOpen, zetOpen } from '$lib/components/ui/dicht.svelte';
	import {
		RELATION_WORD,
		articleLabel,
		byArticle,
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

<Sectie titel="Gewijzigde artikelen" soort="articles" aantal={data.articles}>
	{#each data.laws as l, i (l.law.id ?? `buiten-${i}`)}
		{@const artikelen = byArticle(l.changes)}
		{@const key = l.law.id ?? `buiten-${i}`}
		{@const alle = open[key] ?? false}
		{@const gedeeld = sharedEnactment(l)}
		<!-- A law's heading opens and closes its articles; open until closed, kept per law. -->
		{@const wetSleutel = `sub:wet:${key}`}
		{@const wetOpen = isOpen(wetSleutel, true)}
		<div class="wet">
			<h4 class="wet-naam">
				<KindGlyph collection="instruments" size={12} />
				{#if l.law.id}<BronLink ref={l.law.id}>{l.law.display_name ?? l.law.id}</BronLink>{:else}{l
						.law.display_name ??
						l.law.bwb_id ??
						l.law.celex}{/if}
				<button
					type="button"
					class="wet-knop"
					aria-expanded={wetOpen}
					aria-label="{wetOpen ? 'Artikelen verbergen' : 'Artikelen tonen'}: {l.law.display_name ??
						l.law.bwb_id ??
						''}"
					onclick={() => zetOpen(wetSleutel, !wetOpen)}
					><span class="wet-aantal">{artikelen.length}</span><Caret open={wetOpen} side /></button
				>
			</h4>
			{#if wetOpen}
				{#if gedeeld}
					<p class="samen">
						<BronLink ref={gedeeld.source.id}
							>{gedeeld.source.display_name ?? gedeeld.source.id}</BronLink
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
									{#if gedeeld}{RELATION_WORD[c.relation]}{:else}{RELATION_WORD[c.relation]}, {stageLead(
											c
										)}<BronLink ref={c.source.id}>{c.source.display_name ?? c.source.id}</BronLink
										>{/if}
								</span>
							{/each}
						</li>
					{/each}
				</ul>
				{#if artikelen.length > PREVIEW}
					<button type="button" class="meer" onclick={() => (open = { ...open, [key]: !alle })}
						>{alle ? 'Minder' : `Alle ${artikelen.length} artikelen`}</button
					>
				{/if}
			{/if}
		</div>
	{/each}
	{#each zonder as w (w.key)}
		<div class="wet">
			<h4 class="wet-naam">
				<KindGlyph collection="instruments" size={12} />
				<BronLink ref={`instruments/${w.key}`}>{w.name ?? w.short ?? w.key}</BronLink>
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
	/* The count of a law's articles and the caret: the control that folds them. */
	.wet-knop {
		display: inline-flex;
		align-items: baseline;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink-3);
	}
	.wet-knop:hover {
		color: var(--ink);
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
	.meer {
		align-self: flex-start;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
		cursor: pointer;
	}
	.meer:hover {
		color: var(--accent);
	}
</style>
