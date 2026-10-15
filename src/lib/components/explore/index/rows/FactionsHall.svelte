<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { getParliamentSeats } from '$lib/api/records';
	import { bronHref } from '$lib/bron/href';
	import { fractieNaam, naamVan } from '$lib/bron/menselijk';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { ekListSource } from '$lib/components/parliamentary/chamber';
	import { langeDatum } from '$lib/text/datum';
	import { load } from '$lib/util/load.svelte';
	import Hemicycle from '../../Hemicycle.svelte';
	import ZaalTegenover from '../../ZaalTegenover.svelte';
	import ZaalLegenda from '../../ZaalLegenda.svelte';
	import { indelingMarkering } from '../../zaaltegenover';
	import { kleurVan } from '../../partijkleuren.svelte';
	import type { ViewProps } from '../lists/list';

	// The hall of the Kamer over its fracties, with its legend (asked once per Kamer).
	let { ctx }: ViewProps<Schema<'FactionDTO'>, object> = $props();

	const hall = load(
		() => ctx.p.kamer,
		(chamber) => getParliamentSeats(chamber),
		'Zaal van de Kamer'
	);
	const seats = $derived(hall.state.status === 'ready' ? hall.state.data : null);
	/** The Eerste Kamer's composition as read from its site, which its fracties carry. */
	const composition = $derived.by(() => {
		const source = ctx.p.kamer === 'EK' ? ctx.rows?.[0]?.source : null;
		return source ? ekListSource(source) : null;
	});
	// The cabinet in office on the day of the hall and its fracties (API 0.79.33): one line
	// to the cabinet, whose reader shows its seats (Thijs, 10 Oct: the coalition is the
	// cabinet's, not the Kamer's).
	const coalitionLine = $derived.by(() => {
		const kabinet = seats?.cabinet;
		if (!seats || !kabinet?.key) return null;
		const fracties = [...seats.factions]
			.filter((f) => f.coalition === true)
			.sort((a, b) => b.seats - a.seats)
			.map((f) => fractieNaam(f));
		return {
			naam: kabinet.name ?? naamVan('cabinets', kabinet),
			href: bronHref(`cabinets/${kabinet.key}`, { keepMode: false, mode: 'read' }),
			fracties
		};
	});

	/** The members of each sitting fractie, from the list the hall heads. */
	const members = $derived(
		new Map(
			(ctx.rows ?? []).flatMap((f) => (f.member_count != null ? [[f.key, f.member_count]] : []))
		)
	);
	/** The source by its name; the link holds its address (`…, www.eerstekamer.nl`). */
	const sourceName = (attribution: string) => attribution.replace(/,\s*www\.\S+$/, '');

	/** The numbered places of each hall, as the Kamers' own plans name them. */
	const PLAATSEN_EK = ['Voorzitter', 'Griffie', 'Regering', 'Verslag en redactie'];
	const PLAATSEN_TK = [
		'Voorzitter',
		'Griffier',
		'Kabinet (vak-K)',
		'Verslag en redactie',
		'Spreekgestoelte',
		'Interruptiemicrofoons',
		'Bodedienst'
	];
</script>

{#if hall.state.status === 'error'}
	<LoadState state={hall.state} what="De zaal" retry={hall.retry} />
{:else if !seats || seats.chamber !== ctx.p.kamer}
	<!-- The hall's place kept while it loads, so nothing below it moves. -->
	<div class="hemi-card hemi-card--loading">
		<p class="sr-only" role="status">Laden…</p>
	</div>
{:else}
	<div class="hemi-card">
		<div class="hemi-svg-wrap">
			{#if seats.chamber === 'EK'}
				<ZaalTegenover data={seats} />
			{:else}
				<Hemicycle
					data={seats}
					meubels
					colorOf={(f, i) => kleurVan('TK', fractieNaam(f), i, f.color ?? null)}
				/>
			{/if}
			<ZaalLegenda
				data={seats}
				kolommen={2}
				rijen={10}
				coalitie={coalitionLine}
				{members}
				peil={[
					`Samenstelling op ${langeDatum(
						(seats.chamber === 'EK' ? composition?.composition_date : null) ?? seats.as_of ?? null
					)}`,
					indelingMarkering(seats)
				]
					.filter(Boolean)
					.join('. ')}
				bron={seats.chamber === 'EK'
					? composition
						? { label: sourceName(composition.attribution), href: composition.url }
						: null
					: seats.seating_plan
						? {
								label: seats.seating_plan.title ?? 'Zetelverdeling',
								href: seats.seating_plan.page ?? seats.seating_plan.url ?? ''
							}
						: null}
				plaatsen={seats.chamber === 'EK' ? PLAATSEN_EK : PLAATSEN_TK}
				ruimte={seats.chamber === 'EK' ? PLAATSEN_TK : PLAATSEN_EK}
			/>
		</div>
	</div>
{/if}

<style>
	/* De zaal zonder kader of vlak. */
	/* The hall and its legend side by side, using the width of the list; under each other
	   where the list is narrow. */
	.hemi-card {
		margin-bottom: var(--s-6);
	}
	/* About the height of the hall and its legend, at each width (1440: 440, 375: 730). */
	.hemi-card--loading {
		height: 440px;
		border-radius: var(--r-1);
		background: var(--paper-2);
	}
	.hemi-svg-wrap {
		display: grid;
		grid-template-columns: 456px minmax(0, 1fr);
		column-gap: var(--s-7);
		align-items: center;
		justify-items: center;
	}
	.hemi-svg-wrap :global(.leg) {
		margin: 0;
		justify-self: stretch;
	}
	.hemi-svg-wrap :global(.hemicycle) {
		justify-self: stretch;
	}
	/* Both halls exactly as high, whatever their shape; the width follows. */
	.hemi-svg-wrap :global(.hemicycle svg),
	.hemi-svg-wrap :global(.zaal svg) {
		width: auto;
		max-width: 100%;
		height: 300px;
		max-height: none;
	}
	@media (max-width: 1100px) {
		.hemi-card--loading {
			height: 760px;
		}
		.hemi-svg-wrap {
			grid-template-columns: minmax(0, 1fr);
			row-gap: var(--s-4);
		}
	}
	/* On a phone both halls in the box of the Tweede Kamer's (440 by 291) as wide as the
	   column: as high as each other, at one scale, no empty band. */
	@media (max-width: 520px) {
		.hemi-card--loading {
			height: 728px;
		}
		.hemi-svg-wrap :global(.hemicycle svg),
		.hemi-svg-wrap :global(.zaal svg) {
			width: 100%;
			height: auto;
			aspect-ratio: 440 / 291;
		}
		.hemi-svg-wrap :global(.zaal) {
			justify-self: stretch;
		}
	}
	.hemi-svg-wrap :global(.hemicycle) {
		background: transparent;
	}
</style>
