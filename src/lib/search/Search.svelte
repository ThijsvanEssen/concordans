<script lang="ts">
	// The one search: inline on the start page, inside the ⌘K overlay, and in the panel
	// Netwerk, where a result is picked instead of opened. What it asks and what the list makes
	// of the answers is the session (session.svelte.ts); this draws it.
	import { notHeld } from '$lib/text/coverage';
	import { QUERY_MAX_LENGTH } from '$lib/api/search';
	import { plural } from '$lib/text/words';
	import { naamVanId } from '$lib/bron/menselijk';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Periode from '$lib/components/ui/Periode.svelte';
	import { chamberLinks } from './kamer';
	import { uniqueBy } from '$lib/util/unique';
	import { goto } from '$app/navigation';
	import { FAST_MIN_CHARS, SEARCH_KINDS } from './lanes';
	import { bronHref, focusOf, type BronRef } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { searchedLine } from '$lib/text/coverage';
	import { resultsHref } from './results';
	import { groupLabel, hitName, presentHit, sectionOf } from './present';
	import { CHAMBER_NAME } from '$lib/components/parliamentary/chamber';
	import { bronLabel, nodeId } from '$lib/vocabulary';
	import { NOTATION_COLLECTION } from './resolve-query';
	import { SearchSession } from './session.svelte';
	import SearchOption from './SearchOption.svelte';

	let {
		overlay = false,
		compact = false,
		placeholder = 'Zoek een wet, uitspraak of dossier',
		initial = '',
		onOpen,
		onSelect,
		onWiden,
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
		onSelect?: (id: string) => void;
		/** Given with a scope: where nothing is found, the same query in every kind. */
		onWiden?: () => void;
	} = $props();

	// A result chosen here starts a network of its own, as a double click does (Thijs, 8 Oct);
	// the + in the Netwerk panel (onSelect) is the way to add one.
	function open(ref: BronRef | string, at: string | null) {
		if (onSelect) {
			const id = focusOf(ref);
			if (id) onSelect(id);
			search.query = '';
			return;
		}
		const href = bronHref(ref, { at, keepNetwerk: false });
		onOpen?.();
		goto(href);
	}

	/** Words name nothing exactly: Enter goes to the page of results (besluit 31). */
	function toResults(q: string, from: string, to: string) {
		onOpen?.();
		goto(resultsHref(q, from, to));
	}

	// A panel that picks, and a field in a scope, keep their list.
	const search = new SearchSession(open, onSelect || scope ? undefined : toResults);
	$effect.pre(() => {
		search.kinds = scope ? SEARCH_KINDS.filter((k) => scope.includes(k)) : SEARCH_KINDS;
	});
	// A query handed over (Zoek in alle bronnen) fills the field.
	$effect.pre(() => {
		if (initial) search.query = initial;
	});
	search.connect();

	const uid = $props.id();
	const rowId = (row: number) => `${uid}-row-${row}`;
	let listEl = $state<HTMLElement | null>(null);
	let fieldEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (search.rowCount === 0) return;
		listEl?.querySelector(`#${CSS.escape(rowId(search.active))}`)?.scrollIntoView({
			block: 'nearest'
		});
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' && search.rowCount > 0) {
			e.preventDefault();
			search.down();
		} else if (e.key === 'ArrowUp' && search.rowCount > 0) {
			e.preventDefault();
			search.up();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			search.pressEnter();
		} else if (e.key === 'Escape' && !overlay && search.query) {
			search.query = '';
		}
	}

	// A list that scrolls under a resting pointer reports a move too; only a pointer that
	// changed place moves the active row.
	let pointerAt = '';
	const placeOf = (e: PointerEvent) => `${e.screenX},${e.screenY}`;
	const pointAt = (row: number) => (e: PointerEvent) => {
		if (placeOf(e) !== pointerAt) search.point(row);
	};

	function focusOnMount(node: HTMLInputElement) {
		if (overlay) node.focus();
	}

	/** "Artikel 3:4 Awb" under the kind Artikel: the kind is not said twice. */
	const startsWithKind = (name: string, kind: string) =>
		name.toLowerCase().startsWith(`${kind.toLowerCase()} `);
</script>

<svelte:window onpointermove={(e) => (pointerAt = placeOf(e))} />

<div class="search" class:search--overlay={overlay} class:search--compact={compact}>
	<div class="field">
		{#if search.spinning}
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
			bind:value={search.query}
			bind:this={fieldEl}
			use:focusOnMount
			{onkeydown}
			data-search-field
			type="text"
			maxlength={QUERY_MAX_LENGTH}
			role="combobox"
			aria-label="Zoeken"
			aria-expanded={search.rowCount > 0}
			aria-controls="{uid}-list"
			aria-autocomplete="list"
			aria-activedescendant={search.rowCount > 0 && search.isActive(search.active)
				? rowId(search.active)
				: undefined}
			{placeholder}
			autocomplete="off"
			spellcheck="false"
		/>
		{#if overlay}<span class="kbd" aria-hidden="true">esc</span>{/if}
	</div>

	{#if search.q.length >= FAST_MIN_CHARS}
		<!-- The same period as every list with dates (Periode). -->
		<div class="periode">
			<Periode
				from={search.from}
				to={search.to}
				onChange={(v, t) => {
					search.from = v;
					search.to = t;
				}}
			/>
		</div>
	{/if}

	<div
		class="list"
		class:list--filled={search.filled}
		id="{uid}-list"
		role="listbox"
		aria-label="Resultaten"
		bind:this={listEl}
	>
		{#if search.leftOut.length > 0}
			<p class="state state--group stil weggelaten">Weggelaten: {search.leftOut.join(', ')}</p>
		{/if}
		{#if search.outsideLaw}
			<p class="state stil" role="status">
				"{search.q}" staat niet in Concordans.
				<a href="https://wetten.overheid.nl/zoeken" target="_blank" rel="noopener"
					>wetten.overheid.nl</a
				>
			</p>
		{/if}
		{#if search.chamber}
			<p class="state stil" role="status">
				{CHAMBER_NAME[search.chamber]}:
				{#each chamberLinks(search.chamber) as link, i (link.href)}{i > 0 ? ', ' : ''}<a
						href={link.href}>{link.label}</a
					>{/each}
			</p>
		{/if}
		{#if search.notFound}
			<p class="state stil" role="status">
				{notHeld(`"${search.q}"`)}. <a href="/bronnen#dekking">Dekking</a>
			</p>
		{/if}
		{#if search.choices.length > 0}
			<!-- A citation that fits more than one article: each, straight to the article. -->
			<div class="group" role="group" aria-labelledby="{uid}-keuzes">
				<div class="group-label" id="{uid}-keuzes">
					<KindGlyph collection="articles" />
					Artikelen met dit nummer
				</div>
				{#each search.choices as choice, i (choice.ref.key)}
					<SearchOption
						id={rowId(i)}
						active={search.isActive(i)}
						citation
						{compact}
						href={bronHref(choice.ref, { at: choice.at, keepNetwerk: false })}
						onchoose={() => open(choice.ref, choice.at)}
						onpoint={pointAt(i)}
					>
						<span class="row-title"
							>{choice.label ?? naamVanId(nodeId(choice.ref.collection, choice.ref.key))}</span
						>
						{#if search.active === i}<span class="kbd" aria-hidden="true">↵</span>{/if}
					</SearchOption>
				{/each}
				{#if search.choicesMore > 0}
					<p class="state state--group stil">
						en {search.choicesMore}
						{plural(search.choicesMore, 'ander artikel', 'andere artikelen')}
					</p>
				{/if}
			</div>
		{:else if search.citation}
			<!-- The bron the API named, else the kind of the notation ("36799, nr. 31" a stuk). -->
			{@const kind =
				(search.resolvedWith?.term === search.q
					? search.resolvedWith.target?.ref.collection
					: null) ?? NOTATION_COLLECTION[search.citation.kind]}
			<!-- The name from the source once the answer has it, not the query as typed. -->
			{@const name =
				(search.resolvedWith?.term === search.q ? search.resolvedWith.target?.label : null) ??
				search.q}
			<SearchOption
				id={rowId(0)}
				active={search.active === 0}
				citation
				{compact}
				onchoose={() => search.openCitation()}
				onpoint={pointAt(0)}
			>
				<span class="row-kind"
					><KindGlyph collection={kind} />{#if !startsWithKind(name, bronLabel(kind))}
						{bronLabel(kind)}{/if}</span
				>
				<span class="row-title">{name}</span>
				<span class="kbd" aria-hidden="true">↵</span>
			</SearchOption>
		{:else if search.bare}
			{@const bare = search.bare}
			{@const name = bare.label ?? search.q}
			<!-- A link like the hits: its target is known, so a new tab can open it. -->
			<SearchOption
				id={rowId(0)}
				active={search.active === 0}
				citation
				{compact}
				href={bronHref(bare.ref, { at: bare.at, keepNetwerk: false })}
				onchoose={() => open(bare.ref, bare.at)}
				onpoint={pointAt(0)}
			>
				<span class="row-kind"
					><KindGlyph
						collection={bare.ref.collection}
					/>{#if !startsWithKind(name, bronLabel(bare.ref.collection))}
						{bronLabel(bare.ref.collection)}{/if}</span
				>
				<span class="row-title">{name}</span>
				<span class="kbd" aria-hidden="true">↵</span>
			</SearchOption>
		{/if}

		{#if search.bestComing}
			<!-- The place of the Beste treffer, from the first answer on (#52). -->
			<div class="group group--beste" role="group" aria-labelledby="{uid}-beste-komt">
				<div class="group-label" id="{uid}-beste-komt">
					Beste treffer <span class="laden">laden…</span>
				</div>
			</div>
		{/if}
		{#each search.shown as group (group.best ? 'beste' : group.kind)}
			{@const gid = group.best ? 'beste' : group.kind}
			<!-- The hits a row is told apart from: its whole group, the Beste treffer's too. -->
			{@const neighbours = search.groups.find((g) => g.kind === group.kind)?.hits ?? group.hits}
			<div class="group" class:group--beste={group.best} role="group" aria-labelledby="{uid}-{gid}">
				<div class="group-label" id="{uid}-{gid}">
					<!-- The best hit says what it is, as every group does: "Beste treffer, Dossier". -->
					{#if group.best}Beste treffer, <KindGlyph collection={group.kind} />
						{bronLabel(group.kind)}{:else}<KindGlyph collection={group.kind} />
						{groupLabel(group.kind)}{/if}
					{#if search.loadingKinds.has(group.kind)}<span class="laden">laden…</span>{/if}
					{#if !group.best && search.partialKinds.has(group.kind)}
						<span class="deel">treffers met een deel van de woorden</span>
					{/if}
				</div>
				{#if !group.best && searchedLine(search.searched[group.kind])}
					<!-- What its search reads, so a hit not found is not taken for one not there. -->
					<p class="gezocht"><Coverage searched={search.searched[group.kind]} /></p>
				{/if}
				{#each uniqueBy(group.hits, (x) => x.id) as hit, h (hit.id)}
					{@const i = search.rowOfHit.get(hit.id) ?? search.offset}
					{@const shown = presentHit(hit, search.q, neighbours)}
					{@const section = sectionOf(hit)}
					{#if section && (h === 0 || section !== sectionOf(group.hits[h - 1]))}
						<div class="section" role="presentation">{section}</div>
					{/if}
					<SearchOption
						id={rowId(i)}
						active={search.isActive(i)}
						{compact}
						href={bronHref(hitName(hit), { keepNetwerk: false })}
						onchoose={() => open(hitName(hit), null)}
						onpoint={pointAt(i)}
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
						{#if shown.chamber || shown.context || shown.expired}<span class="row-context"
								>{#if shown.chamber}<abbr title={CHAMBER_NAME[shown.chamber]}>{shown.chamber}</abbr
									>{/if}{shown.chamber && shown.context
									? ` ${shown.context}`
									: shown.context}{#if shown.expired}{shown.context ? ', ' : ''}<span
										class="row-expired"
										title={shown.expired}>vervallen</span
									>{/if}</span
							>{/if}
					</SearchOption>
				{/each}
				{#if search.moreKinds.has(group.kind)}
					<!-- The live mode answered within its time and left more out: the full answer on asking. -->
					<p class="volledig">
						<TekstLink onclick={() => search.askInFull()}
							>Meer {groupLabel(group.kind).toLowerCase()}</TekstLink
						>
					</p>
				{/if}
			</div>
		{/each}

		{#each search.failedLanes as lane (lane.id)}
			<!-- A lane that failed: its group says so, the other groups stand. A lane under way
			     holds its place among the groups (slots). -->
			{@const name = lane.kinds.map((k) => groupLabel(k)).join(' en ')}
			<div class="group" role="group" aria-labelledby="{uid}-{lane.id}-stand">
				<div class="group-label" id="{uid}-{lane.id}-stand">
					<KindGlyph collection={lane.kinds[0]} />
					{name}
				</div>
				<div class="state state--group">
					<LoadState
						state={{ status: 'error', error: search.lanes[lane.id].error }}
						what={name}
						plural
						retry={() => search.retry(lane.id)}
					/>
				</div>
			</div>
		{/each}

		{#if search.failure}
			<div class="state">
				<LoadState
					state={{ status: 'error', error: search.failure.error }}
					what="De resultaten"
					plural
					retry={() => search.retrySearch()}
				/>
			</div>
		{:else if search.empty}
			<div class="state stil" role="status">
				<span>Geen resultaten voor "{search.q}"</span>
				<span class="verder">
					<TekstLink onclick={() => fieldEl?.select()}>Pas de zoekterm aan</TekstLink>
					{#each search.narrower as word (word)}
						<TekstLink
							onclick={() => {
								search.query = word;
							}}>Zoek "{word}"</TekstLink
						>
					{/each}
					{#if search.from || search.to}
						<TekstLink
							onclick={() => {
								search.from = '';
								search.to = '';
							}}>Zonder periode</TekstLink
						>
					{/if}
					{#if scope && onWiden}
						<TekstLink onclick={() => onWiden()}>Zoek in alle bronnen</TekstLink>
					{/if}
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	/* In line with the hits below it. */
	.periode {
		padding: var(--s-2) var(--s-4) 0;
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
		padding: var(--s-3) var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
		color: var(--ink-3);
		flex-shrink: 0;
	}
	/* The field carries the ink ring of its input (the input itself has none); in the
	   dialog the field is its one stop and the caret says enough. */
	.field:focus-within {
		border-color: var(--ink-3);
	}
	.search:not(.search--overlay) .field:focus-within {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
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
		font-family: var(--font-ui);
		font-size: var(--t-ui);
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
	.list :global(.row--citation + .group) {
		margin-top: var(--s-2);
	}

	.group-label {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-4) var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}

	.row-kind {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		flex-shrink: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}

	.row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
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
		font-family: var(--font-serif);
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
		padding: var(--s-1) var(--s-4) 0;
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.state {
		margin: 0;
		padding: var(--s-3) var(--s-4);
	}

	.volledig {
		margin: 0 var(--s-4) var(--s-2);
		font-size: var(--t-meta);
	}
	.gezocht {
		margin: 0;
		padding: 0 var(--s-4) var(--s-1);
		line-height: var(--lh-snug);
	}

	.group-label .laden {
		margin-left: var(--s-2);
		color: var(--ink-3);
	}
	.deel {
		margin-left: var(--s-2);
		font-weight: 400;
		font-style: italic;
	}
	.verder {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		margin-top: var(--s-1);
	}
	.weggelaten {
		padding-bottom: var(--s-1);
	}
	.state--group {
		padding-top: 0;
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
		padding: var(--s-1) var(--s-3) 0;
	}
	.row-expired {
		color: var(--uitkomst-nee);
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
