<script lang="ts">
	import SlowLoad from '$lib/components/ui/SlowLoad.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { FilterGroup } from '$lib/verbonden/filter';
	import { sortOf } from '$lib/bron/rubrieken';
	import type { LineKind } from '$lib/graph/line-kind';
	import type { Relation } from '$lib/vocabulary';
	// The weergave Keten (besluit 39, mockup A197-c): the law at the top, the articles it gives
	// powers in, the regulations under them per layer; a line from each to what it hangs under,
	// dashed where it only names it. On a wide screen a drawing in layers, on a phone a list per
	// layer (AMvB, Ministeriële regeling, Beleidsregel as headings). One click marks a bron: its
	// card stands in the strip at the right.
	import { formatCount } from '$lib/text/getal';
	import { capitalize, plural } from '$lib/text/words';
	import { kindColour } from '$lib/bron/kleur';
	import { VORMEN, vormVanBron } from '$lib/bron/vormen';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import {
		edgeCapFor,
		edgeColorFor,
		edgeDashFor,
		edgeStyleFor,
		edgeToneFor,
		toneColour,
		lineThickness,
		arrowLength
	} from '$lib/components/graph/nodeSprites';
	import { headLength, ARROW_WIDTH, DOT_RADIUS } from '$lib/graph/line-shape';
	import { hasArrow } from '$lib/graph/line-kind';
	import { citeLines, citeText } from '$lib/network/cite-label';
	import { openHref } from '$lib/bron/href';
	import { treeLines, type TreeNode } from '$lib/network/tree-lines';
	import { sectionColour } from '$lib/network/person-layers';
	import { EDGE_WEIGHT, type DrawClass } from '$lib/graph/types';
	import { sideScroll } from '$lib/actions/side-scroll';
	import { HoverCard } from '$lib/actions/hover-card.svelte';
	import BasisGlance from '$lib/network/BasisGlance.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { parentKind, parentRelation, type ChainNode, type ChainLayer } from '$lib/network/chain';
	type LayerId = ChainLayer['id'];

	let {
		layers,
		rest = {},
		chosen = null,
		gap = null,
		scale = 1,
		room = $bindable(0),
		hiddenKinds = new Set(),
		hiddenLines = new Set(),
		more = {},
		amending = 0,
		failure = null,
		loading = false,
		expired = null,
		start = null,
		period = null,
		others = [],
		onChoose
	}: {
		/** The room of the drawing, as the keten measures it (ResizeObserver): how many bronnen a layer shows without panning follows it. */
		room?: number;
		/** The bron the keten starts from, which no filter hides. */
		start?: string | null;
		/** The period of the strip: a bron dated outside it is drawn faint, and counted. */
		period?: { van: string | null; tot: string | null } | null;
		/**
		 * The other chosen bronnen: marked where they stand in the keten, else named in a line
		 * of their own; one with a keten of its own opens it in one click.
		 */
		others?: readonly {
			id: string;
			name: string;
			collection: string;
			onOpen: (() => void) | null;
		}[];
		/** The regulations no longer in force: how many, whether they are drawn, and the switch. */
		expired?: { total: number; shown: boolean; onToggle: () => void } | null;
		layers: readonly ChainLayer[];
		/** Per layer, the regulations not drawn. */
		rest?: Partial<Record<LayerId, number>>;
		/** Per layer, those regulations themselves: "Alle 403" lists them (R3-K F4). */
		more?: Partial<Record<LayerId, readonly ChainNode[]>>;
		/** The keten is on its way: the drawing's place says so, nothing springs in (R3-K F6). */
		loading?: boolean;
		/** The node marked. */
		chosen?: string | null;
		/** What the data lacks, as one label over the drawing. */
		gap?: string | null;
		/** The zoom of the werkplek: the drawing larger or smaller, scrolled within. */
		scale?: number;
		/** The kinds and relations the filter of the strip switched off. */
		hiddenKinds?: ReadonlySet<FilterGroup>;
		hiddenLines?: ReadonlySet<LineKind>;
		/** The decrees that only change other regulations: left out of the layers, counted. */
		amending?: number;
		/** What could not be loaded, said with Opnieuw (LoadState). */
		failure?: { what: string; error: unknown; retry: () => void; plural?: boolean } | null;
		onChoose: (k: ChainNode) => void;
	} = $props();

	/** The layers the filter leaves: the articles with Artikelen, the regulations with Wetten. */
	const shown = $derived(
		layers.filter((l) => {
			// The start's own layer stays; another goes with the kind of what it holds.
			if (l.id === 'law' || l.nodes.some((n) => n.id === start)) return true;
			const c = l.nodes[0]?.collection;
			const kind = c ? sortOf(c, '', null) : 'wetten';
			return !hiddenKinds.has(kind);
		})
	);
	/** What the keten has room for, and what the drawing needs: it pans sideways past that. */
	let avail = $state(760);
	/** The room of a bron in its layer, across: a name of 22 characters, and the label of its line. */
	const SLOT = 192;
	const need = $derived(
		Math.max(0, ...shown.map((l) => LEFT + 24 + (l.nodes.length + (rest[l.id] ? 1 : 0)) * SLOT))
	);
	const width = $derived(Math.max(avail, need));
	$effect(() => {
		room = avail;
	});
	/** A layer is 104 px high (Keten, Maten). */
	const ROW = 104;
	/** From a layer's label to its bronnen, and the line height of a name. */
	const DROP = 58;
	const LINE = 14;
	/** A sign of 14 px on a rim of paper of 2; the bron of the keten 18 px on a halo of 4,5 and an edge of 2. */
	const SIGN = 14;
	const RIM = 2;
	const FOCUS = 18;
	const HALO = 4.5;
	const INK_EDGE = 2;
	/** Room above the first layer: its label and Alle stand clear of the Deel button at the top right. */
	const TOP = 64;
	const LEFT = 120;
	/**
	 * A layer is 104 px high, or higher where a name of it runs over more lines than fit: no name
	 * ever lies over the rail under its layer.
	 */
	const rowHeights = $derived(
		shown.map((l) => {
			const most = Math.max(1, ...l.nodes.map((k) => infoOf.get(k.id)?.lines.length ?? 1));
			return Math.max(ROW, DROP + 24 + LINE * (most - 1) + 58);
		})
	);
	/** Where each layer begins. */
	const tops = $derived(
		rowHeights.map((_, i) => TOP + rowHeights.slice(0, i).reduce((a, b) => a + b, 0))
	);
	const height = $derived(TOP + rowHeights.reduce((a, b) => a + b, 0));
	/** The room of a node in its layer, for the length of its name's lines: at most 22 characters (Keten). */
	const charsFor = (n: number) =>
		Math.min(22, Math.max(12, Math.floor(Math.max(200, width - LEFT - 24) / Math.max(1, n) / 7)));
	/** About what a character of a name takes, in px. */
	const CHAR = 6;
	/** Half the width of a name's widest line, with some air: a name never leaves the drawing. */
	const halfOf = (k: ChainNode, n: number) =>
		Math.ceil((Math.max(...linesOf(k.name, charsFor(n)).map((r) => r.length)) * CHAR) / 2) + 8;
	/**
	 * Where each node stands: its layer's row; across, under what it hangs from (the mean of its
	 * parents' places), kept apart by a node's room and within the width, so the lines run down
	 * rather than across each other (Thijs, Grondwet, 23 Oct). A layer without placed parents
	 * spreads evenly.
	 */
	const place = $derived.by(() => {
		const m = new Map<string, { x: number; y: number }>();
		const left = LEFT;
		const right = Math.max(LEFT + 200, width - 24);
		// A lone bron that a line passes over (the conclusie between the hof and the Hoge Raad) steps
		// aside, so the line does not run through its name.
		const rowOf = new Map<string, number>();
		shown.forEach((l, i) => l.nodes.forEach((k) => rowOf.set(k.id, i)));
		const bypassed = (i: number) =>
			shown
				.slice(i + 1)
				.some((l) => l.nodes.some((k) => k.parents.some((p) => (rowOf.get(p.id) ?? i) < i)));
		shown.forEach((layer, i) => {
			const n = layer.nodes.length;
			// Apart by a slot at most; a layer without a place above it is centred on the drawing.
			const sep = Math.min((right - left) / n, SLOT);
			const wish = layer.nodes.map((k, j) => {
				const at = k.parents.map((p) => m.get(p.id)?.x).filter((x): x is number => x !== undefined);
				return {
					k,
					x: at.length
						? at.reduce((a, b) => a + b, 0) / at.length
						: (left + right) / 2 + (j - (n - 1) / 2) * sep
				};
			});
			wish.sort((a, b) => a.x - b.x);
			// As near its wish as the room allows (pooled blocks, so a group stands centred under
			// what it hangs from), then within the drawing.
			const blocks: { sum: number; count: number; at: number }[] = [];
			wish.forEach((w, j) => {
				blocks.push({ sum: w.x - j * sep, count: 1, at: j });
				while (
					blocks.length > 1 &&
					blocks[blocks.length - 2].sum / blocks[blocks.length - 2].count >
						blocks[blocks.length - 1].sum / blocks[blocks.length - 1].count
				) {
					const last = blocks.pop()!;
					blocks[blocks.length - 1].sum += last.sum;
					blocks[blocks.length - 1].count += last.count;
				}
			});
			const xs = blocks.flatMap((b) =>
				Array.from({ length: b.count }, (_, i) => b.sum / b.count + (b.at + i) * sep)
			);
			const shift = Math.max(0, left + sep / 2 - xs[0]) || Math.min(0, right - sep / 2 - xs[n - 1]);
			for (let j = 0; j < n; j++) xs[j] += shift;
			// Half its name and some air, to the side that has room.
			const room = (layer.nodes[0] ? halfOf(layer.nodes[0], n) : 0) + 48;
			const aside = n === 1 && bypassed(i) ? (xs[0] + room <= right - 40 ? room : -room) : 0;
			// A name stays within the drawing, whichever side its node stands on.
			wish.forEach((w, j) => {
				const half = halfOf(w.k, n);
				const x = Math.min(Math.max(xs[j] + aside, half), Math.max(half, width - half));
				m.set(w.k.id, { x, y: tops[i] + DROP });
			});
		});
		return m;
	});
	/** What a node says under its sign: its name over lines (a judgment cited with its day). */
	const infoOf = $derived.by(() => {
		const m = new Map<string, { lines: string[] }>();
		for (const l of shown)
			for (const k of l.nodes)
				m.set(k.id, {
					lines: linesOf(k.name, charsFor(l.nodes.length))
				});
		return m;
	});
	/** Where a line leaves a node below its name, 7 px under the last line. */
	const under = (id: string) => {
		const i = infoOf.get(id);
		return 24 + LINE * ((i?.lines.length ?? 1) - 1) + 7;
	};
	/** The words on a line of the keten: a judgment's appeal, its cassatie and its conclusie. */
	const wordOf = (relation: Relation, layer: string) =>
		relation === 'APPEAL_OF'
			? layer === 'Hoge Raad'
				? 'cassatie'
				: 'hoger beroep'
			: relation === 'ADVISES_ON'
				? 'conclusie'
				: relation === 'CONTINUES'
					? 'zet voort'
					: null;
	/** The box of each name with its sign: where a line must not run (Keten: no line through a name). */
	const boxes = $derived.by(() => {
		const out: { id: string; x0: number; x1: number; y0: number; y1: number }[] = [];
		for (const l of shown)
			for (const k of l.nodes) {
				const p = place.get(k.id);
				if (!p) continue;
				const half = halfOf(k, l.nodes.length);
				const at = p.x - half;
				out.push({
					id: k.id,
					x0: at - 2,
					x1: at + 2 * half + 2,
					y0: p.y - 14,
					y1: p.y + 24 + LINE * ((infoOf.get(k.id)?.lines.length ?? 1) - 1) + 4
				});
			}
		return out;
	});
	/**
	 * The lines (Netwerkcanvas, Lijnen) as a stamboom (tree-lines.ts): from under the name of what a
	 * node hangs under, one stem down, a tak per layer, a short line to each node; in the style of
	 * its kind. The arrowhead stands where the Design System gives one, at the parent's end; the
	 * style of the line is this one place.
	 */
	const lines = $derived.by(() => {
		const nameOf = new Map(shown.flatMap((l) => l.nodes.map((k) => [k.id, k.name] as const)));
		// A tak runs in the middle of the gutter, never on the line between two rows.
		const rails = tops.map((t) => t + 8);
		const nodes = new Map<string, TreeNode>();
		const rows = new Map<string, number>();
		shown.forEach((l, i) =>
			l.nodes.forEach((k) => {
				const p = place.get(k.id);
				if (!p) return;
				rows.set(k.id, i);
				nodes.set(k.id, { x: p.x, row: i, top: p.y - 12, bottom: p.y + under(k.id) });
			})
		);
		const edges = shown.flatMap((l) =>
			l.nodes.flatMap((k) =>
				k.parents.flatMap((o) => {
					if (hiddenLines.has(parentKind(o)) || !nodes.has(o.id) || !nodes.has(k.id)) return [];
					const relation = parentRelation(o);
					// A mention is an Aanhaling, the text of the law itself a grondslag.
					const from: DrawClass =
						relation === 'REFERS_TO' || o.way === 'mentioned' ? 'judgment' : 'article';
					const style = edgeStyleFor(relation, null, from);
					const lit = chosen === k.id || chosen === o.id;
					const width = lineThickness(EDGE_WEIGHT[relation]) * (lit ? 1.3 : 1);
					const head = hasArrow(style) ? headLength(width, arrowLength()) : 0;
					return [
						{
							relation,
							from,
							style,
							lit,
							width,
							head,
							o,
							k,
							many: k.parents.filter((q) => q.cite).length > 1,
							label: l.label
						}
					];
				})
			)
		);
		const routed = treeLines(
			nodes,
			edges.map((e) => ({
				id: `${e.o.id}~${e.k.id}`,
				parent: e.o.id,
				child: e.k.id,
				kind: `${e.style}|${e.relation}`,
				lead: e.head
			})),
			{ rails, boxes }
		);
		const byId = new Map(routed.map((r) => [r.id, r]));
		return edges.flatMap((e) => {
			const r = byId.get(`${e.o.id}~${e.k.id}`);
			if (!r) return [];
			// The arrowhead at the parent's end, pointing up into its name.
			const w = (e.head * ARROW_WIDTH) / 2;
			const head = e.head
				? `${r.tip.x},${r.tip.y} ${r.tip.x - w},${r.tip.y + e.head} ${r.tip.x + w},${r.tip.y + e.head}`
				: null;
			const word = wordOf(e.relation, e.label);
			const articles = e.o.cite?.articles ?? [];
			return [
				{
					id: r.id,
					parent: r.parent,
					child: r.child,
					d: r.d,
					head,
					dot: e.style === 'puntenIndiener' ? r.end : null,
					word,
					wordAt: { x: r.end.x + 12, y: r.end.y - 6 },
					cite: e.o.cite ? citeText(e.o.cite) : null,
					// What the label opens: the first of its articles, at the lid it names; the glance
					// names them all.
					citeFull: e.o.cite?.full ?? '',
					citeLines: e.o.cite ? citeLines(e.o.cite) : [],
					citeHref: articles[0]
						? openHref({ collection: 'articles', key: articles[0].key }, { at: articles[0].at })
						: null,
					citeLaw: nameOf.get(e.o.id) ?? '',
					mentioned: e.o.way === 'mentioned',
					// On the line close above the card of the child; with several laws above it,
					// under each law instead, so the labels never stand on each other.
					citeAt: e.many ? { x: r.tip.x, y: r.tip.y + 17 } : { x: r.end.x, y: r.end.y - 20 },
					colour: toneColour(
						edgeColorFor(e.relation, e.from),
						edgeToneFor(e.relation, null, e.from)
					),
					dash: edgeDashFor(e.style),
					cap: edgeCapFor(e.style),
					width: e.width,
					lit: e.lit
				}
			];
		});
	});
	// Each bron drawn as the canvas and the legend draw its kind: one shape and one colour per
	// kind (vormen.ts, kleur.ts), so Soort is the key to this drawing too.
	// In the keten of a person each layer wears the colour of its rubriek (person-layers.ts).
	const colour = (k: ChainNode) =>
		(start?.startsWith('members/') ? sectionColour(k.collection) : null) ??
		kindColour(k.collection);
	const vormKey = (k: ChainNode) =>
		vormVanBron(k.collection, { celex: k.instrument?.celex ?? null }, k.id.split('/')[1]);
	const vormOf = (k: ChainNode) => VORMEN[vormKey(k)];
	/** A name over as many lines as it takes, of at most `max` characters; never cut (Keten). */
	const linesOf = (s: string, max = 22) => {
		const out: string[] = [];
		for (const w of s.split(/\s+/)) {
			const last = out[out.length - 1];
			if (last && (last + ' ' + w).length <= max) out[out.length - 1] = `${last} ${w}`;
			else out.push(w);
		}
		return out;
	};
	/** How a row of the list hangs: its seat or court, else its grondslag and what it names. */
	const howOf = (k: ChainNode) =>
		k.how ||
		capitalize(
			[k.grondslag ? `grondslag ${k.grondslag}` : null, k.mentions ? `noemt ${k.mentions}` : null]
				.filter(Boolean)
				.join(', ')
		) ||
		null;
	/** The words of its grondslag: the articles it rests on, each with its law's abbreviation. */
	const grondslagOf = (k: ChainNode): string[] => {
		const said = (way: 'delegates' | 'mentioned') =>
			k.parents.filter((p) => p.way === way && p.cite).map((p) => p.cite!.full);
		const out: string[] = [];
		if (said('delegates').length) out.push(`Grondslag ${said('delegates').join(', ')}`);
		if (said('mentioned').length) out.push(`Noemt ${said('mentioned').join(', ')}`);
		return out;
	};
	/** One glance for the drawing: the regulation it hangs from, shown by HoverCard's rules. */
	const hover = new HoverCard(() => false);
	let target = $state<{
		anchor: HTMLElement;
		kicker: string;
		title: string;
		lines: string[];
	} | null>(null);
	/** The glance of a regulation: after a rest of the pointer or the focus, never for a finger. */
	const glance = (k: ChainNode, layer: ChainLayer, anchor: Element) => {
		const lines = layer.id === 'law' ? [] : grondslagOf(k);
		if (!lines.length) return hover.close();
		target = { anchor: anchor as HTMLElement, kicker: layer.label, title: k.name, lines };
		hover.enter();
	};
	/** The glance of a label on a line: the articles it names, each with the abbreviation of its law. */
	const citeGlance = (l: (typeof lines)[number], anchor: Element) => {
		target = {
			anchor: anchor as HTMLElement,
			kicker: l.mentioned ? 'Genoemd in de aanhef' : 'Grondslag',
			title: l.citeLaw,
			lines: l.citeLines
		};
		hover.enter();
	};
	const card = $derived(hover.open ? target : null);
	/** The labels and the Alle of the layers stay in view while the drawing pans under them. */
	let pan = $state<HTMLElement | null>(null);
	let centredFor = '';
	// A drawing wider than the screen opens on the bron it is about, not on its left edge.
	$effect(() => {
		const root = start ?? shown.find((l) => l.id === 'law')?.nodes[0]?.id;
		const at = root ? place.get(root)?.x : undefined;
		const key = `${root}:${shown.length}:${Math.round(width)}`;
		if (!pan || at === undefined || key === centredFor || width <= avail) return;
		centredFor = key;
		pan.scrollTo({ left: Math.max(0, at * scale - avail / 2), behavior: 'instant' });
	});
	const panned = (el: HTMLElement) => {
		const set = () => el.style.setProperty('--sx', `${el.scrollLeft}px`);
		el.addEventListener('scroll', set, { passive: true });
		return { destroy: () => el.removeEventListener('scroll', set) };
	};
	const press = (e: KeyboardEvent, act: () => void) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	};

	/** The layers whose regulations not drawn are listed: "Alle 403" opens them, once more closes. */
	let open = $state<ReadonlySet<LayerId>>(new Set());
	const toggle = (id: LayerId) => {
		const next = new Set(open);
		if (!next.delete(id)) next.add(id);
		open = next;
	};
	/** The kind of what a layer holds, for its card of the others: "4 andere wetten". */
	const KIND_WORDS: Record<string, [string, string]> = {
		basis: ['wet', 'wetten'],
		law: ['wet', 'wetten'],
		implementation: ['wet', 'wetten'],
		eu: ['EU-akte', 'EU-akten'],
		amvb: ['AMvB', 'AMvB’s'],
		kb: ['koninklijk besluit', 'koninklijke besluiten'],
		ministerial: ['regeling', 'regelingen'],
		policy: ['beleidsregel', 'beleidsregels'],
		other: ['regeling', 'regelingen']
	};
	/** The card of the others: what a click shows or hides. */
	const otherText = (l: ChainLayer) => {
		if (open.has(l.id)) return 'Minder';
		const n = rest[l.id] ?? 0;
		const [one, many] = KIND_WORDS[l.id] ?? ['bron', 'bronnen'];
		return `${formatCount(n)} andere ${n === 1 ? one : many}`;
	};
	/** Dated outside the period of the strip: faint, not gone (Thijs, 23 Oct). */
	const outside = (k: ChainNode) =>
		!!period &&
		!!k.since &&
		((!!period.van && k.since < period.van) || (!!period.tot && k.since > period.tot));
	const outsideCount = $derived(shown.flatMap((l) => l.nodes).filter(outside).length);
	const otherIds = $derived(new Set(others.map((o) => o.id)));
	const notHere = $derived(
		others.filter((o) => !shown.some((l) => l.nodes.some((n) => n.id === o.id)))
	);
	/** The layers of the list (a phone): the start and what stands above it as the list's head (F12). */
	const head = $derived(shown.filter((l) => l.id === 'law' || l.id === 'basis' || l.id === 'eu'));
	const listed = $derived(shown.filter((l) => l.id !== 'law' && l.id !== 'basis' && l.id !== 'eu'));
</script>

{#snippet row(k: ChainNode)}
	{@const how = howOf(k)}
	<li>
		<button
			type="button"
			class="list__row"
			class:is-active={chosen === k.id}
			aria-pressed={chosen === k.id}
			onclick={() => onChoose(k)}
		>
			<span class="list__name"
				><span class="mark"><KindGlyph vorm={vormKey(k)} size={12} colour={colour(k)} /></span
				>{k.name}</span
			>
			{#if how}<span class="list__how">{how}</span>{/if}
		</button>
	</li>
{/snippet}

{#snippet stroke(l: (typeof lines)[number])}
	<path
		class="line"
		data-parent={l.parent}
		data-child={l.child}
		d={l.d}
		fill="none"
		stroke={l.colour}
		stroke-width={l.width}
		stroke-dasharray={l.dash}
		stroke-linecap={l.cap}
	/>
	{#if l.head}<polygon points={l.head} fill={l.colour} />{/if}
	{#if l.dot}<circle cx={l.dot.x} cy={l.dot.y} r={DOT_RADIUS} fill={l.colour} />{/if}
	{#if l.word}<text class="line-word" x={l.wordAt.x} y={l.wordAt.y}>{l.word}</text>{/if}
{/snippet}

{#snippet allButton(layer: ChainLayer)}
	<button
		type="button"
		class="btn alle"
		aria-expanded={open.has(layer.id)}
		onclick={() => toggle(layer.id)}>{otherText(layer)}</button
	>
{/snippet}

<div class="chain" bind:clientWidth={avail}>
	{#if failure}
		<div class="failure">
			<LoadState
				state={{ status: 'error', error: failure.error }}
				what={failure.what}
				plural={failure.plural}
				retry={failure.retry}
				form="block"
			/>
		</div>
	{:else if loading}
		<SlowLoad label="Keten laden…" visible />
	{:else if gap || expired?.total || outsideCount || notHere.length}
		<div class="kop">
			{#if outsideCount}<span class="stil">{formatCount(outsideCount)} buiten de periode</span>{/if}
			{#if notHere.length}<span class="ook"
					>Ook gekozen, niet in deze keten: {#each notHere as o, i (o.id)}{#if i},
						{/if}{#if o.onOpen}<TekstLink onclick={o.onOpen} title="De keten van {o.name}"
								>{o.name}</TekstLink
							>{:else}{o.name}{/if}{/each}</span
				>{/if}
			{#if gap}<p class="gap">{gap}</p>{/if}
			{#if expired?.total}<TekstLink onclick={expired.onToggle} aria-pressed={expired.shown}
					>{expired.shown
						? 'Zonder vervallen regelingen'
						: `Ook ${formatCount(expired.total)} vervallen ${plural(expired.total, 'regeling', 'regelingen')}`}</TekstLink
				>{/if}
		</div>
	{/if}
	<div class="pan" data-zijscroll bind:this={pan} use:sideScroll use:panned>
		<svg
			class="drawing"
			style:width="{width * scale}px"
			style:--sc={scale}
			viewBox="0 0 {width} {height}"
			role="group"
			aria-label="Keten"
		>
			{#each shown as layer, i (layer.id)}
				<text class="layer-label pin" x="24" y={tops[i] - 2}>{layer.label.toUpperCase()}</text>
				<line
					class="rail"
					x1="20"
					x2={width - 20}
					y1={tops[i] + rowHeights[i] - 14.5}
					y2={tops[i] + rowHeights[i] - 14.5}
				/>
			{/each}
			<!-- The lines as one layer, so where they share a stem they do not darken; the marked
		     ones over it, whole. -->
			<g class="lines">
				{#each lines.filter((l) => !l.lit) as l (l.id)}
					{@render stroke(l)}
				{/each}
			</g>
			{#each lines.filter((l) => l.lit) as l (l.id)}
				<g>{@render stroke(l)}</g>
			{/each}
			<!-- The articles on a line, on a rim of paper over the lines. -->
			{#each lines.filter((l) => l.cite) as l (l.id)}
				{@const w = Math.ceil(l.cite!.length * 6.3) + 16}
				<a
					class="cite"
					href={l.citeHref ?? undefined}
					aria-label={l.citeFull}
					onpointerenter={(e) => {
						hover.pointer(e.pointerType);
						citeGlance(l, e.currentTarget);
					}}
					onpointerleave={() => hover.leave()}
					onkeydown={() => hover.keys()}
					onfocus={(e) => citeGlance(l, e.currentTarget)}
					onblur={() => hover.leave()}
				>
					<rect
						class="frame"
						x={l.citeAt.x - w / 2}
						y={l.citeAt.y - 10}
						width={w}
						height="20"
						rx="2"
						stroke-dasharray={l.mentioned ? '2 2' : undefined}
					/>
					<!-- A finger's 44 px, unseen. -->
					<rect class="hit" x={l.citeAt.x - w / 2} y={l.citeAt.y - 10} width={w} height="20" />
					<text x={l.citeAt.x} y={l.citeAt.y + 4} text-anchor="middle">{l.cite}</text>
				</a>
			{/each}
			{#each shown as layer, i (layer.id)}
				{#each layer.nodes as k (k.id)}
					{@const p = place.get(k.id)!}
					{@const v = vormOf(k)}
					{@const info = infoOf.get(k.id)}
					<g
						class="node"
						class:is-active={chosen === k.id}
						class:is-dim={outside(k)}
						role="button"
						tabindex="0"
						aria-label={k.name}
						aria-pressed={chosen === k.id}
						onclick={() => onChoose(k)}
						onkeydown={(e) => {
							hover.keys();
							press(e, () => onChoose(k));
						}}
						onpointerenter={(e) => {
							hover.pointer(e.pointerType);
							glance(k, layer, e.currentTarget);
						}}
						onpointerleave={() => hover.leave()}
						onfocus={(e) => glance(k, layer, e.currentTarget)}
						onblur={() => hover.leave()}
					>
						{#if k.expired || layer.id === 'law'}<title
								>{k.expired ? `${k.name}, vervallen sinds ${k.expired}` : k.name}</title
							>{/if}
						<circle cx={p.x} cy={p.y} r="22" class="hit" />
						{#if otherIds.has(k.id) && chosen !== k.id && k.id !== start}<rect
								class="sel sel--ander"
								x={p.x - 12}
								y={p.y - 12}
								width="24"
								height="24"
								rx="2"
							/>{/if}
						{#if chosen === k.id && k.id !== start}<rect
								class="sel"
								x={p.x - 12}
								y={p.y - 12}
								width="24"
								height="24"
								rx="2"
							/>{/if}
						{#if k.id === start}
							<!-- The bron of the keten: its sign in ink, with an edge of ink on a halo of paper
						     (Netwerkcanvas, Focus). -->
							{@const sc = FOCUS / 16}
							{@const at = `translate(${p.x - FOCUS / 2} ${p.y - FOCUS / 2}) scale(${sc})`}
							<path
								d={v.d}
								transform={at}
								fill="none"
								stroke="var(--paper)"
								stroke-width={(2 * HALO) / sc}
								stroke-linejoin="round"
							/>
							<path
								d={v.d}
								transform={at}
								fill={v.wijze === 'lijn' ? 'var(--paper)' : 'none'}
								stroke="var(--ink)"
								stroke-width={(2 * INK_EDGE) / sc}
								stroke-linejoin="round"
							/>
							{#if v.wijze !== 'lijn'}<path
									d={v.d}
									transform={at}
									fill="var(--ink)"
									fill-rule={v.wijze === 'gat' ? 'evenodd' : 'nonzero'}
								/>{/if}
						{:else}
							{@const sc = SIGN / 16}
							{@const at = `translate(${p.x - SIGN / 2} ${p.y - SIGN / 2}) scale(${sc})`}
							<g class:vervallen={!!k.expired}>
								<path
									d={v.d}
									transform={at}
									fill="var(--paper)"
									stroke="var(--paper)"
									stroke-width={(2 * RIM) / sc}
									stroke-linejoin="round"
								/>
								<path
									d={v.d}
									transform={at}
									fill={v.wijze === 'lijn' ? 'var(--paper)' : colour(k)}
									fill-rule={v.wijze === 'gat' ? 'evenodd' : 'nonzero'}
									stroke={v.wijze === 'lijn' ? colour(k) : 'none'}
									stroke-width={1.7 / sc}
								/>
							</g>
						{/if}
						<text
							class="name {otherIds.has(k.id) ? 'name--ander' : ''}"
							class:name--law={layer.id === 'law' || k.id === start}
							x={p.x}
							y={p.y + 24}
							text-anchor="middle"
							>{#each info?.lines ?? [] as r, j (j)}<tspan x={p.x} dy={j ? LINE : 0}>{r}</tspan
								>{/each}</text
						>
					</g>
				{/each}
				<!-- After the bronnen of its layer: the keyboard goes layer by layer, the card of the
				     others last (Variant C: two squares, "4 andere wetten"). -->
				{#if rest[layer.id]}
					{@const x = Math.max(...layer.nodes.map((k) => place.get(k.id)?.x ?? 0)) + SLOT}
					{@const y = tops[i] + DROP}
					{@const words = linesOf(otherText(layer), 22)}
					<g
						class="others"
						role="button"
						tabindex="0"
						aria-expanded={open.has(layer.id)}
						onclick={() => toggle(layer.id)}
						onkeydown={(e) => press(e, () => toggle(layer.id))}
					>
						<circle cx={x} cy={y} r="22" class="hit" />
						<rect
							x={x - 4}
							y={y - 3}
							width={SIGN}
							height={SIGN}
							fill="var(--paper)"
							stroke={colour(layer.nodes[0])}
							stroke-width="1.5"
						/>
						<rect x={x - 10} y={y - 9} width={SIGN} height={SIGN} fill={colour(layer.nodes[0])} />
						<text class="name" {x} y={y + 24} text-anchor="middle"
							>{#each words as r, j (j)}<tspan {x} dy={j ? LINE : 0}>{r}</tspan>{/each}</text
						>
					</g>
				{/if}
			{/each}
		</svg>
	</div>
	{#if card}
		<BasisGlance
			anchor={card.anchor}
			id="keten-kaart"
			kicker={card.kicker}
			title={card.title}
			lines={card.lines}
			onclose={() => hover.close()}
		/>
	{/if}
	<!-- On a wide screen the regulations a layer does not draw, listed under the drawing once
	     its Alle is pressed. -->
	{#each shown.filter((l) => open.has(l.id) && more[l.id]?.length) as layer (layer.id)}
		<section class="rest" aria-label="{layer.label}, alle">
			<h3 class="list__head">{layer.label}</h3>
			<ul>
				{#each more[layer.id] ?? [] as k (k.id)}{@render row(k)}{/each}
			</ul>
		</section>
	{/each}
	{#if amending}<p class="amending">
			{formatCount(amending)}
			{plural(amending, 'wijzigingsbesluit', 'wijzigingsbesluiten')} buiten de keten
		</p>{/if}

	<!-- On a phone: a list, the law (and what it rests on) at its head, the regulations under
	     their heading (R3-K F12). -->
	<div class="list">
		{#each head as layer (layer.id)}
			<section class="list__layer" aria-label={layer.label}>
				<h3 class="list__head">{layer.label}</h3>
				<ul>
					{#each layer.nodes as k (k.id)}{@render row(k)}{/each}
				</ul>
			</section>
		{/each}
		{#each listed as layer (layer.id)}
			<section class="list__layer" aria-label={layer.label}>
				<h3 class="list__head">{layer.label}</h3>
				<ul>
					{#each layer.nodes as k (k.id)}{@render row(k)}{/each}
					{#if open.has(layer.id)}{#each more[layer.id] ?? [] as k (k.id)}{@render row(
								k
							)}{/each}{/if}
				</ul>
				{#if rest[layer.id]}{@render allButton(layer)}{/if}
			</section>
		{/each}
	</div>
</div>

<style>
	.chain {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: auto;
		background: var(--paper);
	}
	/* The gap marker (besluit 23): one label, never a paragraph. */
	.gap {
		margin: 0;
		padding: 0 var(--s-2);
		border: 1px dashed var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
	.amending {
		margin: 0 var(--s-5) var(--s-4);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.failure {
		margin: var(--s-5);
	}
	/* A click marks the bron with its frame (.sel); the keyboard keeps its ring. */
	.node:focus:not(:focus-visible) {
		outline: none;
	}
	.pan {
		overflow-x: auto;
		scroll-padding-inline: var(--s-8);
		scrollbar-width: none;
	}
	.drawing {
		display: block;
		max-width: none;
		height: auto;
	}
	.pin {
		transform: translateX(calc(var(--sx, 0px) / var(--sc, 1)));
	}
	/* A label of a layer is a control label (sans 11 px 600, spaced), not a name. */
	.layer-label {
		font-family: var(--font-ui);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		fill: var(--ink-3);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 6px;
		stroke-linejoin: round;
	}
	.others {
		cursor: pointer;
	}
	.others:hover .name {
		fill: var(--ink);
		text-decoration: underline;
	}
	.rest {
		margin: 0 var(--s-5) var(--s-4);
	}
	.rest ul {
		margin: 0;
		padding: 0 0 0 var(--s-3);
		list-style: none;
		border-left: 2px solid var(--rule);
	}
	.alle {
		margin-top: var(--s-1);
	}
	.rail {
		stroke: var(--rule);
	}
	.lines {
		opacity: 0.7;
	}
	/* The words on a line, italic, on an edge of paper like a name. */
	.line-word {
		font-family: var(--font-serif);
		font-size: var(--t-note);
		font-style: italic;
		fill: var(--ink-3);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
		stroke-linejoin: round;
	}
	/* The articles on a line (Keten, Referentielabel): serif on a framed rim of paper; a dotted frame
	   where the line only names them. */
	.cite .frame {
		fill: var(--paper);
		stroke: var(--rule-strong);
		stroke-width: 1;
	}
	.cite .hit {
		fill: transparent;
	}
	@media (pointer: coarse) {
		.cite .hit {
			height: calc(44px / var(--sc));
			transform: translateY(calc((20px - 44px / var(--sc)) / 2));
		}
	}
	.cite:hover text {
		fill: var(--ink);
		text-decoration: underline;
	}
	.cite:focus {
		outline: none;
	}
	.cite:focus-visible .frame {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.cite text {
		font-family: var(--font-serif);
		font-size: var(--t-note);
		fill: var(--ink-2);
	}
	/* Outside the period of the strip: faint, not gone. */
	.node.is-dim {
		opacity: 0.35;
	}
	/* Another chosen bron in this keten: its frame, dashed (the marked one's is whole). */
	.sel--ander {
		stroke-dasharray: 3 2;
	}
	.name--ander {
		font-weight: 600;
		fill: var(--ink);
	}
	/* No longer in force: drawn faint, its title says since when. */
	.vervallen {
		opacity: 0.4;
	}
	.kop {
		position: absolute;
		top: var(--s-3);
		left: var(--s-5);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-4);
		font-size: var(--t-micro);
	}
	.hit {
		fill: transparent;
	}
	.node {
		cursor: pointer;
	}
	.sel {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2;
	}
	.name {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-2);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 6px;
		stroke-linejoin: round;
	}
	.name--law,
	.node.is-active .name {
		font-weight: 600;
		fill: var(--ink);
	}
	.node:hover .name {
		fill: var(--ink);
		text-decoration: underline;
	}
	.node:focus-visible .sel,
	.node:focus-visible path {
		outline: 2px solid var(--focus);
	}
	.list {
		display: none;
	}
	@media (max-width: 768px) {
		.pan {
			display: none;
		}
		.kop {
			position: static;
			margin: var(--s-3) var(--s-4) 0;
		}
		.rest {
			display: none;
		}
		.list {
			display: block;
			/* Room under the last row for the floating Weergave button. */
			padding: var(--s-2) var(--s-4) calc(var(--s-8) + var(--s-4));
		}
	}
	.list__layer {
		margin-top: var(--s-4);
	}
	.list__head {
		margin: 0 0 var(--s-2);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.list ul {
		margin: 0;
		padding: 0 0 0 var(--s-3);
		list-style: none;
		border-left: 2px solid var(--rule);
	}
	.list__row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		width: 100%;
		min-height: var(--veld-h-raak);
		padding: var(--s-2) var(--s-3);
		border: 0;
		border-top: 1px solid var(--rule);
		background: none;
		text-align: left;
		cursor: pointer;
	}
	li:first-child .list__row {
		border-top: 0;
	}
	.list__row.is-active {
		background: var(--paper-2);
	}
	.list__name {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 24px;
		color: var(--ink);
	}
	.mark {
		flex: none;
		display: inline-flex;
		align-self: center;
	}
	.list__how {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
</style>
