<script lang="ts">
	// Where a passed bill ended, under its stand: the law it made, a link to it, and the day
	// that law came into force, asked of the law after the first paint (one law only: of more,
	// each says its own day). Words from passed-law.ts.
	import type { Schema } from '$lib/api/types';
	import { getInstrumentDetail } from '$lib/api/instrument-cache';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { langeDatum } from '$lib/text/datum';
	import { separatorBefore } from '$lib/text/words';
	import { load } from '$lib/util/load.svelte';
	import { inForceWords, lawsMade } from './passed-law';

	let { dossier }: { dossier: Pick<Schema<'DossierDetailResponse'>, 'instruments'> } = $props();

	const laws = $derived(lawsMade(dossier));
	const only = $derived(laws.length === 1 ? laws[0].key : null);
	const law = load(
		() => only,
		(key) => (key ? getInstrumentDetail(key) : Promise.resolve(null)),
		'Wet van het dossier'
	);
	const inForce = $derived(
		law.state.status === 'ready' ? (law.state.data?.date_in_force ?? null) : null
	);
</script>

{#if laws.length}
	<p class="passed-law">
		Vastgesteld als {#each laws as l, i (l.key)}{separatorBefore(i, laws.length)}<BronLink
				ref={{ collection: 'instruments', key: l.key }}>{l.name}</BronLink
			>{/each}{#if inForce}; {inForceWords(inForce)} {langeDatum(inForce)}{/if}.
	</p>
{/if}

<style>
	.passed-law {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.passed-law :global(a) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	.passed-law :global(a:hover) {
		text-decoration-color: currentColor;
	}
</style>
