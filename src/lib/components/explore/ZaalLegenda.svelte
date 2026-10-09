<script lang="ts">
	// Een kleine legenda in de stijl van Concordans. Per
	// fractie een stip in de kleur van de zaal, de naam en de zetels, op grootte, in kolommen;
	// daaronder de genummerde plaatsen op één regel. Gelijk voor beide Kamers.
	import type { Schema } from '$lib/api/types';
	import { achtergrondVan } from './partijkleuren.svelte';

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
		/** De peildatum, klein onderaan. */
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
	const naam = (f: Seats['factions'][number]) => f.abbreviation ?? f.name ?? f.key;
</script>

<div class="leg">
	<ol
		class="fr"
		aria-label="Zetels per fractie"
		style:grid-template-rows="repeat({Math.max(rijen, Math.ceil(fracties.length / kolommen))}, auto)"
		style:grid-template-columns="repeat({kolommen}, minmax(0, 1fr))"
	>
		{#each fracties as f (f.key)}
			<li>
				<span class="stip" style:background={achtergrondVan(naam(f), f.color ?? null)}></span>
				<span class="n">{naam(f)}</span><span class="z">{f.seats}</span>
			</li>
		{/each}
	</ol>
	{#snippet regel(lijst: string[], verborgen = false)}
		<p class="pl" class:verborgen aria-hidden={verborgen || undefined}>
			{#each lijst as p, i (p)}<span><b>{i + 1}</b>{p}</span>{/each}
		</p>
	{/snippet}
	<div class="pl-cel">
		{@render regel(plaatsen)}
		{#if ruimte && ruimte.length > plaatsen.length}{@render regel(ruimte, true)}{/if}
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
			{peil}{#if bron}. <a href={bron.href} rel="external">{bron.label}</a>{/if}
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
		margin: var(--s-4) auto 0;
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
	.pl-cel > .pl {
		grid-area: 1 / 1;
	}
	.pl.verborgen {
		visibility: hidden;
	}
	.pl {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.pl span {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
	}
	/* Hetzelfde nummer als in de zaal: een klein rondje in inkt. */
	.pl b {
		display: inline-grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--ink);
		color: var(--paper);
		font-size: var(--t-glyph);
		font-weight: 600;
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
