<script lang="ts">
	// Bundels (decision 19, bundels-ux 2a): the table of contents of the reader's bundels, a
	// list like Bladeren's, built as Actueel and Gevolgd are headed. Each bundel a row that
	// opens in place on what it holds (BundleRow); the work is on its own page. Losse
	// markeringen first, then the bundels last changed first. A bundel shared as a link (its
	// fragment, share.ts: never in a request) opens as that page, read only (MapView), until it
	// is kept, added or put aside. A bundel from a file stands at the top as a row, marked.
	// The page reads this browser's storage alone: no call to the API.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { navigate } from '$lib/util/address';
	import { SvelteSet } from 'svelte/reactivity';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import RijActies from '$lib/components/ui/RijActies.svelte';
	import { download } from '$lib/verbonden/export';
	import { ignore } from '$lib/api/errors';
	import type { SharedMap } from '$lib/map/map';
	import { kaart } from '$lib/map/map.svelte';
	import { BROKEN, isOldLink, sharedMapName, sharedOfFragment } from '$lib/map/share';
	import { siteTitle } from '$lib/seo/server-head.svelte';
	import { NEWER, mapFile, mapFileName, readMapFile, type FileMap } from '$lib/map/file';
	import BundleRow from '$lib/map/BundleRow.svelte';
	import MapView from '$lib/map/MapView.svelte';
	import { BUNDLES_PATH, bundlePageHref } from '$lib/map/page';
	import { focusFirstItem } from '$lib/actions/menu';

	/** The rows open, by the bundel's id (a bundel from a file by `file:<n>`). */
	const open = new SvelteSet<string>();
	const toggle = (key: string) => (open.delete(key) ? undefined : open.add(key));

	// ── A shared bundel, from the address's fragment ───────────────────────────
	let shared = $state<SharedMap | typeof BROKEN | null>(null);
	/** A link of the older form (its bundel in the query) was opened: said as a broken one. */
	let oldLink = $state(false);
	$effect(() => {
		const hash = page.url.hash;
		if (isOldLink(page.url.searchParams)) {
			oldLink = true;
			navigate(`${BUNDLES_PATH}${hash}`);
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
	/** A shared bundel kept, added to one, or put aside: its link leaves the address. */
	function sharedDone(how: 'map' | 'add' | 'none', into?: string) {
		const g = shared && shared !== BROKEN ? shared : null;
		oldLink = false;
		if (g && how === 'map') return goto(bundlePageHref(kaart.bewaarAlsMap(g)));
		if (g && how === 'add' && into) {
			kaart.voegToe(g, into);
			return goto(bundlePageHref({ id: into }));
		}
		navigate(BUNDLES_PATH);
	}

	// ── Bundels from a file, each kept, added or put in place of one as the reader chooses ──
	type Opened = { name: string; maps: FileMap[] } | { name: string; error: string };
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
				: { name: file.name, maps: read };
	}
	/** The bundel of this browser a bundel from a file stands for: by its id, else its name. */
	const targetOf = (f: FileMap) =>
		kaart.mappen.find((m) => m.id === f.id) ?? kaart.mappen.find((m) => m.naam === f.naam);
	/** A bundel from a file kept, added to one, put in place of one, or put aside. */
	function fileDone(f: FileMap, how: 'map' | 'add' | 'replace' | 'none', into?: string) {
		const target = targetOf(f);
		if (how === 'map') kaart.bewaarAlsMap(f);
		else if (how === 'add' && into) kaart.voegToe(f, into);
		else if (how === 'replace' && target) kaart.replace(target.id, f);
		if (opened && 'maps' in opened) {
			const rest = opened.maps.filter((x) => x !== f);
			opened = rest.length ? { ...opened, maps: rest } : null;
		}
	}

	/** Nieuwe bundel asks its name in place; Enter makes it and opens its page. */
	let naming = $state(false);
	/** The bundel from a file whose ⋯ lists the bundels to add it to, in place of its items. */
	let choosing = $state<FileMap | null>(null);
	/** A bundel from a file that is one of this browser's (by its id): Vervang comes first. */
	const sameId = (f: FileMap) => !!f.id && kaart.mappen.some((m) => m.id === f.id);
</script>

<!-- A shared bundel's tab carries its name, as a bundel of this browser's does (A53 #4). -->
<RouteKop
	title={shared && shared !== BROKEN && !oldLink ? siteTitle(sharedMapName(shared)) : undefined}
/>

{#if shared && shared !== BROKEN && !oldLink}
	<!-- A shared bundel: its page, read only, as the one who shared it sees it (2c). -->
	<div class="blad">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href={BUNDLES_PATH}>Bundels</a></nav>
		<MapView {shared} onShared={sharedDone} />
	</div>
{:else}
	<div class="bundels blad blad__indeling">
		<header class="blad__kop">
			<h1 class="blad__titel">Bundels</h1>
			<span class="blad__acties">
				{#if naming}
					<form
						class="naam"
						onsubmit={(e) => {
							e.preventDefault();
							const field = e.currentTarget.elements.namedItem('naam') as HTMLInputElement;
							if (field.value.trim()) goto(bundlePageHref(kaart.nieuw(field.value)));
						}}
					>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							name="naam"
							autofocus
							placeholder="Naam"
							aria-label="Naam van de nieuwe bundel"
							onkeydown={(e) => {
								if (e.key === 'Escape') naming = false;
							}}
							onblur={(e) => {
								if (!e.currentTarget.value.trim()) naming = false;
							}}
						/>
					</form>
				{:else}
					<button type="button" class="btn" onclick={() => (naming = true)}>Nieuwe bundel</button>
				{/if}
				<TekstMenu rechts label="Meer bij de bundels" tekst="Meer">
					{#snippet inhoud(close)}
						<button
							type="button"
							role="menuitem"
							class="tekstmenu__item"
							onclick={() => {
								close();
								fileField?.click();
							}}>Bestand openen</button
						>
						<button
							type="button"
							role="menuitem"
							class="tekstmenu__item"
							onclick={() => {
								close();
								download(mapFileName(kaart.mappen), mapFile(kaart.mappen), 'application/json');
							}}>Alle bundels downloaden</button
						>
					{/snippet}
				</TekstMenu>
			</span>
			<input
				bind:this={fileField}
				type="file"
				accept=".json,application/json"
				hidden
				aria-label="Bestand met bundels"
				onchange={openFile}
			/>
		</header>

		<div class="blad__lijst">
			{#if shared === BROKEN || oldLink}
				<p class="melding" role="status">
					<span>Link onvolledig of beschadigd</span>
					<TekstLink onclick={() => sharedDone('none')}>Sluiten</TekstLink>
				</p>
			{/if}
			{#if opened && 'error' in opened}
				<p class="melding" role="status">
					<span>{opened.error}</span>
					<TekstLink onclick={() => (opened = null)}>Sluiten</TekstLink>
				</p>
			{/if}

			<ul class="lijst">
				{#if opened && 'maps' in opened}
					{#each opened.maps as f, n (n)}
						{@const target = targetOf(f)}
						<BundleRow
							bundle={{ naam: f.naam ?? 'Bundel', items: f.items, notitie: f.notitie }}
							mark="uit bestand"
							open={open.has(`file:${n}`)}
							onToggle={() => toggle(`file:${n}`)}
						>
							{#snippet choices()}
								{#if sameId(f) && target}
									<button type="button" class="btn" onclick={() => fileDone(f, 'replace')}
										>Vervang</button
									>
								{:else}
									<button type="button" class="btn" onclick={() => fileDone(f, 'map')}
										>Bewaar</button
									>
								{/if}
								<RijActies naam={f.naam ?? 'Bundel uit bestand'} onClose={() => (choosing = null)}>
									{#snippet menu(close)}
										{#if choosing === f}
											{#each kaart.listed as into (into.id)}
												<button
													type="button"
													role="menuitem"
													class="tekstmenu__item"
													onclick={() => {
														close();
														fileDone(f, 'add', into.id);
													}}>{into.naam}</button
												>
											{/each}
										{:else}
											{#if sameId(f)}
												<button
													type="button"
													role="menuitem"
													class="tekstmenu__item"
													onclick={() => {
														close();
														fileDone(f, 'map');
													}}>Bewaar als nieuwe bundel</button
												>
											{:else if target}
												<button
													type="button"
													role="menuitem"
													class="tekstmenu__item"
													onclick={() => {
														close();
														fileDone(f, 'replace');
													}}>Vervang {target.naam}</button
												>
											{/if}
											{#if f.items.length}
												<button
													type="button"
													role="menuitem"
													class="tekstmenu__item"
													aria-haspopup="menu"
													onclick={() => {
														choosing = f;
														focusFirstItem();
													}}>Toevoegen aan …</button
												>
											{/if}
											<button
												type="button"
												role="menuitem"
												class="tekstmenu__item"
												onclick={() => {
													close();
													fileDone(f, 'none');
												}}>Niet openen</button
											>
										{/if}
									{/snippet}
								</RijActies>
							{/snippet}
						</BundleRow>
					{/each}
				{/if}
				{#each kaart.listed as m (m.id)}
					<BundleRow bundle={m} open={open.has(m.id)} onToggle={() => toggle(m.id)} />
				{/each}
			</ul>
		</div>
	</div>
{/if}

<style>
	.melding {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin: 0 0 var(--s-3);
		font-size: var(--t-meta);
	}
	/* The rows of Bladeren without a lead, the number and the day at the right. */
	.lijst {
		--row-aside: auto;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--rule-strong);
		list-style: none;
	}
	.lijst :global(.row) {
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.lijst :global(.row-id) {
		display: none;
	}
	.lijst :global(.detail) {
		padding-left: var(--s-2);
	}
	.lijst :global(.row-aside) {
		flex-wrap: nowrap;
	}
	.naam {
		margin: 0;
	}
	/* The field at 16px: below that a phone zooms in on focus. */
	.naam input {
		box-sizing: border-box;
		width: 14rem;
		max-width: 100%;
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-input);
		color: var(--ink);
	}
	/* On a phone the row keeps its number at the right of the name. */
	@media (max-width: 768px) {
		.lijst :global(.row) {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: var(--s-2);
		}
		.lijst :global(.row-aside) {
			padding-top: 0;
		}
	}
</style>
