<script lang="ts">
	// The tabs Tekst and Verbonden of a phone, Verbonden with its count once it holds; the
	// largest soorten stand at the top of the text (VerbondenIngang).
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import type { Option } from '$lib/components/ui/option';
	import type { GraphNode } from '$lib/graph/types';
	import { formatCount } from '$lib/text/getal';
	import type { VerbondenState } from '$lib/verbonden/data-source';
	import { ingangOf } from '$lib/verbonden/ingang';
	import { panel } from '$lib/verbonden/panel-groups.svelte';
	import type { Panel } from './panels';

	let {
		tab = $bindable(),
		verbonden,
		selection
	}: { tab: Panel; verbonden: VerbondenState; selection: GraphNode } = $props();

	const ingang = $derived(ingangOf(verbonden, selection.collection, selection.id, panel.groups));
	const opties = $derived<Option<Panel>[]>([
		{ waarde: 'tekst', label: 'Tekst' },
		{
			waarde: 'verbonden',
			label: ingang ? `Verbonden ${formatCount(ingang.total)}` : 'Verbonden'
		}
	]);
</script>

<Keuze vol label="Tekst of Verbonden" {opties} waarde={tab} onSelect={(w) => (tab = w)} />
