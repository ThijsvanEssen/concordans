<script lang="ts">
	// The seats of a cabinet (Thijs, 10 Oct: the coalition is a cabinet's at a point in time,
	// not the Kamer's), per Kamer in KamerZetels: the coalition's seats as the head figure, their
	// course over the period, the hall of the day chosen (concept 16, variant B). One day for
	// both Kamers (?zetels=); a step in either sets it. The Eerste Kamer always has its section,
	// with a quiet line where the data has nothing for this cabinet (partial over waiting). A
	// cabinet from before 30 November 2006 has no seats per day: no sections. The phases
	// (demissionair and after) stand over the steps, as over the posts.
	import { page } from '$app/state';
	import { navigate, withParams } from '$lib/util/address';
	import KamerZetels from './KamerZetels.svelte';
	import { getCabinetSeats } from '$lib/api/records';
	import { vandaag } from '$lib/text/datum';
	import type { Schema } from '$lib/api/types';

	type Stuk = Schema<'SeatStretchDTO'>;

	let {
		kabinet,
		fasen = []
	}: {
		kabinet: string;
		/** The cabinet's phases from its record, once that is in (phaseStarts). */
		fasen?: { van: string; label: string }[];
	} = $props();

	let zetels = $state<Schema<'CabinetSeatsResponse'> | null>(null);

	$effect(() => {
		const key = kabinet;
		let weg = false;
		zetels = null;
		getCabinetSeats(key)
			.then((z) => {
				if (!weg) zetels = z;
			})
			.catch(() => {});
		return () => {
			weg = true;
		};
	});

	const dag = vandaag();
	/** The cabinet's last day, or today while it is in office. */
	const eind = $derived(zetels ? (zetels.to_date ?? dag) : dag);
	/** The day the halls show: ?zetels= when it falls in the period, else the last day. */
	const opDag = $derived.by(() => {
		const d = page.url.searchParams.get('zetels');
		return zetels?.from_date && d && d >= zetels.from_date && d <= eind ? d : eind;
	});

	/** The halls on the first day of a stretch; the last stretch is the halls without ?zetels. */
	const kies = (s: Stuk) =>
		navigate(
			withParams(page.url, { zetels: !s.to_date || s.to_date >= eind ? null : s.from_date })
		);
</script>

{#if zetels?.tk?.length}
	<!-- One section per Kamer, so either closes on its own (Thijs, 10 Oct). -->
	<KamerZetels
		kamer="TK"
		stukken={zetels.tk}
		meerderheid={zetels.majority.TK ?? 76}
		van={zetels.from_date ?? null}
		{eind}
		dag={opDag}
		kabinet={zetels.key}
		onKies={kies}
		{fasen}
	/>
	<KamerZetels
		kamer="EK"
		stukken={zetels.ek ?? []}
		meerderheid={zetels.majority.EK ?? 38}
		van={zetels.from_date ?? null}
		{eind}
		dag={opDag}
		kabinet={zetels.key}
		onKies={kies}
		{fasen}
	/>
{/if}
