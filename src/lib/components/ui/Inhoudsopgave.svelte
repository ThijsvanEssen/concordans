<script lang="ts">
	// The groups of a page in its facet column, a way to each (Bronnen, Gevolgd, a bundel's
	// page): one list in the frame's left column, its first line on the line of the first
	// group's heading, under its rule (Sectie: 2 px and --s-3). Not on a phone, not on paper.
	let {
		label,
		kop = null,
		items,
		zonderAdres = false
	}: {
		/** What the list is, for a screen reader: `Groepen van bronnen`. */
		label: string;
		/** A heading over the list, where the page has one: `Gevolgd`. */
		kop?: string | null;
		/** Each group: its name and the id of its heading. */
		items: { label: string; id: string }[];
		/** Jump without changing the address: where its fragment holds the page (a shared
		 *  bundel, `#m=…`). */
		zonderAdres?: boolean;
	} = $props();

	function spring(e: MouseEvent, id: string) {
		if (!zonderAdres) return;
		e.preventDefault();
		document.getElementById(id)?.scrollIntoView();
	}
</script>

<nav class="opzij" aria-label={label}>
	{#if kop}<h2 class="opzij__kop">{kop}</h2>{/if}
	<ul>
		{#each items as item (item.id)}
			<li><a href="#{item.id}" onclick={(e) => spring(e, item.id)}>{item.label}</a></li>
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
		color: var(--ink-2);
		text-decoration: none;
	}
	a:hover {
		color: var(--ink);
		text-decoration: underline;
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
