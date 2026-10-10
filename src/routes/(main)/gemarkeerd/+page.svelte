<script lang="ts">
	// Gemarkeerd: the active map as a page, as the other items of the menu are (concept 13-map,
	// variant 7; Thijs, 10 Oct: one behaviour for every menu item). Its heading is its name, a
	// menu to switch maps, start a new one, rename or delete it, with the ways to share it at the
	// right (a link, the citations, a CSV); its order; its items per law, dossier or judgment, or
	// in the reader's own order, each a link to its place with the reader's note in italics; then
	// all maps. A map shared as a link (?map=) stands at the top until it is kept or put aside.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import IconKnop from '$lib/components/ui/IconKnop.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import ConfirmButton from '$lib/components/ui/ConfirmButton.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { isEscape } from '$lib/actions/keys';
	import { download } from '$lib/verbonden/export';
	import AlleMappen from '$lib/map/AlleMappen.svelte';
	import {
		citaten,
		csv,
		groepen,
		naarParam,
		sleutelVan,
		uitParam,
		type Map,
		type MapItem
	} from '$lib/map/map';
	import { kaart, type Gedeeld } from '$lib/map/map.svelte';

	const copier = createCopier();

	// ── A shared map, from the address ─────────────────────────────────────────
	const gedeeld = $derived.by<Gedeeld | null>(() => {
		const items = uitParam(page.url.searchParams.get('map'));
		if (!items.length) return null;
		return {
			naam: page.url.searchParams.get('mapnaam'),
			items,
			volgorde: page.url.searchParams.get('mapvolgorde') === 'eigen' ? 'eigen' : 'groep'
		};
	});
	/** A shared map kept or put aside: its link leaves the address, a reload asks no more. */
	function gedeeldKlaar(hoe: 'map' | 'erbij' | 'niet') {
		if (gedeeld && hoe === 'map') kaart.bewaarAlsMap(gedeeld);
		else if (gedeeld && hoe === 'erbij') kaart.voegToe(gedeeld);
		void goto('/gemarkeerd', { replaceState: true, noScroll: true, keepFocus: true });
	}

	const items = $derived(kaart.items);
	const volgorde = $derived<Map['volgorde']>(kaart.actief.volgorde);
	const reeksen = (lijst: MapItem[], v: Map['volgorde']) =>
		v === 'eigen' ? [{ groep: '', items: [...lijst] }] : groepen(lijst);

	/** The place an item opens: the bron in Samenhang, at its lid or overweging. */
	const adres = (i: MapItem) => {
		const href = buildBronHref(null, i.id);
		return i.at ? `${href.split('#')[0]}#${encodeURIComponent(i.at)}` : href;
	};
	const link = () => {
		const url = new URL('/gemarkeerd', page.url.origin);
		url.searchParams.set('map', naarParam(kaart.items));
		url.searchParams.set('mapnaam', kaart.actief.naam);
		if (kaart.actief.volgorde === 'eigen') url.searchParams.set('mapvolgorde', 'eigen');
		return url.toString();
	};
	const bestand = () => kaart.actief.naam.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Gemarkeerd';
	const tel = (n: number) => `${n.toLocaleString('nl-NL')} ${n === 1 ? 'bron' : 'bronnen'}`;
	// The name wraps; its last word stays with the caret of the menu.
	const naamBegin = $derived(kaart.actief.naam.replace(/\S+$/, ''));
	const naamSlot = $derived(kaart.actief.naam.match(/\S+$/)?.[0] ?? '');

	// ── The name: renamed in place; a new map is named at once ─────────────────
	let naamgeven = $state(false);
	let verwijderen = $state(false);
	/** The field takes the whole name on opening, to type over it. */
	const kiesAlles = (veld: HTMLInputElement) => veld.select();
	function slaNaamOp(e: SubmitEvent & { currentTarget: HTMLFormElement }) {
		e.preventDefault();
		const veld = e.currentTarget.elements.namedItem('naam') as HTMLInputElement;
		kaart.hernoem(kaart.actief.id, veld.value);
		naamgeven = false;
	}

	// ── A note: opened in place, Enter keeps it, Escape leaves it ─────────────
	let notitieVan = $state<string | null>(null);
	/** The field takes the focus on opening. */
	const focus = (veld: HTMLTextAreaElement) => veld.focus();
	function notitieToets(e: KeyboardEvent, i: MapItem) {
		const veld = e.currentTarget as HTMLTextAreaElement;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			kaart.notitie(i, veld.value);
			notitieVan = null;
		} else if (isEscape(e)) {
			veld.value = i.notitie ?? '';
			notitieVan = null;
		}
	}
	function notitieWeg(e: FocusEvent & { currentTarget: HTMLTextAreaElement }, i: MapItem) {
		if (notitieVan !== sleutelVan(i)) return;
		kaart.notitie(i, e.currentTarget.value);
		notitieVan = null;
	}
	const naarBoven = () => window.scrollTo({ top: 0 });
</script>

<RouteKop pad="/gemarkeerd" />

{#snippet item(i: MapItem, eigen: boolean)}
	{@const k = sleutelVan(i)}
	<li>
		<div class="regel">
			<a href={adres(i)}>{i.kort}</a>
			{#if eigen}
				<span class="knoppen">
					{#if !i.notitie && notitieVan !== k}
						<button type="button" class="notitie-knop" onclick={() => (notitieVan = k)}
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
		{#if eigen && notitieVan === k}
			<textarea
				class="notitie-veld"
				rows="2"
				aria-label="Aantekening bij {i.kort}"
				value={i.notitie ?? ''}
				use:focus
				onkeydown={(e) => notitieToets(e, i)}
				onblur={(e) => notitieWeg(e, i)}
			></textarea>
		{:else if i.notitie && eigen}
			<button
				type="button"
				class="notitie"
				title="Aantekening wijzigen"
				onclick={() => (notitieVan = k)}>{i.notitie}</button
			>
		{:else if i.notitie}
			<p class="notitie">{i.notitie}</p>
		{/if}
	</li>
{/snippet}

{#snippet lijst(alle: MapItem[], v: Map['volgorde'], eigen: boolean)}
	<div class="lijst">
		{#each reeksen(alle, v) as g (g.groep)}
			<section class="groep">
				{#if g.groep}<h3>{g.groep}<span class="aantal">{g.items.length}</span></h3>{/if}
				<ul>
					{#each g.items as i (sleutelVan(i))}{@render item(i, eigen)}{/each}
				</ul>
			</section>
		{/each}
	</div>
{/snippet}

<div class="gemarkeerd blad blad--tekst">
	{#if gedeeld}
		<!-- A map from a link: its own heading and the choice, above the reader's own map. -->
		<section class="gedeeld" aria-labelledby="gedeeld-kop">
			<p class="soort">Gedeelde map</p>
			<h2 id="gedeeld-kop">
				{gedeeld.naam ?? 'Zonder naam'}<span class="aantal">{tel(gedeeld.items.length)}</span>
			</h2>
			<p class="acties">
				<button type="button" class="btn" onclick={() => gedeeldKlaar('map')}>Bewaar als map</button
				>
				<button type="button" class="btn" onclick={() => gedeeldKlaar('erbij')}
					>Voeg toe aan {kaart.actief.naam}</button
				>
				<TekstLink onclick={() => gedeeldKlaar('niet')}>Niet bewaren</TekstLink>
			</p>
			{@render lijst(gedeeld.items, gedeeld.volgorde, false)}
		</section>
	{/if}

	<header class="kop">
		{#if naamgeven}
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
						naamgeven = false;
					}}
					onkeydown={(e) => {
						if (isEscape(e)) {
							e.currentTarget.value = kaart.actief.naam;
							naamgeven = false;
						}
					}}
				/>
			</form>
		{:else}
			<h1 class="titel">
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
								naamgeven = true;
							}}>Nieuwe map</button
						>
						<button
							type="button"
							role="menuitem"
							class="tekstmenu__item"
							onclick={() => {
								dicht();
								naamgeven = true;
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
			</h1>
		{/if}
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
	</header>

	{#if verwijderen}
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

	<p class="bepaal">
		<span class="aantal">{tel(items.length)}</span>
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
	</p>

	{#if !items.length}
		<p class="leeg">Nog niets bewaard.</p>
	{:else}
		{@render lijst(items, volgorde, true)}
		<p class="voet">
			<ConfirmButton
				label="Wis de map"
				confirmLabel="Ja, alles uit {kaart.actief.naam} halen"
				buttonClass="wis"
				onConfirm={() => kaart.wis()}
			/>
		</p>
	{/if}

	<div class="alle">
		<AlleMappen onKies={naarBoven} />
	</div>
	<p class="sr-only" aria-live="polite">{copier.announcement}</p>
</div>

<style>
	/* The heading with its actions at the right, as Actueel and Gevolgd. */
	.kop {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.titel {
		min-width: 0;
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
	}
	/* The name is the menu's button: the heading's letter, the caret quiet beside it. */
	.titel :global(.tekstmenu) {
		display: block;
	}
	.titel :global(.tekstmenu__knop) {
		display: inline;
		height: auto;
		padding: 0;
		font: inherit;
		color: inherit;
		text-align: left;
	}
	.titel :global(.tekstmenu__knop > .caret) {
		display: none;
	}
	.titel :global([aria-expanded='true'] .slot .caret) {
		transform: rotate(180deg);
	}
	.naam {
		white-space: normal;
		overflow-wrap: anywhere;
	}
	/* The caret inside the last word's span: an SVG after a span may wrap alone. */
	.slot {
		white-space: nowrap;
	}
	.hernoem {
		flex: 1;
		margin: 0;
	}
	.hernoem input {
		box-sizing: border-box;
		width: 100%;
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
	}
	.acties,
	.vraag {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-size: var(--t-meta);
	}
	.vraag {
		margin-top: var(--s-3);
	}
	.bepaal {
		display: flex;
		align-items: center;
		gap: var(--s-4);
		margin: var(--s-2) 0 var(--s-4);
		font-size: var(--t-meta);
	}
	.aantal {
		margin-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
		white-space: nowrap;
	}
	.bepaal .aantal {
		margin-left: 0;
		font-size: var(--t-meta);
	}
	.leeg {
		margin: 0;
		color: var(--ink-3);
	}
	/* The groups as Bladeren's: the ink rule over the list, a quiet rule under each law. */
	.lijst {
		border-top: 2px solid var(--ink);
	}
	.groep h3 {
		margin: var(--s-4) 0 var(--s-1);
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
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
	}
	.regel {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.regel a {
		color: var(--ink);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.regel a:hover {
		text-decoration: underline;
	}
	/* Aantekening, up, down and out on hover and focus; always on a touch screen. */
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
		margin: 2px 0 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-meta);
		font-style: italic;
		color: var(--ink-2);
		text-align: left;
		cursor: text;
	}
	p.notitie {
		cursor: auto;
	}
	.notitie-knop {
		margin-right: var(--s-2);
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
		font-size: var(--t-meta);
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
	/* A shared map: framed above the own one, its choice under its name. */
	.gedeeld {
		margin-bottom: var(--s-7);
		padding: var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
	}
	.soort {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.gedeeld h2 {
		margin: 0 0 var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 600;
	}
	.gedeeld .acties {
		margin-bottom: var(--s-3);
	}
	.alle {
		margin-top: var(--s-8);
	}
</style>
