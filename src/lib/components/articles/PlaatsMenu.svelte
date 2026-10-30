<script lang="ts" module>
	/**
	 * The marker a click on a place's text opens the menu at: the first `.plaats-marker` of
	 * the place (`place`, a selector) that is its own, not a nested place's; else the place.
	 * The marker takes the focus, so Escape gives it back there, as after a click on the
	 * marker itself (UX-toets A32 #8).
	 */
	export function placeMarker(e: MouseEvent, place: string): HTMLElement | null {
		const own = (e.currentTarget as HTMLElement).closest<HTMLElement>(place);
		const markers = own?.querySelectorAll<HTMLElement>('.plaats-marker') ?? [];
		const marker = [...markers].find((m) => m.closest(place) === own);
		marker?.focus({ preventScroll: true });
		return marker ?? own;
	}
</script>

<script lang="ts">
	import { plural } from '$lib/text/words';
	// The menu of a place in a text (a lid, an onderdeel, a sub), opened from its own marker
	// ("1.", "a.") or a click on its text (concept 21, variant B; Thijs, 10 Oct: "nummer of lid
	// of onder-markering als menu"). Nothing stands beside the text at rest. The menu names
	// the place, Link naar dit lid (its address with its anchor), then the forms to copy, Kopieer tekst, Bewaar, and where the place leads on
	// (its verbindingen, its history). In the top layer by its marker, with the keys of a menu:
	// Escape gives the focus back to the marker, a click outside closes it.
	// Words selected in the text open the same menu (O4, besluit 24), by the words: the place
	// with the start of its quote, the forms with the quote after them, Arceer and Aantekening;
	// a click on an arcering opens it with its aantekening and Arcering weg.
	import { menu } from '$lib/actions/menu';
	import { topLayer } from '$lib/actions/top-layer';
	import { afterTick } from '$lib/util/after-tick';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { citedWhat, type CiteItem } from '$lib/components/ui/cite-items';
	import { kaart } from '$lib/map/map.svelte';
	import type { MapItem } from '$lib/map/map';
	import BundleChecklist from '$lib/map/BundleChecklist.svelte';
	import Tekstveld from '$lib/components/ui/Tekstveld.svelte';
	import { formatCount } from '$lib/text/getal';

	let {
		anker,
		title,
		cite: forms = [],
		tekst,
		bewaar = null,
		verbindingen = null,
		geschiedenis = null,
		fragment = null,
		shading = null,
		rect = null,
		below = false,
		onClose
	}: {
		/** The marker the menu hangs from, and gets the focus back. */
		anker: HTMLElement;
		/** The place, as it is cited: `art. 1:1 onder q sub 1 Wft`, `Lid 2`. */
		title: string;
		/** The forms to cite; its link, the place's address with its anchor, is Link naar dit lid. */
		cite?: CiteItem[];
		/** The text Kopieer tekst copies. */
		tekst: () => string;
		bewaar?: MapItem | null;
		/** Where its verbindingen are; `tellend` while they are counted. */
		verbindingen?: { n: number; href: string } | 'tellend' | null;
		geschiedenis?: { label: string; href: string } | null;
		/** Words selected in the place; `shade` keeps them, with a note where given; null
		 *  where they cannot be kept (over two articles): then only Kopieer. */
		fragment?: { exact: string; shade: ((note: string) => void) | null } | null;
		/** An arcering clicked: its note, and the way to change it or take it away. */
		shading?: {
			exact: string;
			note: string | null;
			annotate: (note: string) => void;
			remove: () => void;
		} | null;
		/** Where the menu hangs from, where not the marker: the words selected. */
		rect?: (() => DOMRect) | null;
		/** Below the words always: on a phone its own bar stands above them. */
		below?: boolean;
		onClose: () => void;
	} = $props();

	/** The address of the place with its anchor: Link naar dit lid, the first item of the menu. */
	const lidLink = $derived(forms.find((c) => c.kind === 'link')?.text ?? null);
	const cite = $derived(forms.filter((c) => c.kind !== 'link'));
	/** The words the menu is of, their start in the head. */
	const words = $derived(fragment?.exact ?? shading?.exact ?? null);
	const QUOTE = 32;
	const head = $derived(
		words
			? `${title}, "${words.length > QUOTE ? `${words.slice(0, QUOTE).trimEnd()}…` : words}"`
			: title
	);
	/** A form to copy with the words after it, as a memo quotes them; a link as it is. */
	const withWords = (c: CiteItem) =>
		words && c.kind !== 'link' ? `${c.text}, "${words}"` : c.text;
	/** The field of the aantekening, open in place in the menu. */
	let writing = $state(false);
	let note = $state('');

	const copier = createCopier();
	const aan = $derived(!!bewaar && kaart.heeft(bewaar));
	/** Bewaar in bundel… asked: the bundels with their ticks stand in place of the two Bewaar items. */
	let choosing = $state(false);

	/** The first bundel takes the focus, so the arrows and Escape go on working. */
	function choose() {
		choosing = true;
		afterTick(() =>
			document.querySelector<HTMLElement>('.plaatsmenu [role="menuitemcheckbox"]')?.focus()
		);
	}

	function sluit(focus = true) {
		// Held before closing: once the menu is gone its props are too.
		const marker = anker;
		onClose();
		if (focus) marker.focus();
	}
	// A copy closes the menu a moment later, unless it closed meanwhile (Escape, a click
	// outside): then its props, the marker too, are gone (F-anker).
	let gone = false;
	let closing: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => {
		gone = true;
		clearTimeout(closing);
	});
	async function kopieer(tekst: string, sleutel: string, genoemd: string) {
		await copier.copy(tekst, sleutel, genoemd);
		if (!gone) closing = setTimeout(() => sluit(), 600);
	}
</script>

<div
	class="tekstmenu__lijst is-breed plaatsmenu"
	role="menu"
	aria-label={head}
	tabindex="-1"
	use:topLayer={{ anchor: anker, close: onClose, rect, below }}
	use:menu={{ open: true, close: onClose, trigger: anker }}
>
	<p class="kop">{head}</p>
	{#if lidLink}
		<button
			type="button"
			class="tekstmenu__item"
			role="menuitem"
			onclick={() => kopieer(lidLink, 'lidlink', `link naar ${title}`)}
			>{copier.label('lidlink', 'Link naar dit lid')}</button
		>
	{/if}
	{#if cite.length}
		<p class="label">Kopieer als</p>
		{#each cite as c (c.kind)}
			<button
				type="button"
				class="tekstmenu__item tekstmenu__item--paar"
				role="menuitem"
				onclick={() => kopieer(withWords(c), c.kind, citedWhat(cite, c, title))}
				><span class="vorm" class:link={c.kind === 'link'}
					>{copier.label(c.kind, c.shown ?? c.text)}</span
				><span class="soort">{c.kind}</span></button
			>
		{/each}
	{/if}
	<button
		type="button"
		class="tekstmenu__item"
		role="menuitem"
		onclick={() => kopieer(tekst(), 'tekst', `tekst van ${title}`)}
		>{copier.label('tekst', 'Kopieer tekst')}</button
	>
	{#if writing && (fragment?.shade || shading)}
		<form
			class="aantekening"
			onsubmit={(e) => {
				e.preventDefault();
				if (shading) shading.annotate(note);
				else fragment?.shade?.(note);
				sluit();
			}}
		>
			<Tekstveld
				multiline
				bind:value={note}
				placeholder="Aantekening"
				label="Aantekening bij {head}"
				focus
				onkeydown={(e: KeyboardEvent) => {
					// The arrows move in the note, not to the menu's items; Escape still closes it.
					if (/^(Arrow(Up|Down)|Home|End)$/.test(e.key)) e.stopPropagation();
					if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
						(e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
				}}
			/>
			<button type="submit" class="tekstmenu__item">Bewaar aantekening</button>
		</form>
	{:else if fragment?.shade}
		{@const shade = fragment.shade}
		<button
			type="button"
			class="tekstmenu__item"
			role="menuitem"
			onclick={() => {
				shade('');
				sluit();
			}}>Arceer</button
		>
		<button
			type="button"
			class="tekstmenu__item"
			role="menuitem"
			onclick={() => {
				note = '';
				writing = true;
			}}>Aantekening</button
		>
	{:else if shading}
		{@const a = shading}
		<button
			type="button"
			class="tekstmenu__item"
			role="menuitem"
			onclick={() => {
				note = a.note ?? '';
				writing = true;
			}}>{a.note ? 'Wijzig aantekening' : 'Aantekening'}</button
		>
		<button
			type="button"
			class="tekstmenu__item"
			role="menuitem"
			onclick={() => {
				a.remove();
				sluit();
			}}>Arcering weg</button
		>
	{/if}
	{#if bewaar}
		<div class="regel">
			<!-- Kept: the bundels with their ticks, as Bewaar's menu (BundleChecklist); nothing
			     is taken out of all at once. -->
			{#if aan || choosing}
				<BundleChecklist item={bewaar} close={sluit} />
			{:else}
				{@const into = kaart.keepsIn}
				<button
					type="button"
					class="tekstmenu__item"
					role="menuitem"
					onclick={() => {
						kaart.keep(bewaar, into.id);
						sluit();
					}}>Bewaar in {into.naam}</button
				>
				<button
					type="button"
					class="tekstmenu__item"
					role="menuitem"
					onclick={() => {
						choose();
					}}>Bewaar in bundel…</button
				>
			{/if}
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
</div>

<style>
	.plaatsmenu {
		font-size: var(--t-ui);
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
	.aantekening {
		display: grid;
		gap: var(--s-1);
		margin: 0;
		padding: var(--s-1) var(--s-3);
	}
	.aantekening .tekstmenu__item {
		padding-inline: 0;
	}
	.regel {
		margin-top: var(--s-1);
		padding-top: var(--s-1);
		border-top: 1px solid var(--rule);
	}
</style>
