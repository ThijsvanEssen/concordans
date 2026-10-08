<script lang="ts">
	// The band "Behoort bij" above every reader (docs/hierarchie.md, "Kern of context"): the
	// kern as lines, a legal term and the bronnen it names as links (Procesgang, Ingediend bij,
	// Wet); under them the groups of the context with their counts, each listed when it is
	// opened. Same place, same terms for every kind of bron (Thijs, 9 Oct). It reads the light
	// node the reader has asked already, so the first paint never waits for it; a line that
	// needs more (the instances before the eerdere aanleg) fills in when its answer comes, a
	// group asks its rows only when it is opened. On a phone the first line shows, the rest
	// folds open, in the short names of its bronnen (Awb, Rb. Den Haag 2015), wrapping rather
	// than cut. Type follows docs/typografie.md: the term rung 6, a bron rung 4.
	import { getNodeFirst } from '$lib/api/records';
	import { getBuckets, type NodeGraph } from '$lib/api/nodes';
	import type { GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import { formatCount } from '$lib/verbonden/filter';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { behoort, heeftIets, laagVan, type Groep, type Laag } from './behoort';

	let { node }: { node: GraphNode } = $props();

	const id = $derived(node.id);
	let light = $state<NodeGraph | null>(null);
	$effect(() => {
		const { collection, key } = node;
		void id;
		light = null;
		let gone = false;
		getNodeFirst(collection, key)
			.then((r) => {
				if (!gone) light = r;
			})
			.catch(() => {});
		return () => {
			gone = true;
		};
	});

	const band = $derived(
		behoort(node.collection, (node.raw?.props ?? {}) as Record<string, unknown>, light)
	);

	// A line that needs more than the light node: its full form once it has come.
	let vol = $state<Record<string, Laag[]>>({});
	$effect(() => {
		void id;
		vol = {};
	});
	$effect(() => {
		const voor = id;
		const controller = new AbortController();
		for (const r of band.regels) {
			if (!r.laad) continue;
			r.laad(controller.signal)
				.then((lagen) => {
					if (voor === id) vol = { ...vol, [r.id]: lagen };
				})
				.catch(() => {});
		}
		return () => controller.abort();
	});
	const regels = $derived(band.regels.map((r) => ({ ...r, lagen: vol[r.id] ?? r.lagen })));

	// A group's rows, asked when it is opened; one list open at a time.
	let open = $state<string | null>(null);
	let rijen = $state<Record<string, Laag[] | 'laden' | 'fout'>>({});
	$effect(() => {
		void id;
		open = null;
		rijen = {};
	});
	/** The most rows a group lists here; Verbonden has them all. */
	const TOON = 50;
	function toggle(g: Groep, soort: string) {
		if (open === g.id) {
			open = null;
			return;
		}
		open = g.id;
		if (rijen[g.id] && rijen[g.id] !== 'fout') return;
		rijen = { ...rijen, [g.id]: 'laden' };
		const voor = id;
		const laden = g.laad
			? g.laad()
			: g.bak
				? getBuckets(node.collection, node.key, [g.bak]).then((ns) =>
						ns.map((n) => laagVan(n, soort))
					)
				: Promise.resolve([]);
		laden
			.then((ls) => {
				if (voor === id) rijen = { ...rijen, [g.id]: ls.slice(0, TOON) };
			})
			.catch(() => {
				if (voor === id) rijen = { ...rijen, [g.id]: 'fout' };
			});
	}

	// On a phone the band is its first line until it is opened.
	let uit = $state(false);
	$effect(() => {
		void id;
		uit = false;
	});

	const groepen = $derived([...band.naast, ...band.onder]);
	const verborgen = $derived(regels.length - 1 + groepen.length);
	// The fold button on a phone: the one group by its name where the line has room for it.
	const knop = $derived(
		regels.length === 0 && groepen.length === 1
			? groepen[0].label
			: regels.length > 1
				? 'Meer'
				: `${groepen.length} ${groepen.length === 1 ? 'groep' : 'groepen'}`
	);
</script>

{#snippet naam(laag: Laag)}<span class="vol">{laag.naam}</span>{#if laag.kort}<span class="kort"
			>{laag.kort}</span
		>{/if}{/snippet}

{#snippet meer()}
	{#if verborgen > 0}
		<button type="button" class="meer btn is-text" aria-expanded={uit} onclick={() => (uit = !uit)}
			>{knop}<Caret open={uit} /></button
		>
	{/if}
{/snippet}

{#if heeftIets(band)}
	<nav class="behoort" class:uit aria-label="Behoort bij">
		{#if regels.length > 0}
			<dl class="regels">
				{#each regels as r, i (r.id)}
					<div class="regel">
						<dt class="term">{r.label}</dt>
						<dd>
							<ol class="lagen">
								{#each r.lagen as laag, j (j)}
									<li class:huidig={laag.huidig}>
										{#if laag.ref}<a
												href={bronHref(laag.ref, { at: laag.at })}
												title={`${laag.soort}: ${laag.vol ?? laag.naam}`}>{@render naam(laag)}</a
											>{:else}<span title={laag.soort}>{@render naam(laag)}</span>{/if}
									</li>
								{/each}
							</ol>
							{#if i === 0}{@render meer()}{/if}
						</dd>
					</div>
				{/each}
			</dl>
		{:else}
			<div class="regel">{@render meer()}</div>
		{/if}
		{#if groepen.length > 0}
			<div class="groepen">
				{#each groepen as g (g.id)}
					<div class="groep">
						<button
							type="button"
							class="groep-kop"
							aria-expanded={open === g.id}
							onclick={() => toggle(g, g.label)}
						>
							{g.label}{#if g.aantal != null}<span class="aantal">{formatCount(g.aantal)}</span
								>{/if}<Caret open={open === g.id} />
						</button>
						{#if open === g.id}
							{@const r = rijen[g.id]}
							{#if r === 'laden' || r === undefined}
								<p class="stil">Laden…</p>
							{:else if r === 'fout'}
								<p class="stil">Kon niet worden geladen.</p>
							{:else if r.length === 0}
								<p class="stil">Niets in deze groep.</p>
							{:else}
								<ul class="rijen">
									{#each r as laag, i (i)}
										<li>
											{#if laag.ref}<a href={bronHref(laag.ref)} title={laag.vol}>{laag.naam}</a
												>{:else}{laag.naam}{/if}
										</li>
									{/each}
								</ul>
								{#if g.aantal != null && g.aantal > r.length}
									<p class="stil">
										{formatCount(r.length)} van {formatCount(g.aantal)}; alle in Verbonden.
									</p>
								{/if}
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</nav>
{/if}

<style>
	.behoort {
		margin: 0 0 var(--s-4);
		padding: 0 0 var(--s-3);
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The term at rung 6, the bronnen at rung 4 (docs/typografie.md). */
	.regels {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-1) var(--s-3);
		margin: 0;
	}
	.regel {
		display: contents;
	}
	.regels > .regel > dt,
	.regels > .regel > dd {
		margin: 0;
		min-width: 0;
	}
	.term {
		padding-top: 2px;
		color: var(--ink-3);
	}
	.regels dd {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
	}
	.lagen {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
		margin: 0;
		padding: 0;
		list-style: none;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.lagen li + li::before {
		content: '›';
		margin-right: var(--s-1);
		color: var(--ink-3);
	}
	.lagen .huidig {
		color: var(--ink-2);
		font-style: italic;
	}
	.lagen a,
	.rijen a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
		overflow-wrap: anywhere;
	}
	.lagen a:hover,
	.rijen a:hover {
		text-decoration-color: var(--ink);
	}
	.kort {
		display: none;
	}
	.meer {
		display: none;
		margin-left: auto;
		flex: none;
		white-space: nowrap;
	}
	.groepen {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin-top: var(--s-2);
	}
	.groep {
		min-width: 0;
	}
	.groep:has(.rijen),
	.groep:has(.stil) {
		flex-basis: 100%;
	}
	.groep-kop {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-1);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-2);
		cursor: pointer;
	}
	.groep-kop:hover {
		color: var(--ink);
	}
	.aantal {
		color: var(--ink-3);
	}
	.rijen {
		margin: var(--s-1) 0 0;
		padding: 0 0 0 var(--s-3);
		list-style: none;
		display: grid;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
	}
	.stil {
		margin: var(--s-1) 0 0;
		color: var(--ink-3);
	}
	/* A phone: the first line, the rest once it is opened. */
	@media (max-width: 768px) {
		.meer {
			display: inline-flex;
		}
		.behoort:not(.uit) .groepen,
		.behoort:not(.uit) .regels > .regel:not(:first-child) {
			display: none;
		}
		.behoort:not(.uit) .lagen {
			flex: 1 1 auto;
		}
		.behoort:not(.uit) li:has(.kort) .vol {
			display: none;
		}
		.behoort:not(.uit) .kort {
			display: inline;
		}
	}
</style>
