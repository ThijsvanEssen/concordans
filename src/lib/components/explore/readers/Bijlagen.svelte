<script lang="ts">
	// The bijlagen of a stuk in its status line (concept 21: "de bijlagen gaan in de
	// statusregel"): "Bijlagen 15" with a caret; opened, the list under the line, asked then
	// (ACCOMPANIES inbound, one request). Verbonden has them all.
	import Caret from '$lib/components/ui/Caret.svelte';
	import { getBuckets } from '$lib/api/nodes';
	import { laagVan, type Laag } from '$lib/bron/behoort';
	import { bronHref } from '$lib/bron/href';
	import { formatCount } from '$lib/verbonden/filter';
	import type { Collection } from '$lib/vocabulary';

	let { collection, bronKey, aantal }: { collection: Collection; bronKey: string; aantal: number } =
		$props();

	/** The most rows listed here. */
	const TOON = 50;
	let open = $state(false);
	let rijen = $state<Laag[] | 'laden' | 'fout' | null>(null);
	$effect(() => {
		void bronKey;
		open = false;
		rijen = null;
	});

	function wissel() {
		open = !open;
		if (!open || (rijen && rijen !== 'fout')) return;
		rijen = 'laden';
		const voor = bronKey;
		getBuckets(collection, bronKey, [
			{ relation: 'ACCOMPANIES', direction: 'inbound', collection: 'documents' }
		])
			.then((ns) => {
				if (voor !== bronKey) return;
				// A bijlage carries the title of its bill; its own name is its subject ("Advies
				// Politie"), as the source gives it.
				rijen = ns.slice(0, TOON).map((n) => {
					const l = laagVan(n, 'Bijlage');
					const onderwerp = (n.props as Record<string, unknown> | undefined)?.subject;
					return typeof onderwerp === 'string' && onderwerp.trim()
						? { ...l, naam: onderwerp.trim(), vol: l.vol ?? l.naam }
						: l;
				});
			})
			.catch(() => {
				if (voor === bronKey) rijen = 'fout';
			});
	}
</script>

<span class="bijlagen">
	<button type="button" class="knop" aria-expanded={open} onclick={wissel}
		>Bijlagen <span class="aantal">{formatCount(aantal)}</span><Caret {open} /></button
	>
	{#if open}
		<div class="lijst">
			{#if rijen === 'laden' || rijen === null}
				<p class="stil">Laden…</p>
			{:else if rijen === 'fout'}
				<p class="stil">Kon niet worden geladen.</p>
			{:else}
				<ul>
					{#each rijen as r, i (i)}
						<li>
							{#if r.ref}<a href={bronHref(r.ref)} title={r.vol}>{r.naam}</a>{:else}{r.naam}{/if}
						</li>
					{/each}
				</ul>
				{#if aantal > rijen.length}
					<p class="stil">
						{formatCount(rijen.length)} van {formatCount(aantal)}; alle in Verbonden.
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</span>

<style>
	/* Its button among the words of the status line, its list on a line of its own under it. */
	.bijlagen {
		display: contents;
	}
	.knop {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-1);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.knop:hover,
	.knop:focus-visible {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.aantal {
		color: var(--ink-3);
	}
	.lijst {
		flex-basis: 100%;
		order: 9;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		padding: 2px 0;
	}
	li a {
		color: var(--ink);
		text-decoration: none;
	}
	li a:hover {
		color: var(--accent);
	}
	.stil {
		margin: 0;
		color: var(--ink-3);
	}
</style>
