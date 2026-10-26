<script lang="ts">
	import { plural, separatorBefore } from '$lib/text/words';
	import { bewaarItem } from '$lib/map/map';
	import { naamVan } from '$lib/bron/menselijk';
	import ReaderHead from './ReaderHead.svelte';
	import { langeDatum, vandaag } from '$lib/text/datum';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import { getCommitment } from '$lib/api/records';
	import { uniqueBy } from '$lib/util/unique';
	// Reader for a toezegging: its text, who made it in which post, the ministry and cabinet,
	// when it was made and when it is expected to be settled, its state and its dossiers.
	import ReaderFrame from './ReaderFrame.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { indexHref } from '$lib/bron/href';
	import type { GraphNode } from '$lib/graph/types';
	import { OPEN_STATUS, POST_LABEL, type Cabinet } from '$lib/components/explore/index/government';
	import { getCabinets } from '$lib/api/government';
	import MinistryLink from '$lib/bron/MinistryLink.svelte';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';
	import {
		discussedIn,
		dossiersByBasis,
		nagekomenIn,
		registeredOn,
		toegezegdIn
	} from '$lib/text/toezegging';
	import { load } from '$lib/util/load.svelte';
	import { report } from '$lib/api/errors';
	import { officialNumber } from '$lib/bron/dossier-naam';

	let { node }: { node: GraphNode } = $props();

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const commitment = load(
		() => node.key,
		(key) => getCommitment(key),
		'Toezegging'
	);

	let cabinets = $state<Cabinet[]>([]);
	$effect(() => {
		getCabinets()
			.then((c) => (cabinets = c))
			.catch((e) => report('Kabinetten', e));
	});
	const cabinetName = (key: string) => cabinets.find((c) => c.key === key)?.name ?? key;

	const today = vandaag();
</script>

{#snippet dossier(d: { key: string; number: string | null; title: string | null })}
	<BronLink ref={{ collection: 'dossiers', key: d.key, number: d.number ?? d.key }}
		>{d.number ? officialNumber(d.number) : ''}{d.title ? ` ${d.title}` : ''}</BronLink
	>
{/snippet}

<ReaderFrame state={commitment.state} what="Toezegging" retry={commitment.retry}>
	{#snippet children(c)}
		{@const late =
			c.status === OPEN_STATUS && !!c.expected_resolution && c.expected_resolution < today}
		{@const tekst = c.text ?? 'Toezegging zonder tekst'}
		<div class="r-commitment">
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
				{#snippet statusLine()}
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
									{#each nagekomen.brieven as b, i (b.key)}{separatorBefore(
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
				<Veld label="Ministerie" value={c.ministry}>
					<MinistryLink ministry={c.ministry} name={c.ministry_name} />
				</Veld>
				<Veld label="Kabinet" value={c.cabinet}>
					<BronLink ref={`cabinets/${c.cabinet}`}>{cabinetName(c.cabinet ?? '')}</BronLink>
				</Veld>
				<Veld label="Geregistreerd" value={registeredOn(c)}>
					<span class="nums">{langeDatum(registeredOn(c))}</span>
				</Veld>
				<Veld label="Stand" value={c.status} nodig>
					<span class:late
						>{c.status}{#if late}, over de verwachte datum{/if}</span
					>
				</Veld>
				<Veld label="Verwacht" value={c.expected_resolution} nodig>
					<span class="nums">{langeDatum(c.expected_resolution)}</span>
				</Veld>
				<!-- The dossier it is about (by the letter that fulfils it); a dossier only on the
				     agenda of its debate under "Besproken", never as its dossier (toezegging.ts). -->
				{@const { own, agenda } = dossiersByBasis(uniqueBy(c.dossiers ?? [], (d) => d.key))}
				<Veld label={plural(own.length, 'Dossier', 'Dossiers')} value={own}>
					<span class="dossiers">
						{#each own as d (d.key)}{@render dossier(d)}{/each}
					</span>
				</Veld>
				{#if agenda.length}
					{@const discussed = discussedIn(c.activity)}
					<Veld label={discussed.label} value={agenda}>
						<span class="dossiers">
							<span
								>{#if discussed.link && c.activity}{discussed.before}
									<BronLink ref={`activities/${c.activity.key}`}>{discussed.link}</BronLink
									>{:else}{discussed.before}{/if}</span
							>
							<span class="dossiers agenda">
								{#each agenda as d (d.key)}{@render dossier(d)}{/each}
							</span>
						</span>
					</Veld>
				{/if}
			</Feiten>

			{#if c.member}
				<p class="alle">
					<AlleN
						noun="toezeggingen van {c.member.name}"
						href={indexHref('commitments', { persoon: c.member.key })}
					/>
				</p>
			{/if}
		</div>
	{/snippet}
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
	/* The agenda of the debate under its line, a step in: its dossiers, not the toezegging's. */
	.agenda {
		padding-left: var(--s-4);
		font-size: var(--t-meta);
	}
	.alle {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
</style>
