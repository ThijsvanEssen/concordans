<script lang="ts">
	// De kop van een bewindspersoon. Wie en wat in één
	// zin; dan drie ingangen met aantallen, zodat duidelijk is waar te beginnen.
	import type { Schema } from '$lib/api/types';
	import { getMemberCommitments, getMemberDossiers } from '$lib/api/records';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import { datum } from '$lib/components/parliamentary/stand';

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
					open: r.facets?.status?.find((s) => s.value === 'Openstaand')?.count ?? 0
				};
			})
			.catch(() => {});
		getMemberDossiers(key, 3)
			.then((r) => !ac.signal.aborted && (dossiers = r.total))
			.catch(() => {});
		return () => ac.abort();
	});
</script>

<!-- The head of a bewindspersoon is the head of every reader (ReaderHead): what they are and
     since when in the status line, the ways into the overview under it. -->
<ReaderHead
	collection="members"
	title={m.name ?? m.key}
	acties={{
		bewaar: {
			id,
			at: '',
			kort: m.name ?? m.key,
			voluit: partij ? `${m.name ?? m.key} (${partij})` : (m.name ?? m.key),
			groep: 'Bewindspersonen'
		}
	}}
>
	{#snippet soort()}
		<KindGlyph collection="members" />Bewindspersoon{partij ? `, ${partij}` : ''}
	{/snippet}
	{#snippet status()}
		{#if laatst}
			<p class="zin">
				{#if nu.length}
					{nu.map((f) => f.function).join(' en ')} sinds {datum(nu[0].from_date)}, {nu[0].cabinet}.
				{:else}
					Laatst {laatst.function?.charAt(0).toLowerCase()}{laatst.function?.slice(1)}, tot {datum(
						laatst.to_date
					)} ({laatst.cabinet}).
				{/if}
			</p>
		{/if}
	{/snippet}
	<ul class="ing">
		{#if tz?.total !== 0}
			<li>
				<a href="#toezeggingen"><b>{tz?.open ?? '…'}</b> openstaande toezeggingen</a>
				<span class="s">van {tz?.total ?? '…'} in de gegevens</span>
			</li>
		{/if}
		<li>
			<a href="#dossiers"><b>{dossiers ?? '…'}</b> {dossiers === 1 ? 'dossier' : 'dossiers'}</a>
			<span class="s">met stukken die deze persoon ondertekende</span>
		</li>
		<li>
			<a href="#loopbaan"><b>{fns.length}</b> {fns.length === 1 ? 'post' : 'posten'}</a>
			<span class="s"
				>in {kabinetten.length === 1 ? kabinetten[0] : `${kabinetten.length} kabinetten`}</span
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
		border-top: 2px solid var(--ink);
		padding-top: var(--s-2);
	}
	.ing a {
		color: var(--ink);
		text-decoration: none;
	}
	.ing a:hover {
		color: var(--accent);
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
