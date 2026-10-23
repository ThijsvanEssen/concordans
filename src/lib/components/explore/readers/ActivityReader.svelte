<script lang="ts">
	import { langeDatum } from '$lib/text/datum';
	import { bewaarItem } from '$lib/map/map';
	import ReaderHead from './ReaderHead.svelte';
	// Reader for an activity: a debate, a wetgevingsoverleg, a procedurevergadering. The head
	// from the node's props at once, then from `/api/activities/{key}` (cheap; the band names
	// its committee, every dossier on its agenda and the activity it took the place of). What
	// was made in it comes after, from `/records`: its verslag and stenogram, the moties
	// submitted, the toezeggingen made and the besluiten taken, each line opening in place.
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { bronLabel } from '$lib/vocabulary';
	import { activityLine } from '$lib/verbonden/lines';
	import { getActivity, getActivityRecords } from '$lib/api/records';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { activiteitGroepen } from './activiteit';
	import { load } from '$lib/util/load.svelte';
	import { report } from '$lib/api/errors';
	import LoadState from '$lib/components/ui/LoadState.svelte';

	let { node }: { node: GraphNode } = $props();

	// The schema leaves node props untyped.
	const attrs = $derived(
		(node.raw?.props ?? {}) as {
			kind?: string;
			date?: string;
			status?: string;
			agenda_title?: string;
			tk_url?: string;
		}
	);

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and nothing is asked again for that.
	const bronKey = $derived(node.key);

	// The head stands on the node's props without the detail: a failure costs it nothing.
	let detail = $state<Schema<'ActivityDTO'> | null>(null);
	$effect(() => {
		const key = bronKey;
		let stale = false;
		detail = null;
		getActivity(key)
			.then((a) => {
				if (!stale) detail = a;
			})
			.catch((e) => report('Activiteit', e));
		return () => (stale = true);
	});
	const records = load(
		() => bronKey,
		(key) => getActivityRecords(key),
		'Stukken van de activiteit'
	);

	const kind = $derived(detail?.kind ?? attrs.kind);
	const date = $derived(detail?.date ?? attrs.date);
	const status = $derived(detail?.status ?? attrs.status);
	const tkUrl = $derived(detail?.tk_url ?? attrs.tk_url);
	const titel = $derived(detail?.agenda_title || attrs.agenda_title || node.label);

	const inhouden = $derived(
		records.state.status === 'ready' ? activiteitGroepen(records.state.data) : null
	);
</script>

{#snippet inhoud(id: string)}
	{@const i = inhouden?.inhoud.get(id)}
	{#if i}<RijInhoud item={i.item} als={i.als} />{/if}
{/snippet}

<ReaderFrame>
	<div class="r-activity">
		<ReaderHead
			collection="activities"
			kindLabel={activityLine({ kind: kind ?? bronLabel('activities'), status, date })}
			title={titel}
			acties={{
				bewaar: bewaarItem(
					node.id,
					{
						kort: titel,
						voluit: [kind, date ? langeDatum(date) : null, titel].filter(Boolean).join(', ')
					},
					{ groep: kind }
				)
			}}
		>
			{#snippet statusLine()}
				{#if date}<span>{langeDatum(date)}.</span>{/if}
			{/snippet}
		</ReaderHead>

		{#if records.state.status === 'error'}
			<LoadState
				state={records.state}
				what="Wat in de activiteit gemaakt is"
				retry={records.retry}
			/>
		{:else if inhouden && inhouden.groepen.length}
			<Tijdlijn
				groepen={inhouden.groepen.map((g) => ({
					...g,
					regels: g.regels.map((r) => (inhouden.inhoud.has(r.id) ? { ...r, inhoud } : r))
				}))}
				inklapbaar
			/>
		{/if}

		{#if tkUrl}
			<footer class="foot">
				<a href={tkUrl} target="_blank" rel="noopener noreferrer" class="full-link">
					Open op tweedekamer.nl →
				</a>
			</footer>
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-activity {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}

	.foot {
		display: flex;
	}
	.full-link {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: none;
	}
	.full-link:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>
