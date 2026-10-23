<script lang="ts">
	// De stand van een wetsvoorstel als balk in drie
	// gelijke vakken, in de volgorde van de procedure. Afgerond met een uitkomst: mos met een
	// gevuld vakje. Afgerond zonder uitkomst: inkt 2. Nu: inkt, vet, met een vlak. Nog niet:
	// gestippeld. Onder elk vak één zin met de datum. Werkt op een lijstitem en op het detail.
	import type { Schema } from '$lib/api/types';
	import { boxesOf, stand } from './stand';
	import TermText from '../explore/readers/TermText.svelte';
	import OutcomeMark from './Uitkomst.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { langeDatum } from '$lib/text/datum';
	import { withdrawalLetter } from './stand';

	type Item = Schema<'DossierSummaryDTO'> | Schema<'DossierDetailResponse'>;
	let { d }: { d: Item } = $props();

	const st = $derived(stand(d));
	const boxes = $derived(boxesOf(d));
	/** Withdrawn: the letter that withdrew it, the proof (API 0.80.1, #857). */
	const letter = $derived(withdrawalLetter(d));
</script>

{#if d.source === 'eerstekamer'}
	<!-- A dossier from before the Tweede Kamer's data (about 2005), written from the Eerste
	     Kamer's papers: no procedure of the Tweede Kamer to show, so a mark, not empty boxes. -->
	<p class="alleen-ek" title="Geen procedure van de Tweede Kamer in de bron">
		Alleen stukken van de Eerste Kamer
	</p>
{:else if st}
	<section class="stand" aria-label="Stand van zaken">
		{#if letter}
			<p class="zin">
				Ingetrokken bij <BronLink ref={{ collection: 'documents', key: letter }}
					>brief{d.closed_on ? ` van ${langeDatum(d.closed_on)}` : ''}</BronLink
				>.
			</p>
		{:else}
			<p class="zin"><TermText text={st.zin} /></p>
		{/if}
		<ol class="balk">
			{#each boxes as box (box.body)}
				<li class="vak vak--{box.mark}">
					<span class="naam">{box.body}</span>
					<span class="streep" aria-hidden="true"></span>
					<OutcomeMark tone={box.mark} woord={box.word} />
					<span class="wanneer">{box.line}</span>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.alleen-ek {
		margin: var(--s-2) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.stand {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.zin {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.zin :global(a) {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.balk {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-1);
		/* The text and the bars at the column's edges (Thijs: "de hele beschikbare breedte"):
		   the padding of each block hangs in the margin, where the plate of the stage that
		   runs now needs it. */
		margin: 0 calc(-1 * var(--s-3));
	}
	.vak {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-2) var(--s-3) var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.naam {
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
	}
	.streep {
		height: 6px;
		margin: 2px 0 var(--s-1);
		background: var(--ink-2);
	}
	.wanneer {
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.vak--ja .streep {
		background: var(--uitkomst-ja);
	}
	.vak--nee .streep {
		background: transparent;
		border: 2px solid var(--uitkomst-nee);
		box-sizing: border-box;
	}
	.vak--nu {
		background: var(--paper-2);
	}
	.vak--nu .naam {
		color: var(--ink);
		font-weight: 600;
	}
	.vak--nu .streep {
		background: var(--ink);
	}
	.vak--nu .wanneer {
		color: var(--ink);
	}
	.vak--open .streep {
		background: transparent;
		border-top: 2px dashed var(--ink-3);
		height: 0;
		margin: var(--s-1) 0 var(--s-2);
	}
	.vak--open .naam,
	.vak--open .wanneer {
		color: var(--ink-3);
	}
	@media (max-width: 560px) {
		.balk {
			grid-template-columns: 1fr;
		}
	}
</style>
