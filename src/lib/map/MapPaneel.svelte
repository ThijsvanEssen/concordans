<script lang="ts">
	// Gemarkeerd: the map over the page, opened from the menu item (concept 13-map, variant 7,
	// step 1). Its heading with the ways to share it (a link, the citations, a CSV), and the
	// items per law, dossier or judgment, each a link to its place and an × to take it out. A
	// map opened from a link stands here until it is added to this one or put aside.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import IconKnop from '$lib/components/ui/IconKnop.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import ConfirmButton from '$lib/components/ui/ConfirmButton.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { isEscape } from '$lib/actions/keys';
	import { download } from '$lib/verbonden/export';
	import { citaten, csv, groepen, naarParam, sleutelVan, type MapItem } from './map';
	import { kaart } from './map.svelte';

	const gedeeld = $derived(kaart.gedeeld);
	const items = $derived(gedeeld ?? kaart.items);
	const copier = createCopier();

	/** The place an item opens: the bron in Samenhang, at its lid or overweging. */
	const adres = (i: MapItem) => {
		const href = buildBronHref(null, i.id);
		return i.at ? `${href.split('#')[0]}#${encodeURIComponent(i.at)}` : href;
	};
	const link = () => {
		const url = new URL('/explore', page.url.origin);
		url.searchParams.set('map', naarParam(kaart.items));
		return url.toString();
	};
	const sluit = () => {
		kaart.open = false;
	};
	/** A shared map added or put aside: its link leaves the address, a reload asks no more. */
	function gedeeldKlaar(neem: boolean) {
		if (neem) kaart.neemOver();
		else kaart.gedeeld = null;
		const url = new URL(page.url);
		if (!url.searchParams.has('map')) return;
		url.searchParams.delete('map');
		void goto(url.pathname + url.search + url.hash, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}
	const tel = (n: number) => `${n.toLocaleString('nl-NL')} ${n === 1 ? 'bron' : 'bronnen'}`;
</script>

<svelte:window onkeydown={(e) => kaart.open && isEscape(e) && sluit()} />

{#if kaart.open}
	<aside class="paneel" aria-label="Gemarkeerd">
		<header class="kop">
			<h2>{gedeeld ? 'Gedeelde map' : 'Gemarkeerd'}</h2>
			<span class="aantal">{tel(items.length)}</span>
			<IconKnop label="Gemarkeerd sluiten" onclick={sluit}>×</IconKnop>
		</header>

		{#if gedeeld}
			<p class="acties">
				<button type="button" class="btn" onclick={() => gedeeldKlaar(true)}
					>Voeg toe aan de map</button
				>
				<TekstLink onclick={() => gedeeldKlaar(false)}>Niet toevoegen</TekstLink>
			</p>
		{:else if items.length}
			<p class="acties">
				<button type="button" class="btn" onclick={() => copier.copy(link(), 'link')}
					>{copier.label('link', 'Kopieer link')}</button
				>
				<button type="button" class="btn" onclick={() => copier.copy(citaten(items), 'citaten')}
					>{copier.label('citaten', 'Citaten')}</button
				>
				<button
					type="button"
					class="btn"
					onclick={() =>
						download(
							'Gemarkeerd.csv',
							csv(items, (i) => new URL(adres(i), page.url.origin).toString())
						)}>CSV</button
				>
			</p>
		{/if}

		{#if !items.length}
			<p class="leeg">Nog niets bewaard.</p>
		{:else}
			<div class="lijst">
				{#each groepen(items) as g (g.groep)}
					<section class="groep">
						<h3>{g.groep}<span class="aantal">{g.items.length}</span></h3>
						<ul>
							{#each g.items as i (sleutelVan(i))}
								<li>
									<a href={adres(i)} onclick={sluit}>{i.kort}</a>
									{#if !gedeeld}
										<IconKnop label="{i.kort} uit Gemarkeerd halen" onclick={() => kaart.weg(i)}
											>×</IconKnop
										>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
			{#if !gedeeld}
				<p class="voet">
					<ConfirmButton
						label="Wis de map"
						confirmLabel="Ja, alles uit Gemarkeerd halen"
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
		width: 380px;
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
	.kop h2 {
		margin: 0;
		font-size: var(--t-h3);
		font-weight: 800;
	}
	.kop :global(.iconknop) {
		margin-left: auto;
	}
	.aantal {
		margin-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	.acties {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin: var(--s-3) 0 var(--s-2);
		font-size: var(--t-meta);
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
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--s-2);
		padding: var(--s-1) 0;
		border-bottom: 1px solid var(--rule);
		font-size: var(--t-meta);
	}
	li a {
		color: var(--ink);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	li a:hover {
		text-decoration: underline;
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
