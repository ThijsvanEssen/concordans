<script lang="ts">
	// Openstaand on the card of a bron (besluit 37): the lopende dossiers that propose a change
	// of it, each with its voorstel, and "Aan het netwerk toevoegen". Asked when the card shows,
	// for this bron alone; what a dossier is called and how many changes it holds is the API's.
	import { getInFluxDossiers } from '$lib/api/overlays';
	import { abortable } from '$lib/api/records';
	import { openHref } from '$lib/bron/href';
	import { refOf } from '$lib/bron/ref';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { count } from '$lib/text/words';
	import { parseNodeId } from '$lib/vocabulary';
	import { openDossierName, billIdOf } from './proposals';
	import ProposalDot from './ProposalDot.svelte';

	let {
		id,
		chosen = new Set<string>(),
		onAdd
	}: {
		/** The bron whose lopende voorstellen are asked. */
		id: string;
		/** The bronnen of the netwerk, by id. */
		chosen?: ReadonlySet<string>;
		onAdd?: (id: string, name?: string) => void;
	} = $props();

	const answer = load(
		() => id,
		(key, signal) => abortable(getInFluxDossiers([key], signal), signal),
		'Kaart openstaand'
	);

	const dossierLink = (dossierId: string) => {
		const ref = parseNodeId(dossierId);
		return ref ? openHref(refOf(ref.collection, ref.key, { number: ref.key })) : null;
	};
	const billLink = (billId: string) => {
		const ref = parseNodeId(billId);
		return ref ? openHref(refOf(ref.collection, ref.key)) : null;
	};
</script>

<section class="open" aria-labelledby="open-kop">
	<h3 class="head" id="open-kop"><ProposalDot />Lopend wetsvoorstel</h3>
	{#if answer.state.status !== 'ready'}
		<LoadState state={answer.state} what="De lopende voorstellen" retry={answer.retry} />
	{:else}
		<ul>
			{#each answer.state.data.get(id) ?? [] as d (d.id)}
				{@const bill = billIdOf(d)}
				{@const href = dossierLink(d.id)}
				<li>
					{#if href}<a class="name" {href} data-sveltekit-noscroll>{openDossierName(d)}</a>
					{:else}<span class="name">{openDossierName(d)}</span>{/if}
					<span class="state">
						{count(d.count, 'wijziging', 'wijzigingen')}{d.closed_known
							? ''
							: ', afloop nog niet vastgesteld'}
					</span>
					{#if bill}
						<span class="row">
							<a class="bill" href={billLink(bill)} data-sveltekit-noscroll>Voorstel van wet</a>
							{#if onAdd}
								<button
									type="button"
									class="btn"
									aria-pressed={chosen.has(bill)}
									disabled={chosen.has(bill)}
									onclick={() => onAdd(bill, openDossierName(d))}
									>{chosen.has(bill) ? 'In het netwerk' : 'Aan het netwerk toevoegen'}</button
								>
							{/if}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.open {
		margin-top: var(--s-4);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0 0 var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-2) 0;
		border-top: 1px solid var(--rule);
		font-size: var(--t-meta);
	}
	.name {
		color: var(--ink);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.state {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin-top: var(--s-1);
	}
	@media (max-width: 768px) {
		.row :global(.btn) {
			height: var(--veld-h-raak);
		}
	}
</style>
