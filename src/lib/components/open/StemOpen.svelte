<script lang="ts">
	// A stemming opened in a row outside Actueel (a lid's votes): its bar, as Actueel shows it
	// (RijInhoud), from the stemming's own record, asked when the row opens (UX-toets 10 Oct,
	// #20). The reader stays one step further: Lees verder.
	import { getDecision } from '$lib/api/records';
	import RijInhoud from './RijInhoud.svelte';
	import { stemmingInhoud, type MetInhoud } from './rij-inhoud';

	let { decisionKey }: { decisionKey: string } = $props();

	let item = $state<MetInhoud | null>(null);
	let mislukt = $state(false);
	$effect(() => {
		const key = decisionKey;
		item = null;
		mislukt = false;
		let stale = false;
		getDecision(key)
			.then((d) => {
				if (stale) return;
				item = stemmingInhoud(key, d.tally);
			})
			.catch(() => {
				if (!stale) mislukt = true;
			});
		return () => (stale = true);
	});
</script>

{#if item}
	<RijInhoud {item} />
{:else if mislukt}
	<p class="stil">De stemming kon niet worden geladen.</p>
{:else}
	<p class="stil">Laden…</p>
{/if}
