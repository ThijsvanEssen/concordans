<script lang="ts">
	// One bundel, alike on Gemarkeerd (a section of the page, among the others) and on its own
	// page (the research on one page, to read and to print): its ways to share it at the right
	// of its name, its note at its top (the question it is about), what it holds (MapGroups),
	// a source outside Concordans added in place, and Wis at its foot.
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import ConfirmButton from '$lib/components/ui/ConfirmButton.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { download, safeFileName } from '$lib/verbonden/export';
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import { afterTick } from '$lib/util/after-tick';
	import { navigate } from '$lib/util/address';
	import { ignore } from '$lib/api/errors';
	import {
		citaten,
		csv,
		groepen,
		itemAddress,
		itemKey,
		netwerkHref,
		type Map,
		type MapItem
	} from './map';
	import { kaart } from './map.svelte';
	import { shareFragment } from './share';
	import { mapFile, mapFileName } from './file';
	import { mapPageHref } from './page';
	import Aantekening from './Aantekening.svelte';
	import AddSource from './AddSource.svelte';
	import MapGroups from './MapGroups.svelte';

	let {
		m,
		standalone = false,
		named = true
	}: {
		m: Map;
		/** On its own page: its name the page's title, Afdrukken among its ways on. */
		standalone?: boolean;
		/** False for a bundel just made: it is named at once. */
		named?: boolean;
	} = $props();

	const copier = createCopier();
	const anchor = $derived(`map-${m.id}`);
	const count = (n: number) => `${formatCount(n)} ${plural(n, 'bron', 'bronnen')}`;
	const day = (iso: string) => korteDatum(vandaag(new Date(iso)));
	const fileBase = $derived(safeFileName(m.naam) || 'Gemarkeerd');

	// The link, made when the bundel changes: deflating takes a moment, and a copy made after
	// it would have lost the click that allows it (Safari).
	let link = $state<string | null>(null);
	$effect(() => {
		const shown = m;
		const origin = page.url.origin;
		let current = true;
		shareFragment(shown)
			.then((hash) => {
				if (current) link = `${origin}/gemarkeerd${hash}`;
			})
			.catch(ignore('gedeeld'));
		return () => {
			current = false;
		};
	});

	/** A change of this bundel: the store acts on the active one. */
	function inMap(change: () => void) {
		if (kaart.actief.id !== m.id) kaart.kies(m.id);
		change();
	}

	// ── The rows open: one by one, or all at once ────────────────────────────
	const open = new SvelteSet<string>();
	const allOpen = $derived(m.items.length > 0 && m.items.every((i) => open.has(itemKey(i))));
	function toggleAll() {
		const opening = !allOpen;
		for (const i of m.items) {
			if (opening) open.add(itemKey(i));
			else open.delete(itemKey(i));
		}
	}

	// ── Its name, its note, Verwijder, a source outside Concordans ────────────
	let renaming = $state(untrack(() => !named));
	let deleting = $state(false);
	let noteOpen = $state(false);
	let adding = $state(false);
	/** The focus back on the bundel's name, once the page has drawn it. */
	const focusHead = () =>
		afterTick(() =>
			document.querySelector<HTMLElement>(`#${anchor} .kop button, #${anchor} h1`)?.focus()
		);
	const focusAdd = () => afterTick(() => document.getElementById(`erbij-${m.id}`)?.focus());
	/** The field takes the whole name on opening, to type over it. */
	const selectAll = (field: HTMLInputElement) => field.select();
	function remove() {
		kaart.verwijder(m.id);
		deleting = false;
		if (standalone) navigate('/gemarkeerd');
	}
</script>

{#snippet actions()}
	<span class="acties">
		{#if m.items.length}
			<!-- The network of a bundel shows its notes: it is the bundel worked in from now on. -->
			<TekstLink href={netwerkHref(m.items) ?? undefined} onclick={() => kaart.kies(m.id)}
				>Netwerk</TekstLink
			>
			<TekstLink disabled={!link} onclick={() => copier.copy(link ?? '', 'link')}
				>{copier.label('link', 'Kopieer link')}</TekstLink
			>
			<TekstLink
				onclick={() =>
					copier.copy(citaten(m.items, m.volgorde, m.notitie, m.groepNotities), 'citations')}
				>{copier.label('citations', 'Citaten')}</TekstLink
			>
			<TekstLink
				onclick={() =>
					download(
						`${fileBase}.csv`,
						csv(m.items, (i) => itemAddress(i, page.url.origin), m.volgorde)
					)}>CSV</TekstLink
			>
		{/if}
		<TekstLink onclick={() => download(mapFileName([m]), mapFile([m]), 'application/json')}
			>Bewaar als bestand</TekstLink
		>
		{#if standalone}
			<TekstLink onclick={() => window.print()}>Afdrukken</TekstLink>
		{:else}
			<TekstLink href={mapPageHref(m)}>Pagina</TekstLink>
		{/if}
		<TekstMenu klein rechts label="Bundel {m.naam}" tekst="Bundel">
			{#snippet inhoud(close)}
				{#if m.id !== kaart.actief.id}
					<button
						type="button"
						role="menuitem"
						class="tekstmenu__item"
						onclick={() => {
							close();
							kaart.kies(m.id);
						}}>Bewaar hierin</button
					>
				{/if}
				<button
					type="button"
					role="menuitem"
					class="tekstmenu__item"
					onclick={() => {
						close();
						renaming = true;
					}}>Hernoem</button
				>
				<button
					type="button"
					role="menuitem"
					class="tekstmenu__item"
					onclick={() => {
						close();
						noteOpen = true;
					}}>{m.notitie ? 'Wijzig aantekening' : 'Aantekening bij de bundel'}</button
				>
				<button
					type="button"
					role="menuitem"
					class="tekstmenu__item"
					onclick={() => {
						close();
						deleting = true;
					}}>Verwijder bundel</button
				>
			{/snippet}
		</TekstMenu>
	</span>
{/snippet}

{#snippet content()}
	{#if renaming}
		<form
			class="hernoem"
			onsubmit={(e) => {
				e.preventDefault();
				const field = e.currentTarget.elements.namedItem('naam') as HTMLInputElement;
				kaart.hernoem(m.id, field.value);
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
				value={m.naam}
				onblur={(e) => {
					kaart.hernoem(m.id, e.currentTarget.value);
					renaming = false;
				}}
				onkeydown={(e) => {
					// The field's own Escape (isEscape leaves a field alone).
					if (e.key === 'Escape') {
						e.currentTarget.value = m.naam;
						renaming = false;
						focusHead();
					}
				}}
			/>
		</form>
	{/if}
	{#if deleting}
		<p class="vraag">
			<span>{m.naam} verwijderen, met {count(m.items.length)}?</span>
			<button type="button" class="btn" onclick={remove}>Verwijder</button>
			<TekstLink onclick={() => (deleting = false)}>Niet verwijderen</TekstLink>
		</p>
	{/if}

	<Aantekening
		tekst={m.notitie}
		bij={m.naam}
		bind:open={noteOpen}
		onBewaar={(t) => inMap(() => kaart.mapNotitie(t))}
	/>
	<p class="meta">
		<span
			>{m.id === kaart.actief.id ? 'Actieve bundel, ' : ''}{count(m.items.length)}, gewijzigd
			{day(m.gewijzigd)}</span
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
				onSelect={(v) => inMap(() => kaart.ordening(v))}
			/>
		{/if}
		{#if m.items.length}
			<TekstLink onclick={toggleAll} aria-pressed={allOpen}
				>{allOpen ? 'Alles inklappen' : 'Alles uitklappen'}</TekstLink
			>
		{/if}
	</p>
	{#if !m.items.length}
		<p class="leeg stil">Nog niets bewaard.</p>
	{:else}
		<MapGroups map={m} items={m.items} order={m.volgorde} notes={m.groepNotities ?? {}} {open} />
	{/if}
	{#if adding}
		<AddSource
			groups={groepen(m.items).map((g) => ({ key: g.sleutel, name: g.groep }))}
			onAdd={(i: MapItem) => inMap(() => kaart.wissel(i))}
			onReader={() => kaart.kies(m.id)}
			onClose={() => {
				adding = false;
				focusAdd();
			}}
		/>
	{:else}
		<p class="erbij">
			<TekstLink id="erbij-{m.id}" onclick={() => (adding = true)}>Andere bron toevoegen</TekstLink>
		</p>
	{/if}
	{#if m.items.length}
		<p class="voet">
			<ConfirmButton
				label="Wis de bundel"
				confirmLabel="Ja, alles uit {m.naam} halen"
				class="wis raakvlak"
				onConfirm={() => inMap(() => kaart.wis())}
			/>
		</p>
	{/if}
	<p class="sr-only" aria-live="polite">{copier.announcement}</p>
{/snippet}

{#if standalone}
	<article class="bundel" id={anchor}>
		<header class="blad__kop">
			<h1 class="blad__titel" tabindex="-1">{m.naam}</h1>
			{@render actions()}
		</header>
		<div class="inhoud">{@render content()}</div>
	</article>
{:else}
	<Sectie title={m.naam} id={anchor} niveau={2} sleutel="map:{m.id}" standaardOpen>
		{#snippet naast()}{@render actions()}{/snippet}
		{@render content()}
	</Sectie>
{/if}

<style>
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
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
	.voet {
		margin: var(--s-2) 0 0;
	}
	.erbij {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
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
	/* On paper: the name, the question and what the bundel holds; no ways on. */
	@media print {
		.acties,
		.erbij,
		.voet,
		.meta :global(.tekstmenu),
		.meta :global(.tekstlink) {
			display: none;
		}
	}
</style>
