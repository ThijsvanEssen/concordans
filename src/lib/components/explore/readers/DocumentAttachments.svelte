<script lang="ts">
	import { textOf } from '$lib/text/words';
	// The bijlagen of a stuk in its status line (concept 21: "de bijlagen gaan in de
	// statusregel"): "Bijlagen 15" as FoldButton, the fold of every heading; opened, the list under the line, asked then
	// (ACCOMPANIES inbound, one request). Verbonden has them all.
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { isOpen } from '$lib/components/ui/dicht.svelte';
	import { untrack } from 'svelte';
	import { getBuckets } from '$lib/api/nodes';
	import { layerOf, type Layer } from '$lib/bron/behoort-layer';
	import { bronHref } from '$lib/bron/href';
	import { formatCount } from '$lib/text/getal';
	import type { Collection } from '$lib/vocabulary';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { createLoader, type LoadState as State } from '$lib/util/load.svelte';

	let { collection, bronKey, aantal }: { collection: Collection; bronKey: string; aantal: number } =
		$props();

	/** The most rows listed here. */
	const SHOW = 50;
	/** Kept per kind in this browser, closed until the reader opens it (dicht.svelte.ts). */
	const FOLD_KEY = 'bijlagen';
	const open = $derived(isOpen(FOLD_KEY, false));
	let rows = $state.raw<State<Layer[]> | null>(null);
	const attachments = createLoader(
		(key: string, signal: AbortSignal) =>
			getBuckets(
				collection,
				key,
				[{ relation: 'ACCOMPANIES', direction: 'inbound', collection: 'documents' }],
				signal
			).then((ns) =>
				// A bijlage carries the title of its bill; its own name is its subject ("Advies
				// Politie"), as the source gives it.
				ns.slice(0, SHOW).map((n) => {
					const l = layerOf(n, 'Bijlage');
					const subject = textOf((n.props as Record<string, unknown> | undefined)?.subject);
					return subject ? { ...l, naam: subject, vol: l.vol ?? l.naam } : l;
				})
			),
		(s) => (rows = s),
		'Bijlagen'
	);
	// Another stuk: its bijlagen are not these.
	$effect(() => {
		void bronKey;
		rows = null;
		return attachments.stop;
	});
	// Opened (or opened already for this kind): asked now, once.
	$effect(() => {
		const key = bronKey;
		if (!open) return;
		untrack(() => {
			if (!rows || rows.status === 'error') attachments.load(key);
		});
	});
</script>

<span class="bijlagen">
	<FoldButton sleutel={FOLD_KEY} {open}
		>Bijlagen <span class="aantal">{formatCount(aantal)}</span></FoldButton
	>
	{#if open}
		<div class="lijst">
			<LoadState
				state={rows ?? { status: 'loading' }}
				what="De bijlagen"
				plural
				retry={attachments.retry}
			>
				{#snippet children(rows)}
					<ul>
						{#each rows as r, i (i)}
							<li>
								{#if r.ref}<a href={bronHref(r.ref)} title={r.vol}>{r.naam}</a>{:else}{r.naam}{/if}
							</li>
						{/each}
					</ul>
					{#if aantal > rows.length}
						<p class="stil">
							{formatCount(rows.length)} van {formatCount(aantal)}; alle in Verbonden.
						</p>
					{/if}
				{/snippet}
			</LoadState>
		</div>
	{/if}
</span>

<style>
	/* Its button among the words of the status line, its list on a line of its own under it. */
	.bijlagen {
		display: contents;
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
		padding: var(--s-1) 0;
	}
	li a {
		color: var(--ink);
		text-decoration: none;
	}
	li a:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>
