<script lang="ts">
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import { getCommitment } from '$lib/api/records';
	import { uniqueBy } from '$lib/util/unique';
	// Reader for a toezegging: its text, who made it in which post, the ministry and cabinet,
	// when it was made and when it is expected to be settled, its state and its dossiers.
	import ReaderFrame from './ReaderFrame.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { indexHref } from '$lib/bron/href';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { bronLabel } from '$lib/vocabulary';
	import {
		OPEN_STATUS,
		POST_LABEL,
		getCabinets,
		getMinistries,
		type Cabinet,
		type Ministry
	} from '$lib/components/explore/index/government';
	import { formatLongDate } from './_shared';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; commitment: Schema<'CommitmentDTO'> };

	let view = $state<State>({ kind: 'loading' });
	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const bronKey = $derived(node.key);

	$effect(() => {
		void attempt;
		const key = bronKey;
		const ac = new AbortController();
		view = { kind: 'loading' };
		getCommitment(key)
			.then((commitment) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', commitment };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Toezegging kon niet worden geladen.' };
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
				c.status === OPEN_STATUS && !!c.expected_resolution && c.expected_resolution < today}
			<header class="head">
				<span class="kicker"
					><SoortLink collection="commitments">{bronLabel('commitments')}</SoortLink></span
				>
				<h2 class="text">{c.text ?? 'Toezegging zonder tekst'}</h2>
			</header>

			<Feiten>
				<Veld label="Bewindspersoon" value={c.member ?? c.minister_name} nodig>
					{#if c.member}
						<BronLink ref={`members/${c.member.key}`}>{c.member.name ?? c.member.key}</BronLink>
					{:else}
						{c.minister_name}
					{/if}
				</Veld>
				<Veld label="Functie" value={c.member?.function ?? (c.post ? POST_LABEL[c.post] : null)} />
				<Veld label="Ministerie" value={ministryName(c.ministry)} />
				<Veld label="Kabinet" value={c.cabinet}>
					<BronLink ref={`cabinets/${c.cabinet}`}>{cabinetName(c.cabinet ?? '')}</BronLink>
				</Veld>
				<Veld label="Gedaan op" value={c.date}>
					<span class="nums"
						>{formatLongDate(c.date ?? null)}{#if c.activity}, in <BronLink
								ref={`activities/${c.activity.key}`}>activiteit {c.activity.number ?? ''}</BronLink
							>{/if}</span
					>
				</Veld>
				<Veld label="Stand" value={c.status} nodig>
					<span class:late
						>{c.status}{#if late}, over de verwachte datum{/if}</span
					>
				</Veld>
				<Veld label="Verwacht" value={c.expected_resolution} nodig>
					<span class="nums">{formatLongDate(c.expected_resolution ?? null)}</span>
				</Veld>
				<Veld label={c.dossiers?.length === 1 ? 'Dossier' : 'Dossiers'} value={c.dossiers}>
					<span class="dossiers">
						{#each uniqueBy(c.dossiers ?? [], (d) => d.key) as d (d.key)}
							<BronLink ref={{ collection: 'dossiers', key: d.key, number: d.number ?? d.key }}
								>{d.number}{d.title ? ` ${d.title}` : ''}</BronLink
							>
						{/each}
					</span>
				</Veld>
			</Feiten>

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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
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
		font-family: var(--font-serif);
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
