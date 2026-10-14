<script lang="ts">
	import { bewaarItem } from '$lib/map/map';
	import { naamVan } from '$lib/bron/menselijk';
	import ReaderHead from './ReaderHead.svelte';
	import { vandaag } from '$lib/text/datum';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { getCommitment } from '$lib/api/records';
	import { uniqueBy } from '$lib/util/unique';
	// Reader for a toezegging: its text, who made it in which post, the ministry and cabinet,
	// when it was made and when it is expected to be settled, its state and its dossiers.
	import ReaderFrame from './ReaderFrame.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { indexHref } from '$lib/bron/href';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
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
	import { nagekomenIn, toegezegdIn } from '$lib/components/parliamentary/toezegging';
	import { tussen } from '$lib/components/parliamentary/vervanging';

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

	const today = vandaag();
</script>

<ReaderFrame>
	<div class="r-commitment">
		{#if view.kind === 'loading'}
			<p class="loading stil">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const c = view.commitment}
			{@const late =
				c.status === OPEN_STATUS && !!c.expected_resolution && c.expected_resolution < today}
			{@const tekst = c.text ?? 'Toezegging zonder tekst'}
			<ReaderHead
				collection="commitments"
				title={tekst}
				acties={{
					bewaar: bewaarItem(node.id, {
						kort: c.number ? `Toezegging ${c.number}` : tekst,
						voluit: c.number ? `Toezegging ${c.number}: ${tekst}` : tekst
					})
				}}
			>
				<!-- Where it was made and where it was kept, in the Kamer's words (toezegging.ts):
				     the activity by its kind and day, the letters by their number. -->
				{#snippet status()}
					{@const gedaan = toegezegdIn(c.activity)}
					{@const nagekomen = nagekomenIn(c.fulfilled_by)}
					{#if gedaan || nagekomen}
						<p class="zinnen">
							{#if gedaan && c.activity}<span
									>{gedaan.voor}
									<BronLink ref={`activities/${c.activity.key}`}>{gedaan.link}</BronLink>.</span
								>{/if}
							{#if nagekomen}<span
									>{nagekomen.voor}
									{#each nagekomen.brieven as b, i (b.key)}{tussen(
											i,
											nagekomen.brieven.length
										)}<BronLink ref={`documents/${b.key}`}>{b.naam}</BronLink>{/each}.</span
								>{/if}
						</p>
					{/if}
				{/snippet}
			</ReaderHead>

			<Feiten>
				<Veld label="Bewindspersoon" value={c.member ?? c.minister_name} nodig>
					{#if c.member}
						<BronLink ref={`members/${c.member.key}`}
							>{c.member.name ?? naamVan('members', c.member)}</BronLink
						>
					{:else}
						{c.minister_name}
					{/if}
				</Veld>
				<Veld label="Functie" value={c.member?.function ?? (c.post ? POST_LABEL[c.post] : null)} />
				<Veld label="Ministerie" value={ministryName(c.ministry)} />
				<Veld label="Kabinet" value={c.cabinet}>
					<BronLink ref={`cabinets/${c.cabinet}`}>{cabinetName(c.cabinet ?? '')}</BronLink>
				</Veld>
				<Veld label="Geregistreerd" value={c.date}>
					<span class="nums">{formatLongDate(c.date ?? null)}</span>
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
				<p class="alle">
					<TekstLink href={indexHref('commitments', { member: c.member.key })}
						>Alle toezeggingen van {c.member.name}</TekstLink
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
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-5);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.loading,
	.error {
		margin: 0;
	}
	.late {
		color: var(--ink) !important;
		/* In ink, as everything at rest but "nee" (Thijs, 10 Oct); the weight keeps it seen. */
		font-weight: 600;
	}
	.zinnen {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.zinnen :global(a) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.nums {
		font-variant-numeric: tabular-nums;
	}
	.dossiers {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.alle {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
</style>
