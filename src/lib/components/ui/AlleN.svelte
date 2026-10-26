<script lang="ts">
	// The one way on from a short list: "Alle 244 uitspraken" and "Minder" once open, and
	// "Volgende 25 uitspraken, nog 219" where the list goes on page by page (docs/bediening.md).
	// A text link in ink under the list; the count in the words, not in a sentence beside them.
	import TekstLink from './TekstLink.svelte';
	import { formatCount } from '$lib/text/getal';

	let {
		aantal = null,
		noun,
		open = false,
		volgende = false,
		woord = 'Volgende',
		stap = null,
		rest = null,
		laden = false,
		opnieuw = false,
		href,
		onclick
	}: {
		/** How many there are; without it "Alle {noun}". */
		aantal?: number | null;
		/** The bronnen in the plural: `uitspraken`, `stukken`; of one, as it is singular: `1 stuk`, never "Alle 1". */
		noun: string;
		/** The list stands whole: "Minder" folds it again. */
		open?: boolean;
		/** The list goes on in pages: "Volgende {stap} {noun}, nog {rest}" loads the next one in place. */
		volgende?: boolean;
		/** `volgende`: the first word; a list from new to old says `Eerdere`: "Eerdere dagen". */
		woord?: string;
		/** `volgende`: how many the next page brings; without it "Volgende {noun}". */
		stap?: number | null;
		/** `volgende`: how many are still to come, this page included; without it no "nog". */
		rest?: number | null;
		/** `volgende`: the next page is on its way: "Laden…", no link. */
		laden?: boolean;
		/** `volgende`: the last ask failed; "Opnieuw" asks it again. */
		opnieuw?: boolean;
		href?: string;
		onclick?: (e: MouseEvent) => void;
	} = $props();

	// One item is already on show: "Alle 1 besluit" says nothing and is no way on (E9 D).
	const toon = $derived(volgende || open || aantal == null || aantal > 1);
	const volgendeWoorden = $derived.by(() => {
		const aantalNu = rest != null && stap != null ? Math.min(stap, rest) : stap;
		const eerst =
			aantalNu != null ? `${woord} ${formatCount(aantalNu)} ${noun}` : `${woord} ${noun}`;
		return rest != null && (stap == null || rest > stap)
			? `${eerst}, nog ${formatCount(rest)}`
			: eerst;
	});
	const woorden = $derived(
		volgende
			? opnieuw
				? 'Opnieuw'
				: volgendeWoorden
			: open
				? 'Minder'
				: aantal === 1
					? `1 ${noun}`
					: aantal != null
						? `Alle ${formatCount(aantal)} ${noun}`
						: `Alle ${noun}`
	);
</script>

{#if volgende && laden}
	<span class="alle-n alle-n--laden" role="status">Laden…</span>
{:else if toon}
	<TekstLink
		class="alle-n"
		{href}
		{onclick}
		aria-expanded={!volgende && !href && onclick ? open : undefined}>{woorden}</TekstLink
	>
{/if}

<style>
	.alle-n--laden {
		font-family: var(--font-serif);
		color: var(--ink-3);
	}
</style>
