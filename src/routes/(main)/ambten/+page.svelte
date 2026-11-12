<script lang="ts">
	// The offices (/ambten, B110, B148): per ministry the offices held today, each with its holder,
	// to its page with every holder and what is attributed to it. "Ook eerdere" adds the offices
	// nobody holds today (`?ambten=alle`): a former office or a gap, not filled in.
	import { page } from '$app/state';
	import { getSeats } from '$lib/api/seats';
	import MinistryLink from '$lib/bron/MinistryLink.svelte';
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
</script>

<RouteKop />

<SourceTabs label={government.label} tabs={sourceTabs(government)} current="/ambten" />

<div class="blad blad--tekst">
	<header class="blad__kop"><h1 class="blad__titel">Ambten</h1></header>
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
		{#each groups as g (g.ministry)}
			<section class="ministerie">
				<h2 class="ministerie__naam">
					{#if g.ministry}<MinistryLink ministry={g.ministry} name={g.name || null} />{:else}Zonder
						ministerie{/if}
				</h2>
				<SeatList seats={g.seats} />
			</section>
		{/each}
	{/if}
</div>

<style>
	.keuze {
		margin-bottom: var(--s-4);
	}
	.ministerie + .ministerie {
		margin-top: var(--s-6);
	}
	.ministerie__naam {
		margin: 0 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.ministerie__naam :global(a) {
		color: inherit;
	}
</style>
