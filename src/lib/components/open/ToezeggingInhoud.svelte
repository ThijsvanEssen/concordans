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
	import { discussedIn, dossiersByBasis, toegezegdIn } from '$lib/text/toezegging';

	let { toezegging: t }: { toezegging: Schema<'CommitmentDTO'> } = $props();
	// Its own dossiers among the facts; those only on its debate's agenda under their line.
	const dossiers = $derived(dossiersByBasis(t.dossiers));
	const feiten = $derived(!!t.activity || !!dossiers.own.length || !!t.expected_resolution);
	// The same words as the reader of the toezegging, the day short as in a list.
	const gedaan = $derived(
		toegezegdIn(t.activity ? { ...t.activity, date: t.activity.date ?? t.date } : null, (iso) =>
			korteDatum(iso)
		)
	);
	const discussed = $derived(discussedIn(t.activity, (iso) => korteDatum(iso)));
</script>

<div class="tz">
	{#if feiten}<p class="feiten">
			{#if t.activity && gedaan}<span
					>{gedaan.voor}
					<BronLink ref={`activities/${t.activity.key}`}>{gedaan.link}</BronLink></span
				>{/if}{#each dossiers.own as d (d.key)}<span
					><BronLink ref={{ collection: 'dossiers', key: d.key, number: d.number ?? '' }}
						><DossierNaam dossier={{ ...d, number: d.number ?? '' }} /></BronLink
					></span
				>{/each}{#if t.expected_resolution}<span>verwacht {korteDatum(t.expected_resolution)}</span
				>{/if}
		</p>{/if}
	{#if dossiers.agenda.length}<div class="discussed">
			<p>
				{discussed.label}
				{#if discussed.link && t.activity}{discussed.before}
					<BronLink ref={`activities/${t.activity.key}`}>{discussed.link}</BronLink
					>{:else}{discussed.before}{/if}
			</p>
			<p class="agenda">
				{#each dossiers.agenda as d (d.key)}<span
						><BronLink ref={{ collection: 'dossiers', key: d.key, number: d.number ?? '' }}
							><DossierNaam dossier={{ ...d, number: d.number ?? '' }} /></BronLink
						></span
					>{/each}
			</p>
		</div>{/if}
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
	.feiten > span:not(:last-child)::after,
	.agenda > span:not(:last-child)::after {
		content: ', ';
	}
	/* The debate's agenda under its line, a step in: its dossiers, not the toezegging's. */
	.discussed {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.discussed p {
		margin: 0;
	}
	.agenda {
		padding-left: var(--s-4);
	}
	.feiten :global(a),
	.discussed :global(a) {
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
