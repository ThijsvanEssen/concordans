<script lang="ts">
	import { count } from '$lib/text/words';
	// The band "Behoort bij" above every reader (docs/hierarchie.md, "Kern of context"): the
	// kern as lines, a legal term and the bronnen it names as links (Procesgang, Ingediend bij,
	// Wet); under them the groups of the context with their counts, each listed when it is
	// opened. Same place, same terms for every kind of bron (Thijs, 9 Oct). It reads the light
	// node the reader has asked already, so the first paint never waits for it; a line that
	// needs more (the instances before the eerdere aanleg) fills in when its answer comes, a
	// group asks its rows only when it is opened. On a phone the first line shows, the rest
	// folds open, in the short names of its bronnen (Awb, Rb. Den Haag 2015), wrapping rather
	// than cut. Type follows docs/typografie.md: the term rung 6, a bron rung 4.
	import { untrack } from 'svelte';
	import { getNodeFirst } from '$lib/api/records';
	import { getBuckets, type NodeGraph } from '$lib/api/nodes';
	import type { GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import { formatCount } from '$lib/text/getal';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { behoort, heeftIets, laagVan, type Groep, type Laag } from './behoort';

	let { node }: { node: GraphNode } = $props();

	const id = $derived(node.id);
	// The light node of this bron, kept while the reader's node is replaced under the same id
	// (its head, its light node, the canvas's): the band stands once, in its final form, not
	// first without its law and unfolded over two lines. `null` as answer: asked, none came.
	let light = $state<{ id: string; r: NodeGraph | null } | null>(null);
	$effect(() => {
		const voor = id;
		const { collection, key } = untrack(() => node);
		let gone = false;
		getNodeFirst(collection, key)
			.then((r) => {
				if (!gone) light = { id: voor, r };
			})
			.catch(() => {
				if (!gone) light = { id: voor, r: null };
			});
		return () => {
			gone = true;
		};
	});
	const lichtHier = $derived(light?.id === id ? light : null);

	// The props of the light node under those of the reader's node: a head built from the
	// bron's detail lacks some (an article's breadcrumb).
	const band = $derived(
		behoort(
			node.collection,
			{
				...((lichtHier?.r?.node.props ?? {}) as Record<string, unknown>),
				...((node.raw?.props ?? {}) as Record<string, unknown>)
			},
			lichtHier?.r ?? null
		)
	);

	// A line that needs more than the light node: its full form once it has come.
	let vol = $state<Record<string, Laag[]>>({});
	$effect(() => {
		void id;
		vol = {};
	});
	$effect(() => {
		const voor = id;
		// Asked once the light node is in: a line built before it (no Kamer from its label yet)
		// would stand for a moment with an answer the band then replaces.
		if (!lichtHier) return;
		const controller = new AbortController();
		for (const r of band.regels) {
			if (!r.laad) continue;
			r.laad(controller.signal)
				.then((lagen) => {
					if (voor === id) vol = { ...vol, [r.id]: lagen };
				})
				.catch(() => {
					// Failed: the line as the light node gives it.
					if (voor === id && !controller.signal.aborted) vol = { ...vol, [r.id]: r.lagen };
				});
		}
		return () => controller.abort();
	});
	// The band waits for its lines in full (the instances before the eerdere aanleg), so it
	// stands once, folded, instead of two layers over two lines first.
	const wacht = $derived(band.regels.some((r) => r.laad && !(r.id in vol)));
	// A line that waits on its `laad` (Bij wetsvoorstel) stands once it has a layer.
	const regels = $derived(
		band.regels.map((r) => ({ ...r, lagen: vol[r.id] ?? r.lagen })).filter((r) => r.lagen.length)
	);

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

	// A chain of more than two layers shows its first and last, the middle as "…" until it
	// is opened (Thijs, 10 Oct: the band "te groot", over three lines).
	let ontvouwd = $state<Record<string, boolean>>({});
	$effect(() => {
		void id;
		ontvouwd = {};
	});
	const gevouwen = (r: { id: string; los?: boolean; lagen: Laag[] }) =>
		!r.los && r.lagen.length > 2 && !ontvouwd[r.id];

	// On a phone the band is its first line until it is opened.
	let uit = $state(false);
	$effect(() => {
		void id;
		uit = false;
	});

	const groepen = $derived([...band.naast, ...band.onder]);
	// What the phone's first line folds away: the lines after it and the groups; with no line
	// at all (a kabinet), the groups behind the button alone.
	const verborgen = $derived(Math.max(regels.length - 1, 0) + groepen.length);
	// The fold button on a phone: the one group by its name where the line has room for it.
	const knop = $derived(
		regels.length === 0 && groepen.length === 1
			? groepen[0].label
			: regels.length > 1
				? 'Meer'
				: count(groepen.length, 'groep', 'groepen')
	);
</script>

{#snippet naam(laag: Laag)}<span class="vol">{laag.naam}</span>{#if laag.kort}<span class="kort"
			>{laag.kort}</span
		>{/if}{/snippet}

<!-- How an instance ended, after its name and outside its link: `, cassatie verworpen`. -->
{#snippet uitkomst(laag: Laag)}{#if laag.uitkomst}<span class="uitkomst">, {laag.uitkomst}</span
		>{/if}{/snippet}

{#snippet meer()}
	{#if verborgen > 0}
		<button
			type="button"
			class="uitklap-knop btn is-text"
			aria-expanded={uit}
			onclick={() => (uit = !uit)}>{knop}<Caret open={uit} /></button
		>
	{/if}
{/snippet}

<!-- Drawn once its light node and its lines have answered: the reader keeps a line for it
     (ReaderFrame). -->
{#if lichtHier && !wacht && heeftIets(band)}
	<nav class="behoort" class:uit class:zonder-kern={regels.length === 0} aria-label="Behoort bij">
		{#if regels.length > 0}
			<dl class="regels">
				{#each regels as r, i (r.id)}
					<div class="regel">
						<dt class="term">{r.label}</dt>
						<dd>
							<ol class="lagen" class:los={r.los} class:gevouwen={gevouwen(r)}>
								{#each r.lagen as laag, j (j)}
									{#if gevouwen(r) && j === 1}
										<li class="vouw">
											<button
												class="raakvlak"
												type="button"
												title={r.lagen
													.slice(1, -1)
													.map((l) => l.naam)
													.join(' › ')}
												aria-label="Alle lagen tonen: {r.lagen
													.slice(1, -1)
													.map((l) => l.naam)
													.join(', ')}"
												onclick={() => (ontvouwd = { ...ontvouwd, [r.id]: true })}>…</button
											>
										</li>
									{/if}
									{#if !gevouwen(r) || j === 0 || j === r.lagen.length - 1}
										<li class:huidig={laag.huidig} class:laatst={j === r.lagen.length - 1}>
											{#if laag.ref}<a
													href={bronHref(laag.ref, { at: laag.at })}
													title={`${laag.soort}: ${laag.vol ?? laag.naam}`}>{@render naam(laag)}</a
												>{:else}<span title={laag.soort}>{@render naam(laag)}</span
												>{/if}{@render uitkomst(laag)}
										</li>
									{/if}
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The term at rung 6, the bronnen at rung 4 (docs/typografie.md). */
	/* Each line: its term in ink-3 straight before what it names, no column of terms
	   (Thijs, 10 Oct: "onnodig veel ruimte na 'Wet'"). */
	.regels {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: 0;
	}
	.regel {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		min-width: 0;
	}
	.regels > .regel > dt,
	.regels > .regel > dd {
		margin: 0;
		min-width: 0;
	}
	.term {
		padding: 0;
		white-space: nowrap;
		color: var(--ink-3);
	}
	.regels dd {
		flex: 1;
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
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	/* Folded: one line, the last layer cut at the right rather than wrapping. */
	/* Cut at the side only (clip): a finger's target of the "…" stands above and below the
	   line (.raakvlak), and `hidden` would cut it there too. */
	.lagen.gevouwen {
		flex-wrap: nowrap;
		white-space: nowrap;
		overflow-x: clip;
		overflow-y: visible;
	}
	.lagen.gevouwen .laatst {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.vouw button {
		padding: 0 2px;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	.vouw button:hover,
	.vouw button:focus-visible {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.lagen li + li::before {
		content: '›';
		margin-right: var(--s-1);
		color: var(--ink-3);
	}
	/* Side by side, not a chain: the fracties of a lid. */
	.lagen.los li:not(:last-child)::after {
		content: ';';
		color: var(--ink-3);
	}
	.lagen.los li + li::before {
		content: none;
	}
	/* The outcome is the source's word, upright beside "deze uitspraak" too. */
	.lagen .uitkomst {
		font-style: normal;
		color: var(--ink-2);
	}
	.lagen .huidig {
		color: var(--ink-2);
		font-style: italic;
	}
	.lagen a,
	.rijen a {
		color: var(--ink-2);
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
	.uitklap-knop {
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
		/* Without a kern line (a kabinet) a phone shows no band: its groups are in Verbonden. */
		.behoort.zonder-kern {
			display: none;
		}
		.uitklap-knop {
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
