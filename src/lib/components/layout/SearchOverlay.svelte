<script lang="ts">
	// The dialog around the one search component; ⌘K opens it on every page.
	import Search from '$lib/search/Search.svelte';

	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	let previousFocus: HTMLElement | null = null;

	$effect(() => {
		if (!open) return;
		previousFocus = document.activeElement as HTMLElement | null;
		return () => {
			previousFocus?.focus();
			previousFocus = null;
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
	<div class="overlay" onclick={onClose}>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="Zoeken"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
		>
			<Search overlay onOpen={onClose} />
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(28, 27, 25, 0.18);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 96px;
		z-index: var(--z-modal);
	}

	.modal {
		width: 640px;
		max-width: calc(100% - 48px);
		max-height: calc(100vh - 160px);
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
			padding-top: 16px;
		}
		.modal {
			max-width: calc(100% - 24px);
			max-height: calc(100vh - 32px);
		}
	}
</style>
