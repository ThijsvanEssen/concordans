<script lang="ts">
	// The filters of a list on a phone (Bladeren, Actueel, the overview of a topic): behind one
	// quiet line, Filter, opened in place. Open, they end in Toon with what the list holds
	// under them, which closes them and brings the list into view: the results never stay out of
	// sight under the open filters (besluit 30, X4). From 768 up the filters stand in their
	// column and neither line is there.
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';

	let {
		id,
		active = 0,
		label,
		list,
		open = $bindable(false),
		children
	}: {
		/** The id of the filters, for the button's aria-controls. */
		id: string;
		/** How many filters are on: after Filter, when there are. */
		active?: number;
		/** What Toon says: "Toon 55 moties", "Toon het overzicht". */
		label: string;
		/** The list the filters filter, brought into view by Toon. */
		list: () => HTMLElement | null | undefined;
		open?: boolean;
		children: Snippet;
	} = $props();

	async function showList() {
		open = false;
		await tick();
		const el = list();
		if (!el) return;
		el.scrollIntoView({ block: 'start' });
		if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
		el.focus({ preventScroll: true });
	}
</script>

<button
	type="button"
	class="verfijnen-knop"
	aria-expanded={open}
	aria-controls={id}
	onclick={() => (open = !open)}>Filter{active ? ` (${active})` : ''}</button
>
<div class="verfijnen" {id} class:is-open={open}>
	{@render children()}
	<button type="button" class="btn toon" onclick={showList}>{label}</button>
</div>

<style>
	.toon {
		display: none;
	}
	@media (max-width: 768px) {
		.verfijnen {
			display: none;
			padding-top: var(--s-3);
		}
		.verfijnen.is-open {
			display: block;
		}
		/* At the foot of the filters, also where they scroll on their own (Bladeren). */
		.toon {
			position: sticky;
			bottom: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			min-height: var(--veld-h-raak);
			margin-top: var(--s-3);
			background: var(--paper);
		}
	}
</style>
