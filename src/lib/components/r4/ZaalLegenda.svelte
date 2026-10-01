<script lang="ts">
	// Ontwerpstudie ronde 4 (prototype): de legenda zoals tweedekamer.nl haar zet. Een
	// kleurbalk per fractie met naam en zetels, op grootte; daarnaast de genummerde plaatsen
	// in de zaal. Gelijk voor beide Kamers.
	import type { Schema } from '$lib/api/types';
	import { kleurenVan, tekstOp } from './partijkleuren';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	let { data, plaatsen }: { data: Seats; plaatsen: string[] } = $props();
	const fracties = $derived([...data.factions].sort((a, b) => b.seats - a.seats));
	const naam = (f: Seats['factions'][number]) => f.abbreviation ?? f.name ?? f.key;
</script>

<div class="leg">
	<ol class="bars" aria-label="Zetels per fractie">
		{#each fracties as f (f.key)}
			{@const k = kleurenVan(data.chamber, naam(f), f.color ?? null)}
			<li
				class="bar"
				style:background={k.length > 1 ? `linear-gradient(90deg, ${k[0]} 50%, ${k[1]} 50%)` : k[0]}
				style:color={tekstOp(k.at(-1) ?? '#a39d90')}
			>
				<span class="n">{naam(f)}</span><span class="z">{f.seats}</span>
			</li>
		{/each}
	</ol>
	<ol class="plaatsen" aria-label="Plaatsen in de zaal">
		{#each plaatsen as p, i (p)}<li><span class="nr">{i + 1}</span>{p}</li>{/each}
	</ol>
</div>

<style>
	.leg {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
		gap: var(--s-5);
		width: 100%;
	}
	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--s-1);
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--s-2);
		padding: var(--s-1) var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 600;
		border-radius: 2px;
		min-width: 0;
	}
	.n {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.z {
		font-variant-numeric: tabular-nums;
	}
	.plaatsen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.nr {
		display: inline-grid;
		place-items: center;
		width: 16px;
		height: 16px;
		margin-right: var(--s-2);
		border-radius: 50%;
		background: var(--ink);
		color: var(--paper);
		font-size: var(--t-glyph);
		font-weight: 600;
	}
	@media (max-width: 640px) {
		.leg {
			grid-template-columns: 1fr;
		}
	}
</style>
