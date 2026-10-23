<script lang="ts">
	// One line of controls under the heading of a group of judgments (docs/bediening.md): their
	// order, and the year and the court behind one text menu.
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { formatCount } from '$lib/text/getal';
	import { RECHTERS, type Court, type Rechter, type VerbondenFilter } from './filter';
	import type { Group } from './groups';
	import type { JudgmentOrder } from './loaders';

	let {
		orders,
		order,
		onOrder,
		years,
		courts,
		areas,
		filter,
		onFilter
	}: {
		/** The orders the group's loader can ask; none where it has one. */
		orders?: Group['orders'];
		order: JudgmentOrder;
		onOrder: (order: JudgmentOrder) => void;
		/** The judgments per year; none where the group cannot be cut by year. */
		years: { year: number; count: number }[];
		/** The judgments per rechter over the whole group, where the API counts them. */
		courts?: Partial<Record<Court, number>>;
		/** The judgments per main area of law over the whole group, where the API counts them. */
		areas?: { area: string; count: number }[];
		filter: VerbondenFilter;
		onFilter: (f: VerbondenFilter) => void;
	} = $props();

	const rechter = $derived(RECHTERS.find((r) => r.id === filter.rechter));
	// Where the API counts the courts, only those that have judgments (and the one chosen).
	const choices = $derived(
		RECHTERS.filter((r) => !courts || courts[r.id] || filter.rechter === r.id)
	);
</script>

<div class="regel">
	{#if orders}
		<!-- Newest first, or the most cited first: the standard judgments on top (UX-15). A text
		     menu as the year and the court are: one quiet line of two choices (A208c). -->
		<TekstMenu
			label="Volgorde"
			opties={orders.map((o) => ({ waarde: o.value, label: o.label }))}
			waarde={order}
			onSelect={(o) => {
				if (o !== order) onOrder(o);
			}}
		/>
	{/if}
	{#if years.length > 0}
		<TekstMenu
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
						{#each [{ id: null, label: 'Alle rechters' }, ...choices] as r (r.id ?? 'alle')}
							<button
								type="button"
								role="menuitemradio"
								class="tekstmenu__item jaar-rechter__item"
								aria-checked={(filter.rechter ?? null) === r.id}
								onclick={() => {
									sluit();
									onFilter({ ...filter, rechter: (r.id as Rechter | null) ?? null });
								}}
								>{r.label}{#if r.id && courts?.[r.id]}<span class="jaar-rechter__tel"
										>{formatCount(courts[r.id] ?? 0)}</span
									>{/if}</button
							>
						{/each}
					</div>
				</div>
			{/snippet}
		</TekstMenu>
	{/if}
	{#if areas?.length || filter.rechtsgebied}
		<TekstMenu rechts label="Rechtsgebied" tekst={filter.rechtsgebied ?? 'Alle rechtsgebieden'}>
			{#snippet inhoud(sluit)}
				<div class="jaar-rechter__lijst" role="group" aria-label="Rechtsgebied">
					{#each [{ area: null, count: null }, ...(areas ?? [])] as a (a.area ?? 'alle')}
						<button
							type="button"
							role="menuitemradio"
							class="tekstmenu__item jaar-rechter__item"
							aria-checked={(filter.rechtsgebied ?? null) === a.area}
							onclick={() => {
								sluit();
								onFilter({ ...filter, rechtsgebied: a.area });
							}}
							>{a.area ?? 'Alle rechtsgebieden'}{#if a.count}<span class="jaar-rechter__tel"
									>{formatCount(a.count)}</span
								>{/if}</button
						>
					{/each}
				</div>
			{/snippet}
		</TekstMenu>
	{/if}
</div>

<style>
	/* One line: the order at the left, the year and the court at the right, as words in the
	   text's letter with a quiet line under them, not two boxes over each other (A208c). */
	.regel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2) var(--s-4);
		padding: 0 var(--s-4) var(--s-2);
	}
	.regel :global(.tekstmenu__knop) {
		height: auto;
		padding: 0;
		gap: var(--s-1);
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: underline dotted var(--rule-strong);
		text-underline-offset: 4px;
	}
	.regel :global(.tekstmenu__knop:hover),
	.regel :global(.tekstmenu__knop[aria-expanded='true']) {
		color: var(--ink);
		text-decoration-color: var(--ink);
	}
	/* A finger's 44 px each on a touch screen, unframed. */
	@media (pointer: coarse), (max-width: 768px) {
		.regel :global(.tekstmenu__knop) {
			min-height: var(--veld-h-raak);
		}
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
