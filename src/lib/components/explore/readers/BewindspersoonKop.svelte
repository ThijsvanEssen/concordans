<script lang="ts">
	import { formatCount } from '$lib/text/getal';
	import { OPEN_STATUS } from '$lib/components/explore/index/government';
	import { lowerFirst, plural } from '$lib/text/words';
	import { sinceDate, untilDate } from '$lib/text/datum';
	import { report } from '$lib/api/errors';
	import { bewaarItem } from '$lib/map/map';
	import { atomHref } from '$lib/components/actueel/feed';
	import { naamVan } from '$lib/bron/menselijk';
	// De kop van een bewindspersoon. Wie en wat in één
	// zin; dan drie ingangen met aantallen, zodat duidelijk is waar te beginnen.
	import type { Schema } from '$lib/api/types';
	import { getMemberCommitments, getMemberDossiers } from '$lib/api/records';
	import ReaderHead from './ReaderHead.svelte';

	let { m, id }: { m: Schema<'MemberDetailDTO'>; id: string } = $props();
	const fns = $derived(
		[...(m.government_functions ?? [])].sort((a, b) =>
			(b.from_date ?? '').localeCompare(a.from_date ?? '')
		)
	);
	const nu = $derived(fns.filter((f) => !f.to_date));
	const laatst = $derived(nu[0] ?? fns[0]);
	const partij = $derived(laatst?.party?.short ?? m.party ?? null);
	const kabinetten = $derived([...new Set(fns.map((f) => f.cabinet))]);

	let tz = $state<{ total: number; open: number } | null>(null);
	let dossiers = $state<number | null>(null);
	$effect(() => {
		const key = m.key;
		const ac = new AbortController();
		// The counts the overview below lists too: the same requests serve both.
		getMemberCommitments(key, 1)
			.then((r) => {
				if (ac.signal.aborted) return;
				tz = {
					total: r.total,
					open: r.facets?.status?.find((s) => s.value === OPEN_STATUS)?.count ?? 0
				};
			})
			.catch((e) => report('Toezeggingen van de bewindspersoon', e));
		getMemberDossiers(key, 3)
			.then((r) => !ac.signal.aborted && (dossiers = r.total))
			.catch((e) => report('Dossiers van de bewindspersoon', e));
		return () => ac.abort();
	});
</script>

<!-- The head of a bewindspersoon is the head of every reader (ReaderHead): what they are and
     since when in the status line, the ways into the overview under it. -->
<ReaderHead
	collection="members"
	lijst="ministers"
	kindLabel="Bewindspersoon"
	kindParts={[partij]}
	title={m.name ?? naamVan('members', m)}
	acties={{
		bewaar: bewaarItem(id, {
			kort: m.name ?? naamVan('members', m),
			voluit: partij
				? `${m.name ?? naamVan('members', m)} (${partij})`
				: (m.name ?? naamVan('members', m))
		}),
		// Volg: what the lid signs and promises, as an Atom feed (`/api/feed?member=`).
		atom: atomHref({ member: m.key })
	}}
>
	{#snippet statusLine()}
		{#if laatst}
			<p class="zin">
				{#if nu.length}
					{nu.map((f) => f.function).join(' en ')} {sinceDate(nu[0].from_date)}, {nu[0].cabinet}.
				{:else}
					Laatst {lowerFirst(laatst.function ?? '')}, {untilDate(laatst.to_date)} ({laatst.cabinet}).
				{/if}
			</p>
		{/if}
	{/snippet}
	<ul class="ing">
		{#if tz?.total !== 0}
			<li>
				<a href="#toezeggingen"><b>{tz?.open ?? '…'}</b> openstaande toezeggingen</a>
				<span class="s">van {tz?.total ?? '…'}</span>
			</li>
		{/if}
		<li>
			<!-- Named as the section it leads to (UX-toets 10 Oct, #17: no sentence under it). -->
			<a href="#dossiers"
				><b>{dossiers ?? '…'}</b>
				{plural(dossiers ?? 0, 'dossier', 'dossiers')} met ondertekende stukken</a
			>
		</li>
		<li>
			<a href="#loopbaan"><b>{fns.length}</b> {plural(fns.length, 'post', 'posten')}</a>
			<span class="s"
				>{kabinetten.length === 1
					? kabinetten[0]
					: `${formatCount(kabinetten.length)} kabinetten`}</span
			>
		</li>
	</ul>
</ReaderHead>

<style>
	.zin {
		margin: 0;
	}
	.ing {
		list-style: none;
		margin: var(--s-4) 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.ing li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border-top: 1px solid var(--rule);
		padding-top: var(--s-2);
	}
	.ing a {
		color: var(--ink);
		text-decoration: none;
	}
	.ing a:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.ing b {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 600;
	}
	.s {
		color: var(--ink-3);
		font-size: var(--t-micro);
	}
	@media (max-width: 560px) {
		.ing {
			grid-template-columns: 1fr;
		}
	}
</style>
