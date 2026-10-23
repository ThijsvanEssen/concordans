<script lang="ts">
	// The peildatum of the whole-law reader: the versions of the law by year, the text of today
	// first, as a line of the head.
	import { langeDatum, sinceDate, vandaag } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import type { Schema } from '$lib/api/types';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { versionsByYear } from './peildatum';
	import { peildatumLabel } from '$lib/text/peildatum-label';

	let {
		versions,
		peildatum,
		today = vandaag(),
		choose,
		verlopen = false,
		asFact = false
	}: {
		versions: Schema<'InstrumentVersionDTO'>[];
		peildatum: string | null;
		/** The day the reader is on; the day of the reader's clock when it is not given. */
		today?: string;
		/** Opens the text of a day; '' for today's. */
		choose: (day: string) => void;
		/** The law has expired: no text holds today, the last one is the newest version. */
		verlopen?: boolean;
		/** A cell of the head's facts (Feiten `strip`): its label over the menu. */
		asFact?: boolean;
	} = $props();

	const oldest = $derived(
		versions
			.map((v) => v.valid_from ?? '')
			.filter(Boolean)
			.sort()[0]
	);
	const newest = $derived(
		versions
			.map((v) => v.valid_from ?? '')
			.filter(Boolean)
			.sort()
			.at(-1)
	);
	// An expired law has no text of today: its last one is named by the day it began to hold.
	const lastText = $derived(verlopen && !peildatum);
	const label = $derived(peildatumLabel(lastText));
	const shown = $derived(langeDatum(peildatum ?? (lastText ? newest : today)));
</script>

{#snippet picker()}
	<TekstMenu {label} tekst={shown}>
		{#snippet inhoud(close)}
			<div class="peil-lijst">
				<span class="peil-noot"
					>{formatCount(versions.length)} versies {sinceDate(oldest ?? null)}</span
				>
				{#if !verlopen}
					<button
						type="button"
						role="menuitemradio"
						class="tekstmenu__item peil-menuitem"
						aria-checked={!peildatum}
						onclick={() => {
							close();
							choose('');
						}}>{langeDatum(today)}, vandaag</button
					>
				{/if}
				{#each versionsByYear(versions) as [year, list] (year)}
					<span class="peil-jaar" aria-hidden="true">{year}</span>
					{#each list as v (v.valid_from)}
						<button
							type="button"
							role="menuitemradio"
							class="tekstmenu__item peil-menuitem"
							aria-checked={peildatum ? peildatum === v.valid_from : verlopen && !!v.current}
							onclick={() => {
								close();
								choose(v.valid_from ?? '');
							}}
							>{langeDatum(v.valid_from)}{v.current
								? verlopen
									? ', laatste'
									: ', geldend'
								: ''}</button
						>
					{/each}
				{/each}
			</div>
		{/snippet}
	</TekstMenu>
{/snippet}

{#if asFact}
	<div class="field">
		<dt>{label}</dt>
		<dd class="as-fact">{@render picker()}</dd>
	</div>
{:else}
	<div class="whole-peil as-fact">
		<span>{label}</span>
		{@render picker()}
	</div>
{/if}

<style>
	/* A list that reads as a line of the head. */
	.whole-peil {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-2);
		margin-top: var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-2);
	}
	/* In the strip of facts and on the article's line the day is a value in the text's type, underlined in dots, with
	   its caret: no box among the other values (Thijs, 23 Oct). */
	.as-fact :global(.tekstmenu__knop) {
		height: auto;
		min-height: 0;
		padding: 0;
		gap: var(--s-1);
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 400;
		color: var(--ink);
		text-decoration: underline dotted var(--rule-strong);
		text-underline-offset: 4px;
	}
	/* The line keeps the height of a control, as its room is kept while the versions come
	   (ArticleReader .peil-plek). */
	.whole-peil.as-fact {
		align-items: center;
	}
	.whole-peil.as-fact :global(.tekstmenu__knop) {
		min-height: var(--veld-h);
	}
	/* A finger's target on a touch screen, unframed. */
	@media (pointer: coarse), (max-width: 768px) {
		.as-fact :global(.tekstmenu__knop),
		.whole-peil.as-fact :global(.tekstmenu__knop) {
			min-height: var(--veld-h-raak);
		}
	}
	.as-fact :global(.tekstmenu__knop:hover),
	.as-fact :global(.tekstmenu__knop[aria-expanded='true']) {
		text-decoration-color: var(--ink);
	}
	.peil-lijst {
		display: flex;
		flex-direction: column;
		max-height: 60vh;
		overflow-y: auto;
	}
	.peil-noot,
	.peil-jaar {
		padding: var(--s-1) var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.peil-jaar {
		padding-top: var(--s-2);
		font-weight: 600;
	}
	.peil-menuitem {
		white-space: nowrap;
	}
</style>
