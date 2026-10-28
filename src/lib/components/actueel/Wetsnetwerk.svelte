<script lang="ts">
	// The network of the last passed bill as a small sketch of the real one (the canvas of
	// Netwerk): the marks, colours and lines of its kinds, four bronnen on one chain. Each
	// bron opens itself; Open in netwerk opens the whole of it. A row on a wide screen, a
	// column on a phone; the lines are drawn between the marks as they stand.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { kindColour } from '$lib/bron/kleur';
	import { drawnLine } from '$lib/components/graph/drawn-line';
	import { DOT_RADIUS } from '$lib/graph/line-shape';
	import { langeDatum } from '$lib/text/datum';
	import { onMount } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
	import { kleineSchets, type Schets } from './wetsnetwerk';
	import { CHAMBER_NAME } from '$lib/components/parliamentary/chamber';

	let { schets }: { schets: Schets } = $props();

	const k = $derived(schets.kandidaat);
	const kaart = $derived(kleineSchets(schets));
	/** The radius of a mark's ring, where its lines stop. */
	const RING = 18;

	let root = $state<HTMLElement>();
	let lijnen = $state<ReturnType<typeof drawnLine>[]>([]);

	function meet() {
		if (!root) return;
		const o = root.getBoundingClientRect();
		const midden = (id: string) => {
			const r = root!
				.querySelector<HTMLElement>(`[data-bron="${CSS.escape(id)}"] .ring`)
				?.getBoundingClientRect();
			return r && { x: r.left + r.width / 2 - o.left, y: r.top + r.height / 2 - o.top };
		};
		lijnen = kaart.lijnen.flatMap((l) => {
			const a = midden(l.van);
			const b = midden(l.naar);
			return a && b
				? [
						drawnLine(a, b, {
							relation: l.relation,
							from: l.from,
							arrow: l.arrow,
							ra: RING,
							rb: RING
						})
					]
				: [];
		});
	}

	onMount(() => {
		const ro = new ResizeObserver(() => meet());
		if (root) ro.observe(root);
		return () => ro.disconnect();
	});
	$effect(() => {
		void kaart;
		afterTick(meet);
	});
</script>

<figure class="wetsnetwerk">
	<div class="veld" bind:this={root}>
		<svg class="lijnen" aria-hidden="true">
			{#each lijnen as l, i (i)}
				<path
					d={l.d}
					fill="none"
					stroke={l.colour}
					stroke-width={l.width}
					stroke-dasharray={l.dash}
					stroke-linecap={l.cap}
				/>
				{#if l.head}<polygon points={l.head} fill={l.colour} />{/if}
				{#if l.dot}<circle cx={l.dot.x} cy={l.dot.y} r={DOT_RADIUS} fill={l.colour} />{/if}
			{/each}
		</svg>
		<ol>
			{#each kaart.knopen as b (b.id)}
				<li data-bron={b.id}>
					<a class="knoop" href={b.href}>
						<span class="ring ring--{b.ring ?? 'geen'}" style:--kleur={kindColour(b.collection)}>
							<KindGlyph vorm={b.vorm} size={16} colour={kindColour(b.collection)} />
						</span>
						<span class="tekst">
							<span class="naam">{b.label}</span>
							{#if b.sub}<span class="sub">{b.sub}</span>{/if}
						</span>
					</a>
				</li>
			{/each}
		</ol>
	</div>
	<figcaption>
		<span>Aangenomen door de {CHAMBER_NAME[k.kamer]}, {langeDatum(k.datum)}</span>
		<a class="verkenner" href={schets.exploreHref}>Open in netwerk</a>
	</figcaption>
</figure>

<style>
	.wetsnetwerk {
		display: flex;
		flex-direction: column;
		margin: 0;
	}
	/* The sheet: the sketch in the middle of it, the caption at its foot. */
	.veld {
		position: relative;
		margin: auto 0;
	}
	.lijnen {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	ol {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		column-gap: var(--s-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.knoop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-2);
		color: var(--ink);
		text-align: center;
		text-decoration: none;
	}
	.ring {
		display: grid;
		place-items: center;
		width: calc(2 * 18px);
		height: calc(2 * 18px);
		border-radius: var(--r-rond);
	}
	/* The rings of the canvas: a dossier in a dashed ring of its colour, the articles of a
	   law in a ring of its colour on the second paper. */
	.ring--dossier {
		border: 1px dashed var(--kleur);
	}
	.ring--wet {
		border: 1px solid var(--kleur);
		background: var(--paper-2);
	}
	.tekst {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.naam {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		line-height: var(--lh-snug);
		overflow-wrap: anywhere;
	}
	.sub {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: var(--lh-snug);
		color: var(--ink-3);
		overflow-wrap: anywhere;
	}
	.knoop:hover .naam {
		text-decoration: underline;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2) var(--s-4);
		margin-top: var(--s-4);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.verkenner {
		font-weight: 600;
		color: var(--ink);
	}

	/* A phone: one bron a row, the marks in a column with the lines between them. */
	@media (max-width: 640px) {
		ol {
			grid-template-columns: minmax(0, 1fr);
			row-gap: var(--s-4);
		}
		.knoop {
			min-height: var(--veld-h-raak);
			flex-direction: row;
			align-items: center;
			gap: var(--s-3);
			text-align: left;
		}
		.ring {
			flex: none;
		}
	}
</style>
