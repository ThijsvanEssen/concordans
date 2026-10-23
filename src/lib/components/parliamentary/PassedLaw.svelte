<script lang="ts">
	// Where a passed bill ended, under its stand: per publication its law was enacted in, the
	// law (a link), the Staatsblad (a link) and the first day in force, from the dossier itself
	// (`enacted`, API 0.80.1): no request of its own. A part the source lacks is left out. A
	// passed dossier without `enacted` names the laws it made (`instruments`), without a day. Words
	// from passed-law.ts.
	import type { Schema } from '$lib/api/types';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { langeDatum, onDate } from '$lib/text/datum';
	import { separatorBefore } from '$lib/text/words';
	import { inForceWords, lawsMade, enactments } from './passed-law';

	let {
		dossier
	}: { dossier: Pick<Schema<'DossierDetailResponse'>, 'instruments' | 'enacted' | 'outcome'> } =
		$props();

	/** The words before the law, or before the Staatsblad of a publication without one. */
	const LEAD = { law: 'Vastgesteld als ', cite: 'Bekendgemaakt in ' };
	const enacted = $derived(enactments(dossier));
	// Without `enacted`, the laws a passed bill made; a bill rejected or withdrawn made none.
	const laws = $derived(
		enacted.length || dossier.outcome !== 'aangenomen' ? [] : lawsMade(dossier)
	);
</script>

{#each enacted as v, i (i)}
	<p class="passed-law">
		{#if v.law}{LEAD.law}<BronLink
				ref={{ collection: 'instruments', key: v.law.key }}
				href={v.law.href}>{v.law.name}</BronLink
			>{v.cite ? ', ' : ''}{:else if v.cite}{LEAD.cite}{/if}{#if v.cite}<BronLink
				ref={{ collection: 'instruments', key: v.cite.key }}
				href={v.cite.href}
				title={v.issued ? `Uitgegeven ${onDate(v.issued)}` : undefined}>{v.cite.text}</BronLink
			>{/if}{#if v.inForce}{`; ${inForceWords(v.inForce)} ${langeDatum(v.inForce)}`}{/if}.
	</p>
{/each}
{#if laws.length}
	<p class="passed-law">
		Vastgesteld als {#each laws as l, i (l.key)}{separatorBefore(i, laws.length)}<BronLink
				ref={{ collection: 'instruments', key: l.key }}>{l.name}</BronLink
			>{/each}.
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
