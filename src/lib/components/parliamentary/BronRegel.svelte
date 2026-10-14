<script lang="ts">
	// The line under what the Eerste Kamer (or another source) gave: when the composition was
	// read and since when the data run, then the source as a link, and when it was consulted.
	// `Samenstelling op 1 oktober 2026, gegevens sinds 1 januari 2003. Bron: Eerste Kamer.`
	// `Bron: Eerste Kamer der Staten-Generaal, www.eerstekamer.nl, geraadpleegd op 2 oktober 2026.`
	import { langeDatum } from '$lib/text/datum';

	let {
		composedOn = null,
		dataSince = null,
		readOn = null,
		label,
		href,
		afterList = false
	}: {
		/** The day of the composition shown. */
		composedOn?: string | null;
		/** The first day the source's data cover; said only with `composedOn`. */
		dataSince?: string | null;
		/** The day the source was consulted. */
		readOn?: string | null;
		label: string | null | undefined;
		href: string | null | undefined;
		/** Under a list, with room above it. */
		afterList?: boolean;
	} = $props();

	const composed = $derived(
		composedOn
			? `Samenstelling op ${langeDatum(composedOn)}${dataSince ? `, gegevens sinds ${langeDatum(dataSince)}` : ''}. `
			: ''
	);
	const read = $derived(readOn ? `, geraadpleegd op ${langeDatum(readOn)}` : '');
</script>

<p class="source-line" class:source-line--after-list={afterList}>
	{composed}Bron: <a href={href ?? undefined} rel="external">{label ?? ''}</a>{read}.
</p>

<style>
	.source-line {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.source-line--after-list {
		margin-top: var(--s-4);
	}
	.source-line a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--rule);
		text-underline-offset: 2px;
	}
	.source-line a:hover {
		color: var(--ink);
		text-underline-offset: 3px;
	}
</style>
