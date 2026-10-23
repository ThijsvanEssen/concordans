<script lang="ts">
	// The seats of a cabinet (Thijs, 10 Oct: the coalition is a cabinet's at a point in time,
	// not the Kamer's), per Kamer in KamerZetels: the coalition's seats as the head figure, their
	// course over the period, the hall of the day chosen (concept 16, variant B). One day for
	// both Kamers (?zetels=); a step in either sets it. The Eerste Kamer always has its section,
	// with a quiet line where the data has nothing for this cabinet (partial over waiting). A
	// cabinet from before 30 November 2006 has no seats per day: no sections; a failure says so. The phases
	// (demissionair and after) stand over the steps, as over the posts.
	import { page } from '$app/state';
	import { navigate, withParams } from '$lib/util/address';
	import KamerZetels from './KamerZetels.svelte';
	import { getCabinetSeats } from '$lib/api/records';
	import { vandaag } from '$lib/text/datum';
	import type { Schema } from '$lib/api/types';
	import { load } from '$lib/util/load.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';

	type Stuk = Schema<'SeatStretchDTO'>;

	let {
		kabinet,
		fasen = []
	}: {
		kabinet: string;
		/** The cabinet's phases from its record, once that is in (phaseStarts). */
		fasen?: { van: string; label: string }[];
	} = $props();

	const seats = load(
		() => kabinet,
		(key) => getCabinetSeats(key),
		'Zetels van het kabinet'
	);
	const zetels = $derived(seats.state.status === 'ready' ? seats.state.data : null);

	const dag = vandaag();
	/** The cabinet's last day, or today while it is in office. */
	const eind = $derived(zetels ? (zetels.to_date ?? dag) : dag);
	/** The day the halls show: ?zetels= when it falls in the period, else the last day. */
	const opDag = $derived.by(() => {
		const d = page.url.searchParams.get('zetels');
		return zetels?.from_date && d && d >= zetels.from_date && d <= eind ? d : eind;
	});

	// The two Kamers stand once both halls have answered, unseen before: the hall of one that
	// comes later does not push the other down (R3-L F3). Three seconds at most.
	let tkReady = $state(false);
	let ekReady = $state(false);
	let waited = $state(false);
	$effect(() => {
		const t = setTimeout(() => {
			waited = true;
		}, 3000);
		return () => clearTimeout(t);
	});
	const shown = $derived(waited || (tkReady && ekReady));

	/** The halls on the first day of a stretch; the last stretch is the halls without ?zetels. */
	const kies = (s: Stuk) =>
		navigate(
			withParams(page.url, { zetels: !s.to_date || s.to_date >= eind ? null : s.from_date })
		);
</script>

{#if seats.state.status === 'error'}
	<LoadState state={seats.state} what="De zetelverdeling" retry={seats.retry} />
{:else if zetels?.tk?.length}
	<!-- One section per Kamer, open and side by side where the column has room for both; on a
	     phone under each other (Thijs, 23 Oct, A190). -->
	<div class="chambers" data-wacht={!shown || undefined}>
		<KamerZetels
			kamer="TK"
			bind:ready={tkReady}
			stretches={zetels.tk}
			meerderheid={zetels.majority.TK ?? 76}
			from={zetels.from_date ?? null}
			to={eind}
			dag={opDag}
			kabinet={zetels.key}
			onSelect={kies}
			{fasen}
		/>
		<KamerZetels
			kamer="EK"
			bind:ready={ekReady}
			stretches={zetels.ek ?? []}
			meerderheid={zetels.majority.EK ?? 38}
			from={zetels.from_date ?? null}
			to={eind}
			dag={opDag}
			kabinet={zetels.key}
			onSelect={kies}
			{fasen}
		/>
	</div>
{/if}

<style>
	/* Two columns where each has the room of a hall and its two sides, else one. */
	.chambers[data-wacht] {
		visibility: hidden;
	}
	.chambers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 336px), 1fr));
		gap: var(--s-5) var(--s-6);
		align-items: start;
		/* The grid spaces the sections; a section's own step before it falls away (Sectie). */
		--lezer-stap: var(--s-5);
	}
</style>
