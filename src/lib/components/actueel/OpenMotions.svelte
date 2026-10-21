<script lang="ts">
	// First on Actueel: the motions of censure and of no confidence the Kamer has not yet voted
	// on, each by its kind, a link to it, its day and where it is filed. Asked after the first
	// paint; nothing when none is open or the answer fails.
	import type { Schema } from '$lib/api/types';
	import { report } from '$lib/api/errors';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { dossierLabel } from '$lib/bron/dossier-naam';
	import { korteDatum } from '$lib/text/datum';
	import OutcomeMark from '$lib/components/parliamentary/Uitkomst.svelte';
	import { motionKindLabel } from '$lib/components/parliamentary/motion-kind';
	import { dossierOf, loadOpenMotions } from './open-motions';

	let motions = $state<Schema<'DocumentListItemDTO'>[]>([]);
	$effect(() => {
		const ac = new AbortController();
		loadOpenMotions(ac.signal)
			.then((m) => (motions = m))
			.catch((e) => {
				if (!ac.signal.aborted) report('Open moties', e);
			});
		return () => ac.abort();
	});
</script>

{#if motions.length}
	<ul
		class="open-motions"
		aria-label="Moties van afkeuring en wantrouwen, niet in stemming geweest"
	>
		{#each motions as m (m.key)}
			{@const dossier = dossierOf(m)}
			<li>
				<span class="kind"
					><OutcomeMark tone="open" title="nog niet in stemming" />{motionKindLabel(m.motion_kind)},
					nog niet in stemming</span
				>
				<BronLink ref={{ collection: 'documents', key: m.key }}>{m.title ?? 'Motie'}</BronLink>
				<span class="meta"
					>{korteDatum(m.date)}{#if dossier}, {dossierLabel({ number: dossier })}{#if m.number}, nr. {m.number}{/if}{/if}</span
				>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.open-motions {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		margin: 0 0 var(--s-5);
		padding: 0 0 var(--s-4);
		list-style: none;
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-serif);
	}
	.open-motions li {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.kind {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
	}
	.open-motions :global(a) {
		font-size: var(--t-body);
		line-height: var(--lh-snug);
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.meta {
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>
