<script lang="ts">
	// The contents of the bron as a sheet, below 1100 px: there three columns and a panel do
	// not fit beside the text, so Inhoud opens the same contents (LezenNav, DocumentToc,
	// JudgmentToc) over the page. Above it the sheet is not shown; the column stands there.
	import type { Snippet } from 'svelte';

	let {
		onClose,
		always = false,
		children
	}: {
		onClose: () => void;
		/** Also above 1100 px, as a drawer at the left: beside the network the contents have no column. */
		always?: boolean;
		children: Snippet;
	} = $props();

	// Picking a bron or a division (its link) closes the sheet; opening or closing a
	// Boek/Titel group (a <summary>) must not, or the tree could never be opened inside it.
	function onBodyClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('summary') && !target.closest('a')) return;
		onClose();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" class:always onclick={(e) => e.target === e.currentTarget && onClose()}>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Inhoud" tabindex="-1">
		<div class="head">
			<span class="title">Inhoud</span>
			<button type="button" class="close" aria-label="Sluiten" onclick={onClose}>×</button>
		</div>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="body" onclick={onBodyClick}>
			{@render children()}
		</div>
	</div>
</div>

<style>
	.backdrop {
		display: none;
	}
	.sheet {
		display: flex;
		flex-direction: column;
		width: 100%;
		background: var(--paper);
		box-shadow: var(--shadow-modal);
		overflow: hidden;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--s-3) var(--s-4);
		border-bottom: 1px solid var(--rule);
		flex-shrink: 0;
	}
	.title {
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.close {
		padding: 0 var(--s-1);
		border: 0;
		background: none;
		font-size: var(--t-h3);
		line-height: 1;
		color: var(--ink-3);
		cursor: pointer;
	}
	.close:hover {
		color: var(--ink);
	}
	/* A finger's target: 32 px at least. */
	@media (pointer: coarse), (max-width: 768px) {
		.close {
			min-height: var(--s-6);
			min-width: var(--s-6);
		}
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	/* Below 1100 px a sheet from the bottom. */
	@media (max-width: 1100px) {
		.backdrop {
			display: flex;
			position: fixed;
			inset: 0;
			z-index: var(--z-modal);
			align-items: flex-end;
			justify-content: center;
			background: var(--scherm);
		}
		.sheet {
			max-width: 480px;
			max-height: 75vh;
			border-radius: var(--r-2) var(--r-2) 0 0;
		}
	}
	/* Above it only where asked (`always`): a drawer at the left. */
	@media (min-width: 1101px) {
		.always {
			display: flex;
			position: fixed;
			inset: 0;
			z-index: var(--z-modal);
			justify-content: flex-start;
			background: var(--scherm);
		}
		.always .sheet {
			width: 360px;
		}
	}
</style>
