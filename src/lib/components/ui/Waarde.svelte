<script lang="ts" module>
	/** A value is missing when the data has none: null, undefined, an empty string or list. Zero is a value. */
	export function ontbreekt(value: unknown): boolean {
		return value == null || value === '' || (Array.isArray(value) && value.length === 0);
	}
</script>

<script lang="ts">
	// The one form for a value that can be missing. No sign fills the gap: a missing value
	// stays empty, with "niet in de gegevens" for a screen reader, so an empty cell is not
	// read out as nothing. Where the absence is what the reader looks for (an outcome, an
	// advice, a date), `nodig` shows those words.
	let {
		value,
		nodig = false
	}: {
		value: string | number | null | undefined;
		/** Show "niet in de gegevens" when the value is missing, instead of leaving it empty. */
		nodig?: boolean;
	} = $props();
</script>

{#if !ontbreekt(value)}{value}{:else if nodig}<span class="leeg">niet in de gegevens</span
	>{:else}<span class="sr-only">niet in de gegevens</span>{/if}

<style>
	.leeg {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>
