<script lang="ts">
	// The glance of a regulation in the keten (Keten, hover and focus): the kind, the name and
	// the grondslag, the articles it rests on, each with the abbreviation of its law.
	import FloatingCard from '$lib/components/ui/FloatingCard.svelte';

	let {
		anchor,
		id,
		kicker,
		title,
		lines,
		onclose
	}: {
		anchor: HTMLElement;
		id: string;
		kicker: string;
		title: string;
		/** `Grondslag art. 19 Cbb, art. 23 Cbb`, `Noemt art. 68 Cbw`. */
		lines: readonly string[];
		onclose: () => void;
	} = $props();
</script>

<FloatingCard kind="glance" {anchor} {onclose} {id} role="tooltip"
	><span class="kicker">{kicker}</span><span class="title">{title}</span
	>{#each lines as line (line)}<span class="line">{line}</span>{/each}</FloatingCard
>

<style>
	.kicker {
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.title {
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.line {
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
</style>
