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
	// Not modal (`modaal={false}`, the Zijpaneel): no scherm, no lock, Tab is not held and the
	// page stays a page; Escape still closes it, and on a phone a tap beside it. From below it
	// stands at 60 % of the screen, its grip takes it to 88 %. From 1800 px a panel at the right is
	// 560 px wide and stands in the page's flow: the page makes room for it (AppShell).
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
		full = false,
		showTitle = true,
		modaal = true,
		head,
		actions,
		under,
		id
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
		/** A phone: the whole screen, as a search of its own (Netwerkkeuze, Bron toevoegen). */
		full?: boolean;
		/** The head names it; false where the content's own first heading does. */
		showTitle?: boolean;
		/** False: a panel beside the page, which stays usable (no scherm, no lock, Tab free). */
		modaal?: boolean;
		/** The head in place of the title: a kicker, the title, a line under it. */
		head?: Snippet;
		/** Buttons in the head, before Sluiten. */
		actions?: Snippet;
		/** Under the head, outside what scrolls: the row before and after, a jump menu. */
		under?: Snippet;
		id?: string;
	} = $props();

	const uid = $props.id();
	const telefoon = new MediaQuery('max-width: 768px');
	const tablet = new MediaQuery('max-width: 1100px');
	const bottom = $derived(upTo === 'tablet' ? tablet.current : telefoon.current);
	/** Not modal from below: up to 88 % by the grip, else 60 %. */
	let large = $state(false);

	// Held before the content mounts: a field in it may take the focus first.
	const was = typeof document === 'undefined' ? null : document.activeElement;
	const me = Symbol('blad');
	let el = $state<HTMLElement | null>(null);

	onMount(() => {
		open.push(me);
		const release = modaal ? lockScroll() : () => {};
		const target = (focus && el?.querySelector<HTMLElement>(focus)) || el?.querySelector('.sluit');
		(target as HTMLElement | null)?.focus({ preventScroll: true });
		return () => {
			open.splice(open.indexOf(me), 1);
			release();
			const back = opener?.() ?? was;
			// A place that went with the Blad leaves the focus on the page, not on the body.
			if (back instanceof HTMLElement && back !== document.body && back.isConnected)
				back.focus({ preventScroll: true });
			else document.getElementById('main-content')?.focus({ preventScroll: true });
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
		// Tab and Shift+Tab go round inside a modal sheet.
		if (e.key !== 'Tab' || !el || !modaal) return;
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

	/** Not modal on a phone: a tap beside the sheet closes it, a tap on a reference replaces it. */
	function onPointerDown(e: PointerEvent) {
		if (modaal || !bottom || !(e.target instanceof Element) || el?.contains(e.target)) return;
		if (!e.target.closest('a.raakvlak')) onClose();
	}

	/** The grip: a tap or a pull up takes the sheet to 88 %, a pull down back, or closes it. */
	let gripFrom = 0;
	function gripUp(e: PointerEvent) {
		const dy = e.clientY - gripFrom;
		if (dy > 24 && !large) onClose();
		else large = dy < -24 ? true : dy > 24 ? false : !large;
	}
</script>

<!-- The keyboard with the focus outside the sheet (a row that went away under it). -->
<svelte:window
	onkeydown={(e) => {
		if (!(e.target instanceof Node && el?.contains(e.target))) onKey(e);
	}}
/>

<svelte:document onpointerdowncapture={onPointerDown} />

<div class="blad" style:--blad-below={aboveTabbar ? 'var(--tabbar-h)' : '0px'}>
	{#if modaal}<div class="scrim" role="presentation" onclick={onClose}></div>{/if}
	<div
		class="sheet"
		class:is-bottom={bottom}
		class:is-tall={tall || large}
		data-los={!modaal || undefined}
		data-full={full || undefined}
		data-place={place}
		{id}
		role={modaal || bottom ? 'dialog' : 'complementary'}
		aria-modal={modaal ? 'true' : undefined}
		aria-label={showTitle && !head ? undefined : title}
		aria-labelledby={showTitle && !head ? `${uid}-title` : undefined}
		tabindex="-1"
		bind:this={el}
		onkeydown={onKey}
	>
		{#if bottom && modaal}<span class="greep" aria-hidden="true"></span>{:else if bottom}<button
				type="button"
				class="greep-raak"
				aria-label={large ? 'Kleiner' : 'Groter'}
				aria-expanded={large}
				onpointerdown={(e) => (gripFrom = e.clientY)}
				onpointerup={gripUp}
				onkeydown={(e) => e.key === 'Enter' && (large = !large)}><span class="greep"></span></button
			>{/if}
		<div class="kop" class:kaal={!showTitle} class:has-head={!!head}>
			{#if head}<div class="kop-tekst">{@render head()}</div>{:else if showTitle}<h2
					class="title"
					id="{uid}-title"
				>
					{title}
				</h2>{:else}<span></span>{/if}
			<div class="kop-acties">
				{@render actions?.()}<IconButton
					class="sluit"
					label="Sluiten"
					keys={['Esc', 'Escape']}
					onclick={onClose}>×</IconButton
				>
			</div>
		</div>
		{@render under?.()}
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

	/* Not modal: part of the page, under the top bar's menus and a card of the text beside it. */
	.sheet[data-los] {
		z-index: calc(var(--z-topbar) - 1);
	}
	/* Wide: in the margin beside the page, which makes room for it; nothing under it. */
	@media (min-width: 1800px) {
		.sheet[data-los][data-place='rechts'] {
			width: var(--paneel-breed);
			box-shadow: none;
		}
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
	/* Not modal from below: the cited lid in view and the reference above it still seen. */
	.sheet.is-bottom[data-los]:not(.is-tall) {
		height: calc(60dvh - var(--blad-below));
	}
	.sheet.is-bottom[data-full] {
		height: calc(100dvh - var(--balk-h) - var(--blad-below));
		max-height: none;
		border-top: 0;
		border-radius: 0;
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

	/* The grip as a button: a finger's 44 px around the line of 36 × 4. */
	.greep-raak {
		position: absolute;
		top: 0;
		left: 50%;
		width: var(--s-8);
		height: var(--tik-h);
		padding: 0;
		border: 0;
		background: none;
		transform: translateX(-50%);
		cursor: grab;
		z-index: 1;
		touch-action: none;
	}
	.greep-raak::after {
		content: '';
		position: absolute;
		inset: calc(-1 * var(--s-2)) calc(-1 * var(--s-1));
	}
	.greep-raak:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.kop {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		padding: var(--s-4) var(--s-4) var(--s-3);
	}
	/* No title of its own: the × alone at the right of the grip's row, a row of its own above the
	   content, so what scrolls goes under it and never under the × (live-toets 29 Oct: the × of a
	   bron's row met it). */
	.kop.kaal {
		justify-content: flex-end;
		padding: var(--s-2) var(--s-2) 0;
	}
	/* A head of its own: kicker, title and line at the left, the buttons at its top right. */
	.kop.has-head {
		align-items: flex-start;
	}
	.is-bottom .kop.has-head {
		padding-top: var(--s-5);
	}
	.kop-tekst {
		min-width: 0;
	}
	.kop-acties {
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--s-2);
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
