<script lang="ts">
	// A stemming opened in a row outside Actueel (a lid's votes): its bar, as Actueel shows it
	// (RijInhoud), from the stemming's own record, asked when the row opens (UX-toets 10 Oct,
	// #20). The reader stays one step further: Lees verder.
	import { getDecision } from '$lib/api/records';
	import RijInhoud from './RijInhoud.svelte';
	import { stemmingInhoud } from './rij-inhoud';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';

	let { decisionKey }: { decisionKey: string } = $props();

	const stemming = load(
		() => decisionKey,
		async (key) => stemmingInhoud(key, (await getDecision(key)).tally),
		'Stemming'
	);
</script>

<LoadState state={stemming.state} what="De stemming" retry={stemming.retry}>
	{#snippet children(item)}
		<RijInhoud {item} />
	{/snippet}
</LoadState>
