<script lang="ts">
	// The menu of a place in a text (a lid, an onderdeel, a sub), opened from its own marker
	// ("1.", "a.") or a click on its text (concept 21, variant B; Thijs, 10 Oct: "nummer of lid
	// of onder-markering als menu"). Nothing stands beside the text at rest. The menu names
	// the place, then the forms to copy, Kopieer tekst, Bewaar, and where the place leads on
	// (its verbindingen, its history). In the top layer, under its marker; the arrows move,
	// Escape and a click outside close it and give the focus back to the marker.
	import { tick } from 'svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import type { CiteItem } from '$lib/components/ui/cite';
	import { kaart } from '$lib/map/map.svelte';
	import type { MapItem } from '$lib/map/map';
	import { formatCount } from '$lib/verbonden/filter';

	let {
		anker,
		titel,
		cite = [],
		tekst,
		bewaar = null,
		verbindingen = null,
		geschiedenis = null,
		onClose
	}: {
		/** The marker the menu hangs from, and gets the focus back. */
		anker: HTMLElement;
		/** The place, as it is cited: `art. 1:1 onder q sub 1 Wft`, `Lid 2`. */
		titel: string;
		cite?: CiteItem[];
		/** The text Kopieer tekst copies. */
		tekst: () => string;
		bewaar?: MapItem | null;
		/** Where its verbindingen are; `tellend` while they are counted. */
		verbindingen?: { n: number; href: string } | 'tellend' | null;
		geschiedenis?: { label: string; href: string } | null;
		onClose: () => void;
	} = $props();

	const copier = createCopier();
	let lijst = $state<HTMLElement | null>(null);
	const aan = $derived(!!bewaar && kaart.heeft(bewaar));

	const items = () => [...(lijst?.querySelectorAll<HTMLElement>('.menuitem') ?? [])];
	function sluit(focus = true) {
		// Held before closing: once the menu is gone its props are too.
		const marker = anker;
		onClose();
		if (focus) marker.focus();
	}
	async function kopieer(wat: string, sleutel: string) {
		await copier.copy(wat, sleutel);
		setTimeout(() => sluit(), 600);
	}

	/** In the top layer, under the marker, inside the window; it follows a scroll. */
	function toplaag(el: HTMLElement) {
		if (typeof el.showPopover === 'function') {
			el.setAttribute('popover', 'manual');
			el.showPopover();
		}
		const RAND = 8;
		const zet = () => {
			const r = anker.getBoundingClientRect();
			const onder = innerHeight - r.bottom - 4 - RAND;
			const boven = r.top - 4 - RAND;
			// Under the marker; above it when it does not fit there and there is more room above.
			const op = el.scrollHeight > onder && boven > onder;
			const ruimte = Math.max(160, op ? boven : onder);
			el.style.maxHeight = `${ruimte}px`;
			const h = Math.min(el.scrollHeight, ruimte);
			el.style.top = `${op ? r.top - 4 - h : r.bottom + 4}px`;
			el.style.left = `${Math.max(RAND, Math.min(r.left, innerWidth - el.offsetWidth - RAND))}px`;
		};
		zet();
		addEventListener('scroll', zet, true);
		addEventListener('resize', zet);
		void tick().then(() => items()[0]?.focus());
		// A click outside closes it; one on the marker is the marker's (it toggles).
		const buiten = (e: PointerEvent) => {
			const t = e.target as Node;
			if (!el.contains(t) && !anker.contains(t)) sluit(false);
		};
		document.addEventListener('pointerdown', buiten, true);
		return {
			destroy() {
				removeEventListener('scroll', zet, true);
				removeEventListener('resize', zet);
				document.removeEventListener('pointerdown', buiten, true);
			}
		};
	}

	function toets(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			sluit();
			return;
		}
		if (e.key === 'Tab') {
			sluit();
			return;
		}
		const lijstItems = items();
		const i = lijstItems.indexOf(document.activeElement as HTMLElement);
		const last = lijstItems.length - 1;
		const next =
			e.key === 'ArrowDown'
				? i < 0 || i === last
					? 0
					: i + 1
				: e.key === 'ArrowUp'
					? i <= 0
						? last
						: i - 1
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? last
							: null;
		if (next === null) return;
		e.preventDefault();
		lijstItems[next]?.focus();
	}
</script>

<div
	class="plaatsmenu"
	role="menu"
	aria-label={titel}
	tabindex="-1"
	bind:this={lijst}
	use:toplaag
	onkeydown={toets}
>
	<p class="kop">{titel}</p>
	{#if cite.length}
		<p class="label">Kopieer als</p>
		{#each cite as c (c.kind)}
			<button type="button" class="menuitem" role="menuitem" onclick={() => kopieer(c.text, c.kind)}
				><span class="vorm" class:link={c.kind === 'link'}>{copier.label(c.kind, c.text)}</span
				><span class="soort">{c.kind}</span></button
			>
		{/each}
	{/if}
	<button type="button" class="menuitem" role="menuitem" onclick={() => kopieer(tekst(), 'tekst')}
		>{copier.label('tekst', 'Kopieer tekst')}</button
	>
	{#if bewaar}
		<div class="regel">
			<button
				type="button"
				class="menuitem"
				role="menuitemcheckbox"
				aria-checked={aan}
				onclick={() => {
					kaart.wissel(bewaar);
					sluit();
				}}>{aan ? `Uit ${kaart.actief.naam} halen` : `Bewaar in ${kaart.actief.naam}`}</button
			>
		</div>
	{/if}
	{#if verbindingen || geschiedenis}
		<div class="regel">
			{#if verbindingen === 'tellend'}
				<p class="tellend">Verbindingen tellen…</p>
			{:else if verbindingen}
				<a
					class="menuitem"
					role="menuitem"
					href={verbindingen.href}
					data-sveltekit-noscroll
					onclick={() => sluit(false)}
					>{formatCount(verbindingen.n)}
					{verbindingen.n === 1 ? 'verbinding' : 'verbindingen'}</a
				>
			{/if}
			{#if geschiedenis}
				<a
					class="menuitem"
					role="menuitem"
					href={geschiedenis.href}
					data-sveltekit-noscroll
					onclick={() => sluit(false)}>{geschiedenis.label}</a
				>
			{/if}
		</div>
	{/if}
	<span class="sr-only" aria-live="polite">{copier.announcement}</span>
</div>

<style>
	.plaatsmenu {
		position: fixed;
		inset: auto;
		margin: 0;
		z-index: var(--z-float);
		width: min(340px, calc(100vw - 16px));
		overflow-y: auto;
		padding: var(--s-1) 0;
		background: var(--paper);
		color: var(--ink);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		font-size: var(--t-ui-micro);
		text-align: left;
	}
	.kop {
		margin: 0;
		padding: var(--s-2) var(--s-3) var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.label,
	.tellend {
		margin: 0;
		padding: var(--s-1) var(--s-3) 0;
		font-family: var(--font-serif);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.menuitem {
		box-sizing: border-box;
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		width: 100%;
		padding: var(--s-1) var(--s-3);
		border: 0;
		background: none;
		font: inherit;
		font-family: var(--font-ui);
		color: var(--ink);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.menuitem:hover,
	.menuitem:focus-visible {
		background: var(--paper-2);
		outline: none;
	}
	/* A finger's row on a touch screen. */
	@media (pointer: coarse) {
		.menuitem {
			padding-block: var(--s-2);
		}
	}
	.vorm {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.vorm.link {
		color: var(--ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.soort {
		flex: none;
		color: var(--ink-3);
	}
	.regel {
		margin-top: var(--s-1);
		padding-top: var(--s-1);
		border-top: 1px solid var(--rule);
	}
</style>
