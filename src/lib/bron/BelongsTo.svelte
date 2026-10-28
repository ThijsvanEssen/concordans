<script lang="ts">
	// The band "Behoort bij" above every reader (docs/hierarchie.md, "Kern of context"): the
	// kern as lines, a legal term and the bronnen it names as links (Procesgang, Ingediend bij,
	// Wet); under them the groups of the context with their counts, each listed when it is
	// opened. Same place, same terms for every kind of bron (Thijs, 9 Oct). It reads the light
	// node the reader has asked already, so the first paint never waits for it; a line that
	// needs more (the instances before the eerdere aanleg) fills in when its answer comes, a
	// group asks its rows only when it is opened. On a phone the first line shows, the rest
	// folds open, in the short names of its bronnen (Awb, Rb. Den Haag 2015), wrapping rather
	// than cut. Type follows docs/typografie.md: the term rung 6, a bron rung 4. One instance
	// per bron (BehoortBij keys it), so all it holds starts closed and empty with the next one.
	import { count } from '$lib/text/words';
	import { untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { getNodeFirst } from '$lib/api/records';
	import { report } from '$lib/api/errors';
	import { getBuckets, type NodeGraph } from '$lib/api/nodes';
	import type { GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import { sourceOfCollection } from '$lib/nav/sources';
	import { formatCount } from '$lib/text/getal';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { behoort, heeftIets } from './behoort';
	import { layerOf, type Groep, type Layer } from '$lib/bron/behoort-layer';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { createLoader, type LoadState as State } from '$lib/util/load.svelte';

	let {
		node,
		onHas
	}: {
		node: GraphNode;
		/** Told once the band has its lines in: whether there is anything to show. */
		onHas?: (heeft: boolean) => void;
	} = $props();

	// The light node of this bron, kept while the reader's node is replaced under the same id
	// (its head, its light node, the canvas's): the band stands once, in its final form, not
	// first without its law and unfolded over two lines. `r: null`: asked, none came.
	let lichtHier = $state<{ r: NodeGraph | null } | null>(null);
	const { collection, key } = untrack(() => node);
	getNodeFirst(collection, key)
		.then((r) => (lichtHier = { r }))
		.catch((e) => {
			report('Behoort bij', e);
			lichtHier = { r: null };
		});

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
	let vol = $state<Record<string, Layer[]>>({});
	// A line whose `laad` failed: it stands as the light node gives it, marked incomplete, so a
	// procesgang cut short by a time-out does not pass for a whole one.
	let onvolledig = $state<Record<string, boolean>>({});
	$effect(() => {
		// Asked once the light node is in: a line built before it (no Kamer from its label yet)
		// would stand for a moment with an answer the band then replaces.
		if (!lichtHier) return;
		const controller = new AbortController();
		for (const r of band.regels) {
			if (!r.laad) continue;
			r.laad(controller.signal)
				.then((lagen) => {
					vol = { ...vol, [r.id]: lagen };
				})
				.catch((e) => {
					if (controller.signal.aborted) return;
					report('Behoort bij', e);
					vol = { ...vol, [r.id]: r.lagen };
					onvolledig = { ...onvolledig, [r.id]: true };
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

	$effect(() => {
		if (lichtHier && !wacht) onHas?.(heeftIets(band));
	});

	// A group's rows, asked when it is opened; one list open at a time.
	let open = $state<string | null>(null);
	let rijen = $state<Record<string, State<Layer[]>>>({});
	// The group whose rows are asked: one at a time, a new one aborts the last.
	let askedId: string | null = null;
	const groupLoader = createLoader(
		(g: Groep, signal: AbortSignal) =>
			getBuckets(node.collection, node.key, [g.bak], signal).then((ns) =>
				ns.slice(0, TOON).map((n) => layerOf(n, g.label))
			),
		(s) => {
			if (askedId) rijen = { ...rijen, [askedId]: s };
		},
		'Behoort bij'
	);
	$effect(() => groupLoader.stop);
	/** The most rows a group lists here; Verbonden has them all. */
	const TOON = 50;
	function laad(g: Groep) {
		askedId = g.id;
		groupLoader.load(g);
	}
	function toggle(g: Groep) {
		if (open === g.id) {
			open = null;
			return;
		}
		open = g.id;
		if (rijen[g.id]?.status !== 'ready') laad(g);
	}

	// A chain of more than three layers shows its first and last, the middle as "…" until it
	// is opened (Thijs, 10 Oct: the band "te groot", over three lines); three stand whole, as
	// the kruimelpad of the mockups V1 (Thijs, 22 Oct).
	let ontvouwd = $state<Record<string, boolean>>({});
	// Side by side (the fracties of a lid) it folds on a phone from three on: its lines stand a
	// finger's 44 px apart there, and the name must come first (E8, N9).
	const phone = new MediaQuery('max-width: 768px');
	const gevouwen = (r: { id: string; los?: boolean; lagen: Layer[] }) =>
		!ontvouwd[r.id] && (r.los ? phone.current && r.lagen.length > 2 : r.lagen.length > 3);

	// On a phone the band is its first line until it is opened.
	let uit = $state(false);

	// The band opens with the soort of the top navigation, as a breadcrumb does: Wetten ›.
	const source = $derived(sourceOfCollection(node.collection, node.raw?.props));
	const groepen = $derived(band.onder);
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

{#snippet naam(laag: Layer)}<span class="vol">{laag.naam}</span>{#if laag.kort}<span class="kort"
			>{laag.kort}</span
		>{/if}{/snippet}

<!-- How an instance ended, after its name and outside its link: `, cassatie verworpen`. -->
{#snippet uitkomst(laag: Layer)}{#if laag.uitkomst}<span class="uitkomst">, {laag.uitkomst}</span
		>{/if}{/snippet}

{#snippet crumb()}<a class="soort raakvlak" href={source.href}>{source.label}</a><span
		class="scheiding"
		aria-hidden="true">›</span
	>{/snippet}

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
						{#if i === 0}{@render crumb()}{/if}
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
													class="raakvlak"
													href={bronHref(laag.ref, { at: laag.at })}
													title={`${laag.soort}: ${laag.vol ?? laag.naam}`}>{@render naam(laag)}</a
												>{:else}<span title={laag.soort}>{@render naam(laag)}</span
												>{/if}{@render uitkomst(laag)}
										</li>
									{/if}
								{/each}
							</ol>
							{#if onvolledig[r.id]}<span
									class="onvolledig"
									title="Niet alles van deze regel kon worden geladen">onvolledig</span
								>{/if}
							{#if i === 0}{@render meer()}{/if}
						</dd>
					</div>
				{/each}
			</dl>
		{:else}
			<div class="regel">{@render crumb()}{@render meer()}</div>
		{/if}
		{#if groepen.length > 0}
			<div class="groepen">
				{#each groepen as g (g.id)}
					<div class="groep">
						<button
							type="button"
							class="groep-kop raakvlak"
							aria-expanded={open === g.id}
							onclick={() => toggle(g)}
						>
							{g.label}{#if g.aantal != null}<span class="aantal">{formatCount(g.aantal)}</span
								>{/if}<Caret open={open === g.id} />
						</button>
						{#if open === g.id}
							<LoadState
								state={rijen[g.id] ?? { status: 'loading' }}
								what="Deze groep"
								retry={() => laad(g)}
							>
								{#snippet empty()}
									<p class="stil">Niets in deze groep.</p>
								{/snippet}
								{#snippet children(r)}
									<ul class="rijen">
										{#each r as laag, i (i)}
											<li>
												{#if laag.ref}<a class="raakvlak" href={bronHref(laag.ref)} title={laag.vol}
														>{laag.naam}</a
													>{:else}{laag.naam}{/if}
											</li>
										{/each}
									</ul>
									{#if g.aantal != null && g.aantal > r.length}
										<p class="stil">
											{formatCount(r.length)} van {formatCount(g.aantal)}; alle in Verbonden.
										</p>
									{/if}
								{/snippet}
							</LoadState>
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
	/* The soort first, a link in ink-2 as the layers are, then the ›. */
	.soort {
		flex: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: var(--onderstreping-krap);
	}
	.soort:hover {
		text-decoration-color: var(--ink);
	}
	.scheiding {
		flex: none;
		color: var(--ink-3);
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
		/* The kruimelpad of the mockups V1: small, quiet, its links in ink without a line. */
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
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
		overflow-x: clip;
		overflow-y: visible;
		text-overflow: ellipsis;
	}
	.vouw button {
		padding: 0 var(--s-1);
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	/* The "…" between two links: 44 px wide for a finger, so its target is its own. */
	@media (pointer: coarse), (max-width: 768px) {
		.vouw button {
			min-width: var(--veld-h-raak);
		}
	}
	/* On a touch screen and below 768 every link and button of the band has the shared target (.raakvlak,
	   lib/styles/basis.css), and its lines stand a finger's 44 px apart (--veld-h-raak), so
	   those targets do not meet: a line's height and the gap under it make the row. Between
	   lines of two sizes (a line and the groups, a group and its rows) the next step. */
	@media (pointer: coarse), (max-width: 768px) {
		.regels,
		.rijen {
			gap: calc(var(--veld-h-raak) - 1lh);
		}
		.lagen,
		.groepen {
			row-gap: calc(var(--veld-h-raak) - 1lh);
		}
		.groepen,
		.rijen {
			margin-top: var(--s-6);
		}
	}
	.vouw button:hover,
	.vouw button:focus-visible {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: var(--onderstreping);
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
	.onvolledig {
		white-space: nowrap;
		font-style: italic;
		color: var(--ink-3);
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
	.lagen a {
		color: var(--ink);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.lagen a:hover,
	.lagen a:focus-visible {
		text-decoration-line: underline;
		text-underline-offset: var(--onderstreping);
	}
	.rijen a {
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: var(--onderstreping-krap);
		overflow-wrap: anywhere;
	}
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
	/* Wide: a chain is one line (T6), each layer cut at its end rather than the chain wrapping;
	   the full name is in the title. Side by side (los) it wraps, as it is a list. */
	@media (min-width: 769px) {
		.lagen:not(.los) {
			flex-wrap: nowrap;
			white-space: nowrap;
		}
		.lagen:not(.los) li {
			min-width: 0;
			overflow-x: clip;
			overflow-y: visible;
			text-overflow: ellipsis;
		}
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
		/* Folded, a layer that does not fit goes to the next line whole (UX-toets B4). */
		.behoort:not(.uit) .lagen.gevouwen {
			flex-wrap: wrap;
		}
		.behoort:not(.uit) li:has(.kort) .vol {
			display: none;
		}
		.behoort:not(.uit) .kort {
			display: inline;
		}
	}
</style>
