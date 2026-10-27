<script lang="ts" module>
	import { Lazy } from '$lib/util/lazy.svelte';

	// The search is a chunk of its own, asked once the page is idle (or at the first ⌘K), so it
	// is in when the dialog opens and no page waits for it on its first load.
	const search = new Lazy(() => import('$lib/search/Search.svelte'), 'Zoeken');
</script>

<script lang="ts">
	// The dialog around the one search component; ⌘K opens it on every page.
	import { onMount } from 'svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';

	let {
		open,
		query = '',
		onClose
	}: { open: boolean; query?: string; onClose: () => void } = $props();

	onMount(() => {
		if (!('requestIdleCallback' in window)) return search.load();
		const id = requestIdleCallback(() => search.load(), { timeout: 3000 });
		return () => cancelIdleCallback(id);
	});
	$effect(() => {
		if (open) search.load();
	});

	let previousFocus: HTMLElement | null = null;

	// Where the focus was before the dialog: held before it is drawn (`pre`), since its field
	// takes the focus as it mounts; given back when it closes (audit 3: it fell to the body).
	$effect.pre(() => {
		if (!open) return;
		previousFocus = document.activeElement as HTMLElement | null;
		return () => {
			const back = previousFocus;
			previousFocus = null;
			// After the dialog has gone; a place that went with it leaves the focus on the page.
			queueMicrotask(() => {
				if (back?.isConnected) back.focus();
				else document.getElementById('main-content')?.focus();
			});
		};
	});

	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		// The field is the one stop inside the dialog, so Tab stays on it.
		if (e.key === 'Tab') e.preventDefault();
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="overlay" onclick={(e) => e.target === e.currentTarget && onClose()}>
		<div class="modal" role="dialog" aria-modal="true" aria-label="Zoekvenster" tabindex="-1">
			{#if search.component}
				{@const Search = search.component}
				<Search overlay initial={query} onOpen={onClose} />
			{:else if search.error}
				<LoadState
					state={{ status: 'error', error: search.error }}
					what="Zoeken"
					retry={search.retry}
				/>
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: var(--scherm);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 96px;
		z-index: var(--z-modal);
	}

	.modal {
		width: 640px;
		max-width: calc(100% - 48px);
		max-height: calc(100dvh - 160px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
	}

	@media (max-width: 640px) {
		.overlay {
			padding-top: var(--s-4);
		}
		.modal {
			max-width: calc(100% - 24px);
			max-height: calc(100dvh - 32px);
		}
	}
</style>
