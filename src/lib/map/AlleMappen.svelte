<script lang="ts">
	// Alle mappen: the maps of this browser in one table, by name, size and last change (concept
	// 13-map, variant 7), a section of Gemarkeerd under the active map. A name makes its map the
	// active one, shown above.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import ConfirmButton from '$lib/components/ui/ConfirmButton.svelte';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import { groepen, type MapItem } from './map';
	import { kaart } from './map.svelte';

	let { onKies }: { onKies?: () => void } = $props();

	const kies = (id: string) => {
		kaart.kies(id);
		onKies?.();
	};
	const dag = (iso: string) => korteDatum(vandaag(new Date(iso)));
	/** The laws, dossiers and judgments a map holds, by name, as its groups. */
	const inhoud = (items: MapItem[]) =>
		groepen(items)
			.map((g) => g.groep)
			.join('; ');
</script>

<Sectie titel="Alle mappen" aantal={kaart.mappen.length} niveau={2} inklapbaar={false}>
	<table>
		<thead>
			<tr>
				<th scope="col">Map</th>
				<th scope="col" class="getal">Bronnen</th>
				<th scope="col" class="datum">Gewijzigd</th>
				<th scope="col"><span class="sr-only">Verwijderen</span></th>
			</tr>
		</thead>
		<tbody>
			{#each kaart.mappen as m (m.id)}
				<tr class:actief={m.id === kaart.actief.id}>
					<td class="naam">
						<button
							type="button"
							aria-current={m.id === kaart.actief.id ? 'true' : undefined}
							onclick={() => kies(m.id)}>{m.naam}</button
						>
						{#if m.items.length}<span class="inhoud">{inhoud(m.items)}</span>{/if}
					</td>
					<td class="getal">{m.items.length.toLocaleString('nl-NL')}</td>
					<td class="datum">{dag(m.gewijzigd)}</td>
					<td class="weg">
						<ConfirmButton
							label="Verwijder"
							naam="Verwijder {m.naam}"
							confirmLabel="Ja, {m.naam} verwijderen"
							buttonClass="verwijder"
							onConfirm={() => kaart.verwijder(m.id)}
						/>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="voet">Bewaard in deze browser.</p>
</Sectie>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	th {
		padding: 0 var(--s-2) var(--s-1) 0;
		border-bottom: 1px solid var(--rule-strong);
		font-weight: 600;
		text-align: left;
		color: var(--ink-2);
	}
	td {
		padding: var(--s-2) var(--s-2) var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: baseline;
	}
	.getal {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.datum {
		padding-left: var(--s-4);
		white-space: nowrap;
		color: var(--ink-2);
	}
	.naam button {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-body);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.naam button:hover {
		text-decoration: underline;
	}
	/* The active map: in weight, as the heading above shows it. */
	.actief .naam button {
		font-weight: 800;
	}
	.inhoud {
		display: block;
		color: var(--ink-3);
		overflow-wrap: anywhere;
	}
	.weg {
		padding-right: 0;
		text-align: right;
		white-space: nowrap;
	}
	.weg :global(.verwijder) {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
	}
	.weg :global(.verwijder:hover) {
		color: var(--accent);
		text-decoration: underline;
	}
	.voet {
		margin: var(--s-2) 0 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* On a phone the date gives way; the name, the number and the step out stay. */
	@media (max-width: 767px) {
		.datum {
			display: none;
		}
	}
</style>
