<script lang="ts">
	// What Concordans holds, as one line of counts from /api/stats: asked once it comes into
	// view, the same request the footer makes. Without the stats the line stays away.
	import { getStats, type Stats } from '$lib/api/stats';
	import { report } from '$lib/api/errors';
	import { inView } from '$lib/actions/in-view';
	import { formatCount } from '$lib/text/getal';

	let stats = $state<Stats | null>(null);
	const ask = () =>
		getStats()
			.then((s) => (stats = s))
			.catch((e) => report('Bronnen', e));

	const counts = $derived(
		stats
			? [
					[stats.nodes.judgments, 'uitspraken'],
					[stats.nodes.articles, 'wetsartikelen'],
					[stats.lists.documents, 'Kamerstukken'],
					[stats.lists.decisions, 'stemmingen'],
					[stats.lists.commitments, 'toezeggingen']
				]
					.filter(([n]) => typeof n === 'number' && n > 0)
					.map(([n, word]) => `${formatCount(n as number)} ${word}`)
					.join(', ')
			: null
	);
</script>

<p class="coverage" use:inView={ask}>
	<span class="label">Bronnen</span>
	{#if counts}<span>{counts}</span>{/if}
	<a href="/bronnen">Herkomst per bron</a>
</p>

<style>
	.coverage {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-3);
		min-height: var(--s-5);
		margin: 0;
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.label {
		font-weight: 600;
		color: var(--ink-3);
	}
	a {
		color: var(--ink);
	}
</style>
