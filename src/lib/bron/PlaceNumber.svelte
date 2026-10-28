<script module lang="ts">
	// The number of a place in a text read in place (an overweging, an alinea): in the margin
	// before it, and its menu where it has one (PlaatsMenu). One component for every reader of
	// numbered places: the judgment and the Kamerstuk, and their overweging and alinea in a
	// bundel. What the place around it gives: its box (`plaats-blok`, with `is-open` while its
	// menu is), where the number stands and its letter.
	import { afterTick } from '$lib/util/after-tick';
	import { report } from '$lib/api/errors';
	import { measurePlaces } from './place-column';

	/**
	 * `use:placeColumn={key}` on the text: its widest number as `--plaats-num` (rounded up to the
	 * 4 px scale), for the margin it stands in to grow to it, so "5.3.2.1" or alinea 10000 fits
	 * as "2.1" does. Measured again when `key` changes (another text) and once the letters
	 * have come.
	 */
	export function placeColumn(node: HTMLElement, key?: unknown) {
		let gone = false;
		const measure = () => {
			if (!gone) measurePlaces(node);
		};
		const soon = () => {
			afterTick(measure);
			document.fonts?.ready.then(measure).catch((e) => report('Na het laden van de letters', e));
		};
		soon();
		return {
			update(next: unknown) {
				if (next !== key) {
					key = next;
					soon();
				}
			},
			destroy() {
				gone = true;
			}
		};
	}
</script>

<script lang="ts">
	let {
		number,
		label,
		open = false,
		quiet = false,
		onopen = null
	}: {
		/** As the text prints it: `5.3.2.1`, `10000`. */
		number: string | number;
		/** What the place is, for a screen reader: `Overweging 5.1`, `Alinea 4`. */
		label: string;
		/** Whether its menu is open. */
		open?: boolean;
		/** Nothing at rest: a number the text itself does not print (an alinea). */
		quiet?: boolean;
		/** Opens its menu, from the number; without it the number is no menu. */
		onopen?: ((marker: HTMLElement) => void) | null;
	} = $props();
</script>

{#if onopen}
	{@const pick = onopen}
	<button
		type="button"
		class="plaats-marker plaats-nummer"
		class:quiet
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="{label}: citeren, bewaren"
		onclick={(e) => pick(e.currentTarget)}>{number}</button
	>
{:else}
	<span class="plaats-nummer" class:quiet>{number}</span>
{/if}

<style>
	/* The number on one line, whatever its length; while its place is pointed at, open or
	   focused it is underlined, with ▾ under it, so it is never wider than the number. */
	.plaats-nummer {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		/* The size of the text beside it, so that both stand on one line. */
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-3);
		text-align: right;
		white-space: nowrap;
		user-select: none;
	}
	.plaats-marker {
		cursor: pointer;
	}
	.quiet {
		color: transparent;
	}
	:global(.plaats-blok:hover) .plaats-marker,
	:global(.plaats-blok.is-open) .plaats-marker,
	.plaats-marker:focus-visible {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	:global(.plaats-blok:hover) .plaats-marker::after,
	:global(.plaats-blok.is-open) .plaats-marker::after,
	.plaats-marker:focus-visible::after {
		content: '▾';
		font-size: 0.7em;
		line-height: 1;
		color: var(--ink-3);
		text-decoration: none;
	}
	.plaats-marker:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
