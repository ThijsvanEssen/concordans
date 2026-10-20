<script lang="ts">
	// One bundel on its own page, the place to work in it (bundels-ux 2b): its name with
	// Netwerk, Kopieer link and one menu Meer; its research question as a field; one working
	// line (the place for the view, the order, Alles uitklappen); what it holds (MapGroups);
	// a source outside Concordans added at its foot. A shared bundel (a link) is the same page,
	// read only, with Bewaar in place of Kopieer link and its choices in Meer. On paper (PDF,
	// the print view, A4) the name, the question, the day it changed and what it holds.
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { focusFirstItem } from '$lib/actions/menu';
	import { download, safeFileName } from '$lib/verbonden/export';
	import { formatCount } from '$lib/text/getal';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import { afterTick } from '$lib/util/after-tick';
	import { navigate } from '$lib/util/address';
	import { ignore, report } from '$lib/api/errors';
	import {
		citaten,
		csv,
		groepen,
		itemAddress,
		itemKey,
		netwerkHref,
		type Map,
		type MapItem,
		type SharedMap
	} from './map';
	import { kaart } from './map.svelte';
	import { shareFragment } from './share';
	import { mapFile, mapFileName } from './file';
	import { BUNDLES_PATH } from './page';
	import Aantekening from './Aantekening.svelte';
	import AddSource from './AddSource.svelte';
	import MapGroups from './MapGroups.svelte';
	import NewMark from '$lib/components/ui/NewMark.svelte';
	import { Fresh } from './fresh.svelte';

	let {
		m = null,
		shared = null,
		onShared
	}: {
		/** The bundel of this browser, to work in. */
		m?: Map | null;
		/** A bundel shared as a link, in place of `m`: read only. */
		shared?: SharedMap | null;
		/** The choice for a shared bundel: kept as a bundel, added to one, or put aside. */
		onShared?: (how: 'map' | 'add' | 'none', into?: string) => void;
	} = $props();

	/** What is shown: the bundel's own or the shared one. */
	const b = $derived<Pick<Map, 'naam' | 'items' | 'volgorde' | 'notitie' | 'groepNotities'>>(
		m ?? {
			naam: shared?.naam ?? 'Gedeelde bundel',
			items: shared?.items ?? [],
			volgorde: shared?.volgorde ?? 'groep',
			notitie: shared?.notitie ?? null,
			groepNotities: shared?.groepNotities ?? {}
		}
	);
	const copier = createCopier();
	const anchor = $derived(m ? `map-${m.id}` : 'gedeeld');
	const fileBase = $derived(safeFileName(b.naam) || 'Bundel');

	// The link, made when the bundel changes: deflating takes a moment, and a copy made after
	// it would have lost the click that allows it (Safari).
	let link = $state<string | null>(null);
	$effect(() => {
		if (!m) return;
		const shown = m;
		const origin = page.url.origin;
		let current = true;
		shareFragment(shown)
			.then((hash) => {
				if (current) link = `${origin}${BUNDLES_PATH}${hash}`;
			})
			.catch(ignore('gedeeld'));
		return () => {
			current = false;
		};
	});

	// Back on the bundel a reader kept in: that keeping ends here (UX-toets A21 #1).
	$effect(() => {
		const id = m?.id;
		untrack(() => {
			if (id && kaart.keeping?.id === id) kaart.keepIn(null);
		});
	});

	// ── What is new since the visit before: on its own page, after the first paint ──
	let fresh = $state<Fresh | null>(null);
	$effect(() => {
		if (!m) return;
		const own = m;
		return untrack(() => {
			const since = kaart.visit(own.id, vandaag());
			if (!since) return;
			const asking = new Fresh(since);
			fresh = asking;
			const ac = new AbortController();
			const frame = requestAnimationFrame(() =>
				setTimeout(() => asking.load(own.items, ac.signal).catch((e) => report('Nieuw sinds', e)))
			);
			return () => {
				cancelAnimationFrame(frame);
				ac.abort();
			};
		});
	});

	// ── The rows open: one by one, or all at once ────────────────────────────
	const open = new SvelteSet<string>();
	const allOpen = $derived(b.items.length > 0 && b.items.every((i) => open.has(itemKey(i))));
	function toggleAll() {
		const opening = !allOpen;
		for (const i of b.items) {
			if (opening) open.add(itemKey(i));
			else open.delete(itemKey(i));
		}
	}

	// ── Its name, Verwijder or Leegmaken, a source outside Concordans ─────────
	let renaming = $state(false);
	let asking = $state<'delete' | 'empty' | null>(null);
	let adding = $state(false);
	/** The list of bundels to add a shared one to, in place of Meer's own items. */
	let choosing = $state(false);
	/** The focus back on the bundel's name, once the page has drawn it. */
	const focusHead = () =>
		afterTick(() =>
			document.querySelector<HTMLElement>(`#${anchor} .kop button, #${anchor} h1`)?.focus()
		);
	const focusAdd = () => afterTick(() => document.getElementById(`erbij-${anchor}`)?.focus());
	/** The field takes the whole name on opening, to type over it. */
	const selectAll = (field: HTMLInputElement) => field.select();
	function confirm() {
		if (!m) return;
		if (asking === 'delete') {
			kaart.verwijder(m.id);
			navigate(BUNDLES_PATH);
		} else if (asking === 'empty') kaart.empty(m.id);
		asking = null;
	}
	/** One item of a menu: closes it, then acts. */
	const act = (close: () => void, f: () => void) => () => {
		close();
		f();
	};
</script>

<!-- What every bundel offers to take along: its citations, a CSV, a file, a PDF. -->
{#snippet takeAlong(close: () => void)}
	<button
		type="button"
		role="menuitem"
		class="tekstmenu__item"
		onclick={act(close, () =>
			copier.copy(citaten(b.items, b.volgorde, b.notitie, b.groepNotities), 'citations')
		)}>Kopieer citaten</button
	>
	<button
		type="button"
		role="menuitem"
		class="tekstmenu__item"
		onclick={act(close, () =>
			download(
				`${fileBase}.csv`,
				csv(b.items, (i) => itemAddress(i, page.url.origin), b.volgorde)
			)
		)}>Download CSV</button
	>
	{#if m}
		{@const own = m}
		<button
			type="button"
			role="menuitem"
			class="tekstmenu__item"
			onclick={act(close, () => download(mapFileName([own]), mapFile([own]), 'application/json'))}
			>Download bestand</button
		>
	{/if}
	<button
		type="button"
		role="menuitem"
		class="tekstmenu__item"
		title="Als PDF bewaren of afdrukken"
		onclick={act(close, () => window.print())}>PDF</button
	>
{/snippet}

{#snippet actions()}
	<span class="acties">
		{#if b.items.length}
			<TekstLink href={netwerkHref(b.items) ?? undefined}>Netwerk</TekstLink>
		{/if}
		{#if m}
			<TekstLink disabled={!link} onclick={() => copier.copy(link ?? '', 'link')}
				>{copier.label('link', 'Kopieer link')}</TekstLink
			>
		{:else}
			<button type="button" class="btn" onclick={() => onShared?.('map')}>Bewaar</button>
		{/if}
		<TekstMenu
			klein
			rechts
			label="Meer bij {b.naam}"
			tekst="Meer"
			onClose={() => (choosing = false)}
		>
			{#snippet inhoud(close)}
				{#if choosing}
					{#each kaart.listed as into (into.id)}
						<button
							type="button"
							role="menuitem"
							class="tekstmenu__item"
							onclick={act(close, () => {
								choosing = false;
								onShared?.('add', into.id);
							})}>{into.naam}</button
						>
					{/each}
				{:else}
					{#if b.items.length}{@render takeAlong(close)}{/if}
					{#if m}
						{@const own = m}
						<div class="tekstmenu__onder">
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={act(close, () => (renaming = true))}>Hernoem</button
							>
							{#if kaart.isDefault(own)}
								{#if own.items.length}
									<button
										type="button"
										role="menuitem"
										class="tekstmenu__item"
										onclick={act(close, () => (asking = 'empty'))}>Leegmaken</button
									>
								{/if}
							{:else}
								<button
									type="button"
									role="menuitem"
									class="tekstmenu__item"
									onclick={act(close, () => (asking = 'delete'))}>Verwijder bundel</button
								>
							{/if}
						</div>
					{:else}
						<div class="tekstmenu__onder">
							{#if b.items.length}
								<!-- Stays open: its list of bundels takes the place of these items. -->
								<button
									type="button"
									role="menuitem"
									class="tekstmenu__item"
									aria-haspopup="menu"
									onclick={() => {
										choosing = true;
										focusFirstItem();
									}}>Voeg toe aan …</button
								>
							{/if}
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={act(close, () => onShared?.('none'))}>Niet bewaren</button
							>
						</div>
					{/if}
				{/if}
			{/snippet}
		</TekstMenu>
	</span>
{/snippet}

{#snippet content()}
	{#if renaming && m}
		{@const own = m}
		<form
			class="hernoem"
			onsubmit={(e) => {
				e.preventDefault();
				const field = e.currentTarget.elements.namedItem('naam') as HTMLInputElement;
				kaart.hernoem(own.id, field.value);
				renaming = false;
				focusHead();
			}}
		>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				name="naam"
				autofocus
				use:selectAll
				aria-label="Naam van de bundel"
				value={own.naam}
				onblur={(e) => {
					kaart.hernoem(own.id, e.currentTarget.value);
					renaming = false;
				}}
				onkeydown={(e) => {
					// The field's own Escape (isEscape leaves a field alone).
					if (e.key === 'Escape') {
						e.currentTarget.value = own.naam;
						renaming = false;
						focusHead();
					}
				}}
			/>
		</form>
	{/if}
	{#if asking}
		<p class="vraag">
			<span>{b.naam} {asking === 'delete' ? 'verwijderen' : 'leegmaken'}?</span>
			<button type="button" class="btn" onclick={confirm}
				>{asking === 'delete' ? 'Verwijder' : 'Leegmaken'}</button
			>
			<TekstLink onclick={() => (asking = null)}
				>{asking === 'delete' ? 'Niet verwijderen' : 'Niet leegmaken'}</TekstLink
			>
		</p>
	{/if}
	{#if shared?.skipped}
		<p class="stil" role="status">{formatCount(shared.skipped)} uit de link niet te lezen</p>
	{/if}
	{#if m}
		{@const own = m}
		<Aantekening
			tekst={own.notitie}
			bij={own.naam}
			placeholder="Onderzoeksvraag of aantekening"
			onBewaar={(t) => kaart.mapNotitie(t, own.id)}
		/>
	{:else}
		<Aantekening tekst={b.notitie} bij={b.naam} />
	{/if}
	{#if m}<p class="papier">Gewijzigd {korteDatum(vandaag(new Date(m.gewijzigd)))}</p>{/if}
	<div class="werkregel">
		<!-- The place of the view, Lijst | Oud en nieuw, where a bundel holds a pair (O3). -->
		{#if m && m.items.length > 1}
			{@const own = m}
			<TekstMenu
				klein
				label="Volgorde van {own.naam}"
				opties={[
					{ waarde: 'groep' as const, label: 'Per wet of dossier' },
					{ waarde: 'eigen' as const, label: 'Eigen volgorde' }
				]}
				waarde={own.volgorde}
				onSelect={(v) => kaart.ordening(v, own.id)}
			/>
		{/if}
		{#if b.items.length}
			<span class="rechts">
				<TekstLink onclick={toggleAll} aria-pressed={allOpen}
					>{allOpen ? 'Alles inklappen' : 'Alles uitklappen'}</TekstLink
				>
			</span>
		{/if}
	</div>
	<!-- What is new since the visit before: its line stands from the first paint, its words
	     come in it (F1). -->
	{#if fresh}<p class="nieuw-regel">
			{#if fresh.any}<NewMark since={fresh.since} />{/if}
		</p>{/if}
	{#if !b.items.length}
		<p class="leeg stil">Nog niets bewaard.</p>
	{:else}
		<MapGroups
			map={m}
			items={b.items}
			order={b.volgorde}
			notes={b.groepNotities ?? {}}
			{open}
			{fresh}
		/>
	{/if}
	{#if m}
		{@const own = m}
		{#if adding}
			<AddSource
				bundle={own.id}
				groups={groepen(own.items).map((g) => ({ key: g.sleutel, name: g.groep }))}
				onAdd={(i: MapItem) => kaart.add(i, own.id)}
				onClose={() => {
					adding = false;
					focusAdd();
				}}
			/>
		{:else}
			<p class="erbij">
				<TekstLink id="erbij-{anchor}" onclick={() => (adding = true)}
					>Andere bron toevoegen</TekstLink
				>
			</p>
		{/if}
	{/if}
	<p class="sr-only" aria-live="polite">{copier.announcement}</p>
{/snippet}

<article class="bundel" id={anchor}>
	<header class="blad__kop">
		<h1 class="blad__titel" tabindex="-1">{b.naam}</h1>
		{@render actions()}
	</header>
	<div class="inhoud">{@render content()}</div>
</article>

<style>
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.acties {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-1) var(--s-4);
		font-size: var(--t-meta);
	}
	/* One line: the view and the order at the left, Alles uitklappen at the right. */
	.werkregel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-1) var(--s-4);
		margin-top: var(--s-2);
		font-size: var(--t-meta);
	}
	.werkregel .rechts {
		margin-left: auto;
	}
	.nieuw-regel {
		height: calc(var(--t-meta) * var(--lh-snug));
		margin: 0;
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.leeg {
		margin: 0;
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
	.erbij {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
	/* The day it changed: on paper only. */
	.papier {
		display: none;
	}
	/* On paper, A4 (PDF, decision 20E): the bundel alone, without the bar and the footer; the
	   name, the question, the day and what the bundel holds, no ways on. */
	@media print {
		@page {
			size: A4;
			margin: 20mm 18mm;
		}
		:global(body:has(.bundel) .topbar),
		:global(body:has(.bundel) .foot),
		:global(body:has(.bundel) .stub-eyebrow) {
			display: none;
		}
		:global(body:has(.bundel) .blad-hoogte) {
			min-height: 0;
		}
		:global(.blad:has(> .bundel)),
		:global(.blad:has(> .bundel) > *) {
			max-width: none;
			padding: 0;
		}
		.bundel :global(a) {
			color: inherit;
			text-decoration: none;
		}
		.bundel :global(h1),
		.bundel :global(h2),
		.bundel :global(h3) {
			break-after: avoid;
		}
		.acties,
		.erbij,
		.werkregel,
		.vraag,
		.nieuw-regel,
		.inhoud :global(.aantekening:has(.aantekening-veld)) {
			display: none;
		}
		.papier {
			display: block;
			margin: 0;
			font-size: var(--t-micro);
			color: var(--ink-3);
		}
	}
</style>
