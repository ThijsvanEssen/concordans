<script lang="ts">
	// On a phone the bronnen and the weergave of the werkplek stand in a sheet from below, behind
	// the button "Weergave" at the foot of the canvas, so the canvas has the screen
	// (Design System, Netwerkkeuze: Telefoon). Wider it is no frame at all: the strip stays where
	// it stands. The sheet is a dialog: Esc, a tap outside and Sluiten close it, the page behind
	// it stands still, and the focus goes back to the button.
	import { MediaQuery } from 'svelte/reactivity';
	import type { Snippet } from 'svelte';
	import { scrollLock } from '$lib/actions/scroll-lock';
	import { clickOutside } from '$lib/actions/top-layer';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { afterTick } from '$lib/util/after-tick';

	let {
		open,
		onClose,
		opener,
		children
	}: {
		open: boolean;
		onClose: () => void;
		/** The button that opened it: a tap on it is its own, not an outside tap. */
		opener: () => HTMLElement | null;
		children: Snippet;
	} = $props();

	const phone = new MediaQuery('max-width: 768px');
	const sheet = $derived(open && phone.current);
	let el = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!sheet) return;
		afterTick(() => el?.querySelector<HTMLElement>('.sluit')?.focus());
		return clickOutside(
			() => [el, opener()],
			() => onClose()
		);
	});

	const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])';
	function onKey(e: KeyboardEvent) {
		// A dialog standing in the sheet (Bron toevoegen) has its own Esc and its own Tab.
		if (!sheet || (e.target instanceof Element && e.target.closest('dialog'))) return;
		if (e.key === 'Escape') {
			// Not also the selection of the network.
			e.preventDefault();
			e.stopPropagation();
			onClose();
			return;
		}
		if (e.key !== 'Tab' || !el) return;
		const els = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent);
		const [first, last] = [els[0], els.at(-1)];
		if (!first || !last) return;
		const at = document.activeElement;
		if (e.shiftKey && at === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && at === last) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

<div
	class="sheet"
	class:is-open={open}
	role={sheet ? 'dialog' : undefined}
	aria-modal={sheet ? 'true' : undefined}
	aria-label={sheet ? 'Weergave' : undefined}
	bind:this={el}
	onkeydown={onKey}
>
	{#if sheet}
		<div class="sheet__head" use:scrollLock>
			<span class="sheet__handle" aria-hidden="true"></span>
			<IconButton class="sluit" label="Sluiten" onclick={onClose}>×</IconButton>
		</div>
	{/if}
	{@render children()}
</div>

<style>
	.sheet {
		display: contents;
	}
	.sheet__head {
		display: none;
	}
	@media (max-width: 768px) {
		.sheet {
			display: none;
		}
		.sheet.is-open {
			position: fixed;
			left: 0;
			right: 0;
			/* Over the canvas, on the tab bar: the werkplek's own stacking layer keeps it under that. */
			bottom: var(--tabbar-h);
			z-index: var(--z-modal);
			display: flex;
			flex-direction: column;
			max-height: calc(88dvh - var(--tabbar-h));
			background: var(--paper);
			border-top: 1px solid var(--rule-strong);
			border-radius: var(--r-2) var(--r-2) 0 0;
			box-shadow: var(--shadow-modal);
		}
		.sheet__head {
			position: relative;
			display: flex;
			justify-content: flex-end;
			padding: var(--s-3) var(--s-3) 0;
		}
		/* The handle of the sheet, in the middle of its head. */
		.sheet__handle {
			position: absolute;
			top: var(--s-2);
			left: 50%;
			width: 36px;
			height: 4px;
			transform: translateX(-50%);
			border-radius: var(--r-rond);
			background: var(--rule);
		}
		.sheet :global(.sluit) {
			width: var(--veld-h-raak);
			height: var(--veld-h-raak);
		}
		.sheet > :global(.strook) {
			flex: 1 1 auto;
			min-height: 0;
			overscroll-behavior: contain;
		}
	}
</style>
