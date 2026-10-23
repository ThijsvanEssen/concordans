<script lang="ts">
	// Reader for a ministry under one of its names: when it had the name, the name it followed
	// and the one that followed it, and the bewindspersonen per cabinet, the newest cabinet first.
	// What is its own (laws, open dossiers, open toezeggingen) is in Verbonden, as the
	// verbindingen of any other bron.
	import { textOf } from '$lib/text/words';
	import { bewaarItem } from '$lib/map/map';
	import { getMinistry } from '$lib/api/records';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { langeDatum } from '$lib/text/datum';
	import { load } from '$lib/util/load.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { POST_LABEL } from '../index/government';
	import { ministryName } from '../index/ministries.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import { ministryTitle, periodWords } from './ministry';

	let { node }: { node: GraphNode } = $props();

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const ministry = load(
		() => node.key,
		(key) => getMinistry(key),
		'Ministerie'
	);
	const record = $derived(ministry.state.status === 'ready' ? ministry.state.data : null);

	// The head from the light node at once, then from the record.
	const p = $derived(node.raw?.props ?? {});
	const naam = $derived(record?.name ?? textOf(p.name) ?? node.label);
	const tot = $derived(record ? record.until : textOf(p.to_date));
	const afkorting = $derived(record?.abbreviation ?? textOf(p.abbreviation));
	const titel = $derived(ministryTitle(naam, tot));
	const stretches = $derived(
		record
			? record.periods.map((s) => ({ from: s.from_date, to: s.until }))
			: (Array.isArray(p.periods) ? p.periods : []).map((s: Record<string, unknown>) => ({
					from: textOf(s.from_date),
					to: textOf(s.to_date)
				}))
	);

	/** The day a post began, where it is not the cabinet's own. */
	const sinds = (from: string | null | undefined, kabinet: string | null | undefined) =>
		from && from !== kabinet ? langeDatum(from) : null;
</script>

<ReaderFrame state={ministry.state} what="Ministerie" retry={ministry.retry}>
	{#snippet head()}
		<ReaderHead
			collection="ministries"
			title={titel}
			acties={{ bewaar: bewaarItem(node.id, { kort: naam, voluit: titel }) }}
		>
			{#snippet statusLine()}
				{#if periodWords(stretches)}<span>{periodWords(stretches)}</span>{/if}
				{#if afkorting}<span class="afk">{afkorting}</span>{/if}
			{/snippet}
		</ReaderHead>
	{/snippet}
	{#snippet children(m)}
		<div class="r-ministry">
			{#if m.predecessors.length > 0 || m.successor}
				<Feiten>
					<Veld label="Voorganger" value={m.predecessors.length > 0 ? m.predecessors : null}>
						{#each m.predecessors as key, i (key)}{i ? ', ' : ''}<BronLink ref={`ministries/${key}`}
								>{ministryName(key)}</BronLink
							>{/each}
					</Veld>
					<Veld label="Opvolger" value={m.successor}>
						<BronLink ref={`ministries/${m.successor}`}>{ministryName(m.successor)}</BronLink>
					</Veld>
				</Feiten>
			{/if}
			{#if m.cabinets.length > 0}
				<Sectie title="Bewindspersonen" inklapbaar={false}>
					{#each m.cabinets as c (c.key)}
						<div class="kabinet">
							<h4 class="kabinet__naam">
								<BronLink ref={`cabinets/${c.key}`}>{c.name ?? c.key}</BronLink>
							</h4>
							<Feiten klein>
								{#each c.posts as post, i (i)}
									{@const sindsDag = sinds(post.from_date, c.from_date)}
									<Veld
										label={post.function ?? (post.post ? POST_LABEL[post.post] : '')}
										value={post.member}
									>
										<BronLink ref={`members/${post.member.key}`}>{post.member.name}</BronLink
										>{#if post.acting}, ad interim{/if}{#if sindsDag}<span class="sinds">
												, sinds {sindsDag}</span
											>{/if}
									</Veld>
								{/each}
							</Feiten>
						</div>
					{/each}
				</Sectie>
			{/if}
		</div>
	{/snippet}
</ReaderFrame>

<style>
	.r-ministry {
		display: flex;
		flex-direction: column;
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.kabinet + .kabinet {
		margin-top: var(--s-4);
	}
	.kabinet__naam {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.sinds {
		color: var(--ink-3);
	}
	/* The abbreviation: a word, not a tag. */
	.afk {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>
