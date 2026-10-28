<script lang="ts">
	// The groups of a page in its facet column, a way to each (Bronnen, Gevolgd, a bundel's
	// page): one list in the frame's left column, its first line on the line of the first
	// group's heading, under its rule (Sectie: 2 px and --s-3). Not on a phone, not on paper.
	let {
		kop = null,
		items,
		zonderAdres = false
	}: {
		/** A heading over the list, where the page has one: `Gevolgd`. */
		kop?: string | null;
		/** Each group: its name and the id of its heading. */
		items: { label: string; id: string }[];
		/** Jump without changing the address: where its fragment holds the page (a shared
		 *  bundel, `#m=…`). */
		zonderAdres?: boolean;
	} = $props();

	/** The group whose heading the page has scrolled to: the last one at or above the top. */
	let here = $state<string | null>(null);
	const TOP = 120;
	function findHere() {
		let current = items[0]?.id ?? null;
		for (const item of items) {
			const el = document.getElementById(item.id);
			if (el && el.getBoundingClientRect().top <= TOP) current = item.id;
		}
		here = current;
	}
	$effect(() => {
		findHere();
		let frame = 0;
		const onMove = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(findHere);
		};
		// A reader scrolls inside a pane, not the window: the capture phase hears either.
		window.addEventListener('scroll', onMove, { capture: true, passive: true });
		window.addEventListener('resize', onMove);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', onMove, { capture: true });
			window.removeEventListener('resize', onMove);
		};
	});

	function spring(e: MouseEvent, id: string) {
		if (!zonderAdres) return;
		e.preventDefault();
		document.getElementById(id)?.scrollIntoView();
	}
</script>

<nav class="opzij" aria-label="Inhoud">
	{#if kop}<h2 class="opzij__kop">{kop}</h2>{/if}
	<ul>
		{#each items as item (item.id)}
			<li>
				<a
					href="#{item.id}"
					aria-current={here === item.id ? 'location' : undefined}
					onclick={(e) => spring(e, item.id)}>{item.label}</a
				>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.opzij {
		padding-top: calc(var(--s-3) + 2px);
	}
	.opzij__kop {
		margin: 0 0 var(--s-2);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--t-meta);
	}
	li {
		padding: 2px 0;
	}
	a {
		display: block;
		padding-left: var(--s-2);
		color: var(--ink-2);
		text-decoration: none;
	}
	a:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	/* Hier: where the page stands, in ink with a line of 2px at the left (DS Inhoudsopgave). */
	a[aria-current='location'] {
		color: var(--ink);
		box-shadow: inset 2px 0 0 var(--ink);
	}
	@media (max-width: 768px) {
		.opzij {
			display: none;
		}
	}
	@media print {
		.opzij {
			display: none;
		}
	}
</style>
