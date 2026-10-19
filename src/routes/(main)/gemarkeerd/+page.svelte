<script lang="ts">
	// Gemarkeerd: the reader's own collections, built as Gevolgd is (Thijs, 10 Oct: "past nu nog
	// totaal niet bij de rest"). The heading over both columns; the bundels in the facet column,
	// the active one (where Bewaar keeps) in weight, with a file to open and all of them to keep
	// as one; in the list column each bundel a section of the page (MapView, as on its own
	// page). A bundel shared as a link (its fragment, share.ts: never in a request) or opened
	// from a file stands at the top as a section of its own until it is kept, added, put in
	// place of one or put aside.
	import { page } from '$app/state';
	import { navigate } from '$lib/util/address';
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { afterTick } from '$lib/util/after-tick';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import ConfirmButton from '$lib/components/ui/ConfirmButton.svelte';
	import { download } from '$lib/verbonden/export';
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import { ignore } from '$lib/api/errors';
	import { itemKey, netwerkHref, type Map, type SharedMap } from '$lib/map/map';
	import { kaart } from '$lib/map/map.svelte';
	import { BROKEN, isOldLink, sharedOfFragment } from '$lib/map/share';
	import { NEWER, mapFile, mapFileName, readMapFile, type FileMap } from '$lib/map/file';
	import Aantekening from '$lib/map/Aantekening.svelte';
	import MapGroups from '$lib/map/MapGroups.svelte';
	import MapView from '$lib/map/MapView.svelte';

	const count = (n: number) => `${formatCount(n)} ${plural(n, 'bron', 'bronnen')}`;
	const day = (iso: string) => korteDatum(vandaag(new Date(iso)));
	/** The focus on a bundel's name, once the page has drawn it. */
	const focusHead = (m: Map) =>
		afterTick(() => document.querySelector<HTMLElement>(`#map-${m.id} .kop button`)?.focus());

	// ── A shared bundel, from the address's fragment ───────────────────────────
	let shared = $state<SharedMap | typeof BROKEN | null>(null);
	const sharedOpen = new SvelteSet<string>();
	/** A link of the older form (its bundel in the query) was opened: said as a broken one. */
	let oldLink = $state(false);
	$effect(() => {
		const hash = page.url.hash;
		if (isOldLink(page.url.searchParams)) {
			oldLink = true;
			navigate(`/gemarkeerd${hash}`);
		}
		let current = true;
		sharedOfFragment(hash)
			.then((read) => {
				if (current) shared = read;
			})
			.catch(ignore('gedeeld'));
		return () => {
			current = false;
		};
	});
	/** A shared bundel kept or put aside: its link leaves the address, a reload asks no more. */
	function sharedDone(how: 'map' | 'add' | 'none') {
		if (shared && shared !== BROKEN && how === 'map') kaart.bewaarAlsMap(shared);
		else if (shared && shared !== BROKEN && how === 'add') kaart.voegToe(shared);
		oldLink = false;
		navigate('/gemarkeerd');
		focusHead(kaart.actief);
	}

	// ── Bundels from a file, each kept, added or put in place of one as the reader chooses ──
	/** The rows open, by their item's key. */
	type OpenRows = SvelteSet<string>;
	type FromFile = { map: FileMap; open: OpenRows };
	type Opened = { name: string; maps: FromFile[] } | { name: string; error: string };
	let opened = $state<Opened | null>(null);
	let fileField = $state<HTMLInputElement>();
	const fileError = (name: string, read: typeof BROKEN | typeof NEWER) =>
		read === NEWER
			? `${name}: van een nieuwere versie van Concordans`
			: `${name}: geen bundel of beschadigd`;
	async function openFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		const read = readMapFile(await file.text());
		opened =
			read === BROKEN || read === NEWER
				? { name: file.name, error: fileError(file.name, read) }
				: { name: file.name, maps: read.map((map) => ({ map, open: new SvelteSet<string>() })) };
	}
	/** The bundel of this browser a bundel from a file stands for: by its id, else its name. */
	const targetOf = (f: FileMap) =>
		kaart.mappen.find((m) => m.id === f.id) ?? kaart.mappen.find((m) => m.naam === f.naam);
	/** A bundel from a file kept, added, put in place of one, or put aside. */
	function fileDone(f: FileMap, how: 'map' | 'add' | 'replace' | 'none') {
		const target = targetOf(f);
		if (how === 'map') kaart.bewaarAlsMap(f);
		else if (how === 'add') kaart.voegToe(f, (target ?? kaart.actief).id);
		else if (how === 'replace' && target) kaart.replace(target.id, f);
		if (opened && 'maps' in opened) {
			const rest = opened.maps.filter((x) => x.map !== f);
			opened = rest.length ? { ...opened, maps: rest } : null;
		}
	}

	// ── The bundels ──────────────────────────────────────────────────────────
	/** A bundel just made: it is named at once. */
	let newId = $state<string | null>(null);
	function newMap() {
		const m = kaart.nieuw();
		newId = m.id;
		afterTick(() => document.getElementById(`map-${m.id}`)?.scrollIntoView());
	}
	async function toMap(m: Map) {
		kaart.kies(m.id);
		await tick();
		document.getElementById(`map-${m.id}`)?.scrollIntoView({ block: 'start' });
	}
</script>

<RouteKop />

<!-- A shared bundel's rows, all open or none, as a bundel's own (MapView). -->
{#snippet allOf(open: OpenRows, items: SharedMap['items'])}
	{@const all = items.length > 0 && items.every((i) => open.has(itemKey(i)))}
	<TekstLink
		onclick={() => {
			for (const i of items) {
				if (all) open.delete(itemKey(i));
				else open.add(itemKey(i));
			}
		}}
		aria-pressed={all}>{all ? 'Alles inklappen' : 'Alles uitklappen'}</TekstLink
	>
{/snippet}

<!-- A bundel from a link or a file: read only, what it holds as a bundel shows it. -->
{#snippet held(g: SharedMap, open: OpenRows, from: string)}
	<Aantekening tekst={g.notitie} bij={g.naam ?? 'de bundel'} />
	<p class="meta">
		<span
			>{count(g.items.length)}{#if g.skipped}, {formatCount(g.skipped)} uit {from} niet te lezen{/if}</span
		>
		{#if g.items.length}{@render allOf(open, g.items)}{/if}
	</p>
	<MapGroups map={null} items={g.items} order={g.volgorde} notes={g.groepNotities} {open} />
{/snippet}

<div class="gemarkeerd blad blad__indeling">
	<header class="blad__kop">
		<h1 class="blad__titel">Gemarkeerd</h1>
	</header>

	<!-- The bundels, as Gevolgd lists its topics: a way to each; the active one in weight. -->
	<nav class="opzij" aria-label="Bundels">
		<h2 class="opzij__kop">Bundels</h2>
		<ul>
			{#each kaart.mappen as m (m.id)}
				<li>
					<button
						type="button"
						class="raakvlak"
						class:is-active={m.id === kaart.actief.id}
						aria-current={m.id === kaart.actief.id ? 'true' : undefined}
						title="{count(m.items.length)}, gewijzigd {day(m.gewijzigd)}"
						onclick={() => toMap(m)}>{m.naam}</button
					><span class="n">{m.items.length}</span>
				</li>
			{/each}
		</ul>
		<p class="ook">
			<TekstLink onclick={newMap}>Nieuwe bundel</TekstLink>
			<TekstLink onclick={() => fileField?.click()}>Open een bestand</TekstLink>
			<TekstLink
				onclick={() =>
					download(mapFileName(kaart.mappen), mapFile(kaart.mappen), 'application/json')}
				>Bewaar alles als bestand</TekstLink
			>
		</p>
		<input
			bind:this={fileField}
			type="file"
			accept=".json,application/json"
			hidden
			aria-label="Bestand met bundels"
			onchange={openFile}
		/>
	</nav>

	<div class="inhoud">
		{#if shared === BROKEN || oldLink}
			<p class="vraag" role="status">
				<span>Link onvolledig of beschadigd</span>
				<TekstLink onclick={() => sharedDone('none')}>Niet bewaren</TekstLink>
			</p>
		{:else if shared}
			{@const g = shared}
			<Sectie title="Gedeelde bundel: {g.naam ?? 'zonder naam'}" niveau={2} inklapbaar={false}>
				{#snippet naast()}
					<span class="acties">
						{#if g.items.length}
							<TekstLink href={netwerkHref(g.items) ?? undefined}>Netwerk</TekstLink>
							<TekstLink onclick={() => sharedDone('map')}>Bewaar als bundel</TekstLink>
							<TekstLink onclick={() => sharedDone('add')}
								>Voeg toe aan {kaart.actief.naam}</TekstLink
							>
						{/if}
						<TekstLink onclick={() => sharedDone('none')}>Niet bewaren</TekstLink>
					</span>
				{/snippet}
				{@render held(g, sharedOpen, 'de link')}
			</Sectie>
		{/if}

		{#if opened && 'error' in opened}
			<p class="vraag" role="status">
				<span>{opened.error}</span>
				<TekstLink onclick={() => (opened = null)}>Sluiten</TekstLink>
			</p>
		{:else if opened}
			{#each opened.maps as { map: f, open }, n (n)}
				{@const target = targetOf(f)}
				<Sectie title="Bundel uit bestand: {f.naam ?? 'zonder naam'}" niveau={2} inklapbaar={false}>
					{#snippet naast()}
						<span class="acties">
							<TekstLink onclick={() => fileDone(f, 'map')}>Bewaar als nieuwe bundel</TekstLink>
							{#if target}
								<ConfirmButton
									label="Vervang {target.naam}"
									confirmLabel="Ja, {target.naam} vervangen"
									class="raakvlak vervang"
									onConfirm={() => fileDone(f, 'replace')}
								/>
							{/if}
							{#if f.items.length}
								<TekstLink onclick={() => fileDone(f, 'add')}
									>Voeg toe aan {(target ?? kaart.actief).naam}</TekstLink
								>
							{/if}
							<TekstLink onclick={() => fileDone(f, 'none')}>Niet openen</TekstLink>
						</span>
					{/snippet}
					{@render held(f, open, 'het bestand')}
				</Sectie>
			{/each}
		{/if}

		{#each kaart.mappen as m (m.id)}
			<MapView {m} named={m.id !== newId} />
		{/each}
	</div>
</div>

<style>
	/* The frame and grid of Bladeren (lib/styles/frame.css), as Gevolgd: the heading over both columns. */
	/* The column's first heading on the line of the first group's heading, as on Gevolgd. */
	.opzij {
		padding-top: calc(var(--s-3) + 2px);
	}
	.opzij__kop {
		margin: 0 0 var(--s-2);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.opzij ul {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--t-meta);
	}
	.opzij li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
		padding: var(--s-1) 0;
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
	.opzij li button.is-active {
		color: var(--ink);
		font-weight: 600;
	}
	.opzij .n {
		color: var(--ink-3);
		font-size: var(--t-micro);
	}
	.opzij .ook {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-1);
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
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.vraag {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-size: var(--t-meta);
	}
	/* Vervang asks once (ConfirmButton), in the letter of the links beside it (TekstLink). */
	.acties :global(.vervang) {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-family: var(--font-serif);
		color: var(--ink);
		text-align: left;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.acties :global(.vervang:hover),
	.acties :global(.vervang:focus-visible) {
		text-decoration-color: currentColor;
	}
	/* On a phone the bundels stand above the groups: the column holds Nieuwe bundel. */
	@media (max-width: 768px) {
		.opzij {
			padding-top: 0;
			margin-bottom: var(--s-5);
		}
	}
</style>
