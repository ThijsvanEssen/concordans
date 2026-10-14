<script lang="ts">
	// A small legend in the style of Concordans: per fractie a dot in the colour of the hall,
	// its name and its seats, by size, in columns; under it the numbered places on one line.
	// The same for both Kamers.
	import { fractieNaam } from '$lib/bron/menselijk';
	import type { Schema } from '$lib/api/types';
	import { achtergrondVan } from './partijkleuren.svelte';
	import ZaalPlaatsen from './ZaalPlaatsen.svelte';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	let {
		data,
		plaatsen,
		peil = null,
		bron = null,
		kolommen = 3,
		rijen = 0,
		ruimte = null,
		coalitie = null
	}: {
		data: Seats;
		plaatsen: string[];
		/** The peildatum, small at the foot. */
		peil?: string | null;
		bron?: { label: string; href: string } | null;
		/** Beside the hall two columns, under it three. */
		kolommen?: number;
		/** At least this many rows, so the legends of both Kamers stand equally high. */
		rijen?: number;
		/**
		 * The places of the other Kamer, where they take more lines: the line keeps their
		 * height, unseen, so the legends of both Kamers stand equally high at every width.
		 */
		ruimte?: string[] | null;
		/** The cabinet in office and its fracties: one line to the cabinet, where its seats are. */
		coalitie?: { naam: string; href: string; fracties: string[] } | null;
	} = $props();
	const fracties = $derived([...data.factions].sort((a, b) => b.seats - a.seats));
</script>

<div class="leg">
	<ol
		class="fr"
		aria-label="Zetels per fractie"
		style:grid-template-rows="repeat({Math.max(rijen, Math.ceil(fracties.length / kolommen))}, auto)"
		style:grid-template-columns="repeat({kolommen}, minmax(0, 1fr))"
	>
		{#each fracties as f (fractieNaam(f))}
			<li>
				<span class="stip" style:background={achtergrondVan(fractieNaam(f), f.color ?? null)}
				></span>
				<span class="n">{fractieNaam(f)}</span><span class="z">{f.seats}</span>
			</li>
		{/each}
	</ol>
	<div class="pl-cel">
		<ZaalPlaatsen {plaatsen} />
		{#if ruimte && ruimte.length > plaatsen.length}<ZaalPlaatsen plaatsen={ruimte} verborgen />{/if}
	</div>
	{#if coalitie}
		<p class="coalitie">
			Coalitie: <a href={coalitie.href}>{coalitie.naam}</a>{coalitie.fracties.length
				? ` (${coalitie.fracties.join(', ')})`
				: ''}
		</p>
	{/if}
	{#if peil}
		<p class="peil">
			<!-- The fixed caption of a date that belongs to what is shown (docs/bediening.md,
			     Bronregels): `Samenstelling op …. Bron: ….` -->
			{peil}. {#if bron}Bron: <a href={bron.href} rel="external">{bron.label}</a>.{/if}
		</p>
	{/if}
</div>

<style>
	.leg {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		width: 100%;
		max-width: 720px;
		margin: var(--s-4) 0 0;
	}
	.fr {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-auto-flow: column;
		column-gap: var(--s-6);
	}
	.fr li {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: 3px 0;
		border-bottom: 1px solid var(--rule);
	}
	.stip {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
		transform: translateY(-1px);
	}
	.n {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.z {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	/* The places and, unseen, the longer list of the other Kamer in one cell. */
	.pl-cel {
		display: grid;
	}
	.pl-cel > :global(.zaal-plaatsen) {
		grid-area: 1 / 1;
	}
	/* One line, so it takes the same height under either Kamer. */
	.peil {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.peil a {
		color: inherit;
	}
	.coalitie {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.coalitie a {
		color: var(--ink);
	}
</style>
