<script lang="ts">
	// One row of the search list: a choice the keys and the pointer move over, that opens on a
	// plain click. A row with an address is a link, so a new tab can open it.
	import type { Snippet } from 'svelte';
	import { gewoneKlik } from '$lib/actions/klik';

	let {
		id,
		active,
		href,
		citation = false,
		onchoose,
		onpoint,
		children
	}: {
		id: string;
		active: boolean;
		/** Where the row leads; without, a click is its only way. */
		href?: string;
		/** A row for what the query cites: its kind and title on one line. */
		citation?: boolean;
		onchoose: () => void;
		onpoint: (e: PointerEvent) => void;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a
		{id}
		class="row"
		class:row--citation={citation}
		class:is-active={active}
		role="option"
		tabindex="-1"
		aria-selected={active}
		{href}
		onclick={(e) => {
			if (!gewoneKlik(e)) return;
			e.preventDefault();
			onchoose();
		}}
		onpointermove={onpoint}>{@render children()}</a
	>
{:else}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		{id}
		class="row"
		class:row--citation={citation}
		class:is-active={active}
		role="option"
		tabindex="-1"
		aria-selected={active}
		onclick={onchoose}
		onpointermove={onpoint}
	>
		{@render children()}
	</div>
{/if}

<style>
	.row {
		display: flex;
		align-items: baseline;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.35;
		color: var(--ink);
		text-decoration: none;
		border-bottom: none;
		cursor: pointer;
	}
	.row.is-active {
		background: var(--paper-2);
	}

	@media (max-width: 640px) {
		.row {
			flex-direction: column;
			align-items: stretch;
			gap: 0;
		}
		.row--citation {
			flex-direction: row;
			align-items: baseline;
			gap: var(--s-3);
		}
	}
</style>
