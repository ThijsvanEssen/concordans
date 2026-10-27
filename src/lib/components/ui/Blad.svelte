<script lang="ts" module>
	// The Blads that stand open, the last on top: Escape and Tab belong to that one only.
	const open: symbol[] = [];
</script>

<script lang="ts">
	// The one sheet (Design System, Principe 6): a dialog with a name, Sluiten at its top right and
	// the page behind it under `scherm`. On a phone it comes from below (at most 88 % of the
	// screen, a handle in `rule`, `r-2` above); wider it stands where its afnemer has it:
	// `midden` under the top bar, `rechts` or `links` as a panel. A tap beside it and Escape
	// close it, the page behind it stands still (lockScroll), the focus goes into it and comes back
	// to what opened it. The content is a snippet, an optional `foot` has what ends the sheet
	// (Wis alles, Toon N). Opened inside another Blad, only the last one answers Escape and Tab.
	import { onMount, type Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { lockScroll } from '$lib/actions/scroll-lock';
	import IconButton from './IconButton.svelte';

	let {
		title,
		onClose,
		children,
		foot,
		opener,
		focus,
		place = 'midden',
		upTo = 'telefoon',
		aboveTabbar = false,
		tall = false,
		showTitle = true
	}: {
		/** The name of the dialog: its head, and for a screen reader. */
		title: string;
		onClose: () => void;
		children: Snippet;
		/** What ends the sheet, under a rule: Wis alles, Toon N. */
		foot?: Snippet;
		/** What opened it, where the focus goes back to; else what had the focus when it opened. */
		opener?: () => HTMLElement | null;
		/** Where the focus goes on opening, a selector inside the sheet; else Sluiten. */
		focus?: string;
		/** Wider than `upTo`: in the middle under the top bar, or a panel at the right or left. */
		place?: 'midden' | 'rechts' | 'links';
		/** Up to where the sheet comes from below: a phone (768 px), or a tablet (1100 px). */
		upTo?: 'telefoon' | 'tablet';
		/** Above the tab bar: the bar stays within reach under it. */
		aboveTabbar?: boolean;
		/** A phone: always the 88 % of the screen, so the sheet does not move as its content does. */
		tall?: boolean;
		/** The head names it; false where the content's own first heading does. */
		showTitle?: boolean;
	} = $props();

	const uid = $props.id();
	const telefoon = new MediaQuery('max-width: 768px');
	const tablet = new MediaQuery('max-width: 1100px');
	const bottom = $derived(upTo === 'tablet' ? tablet.current : telefoon.current);

	// Held before the content mounts: a field in it may take the focus first.
	const was = typeof document === 'undefined' ? null : document.activeElement;
	const me = Symbol('blad');
	let el = $state<HTMLElement | null>(null);

	onMount(() => {
		open.push(me);
		const release = lockScroll();
		const target = (focus && el?.querySelector<HTMLElement>(focus)) || el?.querySelector('.sluit');
		(target as HTMLElement | null)?.focus({ preventScroll: true });
		return () => {
			open.splice(open.indexOf(me), 1);
			release();
			const back = opener?.() ?? was;
			if (back instanceof HTMLElement && back !== document.body && back.isConnected)
				back.focus({ preventScroll: true });
		};
	});

	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

	function onKey(e: KeyboardEvent) {
		if (open.at(-1) !== me || e.defaultPrevented) return;
		if (e.key === 'Escape') {
			// Taken, so the network behind it does not also clear its selection.
			e.preventDefault();
			e.stopPropagation();
			onClose();
			return;
		}
		// Tab and Shift+Tab go round inside the sheet.
		if (e.key !== 'Tab' || !el) return;
		const els = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent);
		const [first, last] = [els[0], els.at(-1)];
		if (!first || !last) return;
		const at = document.activeElement;
		if (e.shiftKey && (at === first || !el.contains(at))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (at === last || !el.contains(at))) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

<!-- The keyboard with the focus outside the sheet (a row that went away under it). -->
<svelte:window
	onkeydown={(e) => {
		if (!(e.target instanceof Node && el?.contains(e.target))) onKey(e);
	}}
/>

<div class="blad" style:--blad-below={aboveTabbar ? 'var(--tabbar-h)' : '0px'}>
	<div class="scrim" role="presentation" onclick={onClose}></div>
	<div
		class="sheet"
		class:is-bottom={bottom}
		class:is-tall={tall}
		data-place={place}
		role="dialog"
		aria-modal="true"
		aria-label={showTitle ? undefined : title}
		aria-labelledby={showTitle ? `${uid}-title` : undefined}
		tabindex="-1"
		bind:this={el}
		onkeydown={onKey}
	>
		{#if bottom}<span class="greep" aria-hidden="true"></span>{/if}
		<div class="kop">
			{#if showTitle}<h2 class="title" id="{uid}-title">{title}</h2>{:else}<span></span>{/if}
			<IconButton class="sluit" label="Sluiten" onclick={onClose}>×</IconButton>
		</div>
		<div class="inhoud">{@render children()}</div>
		{#if foot}<div class="foot">{@render foot()}</div>{/if}
	</div>
</div>

<style>
	.blad {
		display: contents;
	}
	.scrim {
		position: fixed;
		inset: 0 0 var(--blad-below) 0;
		z-index: var(--z-modal);
		background: var(--scherm);
	}
	.sheet {
		position: fixed;
		z-index: var(--z-modal);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--paper);
		color: var(--ink);
		box-shadow: var(--shadow-modal);
		overscroll-behavior: contain;
	}

	/* Wider: where the afnemer has it. */
	.sheet[data-place='midden'] {
		inset: 96px 0 auto;
		width: 480px;
		max-width: calc(100% - var(--s-6));
		max-height: calc(100dvh - 160px);
		margin-inline: auto;
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
	}
	.sheet[data-place='rechts'] {
		inset: var(--balk-h) 0 0 auto;
		width: 400px;
		max-width: 100vw;
		border-left: 1px solid var(--rule-strong);
	}
	.sheet[data-place='links'] {
		inset: 0 auto 0 0;
		width: 360px;
		max-width: 100vw;
	}

	/* From below: the sheet of a phone (Netwerkkeuze, Telefoon). */
	.sheet.is-bottom {
		inset: auto 0 var(--blad-below) 0;
		width: auto;
		max-width: none;
		max-height: calc(88dvh - var(--blad-below));
		margin: 0;
		border: 0;
		border-top: 1px solid var(--rule-strong);
		border-radius: var(--r-2) var(--r-2) 0 0;
	}
	.sheet.is-bottom.is-tall {
		height: calc(88dvh - var(--blad-below));
	}
	@media (min-width: 769px) {
		.sheet.is-bottom {
			max-width: 480px;
			margin-inline: auto;
		}
	}
	.greep {
		position: absolute;
		top: var(--s-2);
		left: 50%;
		width: 36px;
		height: 4px;
		transform: translateX(-50%);
		border-radius: var(--r-rond);
		background: var(--rule);
	}

	.kop {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		padding: var(--s-4) var(--s-4) var(--s-3);
	}
	.title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
	}
	.inhoud {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.foot {
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-3) var(--s-4);
		border-top: 1px solid var(--rule);
	}
</style>
