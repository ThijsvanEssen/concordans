<script lang="ts">
	// The peildatum of the whole-law reader: the versions of the law by year, the text of today
	// first, as a line of the head.
	import { langeDatum } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import type { Schema } from '$lib/api/types';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { versionsByYear } from './peildatum';

	let {
		versions,
		peildatum,
		today,
		choose
	}: {
		versions: Schema<'InstrumentVersionDTO'>[];
		peildatum: string | null;
		today: string;
		/** Opens the text of a day; '' for today's. */
		choose: (day: string) => void;
	} = $props();

	const oldest = $derived(
		versions
			.map((v) => v.valid_from ?? '')
			.filter(Boolean)
			.sort()[0]
	);
</script>

<div class="whole-peil">
	<span>Tekst geldend op</span>
	<TekstMenu label="Tekst geldend op" tekst={langeDatum(peildatum ?? today)}>
		{#snippet inhoud(sluit)}
			<div class="peil-lijst">
				<span class="peil-noot"
					>{formatCount(versions.length)} versies sinds {langeDatum(oldest ?? null)}</span
				>
				<button
					type="button"
					role="menuitemradio"
					class="tekstmenu__item peil-menuitem"
					aria-checked={!peildatum}
					onclick={() => {
						sluit();
						choose('');
					}}>{langeDatum(today)}, vandaag</button
				>
				{#each versionsByYear(versions) as [year, list] (year)}
					<span class="peil-jaar" aria-hidden="true">{year}</span>
					{#each list as v (v.valid_from)}
						<button
							type="button"
							role="menuitemradio"
							class="tekstmenu__item peil-menuitem"
							aria-checked={peildatum === v.valid_from}
							onclick={() => {
								sluit();
								choose(v.valid_from ?? '');
							}}>{langeDatum(v.valid_from)}{v.current ? ', geldend' : ''}</button
						>
					{/each}
				{/each}
			</div>
		{/snippet}
	</TekstMenu>
</div>

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
