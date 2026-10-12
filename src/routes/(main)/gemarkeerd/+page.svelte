<script lang="ts">
	// Gemarkeerd: the reader's own collections, built as Gevolgd is (Thijs, 10 Oct: "past nu nog
	// totaal niet bij de rest"). The heading over both columns; the maps in the facet column, the
	// active one (where Bewaar keeps) in weight; in the list column each map a group of the page
	// (Sectie), its name the heading that opens and closes it, its ways to share it at the right,
	// what it holds under it, its items as the rows of Bladeren. A map shared as a link (?map=)
	// stands at the top as a group of its own until it is kept or put aside.
	import { formatCount } from '$lib/text/getal';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import IconKnop from '$lib/components/ui/IconKnop.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import ConfirmButton from '$lib/components/ui/ConfirmButton.svelte';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { isEscape } from '$lib/actions/keys';
	import { download } from '$lib/verbonden/export';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import { bronLabel, type Collection } from '$lib/vocabulary';
	import {
		citaten,
		csv,
		groepen,
		mapParams,
		netwerkHref,
		sleutelVan,
		uitParams,
		type Gedeeld,
		type GroepNotities,
		type Map,
		type MapItem
	} from '$lib/map/map';
	import { kaart } from '$lib/map/map.svelte';
	import MapInhoud from '$lib/map/MapInhoud.svelte';
	import Aantekening from '$lib/map/Aantekening.svelte';
	import MapRegelingen from '$lib/map/MapRegelingen.svelte';
	import { bijWet, wetVanGroep } from '$lib/map/verbonden';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	const copier = createCopier();

	// ── A shared map, from the address ─────────────────────────────────────────
	const gedeeld = $derived<Gedeeld | null>(uitParams(page.url.searchParams));
	/** A shared map kept or put aside: its link leaves the address, a reload asks no more. */
	function gedeeldKlaar(hoe: 'map' | 'erbij' | 'niet') {
		if (gedeeld && hoe === 'map') kaart.bewaarAlsMap(gedeeld);
		else if (gedeeld && hoe === 'erbij') kaart.voegToe(gedeeld);
		void goto('/gemarkeerd', { replaceState: true, noScroll: true, keepFocus: true });
	}

	const reeksen = (lijst: MapItem[], v: Map['volgorde']) =>
		v === 'eigen' ? [{ groep: '', sleutel: '', items: [...lijst] }] : groepen(lijst);
	const collectieVan = (i: MapItem) => i.id.split('/')[0] as Collection;

	/** The place an item opens: the bron in Samenhang, at its lid or overweging. */
	const adres = (i: MapItem) => {
		const href = buildBronHref(null, i.id);
		return i.at ? `${href.split('#')[0]}#${encodeURIComponent(i.at)}` : href;
	};
	const link = (m: Map) => {
		const url = new URL('/gemarkeerd', page.url.origin);
		url.search = mapParams(m).toString();
		return url.toString();
	};
	const bestand = (m: Map) => m.naam.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Gemarkeerd';
	const tel = (n: number) => `${formatCount(n)} ${n === 1 ? 'bron' : 'bronnen'}`;
	const dag = (iso: string) => korteDatum(vandaag(new Date(iso)));
	const anker = (m: Map) => `map-${m.id}`;

	/** A map's actions on its own: the store acts on the active map. */
	function op(m: Map, f: () => void) {
		if (kaart.actief.id !== m.id) kaart.kies(m.id);
		f();
	}
	async function naarMap(m: Map) {
		kaart.kies(m.id);
		await tick();
		document.getElementById(anker(m))?.scrollIntoView({ block: 'start' });
	}

	// ── An item's content: a click on its row opens it in place ───────────────
	/** The rows open, by map and item (`<map>:<sleutel>`, `gedeeld:<sleutel>`). */
	const geopend = new SvelteSet<string>();
	const rijSleutel = (m: Map | null, i: MapItem) => `${m?.id ?? 'gedeeld'}:${sleutelVan(i)}`;
	function wisselOpen(k: string) {
		if (!geopend.delete(k)) geopend.add(k);
	}
	const allesOpen = (m: Map | null, items: MapItem[]) =>
		items.length > 0 && items.every((i) => geopend.has(rijSleutel(m, i)));
	function allesWissel(m: Map | null, items: MapItem[]) {
		const open = !allesOpen(m, items);
		for (const i of items) {
			if (open) geopend.add(rijSleutel(m, i));
			else geopend.delete(rijSleutel(m, i));
		}
	}

	// ── A name: renamed in place; a new map is named at once ───────────────────
	let naamgeven = $state<string | null>(null);
	let verwijderen = $state<string | null>(null);
	/** The field takes the whole name on opening, to type over it. */
	const kiesAlles = (veld: HTMLInputElement) => veld.select();
	function nieuw() {
		const m = kaart.nieuw();
		naamgeven = m.id;
		void tick().then(() => document.getElementById(anker(m))?.scrollIntoView());
	}

	// ── The notes: an item's, a group's, the map's, opened in place (Aantekening) ──
	/** The note open, by its row's, group's or map's key. */
	let notitieVan = $state<string | null>(null);
	let groepNotitieVan = $state<string | null>(null);
	let mapNotitieVan = $state<string | null>(null);
</script>

<RouteKop pad="/gemarkeerd" />

{#snippet rij(i: MapItem, m: Map | null)}
	{@const k = (m?.id ?? 'gedeeld') + ':' + sleutelVan(i)}
	<IndexRow title={i.kort} href={adres(i)} open={geopend.has(k)} onToggle={() => wisselOpen(k)}>
		{#snippet lead()}
			<span class="row-id-main"
				><KindGlyph collection={collectieVan(i)} size={12} />{bronLabel(collectieVan(i))}</span
			>
		{/snippet}
		{#snippet body()}
			{#if i.voluit && i.voluit !== i.kort}<span class="row-sub">{i.voluit}</span>{/if}
			<Aantekening
				tekst={i.notitie}
				bij={i.kort}
				bind:open={() => notitieVan === k, (v) => (notitieVan = v ? k : null)}
				onBewaar={m ? (t) => op(m, () => kaart.notitie(i, t)) : undefined}
			/>
		{/snippet}
		{#snippet aside()}
			{#if m}
				<span class="knoppen">
					{#if !i.notitie && notitieVan !== k}
						<button type="button" class="notitie-knop" onclick={() => (notitieVan = k)}
							>Aantekening</button
						>
					{/if}
					<IconKnop
						label="{i.kort} een plaats omhoog"
						onclick={() => op(m, () => kaart.schuif(i, -1))}>↑</IconKnop
					>
					<IconKnop
						label="{i.kort} een plaats omlaag"
						onclick={() => op(m, () => kaart.schuif(i, 1))}>↓</IconKnop
					>
					<IconKnop label="{i.kort} uit {m.naam} halen" onclick={() => op(m, () => kaart.weg(i))}
						>×</IconKnop
					>
				</span>
			{/if}
			<TekstLink href={adres(i)} class="naar-lezer" aria-label="{i.kort} in de lezer"
				>In de lezer</TekstLink
			>
		{/snippet}
		{#snippet detail()}
			<MapInhoud item={i} href={adres(i)} />
		{/snippet}
	</IndexRow>
{/snippet}

{#snippet alles(m: Map | null, items: MapItem[])}
	<TekstLink onclick={() => allesWissel(m, items)} aria-pressed={allesOpen(m, items)}
		>{allesOpen(m, items) ? 'Alles inklappen' : 'Alles uitklappen'}</TekstLink
	>
{/snippet}

{#snippet lijst(alle: MapItem[], v: Map['volgorde'], m: Map | null, notities: GroepNotities)}
	{#each reeksen(alle, v) as g (g.groep)}
		{@const k = `${m?.id ?? 'gedeeld'}:${g.sleutel}`}
		{@const bij = notities[g.sleutel]}
		{#if g.groep}
			{@const wet = wetVanGroep(g.items)}
			{@const wetOpen = !!wet && geopend.has(`wet:${k}`)}
			<div class="groep-kop">
				<h3 class="groep">
					{#if wet}<button
							type="button"
							class="groep-knop"
							aria-expanded={wetOpen}
							onclick={() => wisselOpen(`wet:${k}`)}>{g.groep}<Caret open={wetOpen} side /></button
						>{:else}{g.groep}{/if}<span class="aantal">{g.items.length}</span>
				</h3>
				{#if m && !bij && groepNotitieVan !== k}
					<button type="button" class="notitie-knop" onclick={() => (groepNotitieVan = k)}
						>Aantekening</button
					>
				{/if}
			</div>
			{#if wet && wetOpen}
				<div class="wet-open">
					<MapRegelingen titel="Verbonden regelingen" laad={() => bijWet(wet)} />
					<p class="verder">
						<TekstLink href={buildBronHref(null, `instruments/${wet.toLowerCase()}`)}
							>Wet in de lezer</TekstLink
						>
					</p>
				</div>
			{/if}
			<Aantekening
				tekst={bij}
				bij={g.groep}
				bind:open={() => groepNotitieVan === k, (v) => (groepNotitieVan = v ? k : null)}
				onBewaar={m ? (t) => op(m, () => kaart.groepNotitie(g.sleutel, t)) : undefined}
			/>
		{/if}
		<ul class="rijen">
			{#each g.items as i (sleutelVan(i))}{@render rij(i, m)}{/each}
		</ul>
	{/each}
{/snippet}

<div class="gemarkeerd blad blad__indeling">
	<header class="blad__kop">
		<h1 class="blad__titel">Gemarkeerd</h1>
	</header>

	<!-- The maps, as Gevolgd lists its topics: a way to each; the active one in weight. -->
	<nav class="opzij" aria-label="Mappen">
		<h2 class="opzij__kop">Mappen</h2>
		<ul>
			{#each kaart.mappen as m (m.id)}
				<li>
					<button
						type="button"
						class:actief={m.id === kaart.actief.id}
						aria-current={m.id === kaart.actief.id ? 'true' : undefined}
						title="{tel(m.items.length)}, gewijzigd {dag(m.gewijzigd)}"
						onclick={() => naarMap(m)}>{m.naam}</button
					><span class="n">{m.items.length}</span>
				</li>
			{/each}
		</ul>
		<p class="nieuw"><TekstLink onclick={nieuw}>Nieuwe map</TekstLink></p>
	</nav>

	<div class="inhoud">
		{#if gedeeld}
			<Sectie titel="Gedeelde map: {gedeeld.naam ?? 'zonder naam'}" niveau={2} inklapbaar={false}>
				{#snippet naast()}
					<span class="acties">
						<TekstLink href={netwerkHref(gedeeld.items) ?? undefined}>Netwerk</TekstLink>
						<TekstLink onclick={() => gedeeldKlaar('map')}>Bewaar als map</TekstLink>
						<TekstLink onclick={() => gedeeldKlaar('erbij')}
							>Voeg toe aan {kaart.actief.naam}</TekstLink
						>
						<TekstLink onclick={() => gedeeldKlaar('niet')}>Niet bewaren</TekstLink>
					</span>
				{/snippet}
				<Aantekening tekst={gedeeld.notitie} bij={gedeeld.naam ?? 'de map'} />
				<p class="meta">
					<span>{tel(gedeeld.items.length)}</span>
					{@render alles(null, gedeeld.items)}
				</p>
				{@render lijst(gedeeld.items, gedeeld.volgorde, null, gedeeld.groepNotities)}
			</Sectie>
		{/if}

		{#each kaart.mappen as m (m.id)}
			<Sectie titel={m.naam} id={anker(m)} niveau={2} sleutel="map:{m.id}" standaardOpen>
				{#snippet naast()}
					<span class="acties">
						{#if m.items.length}
							<!-- The network of a map shows its notes: it is the map worked in from now on. -->
							<TekstLink href={netwerkHref(m.items) ?? undefined} onclick={() => kaart.kies(m.id)}
								>Netwerk</TekstLink
							>
							<TekstLink onclick={() => copier.copy(link(m), `link-${m.id}`)}
								>{copier.label(`link-${m.id}`, 'Kopieer link')}</TekstLink
							>
							<TekstLink
								onclick={() =>
									copier.copy(
										citaten(m.items, m.volgorde, m.notitie, m.groepNotities),
										`cit-${m.id}`
									)}>{copier.label(`cit-${m.id}`, 'Citaten')}</TekstLink
							>
							<TekstLink
								onclick={() =>
									download(
										`${bestand(m)}.csv`,
										csv(m.items, (i) => new URL(adres(i), page.url.origin).toString())
									)}>CSV</TekstLink
							>
						{/if}
						<TekstMenu klein rechts label="Map {m.naam}" tekst="Map">
							{#snippet inhoud(dicht)}
								{#if m.id !== kaart.actief.id}
									<button
										type="button"
										role="menuitem"
										class="tekstmenu__item"
										onclick={() => {
											dicht();
											kaart.kies(m.id);
										}}>Bewaar hierin</button
									>
								{/if}
								<button
									type="button"
									role="menuitem"
									class="tekstmenu__item"
									onclick={() => {
										dicht();
										naamgeven = m.id;
									}}>Hernoem</button
								>
								<button
									type="button"
									role="menuitem"
									class="tekstmenu__item"
									onclick={() => {
										dicht();
										mapNotitieVan = m.id;
									}}>{m.notitie ? 'Wijzig aantekening' : 'Aantekening bij de map'}</button
								>
								<button
									type="button"
									role="menuitem"
									class="tekstmenu__item"
									onclick={() => {
										dicht();
										verwijderen = m.id;
									}}>Verwijder map</button
								>
							{/snippet}
						</TekstMenu>
					</span>
				{/snippet}

				{#if naamgeven === m.id}
					<form
						class="hernoem"
						onsubmit={(e) => {
							e.preventDefault();
							const veld = e.currentTarget.elements.namedItem('naam') as HTMLInputElement;
							kaart.hernoem(m.id, veld.value);
							naamgeven = null;
						}}
					>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							name="naam"
							autofocus
							use:kiesAlles
							aria-label="Naam van de map"
							value={m.naam}
							onblur={(e) => {
								kaart.hernoem(m.id, e.currentTarget.value);
								naamgeven = null;
							}}
							onkeydown={(e) => {
								if (isEscape(e)) {
									e.currentTarget.value = m.naam;
									naamgeven = null;
								}
							}}
						/>
					</form>
				{/if}
				{#if verwijderen === m.id}
					<p class="vraag">
						<span>{m.naam} verwijderen, met {tel(m.items.length)}?</span>
						<button
							type="button"
							class="btn"
							onclick={() => {
								kaart.verwijder(m.id);
								verwijderen = null;
							}}>Verwijder</button
						>
						<TekstLink onclick={() => (verwijderen = null)}>Niet verwijderen</TekstLink>
					</p>
				{/if}

				<Aantekening
					tekst={m.notitie}
					bij={m.naam}
					bind:open={() => mapNotitieVan === m.id, (v) => (mapNotitieVan = v ? m.id : null)}
					onBewaar={(t) => op(m, () => kaart.mapNotitie(t))}
				/>
				<p class="meta">
					<span
						>{m.id === kaart.actief.id ? 'Actieve map, ' : ''}{tel(m.items.length)}, gewijzigd
						{dag(m.gewijzigd)}</span
					>
					{#if m.items.length > 1}
						<TekstMenu
							klein
							label="Volgorde van {m.naam}"
							opties={[
								{ waarde: 'groep' as const, label: 'Per wet of dossier' },
								{ waarde: 'eigen' as const, label: 'Eigen volgorde' }
							]}
							waarde={m.volgorde}
							onKies={(v) => op(m, () => kaart.ordening(v))}
						/>
					{/if}
					{#if m.items.length}{@render alles(m, m.items)}{/if}
				</p>
				{#if !m.items.length}
					<p class="leeg stil">Nog niets bewaard.</p>
				{:else}
					{@render lijst(m.items, m.volgorde, m, m.groepNotities ?? {})}
					<p class="voet">
						<ConfirmButton
							label="Wis de map"
							confirmLabel="Ja, alles uit {m.naam} halen"
							buttonClass="wis"
							onConfirm={() => op(m, () => kaart.wis())}
						/>
					</p>
				{/if}
			</Sectie>
		{/each}
	</div>
	<p class="sr-only" aria-live="polite">{copier.announcement}</p>
</div>

<style>
	/* The frame and grid of Bladeren (AppShell), as Gevolgd: the heading over both columns. */
	/* The column's first heading on the line of the first group's heading, as on Gevolgd. */
	.opzij {
		padding-top: calc(var(--s-3) + 2px);
	}
	.opzij__kop {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.opzij ul {
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.opzij li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
		padding: 2px 0;
	}
	.opzij li button {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.opzij li button:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	.opzij li button.actief {
		color: var(--ink);
		font-weight: 600;
	}
	.opzij .n {
		color: var(--ink-3);
		font-size: var(--t-micro);
	}
	.opzij .nieuw {
		margin: var(--s-2) 0 0;
		font-size: var(--t-meta);
	}
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-7);
		min-width: 0;
	}
	.acties {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-4);
		font-size: var(--t-meta);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-4);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.leeg {
		margin: 0;
	}
	/* A law, dossier or judgment over its rows, as a day over Actueel's. */
	.groep {
		margin: 0;
		padding-bottom: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
	}
	/* The group's head with Aantekening at its right, on hover and focus; always on touch. */
	.groep-kop {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
		margin: var(--s-3) 0 0;
		border-bottom: 1px solid var(--rule-strong);
	}
	.groep-kop .notitie-knop {
		margin-right: 0;
		opacity: 0;
	}
	.groep-kop:hover .notitie-knop,
	.groep-kop:focus-within .notitie-knop {
		opacity: 1;
	}
	@media (hover: none) {
		.groep-kop .notitie-knop {
			opacity: 1;
		}
	}
	/* A law's name opens what is connected to it, in place, as a row opens. */
	.groep-knop {
		display: inline-flex;
		align-items: baseline;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.groep-knop:hover {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.groep-knop:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.wet-open {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-2) var(--s-3);
		background: var(--paper-2);
	}
	.wet-open .verder {
		margin: 0;
		font-size: var(--t-meta);
	}
	.aantal {
		margin-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	/* Bladeren's rows: the kind in the lead, the place as the title, the citation under it. */
	.rijen {
		--row-lead: 140px;
		--row-aside: 280px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row-id-main {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
	}
	.row-sub {
		display: block;
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* Aantekening, up, down and out at the end of the row, on hover and focus; always on a
	   touch screen. */
	.knoppen {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		opacity: 0;
	}
	/* The way to the reader, always in sight: the row's click opens it here. */
	.rijen :global(.naar-lezer) {
		font-size: var(--t-micro);
		white-space: nowrap;
	}
	:global(.row-wrap:hover) .knoppen,
	:global(.row-wrap:focus-within) .knoppen {
		opacity: 1;
	}
	@media (hover: none) {
		.knoppen {
			opacity: 1;
		}
	}
	.notitie-knop {
		margin-right: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.notitie-knop:hover {
		color: var(--ink);
	}
	.hernoem {
		margin: 0;
	}
	.hernoem input {
		box-sizing: border-box;
		width: 100%;
		max-width: 480px;
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 800;
	}
	.vraag {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-size: var(--t-meta);
	}
	.voet {
		margin: var(--s-2) 0 0;
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
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	/* On a phone the maps stand above the groups: the column holds Nieuwe map. */
	@media (max-width: 768px) {
		.opzij {
			padding-top: 0;
			margin-bottom: var(--s-5);
		}
	}
</style>
