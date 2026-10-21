<script lang="ts">
	// One line where the Tweede Kamer does not meet for days, the same on Actueel and the
	// Stemmingen: until when, and when it votes next, each day a link to its activity. Asked
	// after the first paint; nothing while the Kamer meets, or when the answer fails.
	import { report } from '$lib/api/errors';
	import { chamberSchedule, noSitting, type SittingDay, type NoSitting } from './chamber-schedule';

	let line = $state<NoSitting | null>(null);
	$effect(() => {
		let stale = false;
		chamberSchedule()
			.then((s) => {
				if (!stale) line = noSitting(s);
			})
			.catch((e) => report('Vergaderingen van de Tweede Kamer', e));
		return () => (stale = true);
	});
</script>

{#snippet day(d: SittingDay)}{#if d.href}<a href={d.href}>{d.text}</a>{:else}{d.text}{/if}{/snippet}

{#if line}
	<p class="no-sitting">
		Geen vergaderingen tot {@render day(line.until)}{#if line.votes}; volgende stemmingen {@render day(
				line.votes
			)}{/if}
	</p>
{/if}

<style>
	.no-sitting {
		margin: 0 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.no-sitting a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.no-sitting a:hover {
		text-decoration-color: currentColor;
	}
</style>
