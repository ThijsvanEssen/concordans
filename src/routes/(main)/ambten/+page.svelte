<script lang="ts">
	// The offices (/ambten, B110, B148): per ministry the offices held today, each with its holder,
	// to its page with every holder and what is attributed to it. "Ook eerdere" adds the offices
	// nobody holds today (`?ambten=alle`): a former office or a gap, not filled in.
	import { page } from '$app/state';
	import { getSeats } from '$lib/api/seats';
	import Inhoudsopgave from '$lib/components/ui/Inhoudsopgave.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import Choice from '$lib/components/ui/Keuze.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { load } from '$lib/util/load.svelte';
	import { navigate, withParams } from '$lib/util/address';
	import { seatGroups } from '$lib/offices/office';
	import SeatList from '$lib/offices/SeatList.svelte';
	import { SOURCES } from '$lib/nav/sources';
	import SourceTabs from '$lib/nav/SourceTabs.svelte';
	import { sourceTabs } from '$lib/components/explore/index/categories';

	type Shown = 'nu' | 'alle';
	const shown = $derived<Shown>(page.url.searchParams.get('ambten') === 'alle' ? 'alle' : 'nu');
	const seats = load(
		() => shown,
		(s) => getSeats({ current: s === 'nu' }),
		'Ambten'
	);
	const groups = $derived(seats.state.status === 'ready' ? seatGroups(seats.state.data.items) : []);
	const government = SOURCES.find((x) => x.id === 'regering')!;
	const choose = (s: Shown) => navigate(withParams(page.url, { ambten: s === 'alle' ? s : null }));
	const nameOf = (g: (typeof groups)[number]) => (g.ministry ? g.name : 'Zonder ministerie');
	const anchorOf = (g: (typeof groups)[number]) => `ministerie-${g.ministry ?? 'geen'}`;
</script>

<RouteKop />

<SourceTabs label={government.label} tabs={sourceTabs(government)} current="/ambten" />

<!-- In the frame of Bronnen (B170): the ministries as a way to each in the facet column, each
     a section of its offices in the list column. The ministry itself is one tab further. -->
<div class="blad blad__indeling">
	<!-- The tab names the page, as on a list of Bladeren. -->
	<h1 class="blad__titel sr-only">Bronnen: Ambten</h1>
	<Inhoudsopgave items={groups.map((g) => ({ label: nameOf(g), id: anchorOf(g) }))} />
	<div class="blad__lijst">
		<div class="keuze">
			<Choice
				label="Ambten"
				opties={[
					{ waarde: 'nu', label: 'Nu bezet' },
					{ waarde: 'alle', label: 'Ook eerdere' }
				]}
				waarde={shown}
				onSelect={choose}
			/>
		</div>
		{#if seats.state.status !== 'ready'}
			<LoadState state={seats.state} what="De ambten" plural retry={seats.retry} />
		{:else}
			<div class="groepen">
				{#each groups as g (g.ministry)}
					<Sectie title={nameOf(g)} id={anchorOf(g)} niveau={2} inklapbaar={false} rijen>
						<SeatList seats={g.seats} />
					</Sectie>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.keuze {
		margin-bottom: var(--s-5);
	}
	/* The step between the groups of Bronnen. */
	.groepen {
		display: flex;
		flex-direction: column;
		--lezer-stap: var(--s-7);
		gap: var(--lezer-stap);
	}
	/* The groups hold few rows each: on a phone a step of a row's height tells them apart. */
	@media (max-width: 768px) {
		.groepen {
			--lezer-stap: var(--s-4);
		}
	}
</style>
