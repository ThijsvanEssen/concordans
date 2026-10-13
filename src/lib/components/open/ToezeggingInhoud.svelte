<script lang="ts">
	// What a line of a toezegging opens in place (Tijdlijn `inhoud`), in the lezer of a
	// bewindspersoon and in a post in Bladeren alike: where it was made and on what dossier, by
	// link; when it is expected. The line holds its text. Everything from the list
	// the line came from, no request. The toezegging itself is one step further.
	import type { Schema } from '$lib/api/types';
	import BronLink from '$lib/bron/BronLink.svelte';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import { bronHref } from '$lib/bron/href';
	import { korteDatum } from '$lib/text/datum';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';

	let { toezegging: t }: { toezegging: Schema<'CommitmentDTO'> } = $props();
	const feiten = $derived(!!t.activity || !!t.dossiers?.length || !!t.expected_resolution);
</script>

<div class="tz">
	{#if feiten}<p class="feiten">
			{#if t.activity}<span
					>Gedaan in <BronLink ref={`activities/${t.activity.key}`}
						>de activiteit van {korteDatum(t.activity.date ?? t.date)}</BronLink
					></span
				>{/if}{#each t.dossiers ?? [] as d (d.key)}<span
					><BronLink ref={{ collection: 'dossiers', key: d.key, number: d.number ?? '' }}
						><DossierNaam dossier={{ ...d, number: d.number ?? '' }} /></BronLink
					></span
				>{/each}{#if t.expected_resolution}<span>verwacht {korteDatum(t.expected_resolution)}</span
				>{/if}
		</p>{/if}
	<p class="verder">
		<TekstLink href={bronHref(`commitments/${t.key}`, { keepMode: false, mode: 'read' })}
			>Lees de toezegging</TekstLink
		>
	</p>
</div>

<style>
	.tz {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	/* The facts in one line, a comma between them. */
	.feiten {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.feiten > span:not(:last-child)::after {
		content: ', ';
	}
	.feiten :global(a) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.verder {
		margin: 0;
		font-size: var(--t-meta);
	}
</style>
