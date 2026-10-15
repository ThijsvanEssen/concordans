<script lang="ts">
	// One line of controls under the heading of a group of judgments (docs/bediening.md): their
	// order, and the year and the court behind one text menu.
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { formatCount } from '$lib/text/getal';
	import { RECHTERS, type Rechter, type VerbondenFilter } from './filter';
	import type { Group } from './groups';
	import type { JudgmentOrder } from './loaders';

	let {
		orders,
		order,
		onOrder,
		years,
		filter,
		onFilter
	}: {
		/** The orders the group's loader can ask; none where it has one. */
		orders?: Group['orders'];
		order: JudgmentOrder;
		onOrder: (order: JudgmentOrder) => void;
		/** The judgments per year; none where the group cannot be cut by year. */
		years: { year: number; count: number }[];
		filter: VerbondenFilter;
		onFilter: (f: VerbondenFilter) => void;
	} = $props();

	const rechter = $derived(RECHTERS.find((r) => r.id === filter.rechter));
</script>

<div class="regel">
	{#if orders}
		<!-- Newest first, or the most cited first: the standard judgments on top (UX-15). -->
		<Keuze
			label="Volgorde"
			klein
			opties={orders.map((o) => ({ waarde: o.value, label: o.label }))}
			waarde={order}
			onKies={(o) => {
				if (o !== order) onOrder(o);
			}}
		/>
	{/if}
	{#if years.length > 0}
		<TekstMenu
			klein
			rechts
			label="Jaar en rechter"
			tekst="{filter.jaar ?? 'Alle jaren'}, {rechter?.label.toLowerCase() ?? 'alle rechters'}"
		>
			{#snippet inhoud(sluit)}
				<div class="jaar-rechter">
					<div class="jaar-rechter__lijst" role="group" aria-label="Jaar">
						{#each [{ year: null, count: null }, ...[...years]
								.reverse()
								.filter((x) => x.count)] as x (x.year ?? 'alle')}
							<button
								type="button"
								role="menuitemradio"
								class="tekstmenu__item jaar-rechter__item"
								aria-checked={(filter.jaar ?? null) === x.year}
								onclick={() => {
									sluit();
									onFilter({ ...filter, jaar: x.year });
								}}
								>{x.year ?? 'Alle jaren'}{#if x.count}<span class="jaar-rechter__tel"
										>{formatCount(x.count)}</span
									>{/if}</button
							>
						{/each}
					</div>
					<div class="jaar-rechter__lijst" role="group" aria-label="Rechter">
						{#each [{ id: null, label: 'Alle rechters' }, ...RECHTERS] as r (r.id ?? 'alle')}
							<button
								type="button"
								role="menuitemradio"
								class="tekstmenu__item jaar-rechter__item"
								aria-checked={(filter.rechter ?? null) === r.id}
								onclick={() => {
									sluit();
									onFilter({ ...filter, rechter: (r.id as Rechter | null) ?? null });
								}}>{r.label}</button
							>
						{/each}
					</div>
				</div>
			{/snippet}
		</TekstMenu>
	{/if}
</div>

<style>
	.regel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2) var(--s-4);
		padding: 0 var(--s-4) var(--s-2);
	}
	.jaar-rechter {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0 var(--s-2);
		max-height: 60vh;
		overflow-y: auto;
	}
	.jaar-rechter__lijst {
		display: flex;
		flex-direction: column;
	}
	.jaar-rechter__item {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		white-space: nowrap;
	}
	.jaar-rechter__tel {
		color: var(--ink-3);
	}
</style>
