<script lang="ts">
	// Bron toevoegen: the one search of the site (Search, as a picker) in a Blad. Enter or a click
	// adds the bron and leaves the Blad open for the next; Esc closes it and gives the focus back to
	// where it was. A bron already chosen says so on its row.
	import { MediaQuery } from 'svelte/reactivity';
	import Search from '$lib/search/Search.svelte';
	import Blad from '$lib/components/ui/Blad.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import type { SearchKind } from '$lib/search/lanes';

	let {
		chosen,
		onSelect,
		onClose
	}: {
		/** The bronnen of the netwerk, by the name a link uses. */
		chosen: readonly string[];
		onSelect: (id: string) => void;
		onClose: () => void;
	} = $props();

	const FILTERS = [
		{ waarde: 'alle', label: 'Alle', kinds: null },
		{ waarde: 'wetten', label: 'Wetten', kinds: ['instruments'] },
		{ waarde: 'artikelen', label: 'Artikelen', kinds: ['articles'] },
		{ waarde: 'uitspraken', label: 'Uitspraken', kinds: ['judgments'] },
		{ waarde: 'dossiers', label: 'Dossiers', kinds: ['dossiers'] }
	] as const satisfies readonly {
		waarde: string;
		label: string;
		kinds: readonly SearchKind[] | null;
	}[];
	type Filter = (typeof FILTERS)[number]['waarde'];

	let filter = $state<Filter>('alle');
	const scope = $derived(FILTERS.find((f) => f.waarde === filter)?.kinds ?? null);

	// No keys to name on a touch screen.
	const toetsen = new MediaQuery('(min-width: 769px) and (pointer: fine)');

	function pick(id: string) {
		if (!chosen.includes(id)) onSelect(id);
	}
</script>

{#snippet foot()}
	<div class="toevoegen__toetsen" aria-hidden="true">
		<span><kbd>↑</kbd> <kbd>↓</kbd> kiezen</span>
		<span><kbd>Enter</kbd> toevoegen</span>
		<span><kbd>Esc</kbd> sluiten</span>
	</div>
{/snippet}

<Blad
	title="Bron toevoegen"
	focus="[data-search-field]"
	tall
	full
	aboveTabbar
	{onClose}
	foot={toetsen.current ? foot : undefined}
>
	<Search
		overlay
		picker
		placeholder="Zoek een wet, uitspraak of dossier"
		{scope}
		{chosen}
		onSelect={pick}
	>
		{#snippet belowField()}
			<div class="toevoegen__filters" data-zijscroll>
				<Keuze
					label="Soort bron"
					waarde={filter}
					opties={FILTERS.map((f) => ({ waarde: f.waarde, label: f.label }))}
					onSelect={(w) => (filter = w)}
				/>
			</div>
		{/snippet}
	</Search>
</Blad>

<style>
	.toevoegen__filters {
		overflow-x: auto;
		padding: var(--s-2) var(--s-4);
		border-bottom: 1px solid var(--rule);
	}
	.toevoegen__toetsen {
		display: flex;
		gap: var(--s-4);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>
