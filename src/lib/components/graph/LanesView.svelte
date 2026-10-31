<script lang="ts">
	// Omgeving as lanes (PLAN-doek-banen, fasen 4 en 5): the scene of the canvas (scene.ts) in
	// columns per soort, as SVG in a field that scrolls, the lines as the Keten draws them. On a
	// wide screen the columns side by side (lane-layout.ts, lane-lines.ts), on a phone as strips
	// from top to bottom with only the lines to the chosen bronnen (lane-strips.ts). One click on a
	// bron marks it (its card at the right, as in the Keten), a second reads it; a pointer or the
	// focus on a unit lights its lines and dims the rest. The list of bronnen (CanvasNodeList)
	// stays the way for the keyboard and a screen reader.
	import { markOf } from '$lib/bron/vormen';
	import { kindColour } from '$lib/bron/kleur';
	import { sortColour, sortLabel, sortOne, type Sort } from '$lib/bron/rubrieken';
	import { formatCount } from '$lib/text/getal';
	import { relationLabel } from '$lib/verbonden/relation-words';
	import { bronNaam } from '$lib/bron/naam';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { headLength, ARROW_WIDTH, DOT_RADIUS } from '$lib/graph/line-shape';
	import { LINE_KIND_STYLE } from '$lib/graph/line-kind';
	import { buildScene, type Column, type Scene, type SceneUnit } from '$lib/graph/scene';
	import { laneLayout, type LaneLayout, type UnitBox } from '$lib/graph/lane-layout';
	import { laneLines, type LanePath } from '$lib/graph/lane-lines';
	import { laneStrips, stripLines, type StripLayout } from '$lib/graph/lane-strips';
	import type { MakerLane } from '$lib/graph/roles';
	import type { Visibility } from '$lib/graph/visibility';
	import type { GraphEdge, GraphNode } from '$lib/graph/types';
	import { arrowLength, edgeCapFor, edgeDashFor, toneColour, tokens } from './nodeSprites';

	let {
		nodes,
		edges,
		chosen,
		visibility,
		time = false,
		marked = null,
		pointed = null,
		onMark,
		onOpen,
		onDrawn
	}: {
		nodes: readonly GraphNode[];
		edges: readonly GraphEdge[];
		/** The chosen bronnen, or the focus: they and their units always stay. */
		chosen: readonly string[];
		/** Tonen and Relatie (B51): the scene leaves out what they hide. */
		visibility: Visibility;
		/** Tijd: in Kamerstukken and Rechtspraak the height is the date. */
		time?: boolean;
		/** The bron marked: its card at the right, its unit lit. */
		marked?: string | null;
		/** The bron the keyboard's list points at: its unit lit. */
		pointed?: string | null;
		onMark: (id: string) => void;
		onOpen: (id: string) => void;
		/** What the lanes draw, every bron of a unit: for the counts and the keyboard's list. */
		onDrawn: (ids: ReadonlySet<string>) => void;
	} = $props();

	/** Below this width the columns stand as strips (Telefoon eerst, fase 5). */
	const PHONE = 600;
	/** The columns side by side shrink to this at most; narrower, the field scrolls sideways. */
	const MIN_SCALE = 0.8;
	const GLYPH = 14;
	const LINE = 15;
	const SMALL_LINE = 14;
	const DOT = 20;
	const DOT_LINE = 22;
	const CONTENT_TOP = 116;

	const COLUMN_TITLE: Record<Column, string> = {
		makers: 'Wie maakt',
		papers: 'Kamerstukken',
		laws: 'Wetten',
		rulings: 'Rechtspraak'
	};
	const COLUMN_SORT: Record<Column, Sort> = {
		makers: 'kamerleden',
		papers: 'stukken',
		laws: 'wetten',
		rulings: 'uitspraken'
	};
	const LANE_TITLE: Record<MakerLane, string> = {
		government: 'Regering',
		council: 'Raad van State',
		parliament: 'Parlement'
	};
	const LANE_SORT: Record<MakerLane, Sort> = {
		government: 'bewindspersonen',
		council: 'kamerleden',
		parliament: 'kamerleden'
	};

	let avail = $state(0);
	const phone = $derived(avail > 0 && avail < PHONE);
	const scene: Scene = $derived(
		buildScene({
			nodes,
			edges,
			chosen,
			visibility,
			nameOf: (n) => bronNaam(n, $instrumentMetaStore)
		})
	);
	const byId = $derived(new Map(nodes.map((n) => [n.id, n])));
	const unitOf = $derived.by(() => {
		const out = new Map<string, SceneUnit>();
		for (const u of scene.units) {
			out.set(u.id, u);
			for (const m of u.members) out.set(m, u);
		}
		return out;
	});

	const layout: LaneLayout | StripLayout = $derived(
		phone ? laneStrips(scene, avail, time) : laneLayout(scene, Math.max(avail, 320), time)
	);
	const paths: LanePath[] = $derived(
		phone ? stripLines(scene, layout as StripLayout) : laneLines(scene, layout)
	);
	const scale = $derived(
		phone || avail === 0 ? 1 : Math.max(MIN_SCALE, Math.min(1, avail / layout.width))
	);
	const named = $derived(phone ? (layout as StripLayout).named : null);

	$effect(() => {
		// A hull is drawn too: its pill marks the wet or dossier it stands for.
		onDrawn(
			new Set(scene.units.flatMap((u) => (u.shape === 'hull' ? [u.id, ...u.members] : u.members)))
		);
	});

	// ── lit and dim ───────────────────────────────────────────────────────────
	let hovered = $state<string | null>(null);
	const lit = $derived(
		hovered ??
			(pointed ? unitOf.get(pointed)?.id : undefined) ??
			(marked ? unitOf.get(marked)?.id : undefined) ??
			null
	);
	/** The line under the pointer: it alone lit, with what it says on it. */
	let hoveredLine = $state<string | null>(null);
	const touches = (p: LanePath) =>
		hoveredLine ? p.id === hoveredLine : !lit || p.from === lit || p.to === lit;
	const anyLit = $derived(!!lit || !!hoveredLine);
	// A mark taken away (Escape, the card closed): what a click lit goes out with it.
	$effect(() => {
		if (!marked) hovered = null;
	});
	const markedUnit = $derived(marked ? (unitOf.get(marked)?.id ?? null) : null);

	// ── the look of a line ────────────────────────────────────────────────────
	const lineColour = (p: LanePath) => {
		const line = scene.lines.find((l) => l.id === p.id);
		const style = line ? LINE_KIND_STYLE[line.kind] : null;
		if (!style) return 'var(--ink-3)';
		return toneColour(tokens()[style.colour], line!.proposed ? 'licht' : style.tone);
	};
	/** The arrowhead at the end of a path, pointing along its last run. */
	function head(p: LanePath): string | null {
		if (!p.arrow || p.points.length < 2) return null;
		const tip = p.points.at(-1)!;
		const from = p.points.at(-2)!;
		const len = headLength(p.width, arrowLength());
		const d = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
		const [ux, uy] = [(tip.x - from.x) / d, (tip.y - from.y) / d];
		const w = (len * ARROW_WIDTH) / 2;
		const bx = tip.x - ux * len;
		const by = tip.y - uy * len;
		return `${tip.x},${tip.y} ${bx - uy * w},${by + ux * w} ${bx + uy * w},${by - ux * w}`;
	}
	/** What a line says on hover, in the words of the canvas: "haalt aan, 3 keer, voorgesteld". */
	function lineLabel(p: LanePath): string | null {
		const line = scene.lines.find((l) => l.id === p.id);
		if (!line) return null;
		const from = byId.get(unitOf.get(line.from)?.members[0] ?? '')?.collection ?? null;
		const to = byId.get(unitOf.get(line.to)?.members[0] ?? '')?.collection ?? null;
		const parts = [relationLabel(line.relation, from, to)];
		if (line.count > 1) parts.push(`${formatCount(line.count)} keer`);
		if (line.proposed) parts.push('voorgesteld');
		return parts.join(', ');
	}
	/** Where a line's label stands: the middle of its longest run. */
	function middleOf(p: LanePath) {
		let best = { x: p.points[0].x, y: p.points[0].y, len: -1 };
		for (let i = 1; i < p.points.length; i++) {
			const [a, b] = [p.points[i - 1], p.points[i]];
			const len = Math.hypot(b.x - a.x, b.y - a.y);
			if (len > best.len) best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, len };
		}
		return best;
	}
	const styled = $derived(
		paths.map((p) => ({
			...p,
			colour: lineColour(p),
			dash: edgeDashFor(p.stroke),
			cap: edgeCapFor(p.stroke),
			head: head(p),
			label: lineLabel(p),
			at: middleOf(p)
		}))
	);

	// ── units ─────────────────────────────────────────────────────────────────
	const nodeOf = (u: SceneUnit) => byId.get(u.members[0]);
	/** The mark of a bron in the colour of its kind, as the canvas draws it (`markOf`). */
	function glyphOf(n: GraphNode | undefined, sort: Sort) {
		if (!n) return markOf('', sortColour(sort));
		const props = n.raw?.props;
		return markOf(n.collection, kindColour(n.collection, null, props), props, n.key);
	}
	/** A hull's pill marks its wet or dossier where the canvas has it; else it lights the hull's lines. */
	function choosePill(u: SceneUnit, read = false) {
		if (!byId.has(u.id)) hovered = hovered === u.id ? null : u.id;
		else if (read) onOpen(u.id);
		else onMark(u.id);
	}
	const discText = (u: SceneUnit) => formatCount(u.members.length);
	const rowCount = (n: number) => (n > 1 ? formatCount(n) : '');
	const GAP_LINES = ['functie niet', 'in de gegevens'];

	function choose(u: SceneUnit, id = u.members[0]) {
		if (u.shape === 'node' || id !== u.members[0] || u.shape === 'hull') onMark(id);
		else hovered = hovered === u.id ? null : u.id;
	}
	function onKey(e: KeyboardEvent, act: () => void) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	}

	/** The bronnen with no line to the chosen ones, by soort: one line under the lanes. */
	const unlinked = $derived(
		(Object.entries(scene.counts.unlinked) as [Sort, number][])
			.filter(([, n]) => n > 0)
			.map(([s, n]) => `${formatCount(n)} ${n === 1 ? sortOne(s) : sortLabel(s).toLowerCase()}`)
			.join(', ')
	);
	const boxOf = (id: string): UnitBox | undefined => layout.units.get(id);
	const titleOf = (u: SceneUnit) =>
		[u.label, u.role, u.breakdown].filter(Boolean).join(', ') || u.label;
</script>

{#snippet sign(n: GraphNode | undefined, sort: Sort, x: number, y: number, size: number)}
	{@const g = glyphOf(n, sort)}
	{@const sc = size / 16}
	<path
		d={g.d}
		transform="translate({x} {y}) scale({sc})"
		fill={g.fill}
		fill-rule="evenodd"
		stroke={g.stroke === 'none' ? 'var(--paper)' : g.stroke}
		stroke-width={(g.stroke === 'none' ? 1 : 2) / sc}
		stroke-linejoin="round"
	/>
{/snippet}

{#snippet focusRing(box: UnitBox)}
	<circle
		class="halo"
		cx={box.mark.x + box.mark.width / 2}
		cy={box.mark.y + box.mark.height / 2}
		r={box.mark.width / 2 + 5}
	/>
	<circle
		class="ring"
		cx={box.mark.x + box.mark.width / 2}
		cy={box.mark.y + box.mark.height / 2}
		r={box.mark.width / 2 + 5}
	/>
{/snippet}

{#snippet hull(u: SceneUnit, box: UnitBox)}
	{@const colour = sortColour(u.sort)}
	{@const dossier = u.column === 'papers'}
	{@const perLine = Math.max(1, Math.floor((box.mark.width - 32) / DOT))}
	{@const headed = u.rows.length > 1 || u.rows.some((r) => r.label)}
	<rect
		class="hull"
		x={box.mark.x}
		y={box.mark.y}
		width={box.mark.width}
		height={box.mark.height}
		rx="9"
		stroke={colour}
		stroke-dasharray={dossier ? '6 4' : undefined}
		style:--tint={colour}
	/>
	<g
		class="pill"
		role="button"
		tabindex="-1"
		aria-label={u.label}
		aria-pressed={markedUnit === u.id}
		onclick={() => choosePill(u)}
		ondblclick={() => choosePill(u, true)}
		onkeydown={(e) => onKey(e, () => choosePill(u))}
	>
		<title>{u.label}</title>
		<rect
			x={box.label.x}
			y={box.label.y}
			width={box.label.width}
			height={box.label.height}
			rx={box.label.height / 2}
			stroke={colour}
		/>
		<text class="pill-name" x={box.label.x + 10} y={box.label.y + box.label.height / 2 + 4.5}
			>{box.text.name[0]}</text
		>
	</g>
	{#each u.rows as row (row.id)}
		{@const at = box.rows.find((r) => r.id === row.id)}
		{#if at}
			{#if phone}
				<!-- A phone: a line per row, its sign, its name and how many. -->
				{@const first = byId.get(row.members[0])}
				{@const holdsChosen = row.members.find((m) => chosen.includes(m))}
				<g
					class="member"
					role="button"
					tabindex="-1"
					aria-label="{row.label || u.label} {rowCount(row.members.length)}"
					onclick={() => onMark(holdsChosen ?? row.members[0])}
					onkeydown={(e) => onKey(e, () => onMark(holdsChosen ?? row.members[0]))}
				>
					{@render sign(first, u.sort, box.mark.x + 16, at.y - 7, GLYPH)}
					<text class="row-name" x={box.mark.x + 38} y={at.y + 4}
						>{row.label || u.label}<tspan class="row-count" dx="6"
							>{rowCount(row.members.length)}</tspan
						></text
					>
				</g>
			{:else}
				{#if headed}<text class="row-head" x={box.mark.x + 16} y={at.y - DOT_LINE / 2 - 5}
						>{row.label}<tspan class="row-count" dx="6">{rowCount(row.members.length)}</tspan></text
					>{/if}
				{#each row.members.slice(0, 2 * perLine) as m, i (m)}
					{@const n = byId.get(m)}
					{@const cx = box.mark.x + 16 + (i % perLine) * DOT}
					{@const cy = at.y - GLYPH / 2 + Math.floor(i / perLine) * DOT_LINE}
					<g
						class="member"
						class:is-active={marked === m}
						role="button"
						tabindex="-1"
						aria-label={n?.label ?? m}
						aria-pressed={marked === m}
						onclick={() => onMark(m)}
						ondblclick={() => onOpen(m)}
						onkeydown={(e) => onKey(e, () => onMark(m))}
					>
						<title>{n?.label ?? m}</title>
						<rect class="hit" x={cx - 5} y={cy - 5} width={GLYPH + 10} height={GLYPH + 10} />
						{#if chosen.includes(m) || marked === m}{@render focusRing({
								...box,
								mark: { x: cx, y: cy, width: GLYPH, height: GLYPH }
							})}{/if}
						{@render sign(n, u.sort, cx, cy, GLYPH)}
					</g>
				{/each}
			{/if}
		{/if}
	{/each}
{/snippet}

{#snippet unit(u: SceneUnit, box: UnitBox)}
	{#if u.shape === 'hull' && (!phone || u.focus)}
		<g
			class="unit"
			class:is-dim={!!lit &&
				lit !== u.id &&
				!paths.some((p) => touches(p) && (p.from === u.id || p.to === u.id))}
			data-unit={u.id}
			onpointerenter={() => (hovered = u.id)}
			onpointerleave={() => (hovered = null)}
		>
			{@render hull(u, box)}
		</g>
	{:else}
		{@const disc = u.shape !== 'node'}
		{@const n = nodeOf(u)}
		{@const cx = box.mark.x + box.mark.width / 2}
		{@const cy = box.mark.y + box.mark.height / 2}
		{@const showName = !named || named.has(u.id) || u.focus}
		<g
			class="unit"
			class:is-active={markedUnit === u.id}
			class:is-dim={!!lit &&
				lit !== u.id &&
				!paths.some((p) => touches(p) && (p.from === u.id || p.to === u.id))}
			data-unit={u.id}
			role="button"
			tabindex="-1"
			aria-label={titleOf(u)}
			aria-pressed={u.shape === 'node' ? markedUnit === u.id : lit === u.id}
			onclick={() => choose(u)}
			ondblclick={() => u.shape === 'node' && onOpen(u.members[0])}
			onkeydown={(e) => onKey(e, () => choose(u))}
			onpointerenter={() => (hovered = u.id)}
			onpointerleave={() => (hovered = null)}
			onfocus={() => (hovered = u.id)}
			onblur={() => (hovered = null)}
		>
			<title>{titleOf(u)}</title>
			<rect class="hit" x={box.x - 4} y={box.y - 4} width={box.width + 8} height={box.height + 8} />
			{#if u.focus || markedUnit === u.id}{@render focusRing(box)}{/if}
			{#if disc}
				<circle class="disc" {cx} {cy} r={box.mark.width / 2} style:--tint={sortColour(u.sort)} />
				<text class="count" x={cx} y={cy + 4}>{discText(u)}</text>
			{:else}
				{@render sign(n, u.sort, box.mark.x, box.mark.y, GLYPH)}
			{/if}
			{#if phone}
				{#if showName}
					{#each box.text.name as line, i (i)}
						<text class="name centre" x={cx} y={box.label.y + 11 + i * LINE}>{line}</text>
					{/each}
				{/if}
			{:else}
				<!-- The lines as the layout measured them (lane-layout.ts): nothing wraps again here. -->
				{@const step = disc ? SMALL_LINE : LINE}
				{@const below = box.label.y + 11 + box.text.name.length * step}
				{#each box.text.name as line, i (i)}
					<text class="name" x={box.label.x} y={box.label.y + 11 + i * step}>{line}</text>
				{/each}
				{#each box.text.small as line, i (i)}
					<text class={disc ? 'name sub' : 'role'} x={box.label.x} y={below - 2 + i * SMALL_LINE}
						>{line}</text
					>
				{/each}
				{#if u.gap}
					{#each GAP_LINES as line, i (i)}
						<text
							class="gap"
							x={box.label.x}
							y={below + box.text.small.length * SMALL_LINE + i * SMALL_LINE}>{line}</text
						>
					{/each}
				{/if}
			{/if}
		</g>
	{/if}
{/snippet}

{#snippet path(p: (typeof styled)[number])}
	<path
		class="line"
		d={p.d}
		fill="none"
		stroke={p.colour}
		stroke-width={p.width}
		stroke-dasharray={p.dash}
		stroke-linecap={p.cap}
	/>
	{#if p.head}<polygon points={p.head} fill={p.colour} />{/if}
	<circle cx={p.points[0].x} cy={p.points[0].y} r={DOT_RADIUS * 0.75} fill={p.colour} />
{/snippet}

<div class="banen" bind:clientWidth={avail} data-testid="banen">
	{#if scene.units.length === 0}
		<!-- No bron at all: the canvas says so itself (Nog geen bron gekozen). -->
		{#if nodes.length > 0}<div class="leeg">
				<p class="leeg__kop">Niets te tekenen met deze filters</p>
			</div>{/if}
	{:else}
		<svg
			class="drawing"
			width={layout.width * scale}
			height={layout.height * scale}
			viewBox="0 0 {layout.width} {layout.height}"
			role="group"
			aria-label="Omgeving in banen"
		>
			{#each layout.columns as c (c.column)}
				{#if phone}
					<rect
						class="panel"
						x={c.x}
						y={c.y}
						width={c.width}
						height={c.height}
						rx="12"
						style:--tint={sortColour(COLUMN_SORT[c.column])}
					/>
					<text class="col-head" x={c.x + 12} y={c.y + 22}>{COLUMN_TITLE[c.column]}</text>
					<rect
						class="col-bar"
						x={c.x + 12}
						y={c.y + 29}
						width="120"
						height="3"
						rx="1.5"
						fill={sortColour(COLUMN_SORT[c.column])}
					/>
				{:else}
					<rect
						class="panel"
						x={c.x - 14}
						y={CONTENT_TOP - 52}
						width={c.width + 28}
						height={c.height + 52 + 14}
						rx="12"
						style:--tint={sortColour(COLUMN_SORT[c.column])}
					/>
					<text class="col-head" x={c.x} y={CONTENT_TOP - 26}>{COLUMN_TITLE[c.column]}</text>
					<rect
						class="col-bar"
						x={c.x}
						y={CONTENT_TOP - 18}
						width={c.width}
						height="3"
						rx="1.5"
						fill={sortColour(COLUMN_SORT[c.column])}
					/>
				{/if}
			{/each}
			{#if layout.strip}
				{@const s = layout.strip}
				<rect
					class="panel"
					x={s.x}
					y={s.y}
					width={s.width}
					height={s.height}
					rx="12"
					style:--tint="var(--rubriek-wetten)"
				/>
				<text class="col-head" x={s.x + 14} y={s.y + 24}>Algemene wetten</text>
			{/if}
			{#each layout.lanes as l (l.lane)}
				<rect
					class="lane"
					x={l.x}
					y={l.y}
					width={l.width}
					height={l.height}
					rx="8"
					stroke={sortColour(LANE_SORT[l.lane])}
				/>
				<text class="lane-head" x={l.x + 8} y={l.y + 16}>{LANE_TITLE[l.lane]}</text>
			{/each}
			{#if phone}
				{#each (layout as StripLayout).years as y (y.y)}
					<text class="lane-head" x="28" y={y.y}>{y.label}</text>
				{/each}
			{/if}
			{#if layout.axis}
				{#each layout.axis.ticks as t (t.y + t.label)}
					<text class="tick tick--{t.kind}" x="16" y={t.y + 4}>{t.label}</text>
					{#if t.kind === 'year'}<line
							class="tick-line"
							x1="60"
							x2={layout.width - 20}
							y1={t.y}
							y2={t.y}
						/>{/if}
				{/each}
			{/if}
			<!-- The lines under the units; the lit ones over the rest, whole. -->
			<g class="lines" class:is-dim={anyLit}>
				{#each styled.filter((p) => !anyLit || !touches(p)) as p (p.id)}
					{@render path(p)}
				{/each}
			</g>
			{#if anyLit}
				<g class="lines lines--lit">
					{#each styled.filter(touches) as p (p.id)}
						{@render path(p)}
					{/each}
				</g>
			{/if}
			<!-- A finger's width along each line, unseen: a pointer on it says what the line is. -->
			<g class="line-hits">
				{#each styled as p (p.id)}
					<path
						class="line-hit"
						d={p.d}
						role="img"
						aria-label={p.label ?? undefined}
						onpointerenter={() => (hoveredLine = p.id)}
						onpointerleave={() => (hoveredLine = null)}
					/>
				{/each}
			</g>
			{#each scene.units as u (u.id)}
				{@const box = boxOf(u.id)}
				{#if box}{@render unit(u, box)}{/if}
			{/each}
			{#each styled.filter((p) => p.id === hoveredLine && p.label) as p (p.id)}
				<text class="line-label" x={p.at.x} y={p.at.y - 6}>{p.label}</text>
			{/each}
			{#if phone}
				{#each layout.columns.filter((c) => c.column === 'makers') as c (c.column)}
					{@const makers = scene.units.filter((u) => u.column === 'makers' && !u.general)}
					{@const byLane = (['government', 'council', 'parliament'] as const)
						.map((lane) => [lane, makers.filter((u) => u.lane === lane).length] as const)
						.filter(([, k]) => k > 0)}
					<text class="summary" x={c.x + 12} y={c.y + c.height - 14}
						>{byLane
							.map(
								([lane, k]) =>
									`${k} ${lane === 'council' ? LANE_TITLE[lane] : LANE_TITLE[lane].toLowerCase()}`
							)
							.join(', ')}</text
					>
				{/each}
			{/if}
		</svg>
		{#if unlinked}<p class="stil unlinked">Zonder lijn naar de gekozen bronnen: {unlinked}</p>{/if}
	{/if}
</div>

<style>
	.banen {
		position: absolute;
		inset: 0;
		overflow: auto;
		background: var(--paper);
	}
	/* A phone: the button Weergave floats over the foot of the canvas; the lanes end above it. */
	@media (max-width: 768px) {
		.banen {
			padding-bottom: calc(44px + 2 * var(--s-4));
		}
	}
	.row-count {
		fill: var(--ink-3);
	}
	.drawing {
		display: block;
	}
	.leeg {
		display: grid;
		place-content: center;
		height: 100%;
		text-align: center;
	}
	.leeg__kop {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		margin: 0 0 var(--s-2);
	}
	.unlinked {
		margin: 0 var(--s-4) var(--s-6);
	}
	.panel {
		fill: color-mix(in srgb, var(--tint) 4.5%, transparent);
	}
	.col-head {
		font-size: var(--t-micro);
		font-weight: 600;
		fill: var(--ink);
	}
	.lane {
		fill: var(--paper);
		stroke-opacity: 0.35;
	}
	.lane-head,
	.tick {
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		fill: var(--ink-2);
	}
	.tick--month {
		font-weight: 400;
		text-transform: none;
	}
	.tick-line {
		stroke: var(--rule);
		stroke-dasharray: 2 3;
	}
	.hull {
		fill: color-mix(in srgb, var(--tint) 7%, transparent);
		stroke-width: 1.6px;
	}
	.pill rect {
		fill: var(--paper);
		stroke-width: 1.4px;
	}
	.pill-name {
		font-family: var(--font-serif);
		font-size: var(--t-note);
		font-weight: 600;
		fill: var(--ink);
	}
	.pill,
	.member,
	.unit {
		cursor: pointer;
	}
	.row-head,
	.row-name,
	.summary {
		font-size: var(--t-note);
		fill: var(--ink-2);
	}
	.hit {
		fill: transparent;
		rx: 4px;
	}
	.name {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-2);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 3px;
		stroke-linejoin: round;
	}
	.name.centre {
		text-anchor: middle;
	}
	.name.sub,
	.role {
		font-size: var(--t-label);
		fill: var(--ink-3);
	}
	.gap {
		font-family: var(--font-serif);
		font-size: var(--t-note);
		font-style: italic;
		fill: var(--ink-3);
	}
	.disc {
		fill: color-mix(in srgb, var(--tint) 14%, var(--paper));
		stroke: var(--tint);
		stroke-width: 1.4px;
	}
	.count {
		font-size: var(--t-label);
		font-weight: 600;
		fill: var(--ink);
		text-anchor: middle;
	}
	.ring {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.5px;
	}
	.halo {
		fill: none;
		stroke: var(--paper);
		stroke-width: 5px;
	}
	.unit.is-dim {
		opacity: 0.35;
	}
	.line-hit {
		fill: none;
		stroke: transparent;
		stroke-width: 12px;
		pointer-events: stroke;
	}
	.line-label {
		font-size: var(--t-note);
		fill: var(--ink);
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.lines.is-dim {
		opacity: 0.2;
	}
	.unit:hover .name,
	.unit.is-active .name {
		fill: var(--ink);
	}
</style>
