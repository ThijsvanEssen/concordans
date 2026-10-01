<script lang="ts">
	// Een kleine legenda in de stijl van Concordans. Per
	// fractie een stip in de kleur van de zaal, de naam en de zetels, op grootte, in kolommen;
	// daaronder de genummerde plaatsen op één regel. Gelijk voor beide Kamers.
	import type { Schema } from '$lib/api/types';
	import { kleurenVan } from './partijkleuren';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	let {
		data,
		plaatsen,
		peil = null,
		bron = null
	}: {
		data: Seats;
		plaatsen: string[];
		/** De peildatum, klein onderaan. */
		peil?: string | null;
		bron?: { label: string; href: string } | null;
	} = $props();
	const fracties = $derived([...data.factions].sort((a, b) => b.seats - a.seats));
	const naam = (f: Seats['factions'][number]) => f.abbreviation ?? f.name ?? f.key;
</script>

<div class="leg">
	<ol
		class="fr"
		aria-label="Zetels per fractie"
		style:grid-template-rows="repeat({Math.ceil(fracties.length / 3)}, auto)"
	>
		{#each fracties as f (f.key)}
			{@const k = kleurenVan(data.chamber, naam(f), f.color ?? null)}
			<li>
				<span
					class="stip"
					style:background={k.length > 1
						? `linear-gradient(90deg, ${k[0]} 50%, ${k[1]} 50%)`
						: k[0]}
				></span>
				<span class="n">{naam(f)}</span><span class="z">{f.seats}</span>
			</li>
		{/each}
	</ol>
	<p class="pl">
		{#each plaatsen as p, i (p)}<span><b>{i + 1}</b>{p}</span>{/each}
	</p>
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
		grid-template-columns: repeat(3, minmax(0, 1fr));
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
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	.pl {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		font-family: var(--font-sans);
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
	.peil {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.peil a {
		color: inherit;
	}
</style>
