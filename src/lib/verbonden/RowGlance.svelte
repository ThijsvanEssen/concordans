<script lang="ts">
	// What a row of Verbonden shows when it opens in place and its bron is no Kamerstuk and no
	// connected law: the bron's own glance (loadPreview, the card of a reference), read here
	// instead of on a hover, and the way on to the bron one step further. A uitspraak its first
	// sentence, an article its first lid, a dossier its phase (Design System, OpenRij; Thijs,
	// principe 5: one click opens in place, the bron is one step further).
	import { refId } from '$lib/bron/href';
	import { loadPreview } from '$lib/bron/preview';
	import type { BronRef } from '$lib/bron/ref';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { load } from '$lib/util/load.svelte';
	import type { Snippet } from 'svelte';

	let {
		bron,
		at = null,
		href,
		onRead,
		glimp
	}: {
		bron: BronRef;
		/** The place in the bron the row names: `rov-3.4`, `lid-2`. */
		at?: string | null;
		/** The bron one step further: its reader, or beside the text in an in-place group. */
		href: string;
		onRead?: () => void;
		/** The passage the row already has: shown until the glance's own text has come, then
		 *  replaced by it, so the same words are never there twice. */
		glimp?: Snippet;
	} = $props();

	const preview = load(
		() => refId(bron),
		() => loadPreview(bron, at),
		'Rij'
	);
	const geladen = $derived(preview.state.status === 'ready' ? preview.state.data : null);
	const heeftTekst = $derived(!!(geladen?.lines || geladen?.uitslag || geladen?.dossier));
</script>

<div class="inhoud">
	{#if glimp && !heeftTekst}{@render glimp()}{/if}
	<LoadState state={preview.state} what="De inhoud" retry={preview.retry}>
		{#snippet children(p)}
			{#if p?.lines || p?.uitslag || p?.dossier}
				{#if p.dossier}<p class="stil">{p.dossier}</p>{/if}
				{#if p.lines}<p class="tekst">{p.lines}</p>{/if}
				{#if p.uitslag}<p class="tekst">{p.uitslag}</p>{/if}
			{:else if !glimp}
				<p class="stil"><Coverage noText /></p>
			{/if}
		{/snippet}
	</LoadState>
	<p class="verder"><TekstLink {href} onclick={onRead}>Lees verder</TekstLink></p>
</div>

<style>
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		max-width: 680px;
	}
	.tekst,
	.stil,
	.verder {
		margin: 0;
	}
	.tekst {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-body);
		color: var(--ink);
		white-space: pre-line;
	}
	.stil {
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.verder {
		font-size: var(--t-meta);
	}
</style>
