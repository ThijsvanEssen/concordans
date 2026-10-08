<script lang="ts">
	import { kamerLinks, kamerOf } from './kamer';
	import { uniqueBy } from '$lib/util/unique';
	// The one search: inline on the start page, inside the ⌘K overlay, and in the panel
	// Netwerk, where a result is picked instead of opened.
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import { bronHref, focusOf, type BronRef } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bySection, groupLabel, orderGroups, presentHit, sectionOf } from './present';
	import { CHAMBER_NAME } from '$lib/components/parliamentary/chamber';
	import { bronLabel, type Collection } from '$lib/vocabulary';
	import {
		bareArticle,
		parseCitation,
		lawAbbreviation,
		lawTitle,
		resolvedOf,
		resolveQuery,
		type Citation,
		type Resolved
	} from './resolve-query';

	type Hit = Schema<'SearchResultItem'>;

	let {
		overlay = false,
		compact = false,
		placeholder = 'Zoek een wet, uitspraak of dossier',
		initial = '',
		onOpen,
		onPick,
		scope = null
	}: {
		/** Alleen deze soorten doorzoeken (een ingang op de startpagina). */
		scope?: readonly string[] | null;
		/** The text the field starts with. */
		initial?: string;
		/** Inside the overlay the field takes focus and the list scrolls within the dialog. */
		overlay?: boolean;
		/** A narrow field and list, for a panel. */
		compact?: boolean;
		placeholder?: string;
		/** Called when a bron is opened; the overlay closes on it. */
		onOpen?: () => void;
		/** Given, a result is not opened but handed over by the name a link uses; the field empties. */
		onPick?: (id: string) => void;
	} = $props();

	/** The kinds the search covers; the groups appear best answer first (orderGroups). */
	const KINDS = [
		'instruments',
		'articles',
		'judgments',
		'dossiers',
		// People and bodies before the papers that merely name them.
		'cabinets',
		'members',
		'commitments',
		'factions',
		'committees',
		'documents',
		'decisions'
	] as const satisfies readonly Collection[];
	type Kind = (typeof KINDS)[number];
	const kinds = $derived(scope ? KINDS.filter((k) => scope.includes(k)) : KINDS);
	const LIMIT = 6;
	// The API runs an aborted query to its end until it cancels on a closed connection
	// (Back-end #1): till then 250 ms, after that 150.
	const DEBOUNCE_MS = 250;
	/** The fast kinds from two characters: one says nothing. */
	const SNEL_MIN = 2;

	/**
	 * Search answers per lane, side by side, so the fast kinds stand within a few hundred
	 * milliseconds and the slow ones fill in as they come (prod, 8 Oct: a name 0.1–0.2 s,
	 * articles and stukken up to 0.6 s, judgments 3–8 s). The kinds in no lane go in the
	 * first request, which also says what the query cites (`resolve`).
	 */
	type Laan = { id: string; kinds: readonly Kind[]; min: number; wacht: number };
	/**
	 * The slow lanes wait for a real pause in the typing: the API runs an aborted query to
	 * its end, and a part of a word ("zor", "stik") takes it seconds (prod, 8 Oct), so a
	 * request per keystroke filled its pool. With the live mode of the API (`zoekVraag`)
	 * their wait goes to `DEBOUNCE_MS`.
	 */
	const LANGZAAM_MS = 450;
	const LANEN: readonly Laan[] = [
		// Articles, stukken and judgments only from three characters: "st" takes the API
		// seconds and says nothing.
		{ id: 'tekst', kinds: ['articles', 'documents'], min: 3, wacht: LANGZAAM_MS },
		{ id: 'uitspraken', kinds: ['judgments'], min: 3, wacht: LANGZAAM_MS }
	];
	const INLAAN = new Set<Kind>(LANEN.flatMap((l) => l.kinds));

	/**
	 * The query of a request. One place for what a lane asks: the live mode of the API
	 * (`mode: 'live'`, Back-end #1) goes here once the schema has it.
	 */
	const zoekVraag = (term: string, types: Kind[], resolve: boolean) => ({
		q: term,
		types,
		limit: LIMIT,
		resolve: resolve || undefined
	});

	/** What a citation row is marked as before the API has confirmed the bron. */
	const CITED: Record<Citation['kind'], Collection> = {
		ecli: 'judgments',
		article: 'articles',
		dossier: 'dossiers',
		bwb: 'instruments',
		celex: 'instruments',
		publication: 'instruments'
	};

	let query = $state('');
	// A query handed over (Zoek in alle bronnen) fills the field.
	$effect(() => {
		if (initial) query = initial;
	});
	let results = $state<Partial<Record<Kind, Hit[]>>>({});
	/** The query `results` answers; '' before the first answer. */
	let answered = $state('');
	let loading = $state(false);
	let failed = $state(false);
	/** Per lane: what it last answered (it stays while the next query runs), and how it stands. */
	let laanHits = $state<Record<string, Partial<Record<Kind, Hit[]>>>>({});
	let laanStand = $state<Record<string, 'klaar' | 'laden' | 'mislukt'>>({});
	/** Raised by "Probeer opnieuw": that lane is asked again, the rest not. */
	let opnieuw = $state<Record<string, number>>({});
	/** The kinds of the first request; without them, the first lane in scope says what the query cites. */
	const snel = $derived(kinds.filter((k) => !INLAAN.has(k)));
	const lanen = $derived(
		LANEN.map((l) => ({ ...l, kinds: l.kinds.filter((k) => kinds.includes(k)) })).filter(
			(l) => l.kinds.length > 0
		)
	);
	const hitsVan = (kind: Kind): Hit[] | undefined => {
		const laan = LANEN.find((l) => l.kinds.includes(kind));
		return laan ? laanHits[laan.id]?.[kind] : results[kind];
	};
	/** A lane under way or failed, with whether any of its kinds shows hits meanwhile. */
	const lanenBezig = $derived(
		lanen
			.filter((l) => (laanStand[l.id] ?? 'klaar') !== 'klaar')
			.map((l) => ({
				...l,
				stand: laanStand[l.id],
				toont: l.kinds.some((k) => (hitsVan(k) ?? []).length > 0)
			}))
	);
	const ladend = $derived(
		new Set(lanenBezig.filter((l) => l.stand === 'laden').flatMap((l) => l.kinds))
	);
	let resolving = $state(false);
	/** A citation the API did not confirm: its row is gone and the results stay. */
	let unresolved = $state('');
	/** "55 Gw" typed without "art.", which the API confirmed as an article. */
	let confirmed = $state<{ term: string; target: Resolved } | null>(null);
	/** What /api/search resolved the query to, with its hits (`resolve=true`, API 0.74). */
	let resolvedWith = $state<{ term: string; target: Resolved | null } | null>(null);
	// A regeling named by its title that the API does not know ("Omgevingswet"): the
	// network holds a selection of laws, and the hits only mention it.
	let outside = $state('');
	let active = $state(0);
	let listEl = $state<HTMLElement | null>(null);

	const uid = $props.id();
	const q = $derived(query.trim());

	const extra = (hit: Hit, name: string): string => {
		const value = hit.extra?.[name];
		return typeof value === 'string' ? value : '';
	};

	/** What a link to the hit names: its node id, and a dossier's number (`37020-XV`). */
	const hitName = (hit: Hit) =>
		hit.collection === 'dossiers' ? `dossiers/${extra(hit, 'number')}` : hit.id;

	// One request answers every kind; its groups stand best answer first (orderGroups).
	const groups = $derived(
		orderGroups(
			kinds
				.map((kind) => ({
					kind,
					hits: bySection(hitsVan(kind) ?? [])
				}))
				.filter((g) => g.hits.length > 0)
		)
	);
	const hits = $derived(groups.flatMap((g) => g.hits));
	const indexOf = $derived(new Map(hits.map((hit, i) => [hit.id, i])));

	const citation = $derived(q && q !== unresolved ? parseCitation(q) : null);
	const bare = $derived(!citation && confirmed?.term === q ? confirmed.target : null);
	/** Rows the keys move over: the citation first, then every hit. */
	const offset = $derived(citation || bare ? 1 : 0);
	const rowCount = $derived(offset + hits.length);
	// A citation the API does not know: said where its row was, not dropped without a word.
	const notFound = $derived(unresolved !== '' && unresolved === q);
	const kamer = $derived(kamerOf(q));
	const outsideLaw = $derived(
		outside !== '' &&
			outside === q &&
			answered === q &&
			!bare &&
			!(results.instruments ?? []).some((h) =>
				(h.display_name ?? '').toLowerCase().includes(q.trim().toLowerCase())
			)
	);
	const empty = $derived(
		q.length > 0 &&
			answered === q &&
			!loading &&
			!failed &&
			lanenBezig.length === 0 &&
			hits.length === 0 &&
			!citation &&
			!bare &&
			!outsideLaw
	);

	// The first request per query: the fast kinds and what the query cites; the lanes below
	// run beside it. The timer waits for the typing to pause, and a newer query aborts the
	// requests of the previous one. Earlier results stay while the next run.
	$effect(() => {
		const term = q;
		failed = false;
		if (term.length < SNEL_MIN) {
			results = {};
			answered = '';
			loading = false;
			return;
		}
		const controller = new AbortController();
		const written = bareArticle(term);
		const abbreviation = written ? null : lawAbbreviation(term);
		const title = written ? null : lawTitle(term);
		const timer = setTimeout(() => {
			loading = true;
			// Beside the words, the article they may cite: shown only once the API has it.
			if (written) {
				resolveQuery(written)
					.then((target) => {
						if (!controller.signal.aborted && target) confirmed = { term, target };
					})
					.catch(() => {
						// The words are searched all the same.
					});
			}
			// The hits and what the query cites (BE-16), with the fast kinds: "AVG" has its law
			// the moment its hits are there, so Enter cannot open a hit before the law is known.
			if (snel.length === 0) loading = false;
			else
				unwrap(
					api.GET('/api/search', {
						params: { query: zoekVraag(term, snel, true) },
						signal: controller.signal
					})
				)
					.then((r) => {
						const target = resolvedOf(r.resolved);
						resolvedWith = { term, target };
						if (abbreviation || title) {
							// The law an abbreviation stands for, first; a title the API does not know
							// is a law outside the selection.
							if (target?.ref.collection === 'instruments') confirmed = { term, target };
							else if (title) outside = term;
						}
						results = r.results;
						answered = term;
						loading = false;
					})
					.catch(() => {
						if (controller.signal.aborted) return;
						results = {};
						answered = term;
						failed = true;
						loading = false;
					});
		}, DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	// Each lane on its own: its group waits or fails alone, and "Probeer opnieuw" asks it
	// again without the rest. Without fast kinds in scope (Uitspraken), the first lane also
	// says what the query cites.
	for (const laan of LANEN) {
		$effect(() => {
			const term = q;
			void opnieuw[laan.id];
			const types = laan.kinds.filter((k) => kinds.includes(k));
			if (!term || types.length === 0 || term.length < laan.min) {
				laanHits[laan.id] = {};
				laanStand[laan.id] = 'klaar';
				return;
			}
			const eerste = snel.length === 0 && lanen[0]?.id === laan.id;
			const controller = new AbortController();
			const timer = setTimeout(() => {
				laanStand[laan.id] = 'laden';
				unwrap(
					api.GET('/api/search', {
						params: { query: zoekVraag(term, types, eerste) },
						signal: controller.signal
					})
				)
					.then((r) => {
						if (controller.signal.aborted) return;
						laanHits[laan.id] = r.results as Partial<Record<Kind, Hit[]>>;
						if (eerste) {
							resolvedWith = { term, target: resolvedOf(r.resolved) };
							answered = term;
						}
						laanStand[laan.id] = 'klaar';
					})
					.catch(() => {
						if (controller.signal.aborted) return;
						laanHits[laan.id] = {};
						if (eerste) answered = term;
						laanStand[laan.id] = 'mislukt';
					});
			}, laan.wacht);
			return () => {
				clearTimeout(timer);
				controller.abort();
			};
		});
	}

	// The first row is chosen before any key: Enter opens it. The first ↓ confirms that
	// row instead of skipping it, as a list without a preselection would.
	let moved = false;
	$effect(() => {
		void q;
		void answered;
		active = 0;
		moved = false;
	});

	$effect(() => {
		if (rowCount === 0) return;
		listEl?.querySelector(`#${CSS.escape(`${uid}-row-${active}`)}`)?.scrollIntoView({
			block: 'nearest'
		});
	});

	function open(ref: BronRef | string, at: string | null = null) {
		if (onPick) {
			const id = focusOf(ref);
			if (id) onPick(id);
			query = '';
			return;
		}
		const href = bronHref(ref, { at });
		onOpen?.();
		goto(href);
	}

	async function openCitation() {
		if (resolving) return;
		const term = q;
		resolving = true;
		// The answer that came with the hits, where it names the bron; else the full way.
		const known = resolvedWith?.term === term ? resolvedWith.target : null;
		const target = known ?? (await resolveQuery(term));
		resolving = false;
		if (target) {
			open(target.ref, target.at);
		} else {
			unresolved = term;
		}
	}

	function openBare(target: Resolved) {
		open(target.ref, target.at);
	}

	function openHit(hit: Hit) {
		open(hitName(hit));
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' && rowCount > 0) {
			e.preventDefault();
			active = moved ? Math.min(active + 1, rowCount - 1) : active;
			moved = true;
		} else if (e.key === 'ArrowUp' && rowCount > 0) {
			e.preventDefault();
			active = Math.max(active - 1, 0);
			moved = true;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (citation && active === 0) void openCitation();
			else if (bare && active === 0) openBare(bare);
			// A hit opens only when the list answers what is typed.
			else if (answered === q && hits[active - offset]) openHit(hits[active - offset]);
		} else if (e.key === 'Escape' && !overlay && query) {
			query = '';
		}
	}

	// A list that scrolls under a resting pointer reports a move too; only a pointer that
	// changed place moves the active row.
	let pointerAt = '';
	const placeOf = (e: PointerEvent) => `${e.screenX},${e.screenY}`;
	function onpointermove(e: PointerEvent, row: number) {
		if (placeOf(e) !== pointerAt) {
			active = row;
			moved = true;
		}
	}

	function focusOnMount(node: HTMLInputElement) {
		if (overlay) node.focus();
	}
</script>

<svelte:window onpointermove={(e) => (pointerAt = placeOf(e))} />

<div class="search" class:search--overlay={overlay} class:search--compact={compact}>
	<div class="field">
		{#if loading || resolving}
			<span class="spinner" aria-hidden="true"></span>
		{:else}
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="7" />
				<path d="m20 20-3.5-3.5" />
			</svg>
		{/if}
		<input
			bind:value={query}
			use:focusOnMount
			{onkeydown}
			data-search-field
			type="text"
			role="combobox"
			aria-label="Zoeken"
			aria-expanded={rowCount > 0}
			aria-controls="{uid}-list"
			aria-autocomplete="list"
			aria-activedescendant={rowCount > 0 ? `${uid}-row-${active}` : undefined}
			{placeholder}
			autocomplete="off"
			spellcheck="false"
		/>
		{#if overlay}<span class="kbd" aria-hidden="true">esc</span>{/if}
	</div>

	<div
		class="list"
		class:list--filled={rowCount > 0 ||
			failed ||
			empty ||
			notFound ||
			outsideLaw ||
			kamer ||
			(q && lanenBezig.length > 0)}
		id="{uid}-list"
		role="listbox"
		aria-label="Resultaten"
		bind:this={listEl}
	>
		{#if outsideLaw}
			<p class="state" role="status">
				"{q}" staat niet in Concordans. Het netwerk bevat een selectie van wetten;
				<a href="https://wetten.overheid.nl/zoeken" target="_blank" rel="noopener"
					>zoek de regeling op wetten.overheid.nl</a
				>.
				{#if hits.length}De treffers hieronder noemen haar.{/if}
			</p>
		{/if}
		{#if kamer}
			<p class="state" role="status">
				De {kamer === 'EK' ? 'Eerste' : 'Tweede'} Kamer is geen bron in het netwerk. Bekijk haar
				{#each kamerLinks(kamer) as link, i (link.href)}{i > 0 ? (i === 2 ? ' en ' : ', ') : ''}<a
						href={link.href}>{link.label}</a
					>{/each}.
			</p>
		{/if}
		{#if notFound}
			<p class="state" role="status">
				"{q}" staat niet in de gegevens. Het netwerk bevat een selectie van bronnen;
				<a href="/bronnen#dekking">zie de dekking</a>.
			</p>
		{/if}
		{#if citation}
			<!-- "36799, nr. 31" is a stuk; the dossier itself has no number after it. -->
			{@const kind =
				citation.kind === 'dossier' && citation.document ? 'documents' : CITED[citation.kind]}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				id="{uid}-row-0"
				class="row row--citation"
				class:is-active={active === 0}
				role="option"
				tabindex="-1"
				aria-selected={active === 0}
				onclick={openCitation}
				onpointermove={(e) => onpointermove(e, 0)}
			>
				<span class="row-kind"><KindGlyph collection={kind} /> {bronLabel(kind)}</span>
				<span class="row-title">{q}</span>
				<span class="kbd" aria-hidden="true">↵</span>
			</div>
		{:else if bare}
			<!-- A link like the hits: its target is known, so a new tab can open it. -->
			<a
				id="{uid}-row-0"
				class="row row--citation"
				class:is-active={active === 0}
				role="option"
				tabindex="-1"
				aria-selected={active === 0}
				href={bronHref(bare.ref, { at: bare.at })}
				onclick={(e) => {
					if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
					e.preventDefault();
					openBare(bare);
				}}
				onpointermove={(e) => onpointermove(e, 0)}
			>
				<span class="row-kind"
					><KindGlyph collection={bare.ref.collection} /> {bronLabel(bare.ref.collection)}</span
				>
				<span class="row-title">{bare.label ?? q}</span>
				<span class="kbd" aria-hidden="true">↵</span>
			</a>
		{/if}

		{#each groups as group (group.kind)}
			<div class="group" role="group" aria-labelledby="{uid}-{group.kind}">
				<div class="group-label" id="{uid}-{group.kind}">
					<KindGlyph collection={group.kind} />
					{groupLabel(group.kind)}
					{#if ladend.has(group.kind)}<span class="laden">laden…</span>{/if}
				</div>
				{#each uniqueBy(group.hits, (x) => x.id) as hit, h (hit.id)}
					{@const i = offset + (indexOf.get(hit.id) ?? 0)}
					{@const shown = presentHit(hit, q)}
					{@const section = sectionOf(hit)}
					{#if section && (h === 0 || section !== sectionOf(group.hits[h - 1]))}
						<div class="section" role="presentation">{section}</div>
					{/if}
					<a
						id="{uid}-row-{i}"
						class="row"
						class:is-active={active === i}
						role="option"
						tabindex="-1"
						aria-selected={active === i}
						href={bronHref(hitName(hit))}
						onclick={(e) => {
							if (onPick) {
								e.preventDefault();
								openHit(hit);
								return;
							}
							onOpen?.();
						}}
						onpointermove={(e) => onpointermove(e, i)}
					>
						<span class="row-main">
							<span class="row-title">{shown.title}</span>
							{#if shown.snippet}
								<span class="row-snippet"
									>{#each shown.snippet as part, n (n)}{#if part.mark}<mark>{part.text}</mark
											>{:else}{part.text}{/if}{/each}</span
								>
							{/if}
						</span>
						{#if shown.chamber || shown.context}<span class="row-context"
								>{#if shown.chamber}<abbr title={CHAMBER_NAME[shown.chamber]}>{shown.chamber}</abbr
									>{/if}{shown.chamber && shown.context ? ` ${shown.context}` : shown.context}</span
							>{/if}
					</a>
				{/each}
			</div>
		{/each}

		{#each lanenBezig.filter((l) => l.stand === 'mislukt' || !l.toont) as laan (laan.id)}
			<!-- A lane that comes later or failed: its group says so, the other groups stand. -->
			{@const naam = laan.kinds.map((k) => groupLabel(k)).join(' en ')}
			<div class="group" role="group" aria-labelledby="{uid}-{laan.id}-stand">
				<div class="group-label" id="{uid}-{laan.id}-stand">
					<KindGlyph collection={laan.kinds[0]} />
					{naam}
				</div>
				{#if laan.stand === 'laden'}
					<p class="state state--group" role="status">Laden…</p>
				{:else}
					<p class="state state--group" role="status">
						{naam} konden niet worden geladen.
						<button
							type="button"
							class="opnieuw"
							onclick={() => (opnieuw[laan.id] = (opnieuw[laan.id] ?? 0) + 1)}
							>Probeer opnieuw</button
						>
					</p>
				{/if}
			</div>
		{/each}

		{#if failed}
			<p class="state" role="status">Zoeken mislukt</p>
		{:else if empty}
			<p class="state" role="status">Geen resultaten</p>
		{/if}
	</div>
</div>

<style>
	.search {
		display: flex;
		flex-direction: column;
		min-height: 0;
		width: 100%;
	}

	.field {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.field:focus-within {
		border-color: var(--ink-3);
	}
	.search--overlay .field {
		border: 0;
		border-bottom: 1px solid var(--rule);
		border-radius: 0;
		padding: var(--s-4);
	}

	input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: none;
		background: transparent;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		color: var(--ink);
	}
	input::placeholder {
		color: var(--ink-3);
		font-style: italic;
	}

	.kbd {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		border: 1px solid var(--rule);
		padding: 1px var(--s-2);
		border-radius: var(--r-1);
		flex-shrink: 0;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 1.5px solid var(--rule-strong);
		border-top-color: var(--ink-3);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 2.4s;
		}
	}

	.list--filled {
		padding: var(--s-1) 0;
	}
	.search--overlay .list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.group + .group,
	.row--citation + .group {
		margin-top: var(--s-2);
	}

	.group-label {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-4) var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}

	.row {
		display: flex;
		align-items: baseline;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.35;
		color: var(--ink);
		text-decoration: none;
		border-bottom: none;
		cursor: pointer;
	}
	.row.is-active {
		background: var(--paper-2);
	}

	.row-kind {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		flex-shrink: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}

	.row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.row-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* One line of the text, the words searched for marked. */
	.row-snippet {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.row-snippet mark {
		background: none;
		color: var(--ink-2);
		font-weight: 600;
	}
	/* The dossier the stukken below it belong to. */
	.section {
		padding: var(--s-1) var(--s-4) 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-2);
	}

	.row-context {
		flex: 0 1 auto;
		max-width: 65%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.state {
		margin: 0;
		padding: var(--s-3) var(--s-4);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}

	.group-label .laden {
		margin-left: var(--s-2);
		color: var(--ink-3);
	}
	.state--group {
		padding-top: 0;
	}
	.opnieuw {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.opnieuw:hover {
		color: var(--ink);
	}

	.search--compact .field {
		gap: var(--s-2);
		padding: var(--s-1) var(--s-3);
	}
	.search--compact input {
		font-size: var(--t-body-2);
	}
	.search--compact .list--filled {
		max-height: 320px;
		overflow-y: auto;
	}
	.search--compact .group-label {
		padding: var(--s-1) var(--s-3) 2px;
	}
	.search--compact .row {
		flex-direction: column;
		align-items: stretch;
		gap: 1px;
		padding: var(--s-1) var(--s-3);
		font-size: var(--t-body-2);
	}
	.search--compact .row--citation {
		flex-direction: row;
		align-items: baseline;
		gap: var(--s-2);
	}
	.row-context abbr {
		text-decoration: none;
	}
	.search--compact .row-context {
		max-width: none;
	}
	.search--compact .state {
		padding: var(--s-2) var(--s-3);
	}

	@media (max-width: 640px) {
		.row {
			flex-direction: column;
			align-items: stretch;
			gap: 1px;
		}
		.row--citation {
			flex-direction: row;
			align-items: baseline;
			gap: var(--s-3);
		}
		.row-context {
			max-width: none;
		}
		input {
			font-size: var(--t-body);
		}
	}
</style>
