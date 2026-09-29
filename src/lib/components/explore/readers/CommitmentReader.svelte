<script lang="ts">
	import { uniqueBy } from '$lib/util/unique';
	// Reader for a toezegging: its text, who made it in which post, the ministry and cabinet,
	// when it was made and when it is expected to be settled, its state and its dossiers.
	import ReaderFrame from './ReaderFrame.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { indexHref } from '$lib/bron/href';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { bronLabel } from '$lib/vocabulary';
	import {
		COMMITMENT_STATUS_LABEL,
		POST_LABEL,
		getCabinets,
		getMinistries,
		type Cabinet,
		type Ministry
	} from '$lib/components/explore/index/government';
	import { formatLongDate } from './_shared';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; commitment: Schema<'CommitmentDTO'> };

	let view = $state<State>({ kind: 'loading' });
	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		unwrap(api.GET('/api/commitments/{key}', { params: { path: { key } }, signal: ac.signal }))
			.then((commitment) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', commitment };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Toezegging kon niet geladen worden.' };
			});
		return () => ac.abort();
	});

	let ministries = $state<Ministry[]>([]);
	let cabinets = $state<Cabinet[]>([]);
	$effect(() => {
		getMinistries()
			.then((m) => (ministries = m))
			.catch(() => {});
		getCabinets()
			.then((c) => (cabinets = c))
			.catch(() => {});
	});
	const ministryName = (key: string | null | undefined) =>
		(key && ministries.find((m) => m.key === key)?.name) || null;
	const cabinetName = (key: string) => cabinets.find((c) => c.key === key)?.name ?? key;

	const today = new Date().toISOString().slice(0, 10);
</script>

<ReaderFrame>
	<div class="r-commitment">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const c = view.commitment}
			{@const late =
				c.status === 'open' && !!c.expected_resolution && c.expected_resolution < today}
			<header class="head">
				<span class="kicker"><KindGlyph collection="commitments" />{bronLabel('commitments')}</span>
				<p class="text">{c.text ?? 'Toezegging zonder tekst'}</p>
			</header>

			<dl class="facts">
				<dt>Bewindspersoon</dt>
				<dd>
					{#if c.member}
						<BronLink ref={`members/${c.member.key}`}>{c.member.name ?? c.member.key}</BronLink>
					{:else}
						{c.minister_name ?? 'onbekend'}
					{/if}
				</dd>
				{#if c.member?.function || c.post}
					<dt>Functie</dt>
					<dd>{c.member?.function ?? (c.post ? POST_LABEL[c.post] : '')}</dd>
				{/if}
				{#if ministryName(c.ministry)}
					<dt>Ministerie</dt>
					<dd>{ministryName(c.ministry)}</dd>
				{/if}
				{#if c.cabinet}
					<dt>Kabinet</dt>
					<dd><BronLink ref={`cabinets/${c.cabinet}`}>{cabinetName(c.cabinet)}</BronLink></dd>
				{/if}
				{#if c.date}
					<dt>Gedaan op</dt>
					<dd class="nums">
						{formatLongDate(c.date)}{#if c.activity}, in <BronLink
								ref={`activities/${c.activity.key}`}>activiteit {c.activity.number ?? ''}</BronLink
							>{/if}
					</dd>
				{/if}
				<dt>Stand</dt>
				<dd class:late>
					{c.status ? COMMITMENT_STATUS_LABEL[c.status] : 'onbekend'}{#if late}, over de verwachte
						datum{/if}
				</dd>
				<dt>Verwacht</dt>
				<dd class="nums">
					{c.expected_resolution ? formatLongDate(c.expected_resolution) : 'geen datum genoemd'}
				</dd>
				{#if c.dossiers?.length}
					<dt>{c.dossiers.length === 1 ? 'Dossier' : 'Dossiers'}</dt>
					<dd class="dossiers">
						{#each uniqueBy(c.dossiers, (d) => d.key) as d (d.key)}
							<BronLink ref={{ collection: 'dossiers', key: d.key, number: d.number ?? d.key }}
								>{d.number}{d.title ? ` ${d.title}` : ''}</BronLink
							>
						{/each}
					</dd>
				{/if}
			</dl>

			{#if c.member}
				<p class="more">
					<a href={indexHref('commitments', { member: c.member.key })} data-sveltekit-noscroll
						>Alle toezeggingen van {c.member.name}</a
					>
				</p>
			{/if}
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-commitment {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
		color: var(--ink-2);
	}
	.loading,
	.error {
		margin: 0;
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.kicker {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}
	/* The toezegging is its text: set as the reading text, not as a title. */
	.text {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: 1.6;
		color: var(--ink);
		max-width: 68ch;
	}
	/* Label left, value beside it: one edge for the labels, one for the values. */
	.facts {
		display: grid;
		grid-template-columns: 10em minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
	}
	.facts dt {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.facts dd {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.late {
		color: var(--accent) !important;
	}
	.nums {
		font-variant-numeric: tabular-nums;
	}
	.dossiers {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.more {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.more a {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.more a:hover {
		color: var(--accent);
	}
</style>
