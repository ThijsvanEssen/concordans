<script lang="ts">
	// The one way on from a short list to all of it: "Alle 244 uitspraken", and "Minder" once
	// open (docs/bediening.md). A text link in ink under the list; the count in the words, not
	// in a sentence beside them.
	import TekstLink from './TekstLink.svelte';
	import { formatCount } from '$lib/verbonden/filter';

	let {
		aantal = null,
		noun,
		open = false,
		href,
		onclick
	}: {
		/** How many there are; without it "Alle {noun}". */
		aantal?: number | null;
		/** The bronnen in the plural: `uitspraken`, `stukken`. */
		noun: string;
		/** The list stands whole: "Minder" folds it again. */
		open?: boolean;
		href?: string;
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const woorden = $derived(
		open ? 'Minder' : aantal != null ? `Alle ${formatCount(aantal)} ${noun}` : `Alle ${noun}`
	);
</script>

<TekstLink class="alle-n" {href} {onclick}>{woorden}</TekstLink>
