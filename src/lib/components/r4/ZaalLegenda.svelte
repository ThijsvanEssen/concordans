<script lang="ts">
	// Ontwerpstudie ronde 4 (prototype): een kleine legenda in de stijl van Concordans. Per
	// fractie een stip in de kleur van de zaal, de naam en de zetels, op grootte, in kolommen;
	// daaronder de genummerde plaatsen op één regel. Gelijk voor beide Kamers.
	import type { Schema } from '$lib/api/types';
	import { kleurenVan } from './partijkleuren';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	let { data, plaatsen }: { data: Seats; plaatsen: string[] } = $props();
	const fracties = $derived([...data.factions].sort((a, b) => b.seats - a.seats));
	const naam = (f: Seats['factions'][number]) => f.abbreviation ?? f.name ?? f.key;
</script>

<div class="leg">
	<ol class="fr" aria-label="Zetels per fractie">
		{#each fracties as f (f.key)}
			{@const k = kleurenVan(data.chamber, naam(f), f.color ?? null)}
			<li>
				<span class="stip" style:background={k.length > 1 ? `linear-gradient(90deg, ${k[0]} 50%, ${k[1]} 50%)` : k[0]}></span>
				<span class="n">{naam(f)}</span><span class="z">{f.seats}</span>
			</li>
		{/each}
	</ol>
	<p class="pl">
		{#each plaatsen as p, i (p)}<span><b>{i + 1}</b> {p}</span>{/each}
	</p>
</div>

<style>
	.leg {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		width: 100%;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.fr {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 2px var(--s-4);
	}
	.fr li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-width: 0;
	}
	.stip {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}
	.n {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--ink);
	}
	.z {
		font-variant-numeric: tabular-nums;
	}
	.pl {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		color: var(--ink-3);
	}
	.pl b {
		font-weight: 600;
		color: var(--ink-2);
	}
</style>
