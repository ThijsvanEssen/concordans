<script lang="ts">
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { forAgainst, votesSentence } from '$lib/components/parliamentary/stemming';
	// What a row shows when it opens (Actueel, Gevolgd; a Kamerstuk in Verbonden, Bronnen and
	// Bundels): the bron's own content, read in place, not a panel of actions (Thijs, 10 Oct: "doet niet zoveel behalve een extra klik
	// toevoegen"). Nothing the row says already comes back. A motie its dictum, an amendement
	// its toelichting, another stuk the opening of its text, a stemming its bar and its fracties, a uitspraak its
	// inhoudsindicatie, a publication its changes, an inwerkingtreding the publication that
	// brought it (Wijzigingen); asked when the row opens (one request, shared with the reader), a motie's
	// dictum from the feed itself where it has one. A paper the feed says has no text yet does
	// not open (inhoudVan). The reader stays one step further: the title, or Lees verder.
	import { bronHref } from '$lib/bron/href';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import Wijzigingen from './Wijzigingen.svelte';
	import VoteLine from '$lib/components/parliamentary/VoteLine.svelte';
	import { rowText } from './requests';
	import { inhoudVan, kernUitLijst, type Inhoud, type MetInhoud } from './rij-inhoud';

	let {
		item,
		als = null
	}: {
		item: MetInhoud;
		/** What to show where the item's kind does not say it (a paper of a procedure). */
		als?: Inhoud;
	} = $props();

	const content = $derived(als ?? inhoudVan(item));
	// An inwerkingtreding is read in its law; the version itself has no reader.
	const wet = $derived(item.commencement?.instrument?.key);
	const ref = $derived(
		content === 'inwerkingtreding' && wet
			? `instruments/${wet}`
			: `${item.node.collection}/${item.node.key}`
	);

	// A motion's dictum or an amendment's explanation as the list gives it: no request (API
	// 0.79.42, 0.79.55).
	const fromList = $derived(kernUitLijst(content, item));
	/** The text asked of the stuk, where the list does not give it. */
	const asked = $derived(
		!fromList &&
			(content === 'dictum' ||
				content === 'toelichting' ||
				content === 'opening' ||
				content === 'kern')
			? content
			: null
	);
	const text = load(
		() => (asked ? `${asked}/${item.node.key}` : null),
		(key, signal) => (key && asked ? rowText(item, asked, signal) : Promise.resolve(null)),
		'Rij'
	);

	const tally = $derived(forAgainst(item.vote?.tally));
	const tallySentence = $derived(votesSentence(item.vote?.tally));
</script>

<div class="inhoud">
	{#if content === 'stemming'}
		<!-- The tally is in the row; here its picture: the share voor. -->
		<div class="balk" role="img" aria-label={tallySentence} title={tallySentence}>
			<div class="voor" style:width="{(tally.voor / (tally.voor + tally.tegen)) * 100}%"></div>
		</div>
		<!-- And the fracties on each side, asked as the row opens: the line of the stuk's head. -->
		{#if item.node.collection === 'decisions'}<VoteLine
				decisionKey={item.node.key}
				head={false}
			/>{/if}
	{:else if content === 'samenvatting'}
		<p class="tekst">{item.summary}</p>
	{:else if content === 'wijzigingen' || content === 'inwerkingtreding'}
		{#if item.summary?.trim()}<p class="tekst">{item.summary}</p>{/if}
		<Wijzigingen {item} variant={content} />
	{:else if fromList}
		<p class="tekst" class:dictum={fromList.als === 'dictum'}>{fromList.tekst}</p>
	{:else if asked}
		<LoadState state={text.state} what="De tekst" retry={text.retry}>
			{#snippet children(t)}
				{#if t?.text}
					<p class="tekst" class:dictum={t.as === 'dictum'}>{t.text}</p>
				{:else}
					<p class="stil"><Coverage noText /></p>
				{/if}
			{/snippet}
		</LoadState>
	{:else}
		<p class="stil"><Coverage noText /></p>
	{/if}
	<p class="verder">
		<TekstLink href={bronHref(ref, { keepMode: false, mode: 'read' })}>Lees verder</TekstLink>
	</p>
</div>

<style>
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		max-width: 680px;
	}
	.tekst {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.dictum {
		font-style: italic;
	}
	.verder {
		margin: 0;
		font-size: var(--t-meta);
	}
	.balk {
		height: var(--s-3);
		max-width: 320px;
		background: var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}
	.voor {
		height: 100%;
		background: var(--ink-2);
	}
</style>
