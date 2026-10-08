<script lang="ts">
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import { heeftParameter } from '$lib/api/heeft';
	import { VOORKEUZEN, maandenTerug } from '$lib/text/periode';
	import { vandaag } from '$lib/text/datum';
	import { kamerLinks, kamerOf } from './kamer';
	import { uniqueBy } from '$lib/util/unique';
	// The one search: inline on the start page, inside the ⌘K overlay, and in the panel
	// Netwerk, where a result is picked instead of opened.
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, isTimeout, unwrap } from '$lib/api/client';
	import { DEBOUNCE_MS, LANEN as ALLE_LANEN, LIVE, type Laan as LaanDef } from './lanen';
	import type { Schema } from '$lib/api/types';
	import { bronHref, focusOf, type BronRef } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import {
		besteTreffer,
		bySection,
		groupLabel,
		orderGroups,
		presentHit,
		sectionOf
	} from './present';
	import { CHAMBER_NAME } from '$lib/components/parliamentary/chamber';
	import { bronLabel, type Collection } from '$lib/vocabulary';
	import {
		bareArticle,
		keuzesOf,
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

	/** The fast kinds from two characters: one says nothing. */
	const SNEL_MIN = 2;

	type Laan = Omit<LaanDef, 'kinds'> & { kinds: readonly Kind[] };
	/** The lanes ($lib/search/lanen), their kinds as this search knows them. */
	const LANEN = ALLE_LANEN as readonly Laan[];
	const INLAAN = new Set<Kind>(LANEN.flatMap((l) => l.kinds));

	/**
	 * The query of a request. One place for what a lane asks: the live mode of the API
	 * (`mode: 'live'`, Back-end #1) goes here once the schema has it.
	 */
	const zoekVraag = (
		term: string,
		types: Kind[],
		resolve: boolean,
		mode: 'live' | 'full' | null = null
	) => ({
		q: term,
		types,
		limit: LIMIT,
		resolve: resolve || undefined,
		// Not in the schema yet; an API without it ignores it.
		...(mode ? ({ mode } as object) : {}),
		// The period (Thijs, 9 Oct), once `/api/search` takes it ($lib/api/heeft).
		...(MET_PERIODE && periodeVan ? ({ from: periodeVan } as object) : {})
	});

	/** The search by period: shown once the API takes `from` and `to` (Back-end #1). */
	const MET_PERIODE = heeftParameter('/api/search', 'from', 'to');
	let periodeVan = $state('');
	const vandaagDag = vandaag();

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
	/** `traag`: it gave up on its own time (`zoekApi`, 30 s), not on an error of the API. */
	let laanStand = $state<Record<string, 'klaar' | 'laden' | 'mislukt' | 'traag'>>({});
	/** Per lane, the query whose answer in the live mode left more out (`partial`). */
	let laanMeer = $state<Record<string, string>>({});
	/** The query asked in full after "Meer uitspraken" (`mode=full`). */
	let volVoor = $state('');
	/** The fast kinds the live answer cut off, for its query. */
	let snelMeer = $state<{ term: string; kinds: Kind[] }>({ term: '', kinds: [] });
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
		new Set(lanenBezig.filter((l) => l.stand === 'laden' && l.laden).flatMap((l) => l.kinds))
	);
	let resolving = $state(false);
	/** A citation the API did not confirm: its row is gone and the results stay. */
	let unresolved = $state('');
	/** "55 Gw" typed without "art.", which the API confirmed as an article. */
	let confirmed = $state<{ term: string; target: Resolved } | null>(null);
	/** What /api/search resolved the query to, with its hits (`resolve=true`, API 0.74). */
	let resolvedWith = $state<{ term: string; target: Resolved | null } | null>(null);
	/** The articles a citation can mean where it is not one ("artikel 3 BW"), per query. */
	let keuzesVoor = $state<{ term: string; items: Resolved[]; total: number } | null>(null);
	// A regeling named by its title that the API does not know ("Omgevingswet"): the
	// network holds a selection of laws, and the hits only mention it.
	let outside = $state('');
	let active = $state(0);
	let listEl = $state<HTMLElement | null>(null);

	const uid = $props.id();
	const q = $derived(query.trim());
	/** Kinds whose live answer left more out for this query, not yet asked in full. */
	const meerKinds = $derived(
		new Set([
			...lanen.filter((l) => laanMeer[l.id] === q && volVoor !== q).flatMap((l) => l.kinds),
			...(snelMeer.term === q && volVoor !== q ? snelMeer.kinds : [])
		])
	);

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
	/**
	 * The one hit above the groups (besteTreffer), out of its own group. Only once the lane of
	 * articles has answered, so the top does not change under the pointer.
	 */
	const beste = $derived((laanStand['tekst'] ?? 'klaar') === 'klaar' ? besteTreffer(groups) : null);
	const getoond = $derived(
		beste
			? [
					{ kind: beste.kind, hits: [beste.hit], beste: true },
					...groups
						.map((g) => ({ ...g, hits: g.hits.filter((h) => h.id !== beste.hit.id), beste: false }))
						.filter((g) => g.hits.length > 0)
				]
			: groups.map((g) => ({ ...g, beste: false }))
	);
	const hits = $derived(getoond.flatMap((g) => g.hits));
	const indexOf = $derived(new Map(hits.map((hit, i) => [hit.id, i])));

	/** "Artikel 3 BW" in Boek 1, 3, 6 …: a row each, in place of the citation row. */
	const keuzes = $derived(keuzesVoor?.term === q ? keuzesVoor.items : []);
	const keuzesMeer = $derived(keuzesVoor?.term === q ? keuzesVoor.total - keuzes.length : 0);
	const citation = $derived(q && q !== unresolved && keuzes.length === 0 ? parseCitation(q) : null);
	const bare = $derived(
		!citation && keuzes.length === 0 && confirmed?.term === q ? confirmed.target : null
	);
	/** Rows the keys move over: the choices or the citation first, then every hit. */
	const offset = $derived(keuzes.length || (citation || bare ? 1 : 0));
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
		void periodeVan;
		// "Meer …" asks the whole query again in full, the fast kinds too.
		if (LIVE) void volVoor;
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
						params: {
							query: zoekVraag(term, snel, true, LIVE ? (volVoor === term ? 'full' : 'live') : null)
						},
						signal: controller.signal
					})
				)
					.then((r) => {
						const target = resolvedOf(r.resolved);
						resolvedWith = { term, target };
						keuzesVoor = { term, ...keuzesOf(r.resolved) };
						if (abbreviation || title) {
							// The law an abbreviation stands for, first; a title the API does not know
							// is a law outside the selection.
							if (target?.ref.collection === 'instruments') confirmed = { term, target };
							else if (title) outside = term;
						}
						results = r.results;
						const partial = (r as { partial?: Partial<Record<Kind, boolean>> }).partial ?? {};
						snelMeer = { term, kinds: snel.filter((k) => partial[k]) };
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
	//
	// One request per lane at a time. The API runs an aborted query to its end, so aborting
	// frees nothing: a newer query waits until the running one is done, and then only the
	// latest goes. An answer to an older query is not shown; the hits before it stay.
	const bezig: Record<string, boolean> = {};
	const volgende: Record<string, (() => void) | null> = {};
	let laatste = '';
	const stopt = new AbortController();
	onDestroy(() => stopt.abort());

	function vraag(laan: Laan, term: string, types: Kind[], eerste: boolean) {
		if (bezig[laan.id]) {
			volgende[laan.id] = () => vraag(laan, term, types, eerste);
			return;
		}
		bezig[laan.id] = true;
		laanStand[laan.id] = 'laden';
		const geldt = () => term === laatste;
		unwrap(
			laan.client.GET('/api/search', {
				params: {
					query: zoekVraag(
						term,
						types,
						eerste,
						laan.live ? (volVoor === term ? 'full' : 'live') : null
					)
				},
				signal: stopt.signal
			})
		)
			.then((r) => {
				if (!geldt()) return;
				laanHits[laan.id] = r.results as Partial<Record<Kind, Hit[]>>;
				// The live mode names the kinds it cut off at its time: more on "Meer uitspraken".
				const partial = (r as { partial?: Partial<Record<Kind, boolean>> }).partial ?? {};
				laanMeer[laan.id] = types.some((k) => partial[k]) ? term : '';
				if (eerste) {
					resolvedWith = { term, target: resolvedOf(r.resolved) };
					keuzesVoor = { term, ...keuzesOf(r.resolved) };
					answered = term;
				}
				laanStand[laan.id] = 'klaar';
			})
			.catch((e) => {
				if (stopt.signal.aborted || !geldt()) return;
				laanHits[laan.id] = {};
				if (eerste) answered = term;
				laanStand[laan.id] = isTimeout(e) ? 'traag' : 'mislukt';
			})
			.finally(() => {
				bezig[laan.id] = false;
				const next = volgende[laan.id];
				volgende[laan.id] = null;
				next?.();
			});
	}

	$effect(() => {
		laatste = q;
	});

	for (const laan of LANEN) {
		$effect(() => {
			const term = q;
			void opnieuw[laan.id];
			void periodeVan;
			if (laan.live) void volVoor;
			const types = laan.kinds.filter((k) => kinds.includes(k));
			volgende[laan.id] = null;
			if (!term || types.length === 0 || term.length < laan.min) {
				laanHits[laan.id] = {};
				laanStand[laan.id] = 'klaar';
				return;
			}
			const eerste = snel.length === 0 && lanen[0]?.id === laan.id;
			const timer = setTimeout(() => vraag(laan, term, types, eerste), laan.wacht);
			return () => clearTimeout(timer);
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

	// A result chosen here starts a network of its own, as a double click does (Thijs, 8 Oct);
	// the + in the Netwerk panel (onPick) is the way to add one.
	function open(ref: BronRef | string, at: string | null = null) {
		if (onPick) {
			const id = focusOf(ref);
			if (id) onPick(id);
			query = '';
			return;
		}
		const href = bronHref(ref, { at, keepNetwerk: false });
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
			if (active < keuzes.length) openBare(keuzes[active]);
			else if (citation && active === 0) void openCitation();
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

	/** "Artikel 3:4 Awb" under the kind Artikel: the kind is not said twice. */
	const begintMet = (naam: string, soort: string) =>
		naam.toLowerCase().startsWith(`${soort.toLowerCase()} `);
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

	{#if MET_PERIODE && q.length >= SNEL_MIN}
		<!-- The same periods as every list with dates, as buttons: no van and tot here. -->
		<div class="periode">
			<Keuze
				klein
				label="Periode"
				opties={[
					{ waarde: '', label: 'Alles', titel: 'Zonder begin of eind' },
					...VOORKEUZEN.map((v) => ({
						waarde: maandenTerug(vandaagDag, v.maanden),
						label: v.label,
						titel: v.titel
					}))
				]}
				waarde={periodeVan}
				onKies={(w) => (periodeVan = w)}
			/>
		</div>
	{/if}

	<div
		class="list"
		class:list--filled={rowCount > 0 ||
			failed ||
			empty ||
			notFound ||
			outsideLaw ||
			kamer ||
			(q && lanenBezig.some((l) => l.stand !== 'laden' || l.laden))}
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
		{#if keuzes.length > 0}
			<!-- A citation that fits more than one article: each, straight to the article. -->
			<div class="group" role="group" aria-labelledby="{uid}-keuzes">
				<div class="group-label" id="{uid}-keuzes">
					<KindGlyph collection="articles" />
					Kies een artikel
				</div>
				{#each keuzes as keuze, i (keuze.ref.key)}
					<a
						id="{uid}-row-{i}"
						class="row row--citation"
						class:is-active={active === i}
						role="option"
						tabindex="-1"
						aria-selected={active === i}
						href={bronHref(keuze.ref, { at: keuze.at, keepNetwerk: false })}
						onclick={(e) => {
							if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
							e.preventDefault();
							openBare(keuze);
						}}
						onpointermove={(e) => onpointermove(e, i)}
					>
						<span class="row-title">{keuze.label ?? keuze.ref.key}</span>
						{#if active === i}<span class="kbd" aria-hidden="true">↵</span>{/if}
					</a>
				{/each}
				{#if keuzesMeer > 0}
					<p class="state state--group">
						en {keuzesMeer}
						{keuzesMeer === 1 ? 'ander artikel' : 'andere artikelen'}
					</p>
				{/if}
			</div>
		{:else if citation}
			<!-- "36799, nr. 31" is a stuk; the dossier itself has no number after it. -->
			{@const kind =
				citation.kind === 'dossier' && citation.document ? 'documents' : CITED[citation.kind]}
			<!-- The name from the source once the answer has it, not the query as typed. -->
			{@const naam = (resolvedWith?.term === q ? resolvedWith.target?.label : null) ?? q}
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
				<span class="row-kind"
					><KindGlyph collection={kind} />{#if !begintMet(naam, bronLabel(kind))}
						{bronLabel(kind)}{/if}</span
				>
				<span class="row-title">{naam}</span>
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
				href={bronHref(bare.ref, { at: bare.at, keepNetwerk: false })}
				onclick={(e) => {
					if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
					e.preventDefault();
					openBare(bare);
				}}
				onpointermove={(e) => onpointermove(e, 0)}
			>
				<span class="row-kind"
					><KindGlyph
						collection={bare.ref.collection}
					/>{#if !begintMet(bare.label ?? q, bronLabel(bare.ref.collection))}
						{bronLabel(bare.ref.collection)}{/if}</span
				>
				<span class="row-title">{bare.label ?? q}</span>
				<span class="kbd" aria-hidden="true">↵</span>
			</a>
		{/if}

		{#each getoond as group (group.beste ? 'beste' : group.kind)}
			{@const gid = group.beste ? 'beste' : group.kind}
			<div
				class="group"
				class:group--beste={group.beste}
				role="group"
				aria-labelledby="{uid}-{gid}"
			>
				<div class="group-label" id="{uid}-{gid}">
					<!-- The best hit says what it is, as every group does: "Beste treffer, Dossier". -->
					{#if group.beste}Beste treffer, <KindGlyph collection={group.kind} />
						{bronLabel(group.kind)}{:else}<KindGlyph collection={group.kind} />
						{groupLabel(group.kind)}{/if}
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
						href={bronHref(hitName(hit), { keepNetwerk: false })}
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
				{#if meerKinds.has(group.kind)}
					<!-- The live mode answered within its time and left more out: the full answer on asking. -->
					<button type="button" class="meer-uitspraken" onclick={() => (volVoor = q)}
						>Meer {groupLabel(group.kind).toLowerCase()}</button
					>
				{/if}
			</div>
		{/each}

		{#each lanenBezig.filter((l) => l.stand !== 'laden' || (l.laden && !l.toont)) as laan (laan.id)}
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
						{naam}
						{laan.stand === 'traag' ? 'duren lang.' : 'konden niet worden geladen.'}
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
	.periode {
		padding: var(--s-2) 0;
	}
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

	.meer-uitspraken {
		margin: 0 var(--s-4) var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.meer-uitspraken:hover {
		color: var(--ink);
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
		/* Two lines on a phone: one cuts a title before what tells it apart. */
		.row-title,
		.section {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			white-space: normal;
		}
		input {
			font-size: var(--t-body);
		}
	}
</style>
