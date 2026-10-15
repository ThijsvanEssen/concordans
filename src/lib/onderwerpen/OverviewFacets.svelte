<script lang="ts">
	// The facets of the overview of a topic, at the left of the figures and the list as in
	// Actueel and Bladeren: the fractie whose votes are counted. On a phone behind Verfijnen,
	// opened in place.
	import { getFactions } from '$lib/api/factions';
	import { fractieNaam } from '$lib/bron/menselijk';
	import type { Chamber } from '$lib/components/parliamentary/chamber';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { load } from '$lib/util/load.svelte';

	let {
		faction,
		chamber,
		onChoose
	}: {
		/** The fractie chosen, by its name; '' for none. */
		faction: string;
		/** The Kamer chosen: its fracties, and those of both Kamers; '' for every fractie. */
		chamber: Chamber | '';
		onChoose: (faction: string | null) => void;
	} = $props();

	let open = $state(false);

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
	const GROUPS = [
		{ heading: 'Huidige fracties', active: true },
		{ heading: 'Eerdere fracties', active: false }
	];
</script>

<aside class="facetten blad__facetten" aria-label="Verfijnen">
	<button
		type="button"
		class="verfijnen-knop"
		aria-expanded={open}
		aria-controls="overzicht-facetten"
		onclick={() => (open = !open)}>Verfijnen{faction ? ' (1)' : ''}</button
	>
	<div class="facet-lijst" id="overzicht-facetten" class:open>
		<section class="facet" aria-labelledby="f-fractie">
			<h2 class="facet__kop" id="f-fractie">Fractie</h2>
			<TekstMenu klein label="Fractie" tekst={faction || 'Geen fractie'}>
				{#snippet inhoud(sluit)}
					<div class="fractie-lijst">
						<button
							type="button"
							role="menuitemradio"
							class="tekstmenu__item menu-regel"
							aria-checked={!faction}
							onclick={() => {
								sluit();
								onChoose(null);
							}}>Geen fractie</button
						>
						{#each GROUPS as group (group.heading)}
							<span class="fractie-kop" aria-hidden="true">{group.heading}</span>
							{#each choices.filter((x) => x.active === group.active) as x (x.key)}
								<button
									type="button"
									role="menuitemradio"
									class="tekstmenu__item menu-regel"
									aria-checked={faction === x.name}
									onclick={() => {
										sluit();
										onChoose(x.name);
									}}>{x.name}</button
								>
							{/each}
						{/each}
					</div>
				{/snippet}
			</TekstMenu>
		</section>
	</div>
</aside>

<style>
	.facet {
		margin-bottom: var(--s-5);
	}
	.facet__kop {
		margin: 0 0 var(--s-2);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.fractie-lijst {
		display: flex;
		flex-direction: column;
	}
	.fractie-kop {
		padding: var(--s-2) var(--s-3) var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.menu-regel {
		white-space: nowrap;
	}
	@media (max-width: 768px) {
		.facetten {
			position: static;
			margin-bottom: var(--s-4);
		}
		.facet-lijst {
			display: none;
			padding-top: var(--s-3);
		}
		.facet-lijst.open {
			display: block;
		}
	}
</style>
