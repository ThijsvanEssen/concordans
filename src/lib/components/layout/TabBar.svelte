<script lang="ts">
	// The tab bar of a phone (768 px and narrower; besluit 36): Zoeken, Bronnen, Netwerk, Actueel, Mijn.
	// Bronnen and Mijn open a sheet over the page, above the bar, with the soorten bron or
	// what the reader keeps; a tap outside the sheet, Escape or the tab again closes it (a
	// tap closes by its click, never by the focus that leaves: actions/menu.ts). The menu of
	// the top bar on a wider screen has the same items (SOURCES, MINE).
	import { clickOutside } from '$lib/actions/top-layer';
	import { page } from '$app/state';
	import NewMark from '$lib/components/ui/NewMark.svelte';
	import { sign } from '$lib/bevestig/bevestig.svelte';
	import { SOURCES, sourceOf } from '$lib/nav/sources';
	import { MINE, mineAt } from '$lib/nav/mine';
	import Picto from '$lib/components/ui/Picto.svelte';
	import { count } from '$lib/text/words';
	import { networkState } from '$lib/nav/network';

	let { onSearchOpen }: { onSearchOpen?: () => void } = $props();

	type Sheet = 'bronnen' | 'mijn';
	let sheet = $state<Sheet | null>(null);
	let barEl: HTMLElement | null = $state(null);
	let sheetEl: HTMLElement | null = $state(null);

	const path = $derived(page.url.pathname);
	const source = $derived(sourceOf(page.url));
	const mine = $derived(mineAt(path));
	const onActueel = $derived(path.startsWith('/actueel'));
	const network = $derived(networkState(page.url));
	const fresh = $derived(sign.has('bundels') || sign.has('gevolgd'));

	// A page of another place closes the sheet.
	$effect(() => {
		void page.url.href;
		sheet = null;
	});

	// A tap outside the sheet and the bar closes it; the bar's own tabs toggle.
	$effect(() => {
		if (!sheet) return;
		return clickOutside(
			() => [sheetEl, barEl],
			() => (sheet = null)
		);
	});

	// The sheet takes the focus when it opens: the next Tab is its first item.
	$effect(() => {
		sheetEl?.focus({ preventScroll: true });
	});

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !sheet) return;
		barEl?.querySelector<HTMLElement>(`[data-sheet="${sheet}"]`)?.focus();
		sheet = null;
	}

	const toggle = (s: Sheet) => (sheet = sheet === s ? null : s);
</script>

<svelte:window onkeydown={onKey} />

{#if sheet}
	<div class="scrim" aria-hidden="true"></div>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="sheet"
		role="dialog"
		tabindex="-1"
		aria-label={sheet === 'bronnen' ? 'Bronnen' : 'Mijn'}
		bind:this={sheetEl}
		onclick={() => (sheet = null)}
	>
		{#if sheet === 'bronnen'}
			<h2 class="sheet__head">Bronnen</h2>
			{#each SOURCES as s (s.id)}
				<a
					class="menuitem"
					href={s.href}
					aria-current={source?.id === s.id ? 'page' : undefined}
					class:is-active={source?.id === s.id}>{s.label}<span>{s.holds}</span></a
				>
			{/each}
		{:else}
			<h2 class="sheet__head">Mijn</h2>
			{#each MINE as m (m.id)}
				<a
					class="menuitem"
					href={m.href}
					aria-current={mine === m.id ? 'page' : undefined}
					class:is-active={mine === m.id}
					>{m.label}{#if sign.has(m.id)}<NewMark />{/if}</a
				>
			{/each}
		{/if}
	</div>
{/if}

<nav class="tabbar" aria-label="Hoofdmenu" bind:this={barEl}>
	<button type="button" class="tab" onclick={() => onSearchOpen?.()}>
		<svg
			width="20"
			height="20"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"><circle cx="7" cy="7" r="4.8" /><path d="M10.6 10.6 14 14" /></svg
		>Zoeken
	</button>
	<button
		type="button"
		class="tab"
		class:is-active={sheet ? sheet === 'bronnen' : source !== null}
		data-sheet="bronnen"
		aria-expanded={sheet === 'bronnen'}
		onclick={() => toggle('bronnen')}
	>
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" /></svg
		>Bronnen
	</button>
	<a
		class="tab"
		class:is-active={!sheet && network.pressed}
		href={network.href}
		role="button"
		aria-pressed={network.pressed}
		aria-label={network.count ? `Netwerk, ${count(network.count, 'bron', 'bronnen')}` : undefined}
		><Picto naam="netwerk-o" size={20} />Netwerk{#if network.count}<span class="tab__aantal"
				>{network.count}</span
			>{/if}</a
	>
	<a
		class="tab"
		class:is-active={!sheet && onActueel}
		href="/actueel"
		aria-current={onActueel ? 'page' : undefined}
	>
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"><rect x="3" y="4" width="14" height="12" /><path d="M6 8h8M6 12h5" /></svg
		>Actueel
	</a>
	<button
		type="button"
		class="tab"
		class:is-active={sheet ? sheet === 'mijn' : mine !== null}
		data-sheet="mijn"
		aria-expanded={sheet === 'mijn'}
		onclick={() => toggle('mijn')}
	>
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"><path d="M5 3h10v14l-5-3-5 3z" /></svg
		>Mijn{#if fresh && sheet !== 'mijn'}<NewMark />{/if}
	</button>
</nav>

<style>
	.tabbar,
	.sheet,
	.scrim {
		display: none;
	}
	@media (max-width: 768px) {
		.tabbar {
			display: flex;
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: var(--z-float);
			height: var(--tabbar-h);
			box-sizing: border-box;
			padding: 0 var(--safe-right) var(--safe-bottom) var(--safe-left);
			background: var(--paper);
			border-top: 1px solid var(--rule-strong);
		}
		.tab {
			flex: 1;
			min-width: 0;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: var(--s-1);
			padding: 0;
			border: 0;
			background: none;
			font-family: var(--font-ui);
			font-size: var(--t-label);
			font-weight: 500;
			color: var(--ink-3);
			text-decoration: none;
			cursor: pointer;
		}
		.tab {
			position: relative;
		}
		.tab__aantal {
			position: absolute;
			top: var(--s-2);
			right: calc(50% - var(--s-6));
			font-size: var(--t-micro);
			line-height: 1;
			color: var(--ink-3);
		}
		.tab.is-active {
			color: var(--ink);
			box-shadow: inset 0 2px 0 var(--ink);
		}
		.scrim {
			display: block;
			position: fixed;
			inset: 0;
			z-index: calc(var(--z-float) - 1);
			background: var(--scherm);
		}
		.sheet {
			display: block;
			position: fixed;
			left: 0;
			right: 0;
			bottom: var(--tabbar-h);
			z-index: var(--z-float);
			max-height: calc(100dvh - var(--tabbar-h) - var(--balk-h));
			overflow-y: auto;
			padding: var(--s-3) var(--s-4) var(--s-4);
			background: var(--paper);
			border-top: 1px solid var(--rule-strong);
		}
		.sheet__head {
			margin: 0 0 var(--s-2);
			font-size: var(--t-label);
			font-weight: 600;
			color: var(--ink-3);
		}
		.menuitem {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: var(--s-3);
			min-height: var(--veld-h-raak);
			border-top: 1px solid var(--rule);
			font-family: var(--font-ui);
			font-size: var(--t-body-2);
			color: var(--ink);
			text-decoration: none;
		}
		.menuitem.is-active {
			font-weight: 600;
		}
		.menuitem span {
			font-size: var(--t-label);
			font-weight: 400;
			color: var(--ink-3);
			text-align: right;
		}
	}
</style>
