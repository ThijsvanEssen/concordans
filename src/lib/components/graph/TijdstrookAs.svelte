<script lang="ts">
	// The years named under the bars of the Tijdstrook: under them, a space of its own between,
	// and as many as fit the width: the first and the last always, between them every second,
	// fifth or tenth year (axisYears). A year in the period is ink, outside it rule.
	import { axisYears } from '$lib/bron/strook';

	let {
		eerste,
		laatste,
		van,
		tot,
		uiteinden = false
	}: {
		eerste: number;
		laatste: number;
		/** The period chosen, by its years; null where all years are. */
		van: number | null;
		tot: number | null;
		/** Only the first and the last year (the strip of a phone at rest). */
		uiteinden?: boolean;
	} = $props();

	let breedte = $state(0);
	const jaren = $derived(
		uiteinden
			? [
					{ jaar: eerste, align: 'start' as const },
					{ jaar: laatste, align: 'end' as const }
				]
			: axisYears(eerste, laatste, breedte)
	);
	const kolom = $derived(breedte / (laatste - eerste + 1));
</script>

<div class="as" aria-hidden="true" bind:clientWidth={breedte}>
	{#each jaren as j (j.jaar)}
		<span
			data-jaar={j.jaar}
			data-uitlijning={j.align}
			class:is-in={(van !== null || tot !== null) &&
				j.jaar >= (van ?? eerste) &&
				j.jaar <= (tot ?? laatste)}
			style:left={j.align === 'start'
				? '0'
				: j.align === 'end'
					? '100%'
					: `${(j.jaar - eerste + 0.5) * kolom}px`}>{j.jaar}</span
		>
	{/each}
</div>

<style>
	.as {
		position: relative;
		height: var(--s-4);
		margin-top: var(--s-1);
	}
	.as span {
		position: absolute;
		top: 0;
		white-space: nowrap;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 1;
		color: var(--ink-3);
	}
	.as span[data-uitlijning='mid'] {
		transform: translateX(-50%);
	}
	.as span[data-uitlijning='end'] {
		transform: translateX(-100%);
	}
	.as span.is-in {
		color: var(--ink);
	}
</style>
