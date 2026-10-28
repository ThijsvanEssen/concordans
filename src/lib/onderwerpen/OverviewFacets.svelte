<script lang="ts">
	// The filters of the overview of a topic, over the figures and the list as on every list page
	// (FilterBar): the fractie whose votes are counted, its current and former fracties as two
	// sections of one button. On a phone behind Filter (N), ending in Toon.
	import { getFactions } from '$lib/api/factions';
	import { fractieNaam } from '$lib/bron/menselijk';
	import type { Chamber } from '$lib/components/parliamentary/chamber';
	import FilterBar from '$lib/components/explore/index/FilterBar.svelte';
	import type { FacetGroup } from '$lib/components/explore/index/facets';
	import { load } from '$lib/util/load.svelte';

	let {
		faction,
		chamber,
		list,
		onChoose
	}: {
		/** The fractie chosen, by its name; '' for none. */
		faction: string;
		/** The Kamer chosen: its fracties, and those of both Kamers; '' for every fractie. */
		chamber: Chamber | '';
		/** The figures and the list the fractie counts, brought into view by Toon. */
		list: () => HTMLElement | null | undefined;
		onChoose: (faction: string | null) => void;
	} = $props();

	// The facet stands without its fracties where they do not come.
	const factions = load(
		() => 'factions',
		(_, signal) => getFactions(undefined, signal),
		'Overzicht fracties'
	);
	const choices = $derived(
		(factions.state.status === 'ready' ? factions.state.data : [])
			.filter((x) => !chamber || !x.chamber || x.chamber === chamber)
			.map((x) => ({ key: x.key, name: fractieNaam(x), active: !!x.active }))
			.sort((a, b) => a.name.localeCompare(b.name, 'nl'))
	);
	const groups = $derived<FacetGroup[]>(
		[
			{ heading: 'Huidige fracties', active: true },
			{ heading: 'Eerdere fracties', active: false }
		].map((g) => ({
			id: g.active ? 'fractie-huidig' : 'fractie-eerder',
			label: g.heading,
			button: 'Fractie',
			chip: 'Fractie',
			kind: 'list',
			options: choices
				.filter((x) => x.active === g.active)
				.map((x) => ({
					id: x.key,
					label: x.name,
					on: faction === x.name,
					onClick: () => onChoose(faction === x.name ? null : x.name)
				}))
		}))
	);
</script>

<FilterBar {groups} show="Toon het overzicht" {list} onClear={() => onChoose(null)} />
