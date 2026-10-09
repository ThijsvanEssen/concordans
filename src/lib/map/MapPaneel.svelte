<script lang="ts">
	// Gemarkeerd: the active map over the page, opened from the menu item (concept 13-map,
	// variant 7). Its heading is its name, a menu to switch to another map, start a new one,
	// rename or delete it; the ways to share it (a link, the citations, a CSV); its order, per
	// law or dossier or the reader's own, and the way to all maps; then its items, each a link
	// to its place, with the reader's note in italics, a step up or down and an × to take it
	// out. A map opened from a link stands here until it is kept or put aside.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import IconKnop from '$lib/components/ui/IconKnop.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import ConfirmButton from '$lib/components/ui/ConfirmButton.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { isEscape } from '$lib/actions/keys';
	import { download } from '$lib/verbonden/export';
	import { citaten, csv, groepen, naarParam, sleutelVan, type Map, type MapItem } from './map';
	import { kaart } from './map.svelte';

	const gedeeld = $derived(kaart.gedeeld);
	const items = $derived(gedeeld?.items ?? kaart.items);
	const volgorde = $derived<Map['volgorde']>(gedeeld ? 'groep' : kaart.actief.volgorde);
	const reeksen = $derived(
		volgorde === 'eigen' ? [{ groep: '', items: [...items] }] : groepen(items)
	);
	const copier = createCopier();

	/** The place an item opens: the bron in Samenhang, at its lid or overweging. */
	const adres = (i: MapItem) => {
		const href = buildBronHref(null, i.id);
		return i.at ? `${href.split('#')[0]}#${encodeURIComponent(i.at)}` : href;
	};
	const link = () => {
		const url = new URL('/explore', page.url.origin);
		url.searchParams.set('map', naarParam(kaart.items));
		url.searchParams.set('mapnaam', kaart.actief.naam);
		return url.toString();
	};
	// The name wraps, its last word stays with the caret of the menu.
	const naamBegin = $derived(kaart.actief.naam.replace(/\S+$/, ''));
	const naamSlot = $derived(kaart.actief.naam.match(/\S+$/)?.[0] ?? '');
	const bestand = () => kaart.actief.naam.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Gemarkeerd';
	const sluit = () => (kaart.open = false);
	const tel = (n: number) => `${n.toLocaleString('nl-NL')} ${n === 1 ? 'bron' : 'bronnen'}`;

	// ── The name: renamed in place; a new map is named at once ─────────────────
	/** The field takes the whole name on opening, to type over it. */
	const kiesAlles = (veld: HTMLInputElement) => veld.select();
	function slaNaamOp(e: SubmitEvent & { currentTarget: HTMLFormElement }) {
		e.preventDefault();
		const veld = e.currentTarget.elements.namedItem('naam') as HTMLInputElement;
		kaart.hernoem(kaart.actief.id, veld.value);
		kaart.naamgeven = false;
	}
	let verwijderen = $state(false);

	// ── A note: opened in place, Enter keeps it, Escape leaves it ─────────────
	let notitieVan = $state<string | null>(null);
	async function openNotitie(i: MapItem) {
		notitieVan = sleutelVan(i);
		await tick();
		document.getElementById(`notitie-${sleutelVan(i)}`)?.focus();
	}
	function notitieToets(e: KeyboardEvent, i: MapItem) {
		const veld = e.currentTarget as HTMLTextAreaElement;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			kaart.notitie(i, veld.value);
			notitieVan = null;
		} else if (isEscape(e)) {
			e.stopPropagation();
			notitieVan = null;
		}
	}
	function notitieWeg(e: FocusEvent & { currentTarget: HTMLTextAreaElement }, i: MapItem) {
		if (notitieVan !== sleutelVan(i)) return;
		kaart.notitie(i, e.currentTarget.value);
		notitieVan = null;
	}

	/** A shared map kept or put aside: its link leaves the address, a reload asks no more. */
	function gedeeldKlaar(hoe: 'map' | 'erbij' | 'niet') {
		if (hoe === 'map') kaart.bewaarAlsMap();
		else if (hoe === 'erbij') kaart.voegToe();
		else kaart.gedeeld = null;
		const url = new URL(page.url);
		if (!url.searchParams.has('map')) return;
		url.searchParams.delete('map');
		url.searchParams.delete('mapnaam');
		void goto(url.pathname + url.search + url.hash, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}
</script>

<svelte:window
	onkeydown={(e) => kaart.open && isEscape(e) && !kaart.naamgeven && !notitieVan && sluit()}
/>

{#snippet item(i: MapItem)}
	{@const k = sleutelVan(i)}
	<li>
		<div class="regel">
			<a href={adres(i)} onclick={sluit}>{i.kort}</a>
			{#if !gedeeld}
				<span class="knoppen">
					{#if !i.notitie && notitieVan !== k}
						<button type="button" class="notitie-knop" onclick={() => openNotitie(i)}
							>Aantekening</button
						>
					{/if}
					<IconKnop label="{i.kort} een plaats omhoog" onclick={() => kaart.schuif(i, -1)}
						>↑</IconKnop
					>
					<IconKnop label="{i.kort} een plaats omlaag" onclick={() => kaart.schuif(i, 1)}
						>↓</IconKnop
					>
					<IconKnop label="{i.kort} uit {kaart.actief.naam} halen" onclick={() => kaart.weg(i)}
						>×</IconKnop
					>
				</span>
			{/if}
		</div>
		{#if notitieVan === k}
			<textarea
				id="notitie-{k}"
				class="notitie-veld"
				rows="2"
				aria-label="Aantekening bij {i.kort}"
				value={i.notitie ?? ''}
				onkeydown={(e) => notitieToets(e, i)}
				onblur={(e) => notitieWeg(e, i)}
			></textarea>
		{:else if i.notitie && gedeeld}
			<p class="notitie">{i.notitie}</p>
		{:else if i.notitie}
			<button
				type="button"
				class="notitie"
				title="Aantekening wijzigen"
				onclick={() => openNotitie(i)}>{i.notitie}</button
			>
		{/if}
	</li>
{/snippet}

{#if kaart.open}
	<aside class="paneel" aria-label="Gemarkeerd">
		<header class="kop">
			{#if gedeeld}
				<h2>{gedeeld.naam ?? 'Gedeelde map'}</h2>
			{:else if kaart.naamgeven}
				<form class="hernoem" onsubmit={slaNaamOp}>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						name="naam"
						autofocus
						use:kiesAlles
						aria-label="Naam van de map"
						value={kaart.actief.naam}
						onblur={(e) => {
							kaart.hernoem(kaart.actief.id, e.currentTarget.value);
							kaart.naamgeven = false;
						}}
						onkeydown={(e) => {
							if (isEscape(e)) {
								e.stopPropagation();
								e.currentTarget.value = kaart.actief.naam;
								kaart.naamgeven = false;
							}
						}}
					/>
				</form>
			{:else}
				<div class="kop-menu">
					<TekstMenu
						label="Map"
						opties={kaart.mappen.map((m) => ({ waarde: m.id, label: m.naam }))}
						waarde={kaart.actief.id}
						onKies={(id) => kaart.kies(id)}
					>
						{#snippet knop()}<span class="naam"
								>{naamBegin}<span class="slot">{naamSlot}<Caret /></span></span
							>{/snippet}
						{#snippet onder(dicht)}
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={() => {
									dicht();
									kaart.nieuw();
									kaart.naamgeven = true;
								}}>Nieuwe map</button
							>
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={() => {
									dicht();
									kaart.naamgeven = true;
								}}>Hernoem</button
							>
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={() => {
									dicht();
									verwijderen = true;
								}}>Verwijder map</button
							>
						{/snippet}
					</TekstMenu>
				</div>
			{/if}
			<span class="aantal">{tel(items.length)}</span>
			<IconKnop label="Gemarkeerd sluiten" onclick={sluit}>×</IconKnop>
		</header>

		{#if verwijderen && !gedeeld}
			<p class="vraag">
				<span>{kaart.actief.naam} verwijderen, met {tel(kaart.items.length)}?</span>
				<button
					type="button"
					class="btn"
					onclick={() => {
						kaart.verwijder(kaart.actief.id);
						verwijderen = false;
					}}>Verwijder</button
				>
				<TekstLink onclick={() => (verwijderen = false)}>Niet verwijderen</TekstLink>
			</p>
		{/if}

		{#if gedeeld}
			<p class="acties">
				<button type="button" class="btn" onclick={() => gedeeldKlaar('map')}>Bewaar als map</button
				>
				<button type="button" class="btn" onclick={() => gedeeldKlaar('erbij')}
					>Voeg toe aan {kaart.actief.naam}</button
				>
				<TekstLink onclick={() => gedeeldKlaar('niet')}>Niet bewaren</TekstLink>
			</p>
		{:else}
			{#if items.length}
				<p class="acties">
					<button type="button" class="btn" onclick={() => copier.copy(link(), 'link')}
						>{copier.label('link', 'Kopieer link')}</button
					>
					<button
						type="button"
						class="btn"
						onclick={() => copier.copy(citaten(items, volgorde), 'citaten')}
						>{copier.label('citaten', 'Citaten')}</button
					>
					<button
						type="button"
						class="btn"
						onclick={() =>
							download(
								`${bestand()}.csv`,
								csv(items, (i) => new URL(adres(i), page.url.origin).toString())
							)}>CSV</button
					>
				</p>
			{/if}
			<div class="bepaal">
				{#if items.length > 1}
					<TekstMenu
						klein
						label="Volgorde"
						opties={[
							{ waarde: 'groep' as const, label: 'Per wet of dossier' },
							{ waarde: 'eigen' as const, label: 'Eigen volgorde' }
						]}
						waarde={volgorde}
						onKies={(v) => kaart.ordening(v)}
					/>
				{/if}
				<TekstLink href="/gemarkeerd" onclick={sluit}
					>{kaart.mappen.length === 1
						? 'Alle mappen'
						: `Alle ${kaart.mappen.length} mappen`}</TekstLink
				>
			</div>
		{/if}

		{#if !items.length}
			<p class="leeg">Nog niets bewaard.</p>
		{:else}
			<div class="lijst">
				{#each reeksen as g (g.groep)}
					<section class="groep">
						{#if g.groep}<h3>{g.groep}<span class="aantal">{g.items.length}</span></h3>{/if}
						<ul>
							{#each g.items as i (sleutelVan(i))}{@render item(i)}{/each}
						</ul>
					</section>
				{/each}
			</div>
			{#if !gedeeld}
				<p class="voet">
					<ConfirmButton
						label="Wis de map"
						confirmLabel="Ja, alles uit {kaart.actief.naam} halen"
						buttonClass="wis"
						onConfirm={() => kaart.wis()}
					/>
				</p>
			{/if}
		{/if}
		<p class="sr-only" aria-live="polite">{copier.announcement}</p>
	</aside>
{/if}

<style>
	/* As the cards over the network: paper, a frame, under the top bar at the right. */
	.paneel {
		position: fixed;
		top: calc(var(--topbar-h, 56px) + var(--s-2));
		right: var(--s-3);
		z-index: var(--z-float, 20);
		display: flex;
		flex-direction: column;
		width: 400px;
		max-width: calc(100vw - 2 * var(--s-3));
		max-height: calc(100vh - var(--topbar-h, 56px) - 2 * var(--s-3));
		overflow-y: auto;
		padding: var(--s-3) var(--s-4) var(--s-4);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-pop);
		font-family: var(--font-serif);
	}
	.kop {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
	}
	.kop h2,
	.kop-menu {
		min-width: 0;
		margin: 0;
		font-size: var(--t-h3);
		font-weight: 800;
	}
	/* The name is the menu's button: the heading's letter, the caret quiet beside it. */
	.kop-menu :global(.tekstmenu__knop) {
		display: inline;
		height: auto;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
	}
	.kop-menu :global(.tekstmenu) {
		display: block;
	}
	/* The name wraps; its last word and the caret stay together. */
	.naam {
		white-space: normal;
		overflow-wrap: anywhere;
	}
	/* The caret inside the last word's span: an SVG after a span may wrap alone. */
	.slot {
		white-space: nowrap;
	}
	.kop-menu :global(.tekstmenu__knop > .caret) {
		display: none;
	}
	.kop-menu :global([aria-expanded='true'] .slot .caret) {
		transform: rotate(180deg);
	}
	.kop :global(.iconknop) {
		margin-left: auto;
	}
	.hernoem {
		flex: 1;
		margin: 0;
	}
	.hernoem input {
		box-sizing: border-box;
		width: 100%;
		height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 800;
	}
	.aantal {
		margin-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
		white-space: nowrap;
	}
	.vraag,
	.acties {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
	.bepaal {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		margin: var(--s-3) 0 var(--s-2);
		font-size: var(--t-meta);
	}
	.bepaal > :global(:last-child) {
		margin-left: auto;
	}
	.leeg {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.lijst {
		border-top: 2px solid var(--ink);
	}
	.groep h3 {
		margin: var(--s-3) 0 var(--s-1);
		padding-bottom: var(--s-1);
		border-bottom: 1px solid var(--rule);
		font-size: var(--t-meta);
		font-weight: 600;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		padding: var(--s-1) 0;
		border-bottom: 1px solid var(--rule);
		font-size: var(--t-meta);
	}
	.regel {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--s-2);
	}
	.regel a {
		color: var(--ink);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.regel a:hover {
		text-decoration: underline;
	}
	/* Up, down and out on hover and focus; always on a touch screen. */
	.knoppen {
		display: inline-flex;
		flex: none;
		align-items: center;
		opacity: 0;
	}
	li:hover .knoppen,
	li:focus-within .knoppen {
		opacity: 1;
	}
	@media (hover: none) {
		.knoppen {
			opacity: 1;
		}
	}
	/* The reader's note: italic, under the citation; a click opens it to change. */
	.notitie {
		display: block;
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-style: italic;
		color: var(--ink-2);
		text-align: left;
		cursor: text;
	}
	.notitie-knop {
		margin-right: var(--s-1);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.notitie-knop:hover {
		color: var(--ink);
	}
	.notitie-veld {
		box-sizing: border-box;
		width: 100%;
		margin-top: var(--s-1);
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font: inherit;
		font-style: italic;
		resize: vertical;
	}
	.voet {
		margin: var(--s-3) 0 0;
	}
	.voet :global(.wis) {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.voet :global(.wis:hover) {
		color: var(--accent);
	}
	/* On a phone the width of the screen under the top bar. */
	@media (max-width: 767px) {
		.paneel {
			left: var(--s-3);
			width: auto;
		}
	}
</style>
