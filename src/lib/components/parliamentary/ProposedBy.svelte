<script lang="ts">
	// Who brought the bill in, as one sentence of the dossier's head (API 0.80.7): the words
	// from proposer.ts, the name a link to its member. Nothing where the source says nothing.
	import type { Schema } from '$lib/api/types';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { proposal } from './proposer';

	let {
		proposer,
		documentKinds = null
	}: {
		proposer: Schema<'DossierProposerDTO'> | null;
		documentKinds?: Record<string, number> | null;
	} = $props();
	const v = $derived(proposal(proposer, documentKinds));
</script>

{#if v}
	<p class="reading">
		{v.before}{#if v.name}{#if v.memberKey}<BronLink
					ref={{ collection: 'members', key: v.memberKey }}>{v.name}</BronLink
				>{:else}{v.name}{/if}{/if}{v.after}
	</p>
{/if}
