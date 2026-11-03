<script lang="ts">
	// The tabs Tekst and Verbonden of a phone, Verbonden with its count once it holds; the
	// largest soorten stand at the top of the text (ConnectedEntry).
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import type { Option } from '$lib/components/ui/option';
	import type { GraphNode } from '$lib/graph/types';
	import { formatCount } from '$lib/text/getal';
	import { entryOf, type Connections } from '$lib/verbonden/entry';
	import { panel } from '$lib/verbonden/panel-groups.svelte';
	import type { Panel } from './panels';

	let {
		tab = $bindable(),
		connected,
		selection
	}: { tab: Panel; connected: Connections; selection: GraphNode } = $props();

	const entry = $derived(entryOf(connected, selection.collection, selection.id, panel.groups));
	const opties = $derived<Option<Panel>[]>([
		{ waarde: 'tekst', label: 'Tekst' },
		{
			waarde: 'verbonden',
			label: entry ? `Verbonden ${formatCount(entry.total)}` : 'Verbonden'
		}
	]);
</script>

<Keuze vol label="Tekst of Verbonden" {opties} waarde={tab} onSelect={(w) => (tab = w)} />
