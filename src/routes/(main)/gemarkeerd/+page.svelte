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

	const reeksen = (lijst: MapItem[], v: Map['volgorde']) =>
		v === 'eigen' ? [{ groep: '', items: [...lijst] }] : groepen(lijst);
	const collectieVan = (i: MapItem) => i.id.split('/')[0] as Collection;

	/** The place an item opens: the bron in Samenhang, at its lid or overweging. */
	const adres = (i: MapItem) => {
		const href = buildBronHref(null, i.id);
		return i.at ? `${href.split('#')[0]}#${encodeURIComponent(i.at)}` : href;
	};
	const link = (m: Map) => {
		const url = new URL('/gemarkeerd', page.url.origin);
		url.searchParams.set('map', naarParam(m.items));
		url.searchParams.set('mapnaam', m.naam);
		if (m.volgorde === 'eigen') url.searchParams.set('mapvolgorde', 'eigen');
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

	// ── A note: opened in place, Enter keeps it, Escape leaves it ─────────────
	let notitieVan = $state<string | null>(null);
	/** The field takes the focus on opening. */
	const focus = (veld: HTMLTextAreaElement) => veld.focus();
	function notitieToets(e: KeyboardEvent, m: Map, i: MapItem) {
		const veld = e.currentTarget as HTMLTextAreaElement;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			op(m, () => kaart.notitie(i, veld.value));
			notitieVan = null;
		} else if (isEscape(e)) {
			veld.value = i.notitie ?? '';
			notitieVan = null;
		}
	}
</script>

<RouteKop pad="/gemarkeerd" />

{#snippet rij(i: MapItem, m: Map | null)}
	{@const k = (m?.id ?? 'gedeeld') + ':' + sleutelVan(i)}
	<IndexRow title={i.kort} href={adres(i)} acties>
		{#snippet lead()}
			<span class="row-id-main"
				><KindGlyph collection={collectieVan(i)} size={12} />{bronLabel(collectieVan(i))}</span
			>
		{/snippet}
		{#snippet body()}
			{#if i.voluit && i.voluit !== i.kort}<span class="row-sub">{i.voluit}</span>{/if}
			{#if m && notitieVan === k}
				<textarea
					class="notitie-veld"
					rows="2"
					aria-label="Aantekening bij {i.kort}"
					value={i.notitie ?? ''}
					use:focus
					onkeydown={(e) => notitieToets(e, m, i)}
					onblur={(e) => {
						if (notitieVan !== k) return;
						const tekst = e.currentTarget.value;
						op(m, () => kaart.notitie(i, tekst));
						notitieVan = null;
					}}
				></textarea>
			{:else if i.notitie && m}
				<button
					type="button"
					class="notitie"
					title="Aantekening wijzigen"
					onclick={() => (notitieVan = k)}>{i.notitie}</button
				>
			{:else if i.notitie}
				<span class="notitie">{i.notitie}</span>
			{/if}
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
		{/snippet}
	</IndexRow>
{/snippet}

{#snippet lijst(alle: MapItem[], v: Map['volgorde'], m: Map | null)}
	{#each reeksen(alle, v) as g (g.groep)}
		{#if g.groep}<h3 class="groep">{g.groep}<span class="aantal">{g.items.length}</span></h3>{/if}
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
						<TekstLink onclick={() => gedeeldKlaar('map')}>Bewaar als map</TekstLink>
						<TekstLink onclick={() => gedeeldKlaar('erbij')}
							>Voeg toe aan {kaart.actief.naam}</TekstLink
						>
						<TekstLink onclick={() => gedeeldKlaar('niet')}>Niet bewaren</TekstLink>
					</span>
				{/snippet}
				<p class="meta">{tel(gedeeld.items.length)}</p>
				{@render lijst(gedeeld.items, gedeeld.volgorde, null)}
			</Sectie>
		{/if}

		{#each kaart.mappen as m (m.id)}
			<Sectie titel={m.naam} id={anker(m)} niveau={2} sleutel="map:{m.id}" standaardOpen>
				{#snippet naast()}
					<span class="acties">
						{#if m.items.length}
							<TekstLink onclick={() => copier.copy(link(m), `link-${m.id}`)}
								>{copier.label(`link-${m.id}`, 'Kopieer link')}</TekstLink
							>
							<TekstLink onclick={() => copier.copy(citaten(m.items, m.volgorde), `cit-${m.id}`)}
								>{copier.label(`cit-${m.id}`, 'Citaten')}</TekstLink
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
				</p>
				{#if !m.items.length}
					<p class="leeg stil">Nog niets bewaard.</p>
				{:else}
					{@render lijst(m.items, m.volgorde, m)}
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
		margin: var(--s-3) 0 0;
		padding-bottom: var(--s-1);
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
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
		--row-aside: 190px;
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
	/* The reader's note: italic, under the citation; a click opens it to change. */
	.notitie {
		display: block;
		margin: var(--s-1) 0 0;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-style: italic;
		color: var(--ink-2);
		text-align: left;
	}
	button.notitie {
		cursor: text;
	}
	.notitie-veld {
		box-sizing: border-box;
		width: 100%;
		margin-top: var(--s-1);
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-style: italic;
		resize: vertical;
	}
	/* Aantekening, up, down and out at the end of the row, on hover and focus; always on a
	   touch screen. */
	.knoppen {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		width: 100%;
		opacity: 0;
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
