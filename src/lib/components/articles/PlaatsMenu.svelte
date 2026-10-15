<script lang="ts" module>
	/**
	 * The marker a click on a place's text opens the menu at: the first `.plaats-marker` of
	 * the place (`place`, a selector) that is its own, not a nested place's; else the place.
	 */
	export function placeMarker(e: MouseEvent, place: string): HTMLElement | null {
		const own = (e.currentTarget as HTMLElement).closest<HTMLElement>(place);
		const markers = own?.querySelectorAll<HTMLElement>('.plaats-marker') ?? [];
		return [...markers].find((m) => m.closest(place) === own) ?? own;
	}
</script>

<script lang="ts">
	import { plural } from '$lib/text/words';
	// The menu of a place in a text (a lid, an onderdeel, a sub), opened from its own marker
	// ("1.", "a.") or a click on its text (concept 21, variant B; Thijs, 10 Oct: "nummer of lid
	// of onder-markering als menu"). Nothing stands beside the text at rest. The menu names
	// the place, then the forms to copy, Kopieer tekst, Bewaar, and where the place leads on
	// (its verbindingen, its history). In the top layer by its marker, with the keys of a menu:
	// Escape gives the focus back to the marker, a click outside closes it.
	import { menu } from '$lib/actions/menu';
	import { topLayer } from '$lib/actions/top-layer';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import type { CiteItem } from '$lib/components/ui/cite-items';
	import { kaart } from '$lib/map/map.svelte';
	import type { MapItem } from '$lib/map/map';
	import { formatCount } from '$lib/text/getal';

	let {
		anker,
		title,
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
		title: string;
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
	const aan = $derived(!!bewaar && kaart.heeft(bewaar));

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
</script>

<div
	class="tekstmenu__lijst is-breed plaatsmenu"
	role="menu"
	aria-label={title}
	tabindex="-1"
	use:topLayer={{ anchor: anker, close: onClose }}
	use:menu={{ open: true, close: onClose, trigger: anker }}
>
	<p class="kop">{title}</p>
	{#if cite.length}
		<p class="label">Kopieer als</p>
		{#each cite as c (c.kind)}
			<button
				type="button"
				class="tekstmenu__item tekstmenu__item--paar"
				role="menuitem"
				onclick={() => kopieer(c.text, c.kind)}
				><span class="vorm" class:link={c.kind === 'link'}>{copier.label(c.kind, c.text)}</span
				><span class="soort">{c.kind}</span></button
			>
		{/each}
	{/if}
	<button
		type="button"
		class="tekstmenu__item"
		role="menuitem"
		onclick={() => kopieer(tekst(), 'tekst')}>{copier.label('tekst', 'Kopieer tekst')}</button
	>
	{#if bewaar}
		<div class="regel">
			<button
				type="button"
				class="tekstmenu__item"
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
					class="tekstmenu__item"
					role="menuitem"
					href={verbindingen.href}
					data-sveltekit-noscroll
					onclick={() => sluit(false)}
					>{formatCount(verbindingen.n)}
					{plural(verbindingen.n, 'verbinding', 'verbindingen')}</a
				>
			{/if}
			{#if geschiedenis}
				<a
					class="tekstmenu__item"
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
		font-size: var(--t-ui-micro);
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
