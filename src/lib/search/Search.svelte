<script lang="ts">
	// The one search: inline on the start page and inside the ⌘K overlay.
	import { goto } from '$app/navigation';
	import { track } from '$lib/analytics';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import { bronHref, type BronRef } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { formatDate } from '$lib/components/explore/readers/_shared';
	import { STAGE_LABEL, isStage } from '$lib/components/parliamentary/stages';
	import { bronLabel, bronPlural, type Collection } from '$lib/vocabulary';
	import { parseCitation, resolveQuery, type Citation } from './resolve-query';

	type Hit = Schema<'SearchResultItem'>;

	let {
		overlay = false,
		onOpen
	}: {
		/** Inside the overlay the field takes focus and the list scrolls within the dialog. */
		overlay?: boolean;
		/** Called when a bron is opened; the overlay closes on it. */
		onOpen?: () => void;
	} = $props();

	/** The kinds the search covers, in the order the groups appear. */
	const KINDS = [
		'instruments',
		'articles',
		'judgments',
		'dossiers',
		'documents',
		'committees',
		'factions',
		'members'
	] as const satisfies readonly Collection[];
	type Kind = (typeof KINDS)[number];
	const LIMIT = 6;
	const DEBOUNCE_MS = 180;

	/** What a citation row is marked as before the API has confirmed the bron. */
	const CITED: Record<Citation['kind'], Collection> = {
		ecli: 'judgments',
		article: 'articles',
		dossier: 'dossiers',
		bwb: 'instruments',
		celex: 'instruments'
	};

	let query = $state('');
	let results = $state<Partial<Record<Kind, Hit[]>>>({});
	/** The query `results` answers; '' before the first answer. */
	let answered = $state('');
	let loading = $state(false);
	let failed = $state(false);
	let resolving = $state(false);
	/** A citation the API did not confirm: its row is gone and the results stay. */
	let unresolved = $state('');
	let active = $state(0);
	let listEl = $state<HTMLElement | null>(null);

	const uid = $props.id();
	const q = $derived(query.trim());

	const extra = (hit: Hit, name: string): string => {
		const value = hit.extra?.[name];
		return typeof value === 'string' ? value : '';
	};

	function titleOf(hit: Hit): string {
		if (hit.collection === 'articles' && extra(hit, 'article_number')) {
			return `Artikel ${extra(hit, 'article_number')}`;
		}
		if (hit.collection === 'judgments' && extra(hit, 'ecli')) return extra(hit, 'ecli');
		return hit.display_name ?? hit.key;
	}

	/** "Hoge Raad 2024-09-24 / 23/02910": court, date and case number. */
	function judgmentContext(name: string): string {
		const m = /^(.*?)\s+(\d{4}-\d{2}-\d{2})(?:\s*\/\s*(.+))?$/.exec(name);
		if (!m) return name;
		return [m[1], formatDate(m[2]), m[3]].filter(Boolean).join(' · ');
	}

	function contextOf(hit: Hit): string {
		switch (hit.collection) {
			case 'articles':
				return extra(hit, 'citation_title');
			case 'instruments':
				return extra(hit, 'bwb_id');
			case 'judgments':
				return judgmentContext(hit.display_name ?? '');
			case 'dossiers': {
				const stage = hit.extra?.current_stage;
				return [
					extra(hit, 'number'),
					typeof stage === 'string' && isStage(stage) ? STAGE_LABEL[stage] : ''
				]
					.filter(Boolean)
					.join(' · ');
			}
			case 'documents':
				return extra(hit, 'kind');
			case 'members':
				return extra(hit, 'party');
			default:
				return '';
		}
	}

	const groups = $derived(
		KINDS.map((kind) => ({ kind, hits: results[kind] ?? [] })).filter((g) => g.hits.length > 0)
	);
	const hits = $derived(groups.flatMap((g) => g.hits));
	const indexOf = $derived(new Map(hits.map((hit, i) => [hit.id, i])));

	const citation = $derived(q && q !== unresolved ? parseCitation(q) : null);
	/** Rows the keys move over: the citation first, then every hit. */
	const offset = $derived(citation ? 1 : 0);
	const rowCount = $derived(offset + hits.length);
	const empty = $derived(
		q.length > 0 && answered === q && !loading && !failed && hits.length === 0 && !citation
	);

	// One request per query: the timer waits for the typing to pause, and a newer query
	// aborts the request of the previous one. Earlier results stay while the next runs.
	$effect(() => {
		const term = q;
		failed = false;
		if (!term) {
			results = {};
			answered = '';
			loading = false;
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(() => {
			loading = true;
			unwrap(
				api.GET('/api/search', {
					params: { query: { q: term, types: [...KINDS], limit: LIMIT } },
					signal: controller.signal
				})
			)
				.then((r) => {
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

	$effect(() => {
		void q;
		void answered;
		active = 0;
	});

	$effect(() => {
		if (rowCount === 0) return;
		listEl?.querySelector(`#${CSS.escape(`${uid}-row-${active}`)}`)?.scrollIntoView({
			block: 'nearest'
		});
	});

	function open(ref: BronRef | string, at: string | null = null) {
		const href = bronHref(ref, { at });
		onOpen?.();
		goto(href);
	}

	async function openCitation() {
		if (resolving) return;
		const term = q;
		resolving = true;
		const target = await resolveQuery(term);
		resolving = false;
		if (target) {
			track('search_resolved', { type: target.ref.collection });
			open(target.ref, target.at);
		} else {
			unresolved = term;
		}
	}

	function openHit(hit: Hit) {
		track('search_resolved', { type: hit.collection });
		open(hit.id);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' && rowCount > 0) {
			e.preventDefault();
			active = Math.min(active + 1, rowCount - 1);
		} else if (e.key === 'ArrowUp' && rowCount > 0) {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (citation && active === 0) void openCitation();
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
		if (placeOf(e) !== pointerAt) active = row;
	}

	function focusOnMount(node: HTMLInputElement) {
		if (overlay) node.focus();
	}
</script>

<svelte:window onpointermove={(e) => (pointerAt = placeOf(e))} />

<div class="search" class:search--overlay={overlay}>
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
			placeholder="Woorden, artikel, ECLI of dossiernummer"
			autocomplete="off"
			spellcheck="false"
		/>
		{#if overlay}<span class="kbd" aria-hidden="true">esc</span>{/if}
	</div>

	<div
		class="list"
		class:list--filled={rowCount > 0 || failed || empty}
		id="{uid}-list"
		role="listbox"
		aria-label="Resultaten"
		bind:this={listEl}
	>
		{#if citation}
			{@const kind = CITED[citation.kind]}
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
		{/if}

		{#each groups as group (group.kind)}
			<div class="group" role="group" aria-labelledby="{uid}-{group.kind}">
				<div class="group-label" id="{uid}-{group.kind}">
					<KindGlyph collection={group.kind} />
					{bronPlural(group.kind)}
				</div>
				{#each group.hits as hit (hit.id)}
					{@const i = offset + (indexOf.get(hit.id) ?? 0)}
					{@const context = contextOf(hit)}
					<a
						id="{uid}-row-{i}"
						class="row"
						class:is-active={active === i}
						role="option"
						tabindex="-1"
						aria-selected={active === i}
						href={bronHref(hit.id)}
						onclick={() => {
							track('search_resolved', { type: hit.collection });
							onOpen?.();
						}}
						onpointermove={(e) => onpointermove(e, i)}
					>
						<span class="row-title">{titleOf(hit)}</span>
						{#if context}<span class="row-context">{context}</span>{/if}
					</a>
				{/each}
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
		gap: 12px;
		padding: 14px 18px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
		color: var(--fg-3);
		flex-shrink: 0;
	}
	.field:focus-within {
		border-color: var(--ink-3);
	}
	.search--overlay .field {
		border: 0;
		border-bottom: 1px solid var(--rule);
		border-radius: 0;
		padding: 16px 18px;
	}

	input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: none;
		background: transparent;
		font-family: var(--font-serif);
		font-size: 19px;
		color: var(--ink);
	}
	input::placeholder {
		color: var(--fg-4);
		font-style: italic;
	}

	.kbd {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-3);
		border: 1px solid var(--rule);
		padding: 1px 6px;
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
		padding: 6px 0;
	}
	.search--overlay .list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.group + .group,
	.row--citation + .group {
		border-top: 1px solid var(--rule);
		margin-top: 6px;
		padding-top: 6px;
	}

	.group-label {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 18px 4px;
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	.row {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 7px 18px;
		font-family: var(--font-serif);
		font-size: 15px;
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
		gap: 8px;
		flex-shrink: 0;
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	.row-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-context {
		flex: 0 1 auto;
		max-width: 65%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
	}

	.state {
		margin: 0;
		padding: 12px 18px;
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--fg-3);
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
			gap: 12px;
		}
		.row-context {
			max-width: none;
		}
		input {
			font-size: 17px;
		}
	}
</style>
