<script lang="ts">
	// The rows of Verband (DS Verband): each row a chain from the one chosen bron to the other,
	// also at one step, where its kenmerk (what both name) stands between them as a pill. The
	// two chosen bronnen are the heads of the columns at the left and right; a block for each
	// length (Eén stap, Twee stappen, Drie stappen). A tap on a pill or a tussenbron marks its
	// row: a ring, its lines in ink and thicker, the other rows at 35 %. On a phone the same
	// rows as a numbered list for each block.
	import { kindColour } from '$lib/bron/kleur';
	import { markOf } from '$lib/bron/vormen';
	import { drawnLine } from '$lib/components/graph/drawn-line';
	import { DOT_RADIUS } from '$lib/graph/line-shape';
	import type { ChainBlock, ChainBron, ChainRow, ChainStep, StepLeg } from './linkchains';
	import { drawingLabel, rowIds, stepsText, type PairDrawing, type PairEnd } from './pairs';

	let {
		drawing,
		scale = 1,
		chosen = null,
		onChoose
	}: {
		drawing: PairDrawing;
		scale?: number;
		/** The bron marked (a kenmerk or a tussenbron), its card in the strip. */
		chosen?: string | null;
		onChoose: (id: string) => void;
	} = $props();

	const blocks = $derived(drawing.blocks);
	const ends = $derived([drawing.left, drawing.right, ...drawing.extra]);
	/** A row is the chosen one where it holds the marked bron; no mark, every row is full. */
	const marks = $derived(
		!!chosen && blocks.some((b) => b.rows.some((r) => rowIds(r).includes(chosen)))
	);
	const dimmed = (r: ChainRow) => marks && !rowIds(r).includes(chosen!);
	const active = (r: ChainRow) => marks && rowIds(r).includes(chosen!);

	let width = $state(760);
	const W = $derived(Math.max(width, 640));
	const LEFT = $derived(Math.round(W * 0.1));
	const RIGHT = $derived(W - LEFT);
	const LINE = 14;
	const PILL_GAP = 3;
	const EXTRA_STEP = 18;

	/** A name over lines of at most `max` characters, at the words; the last ends in "…". */
	function wrap(name: string, max: number, lines = 3): string[] {
		const out: string[] = [];
		let line = '';
		for (const word of name.split(' ')) {
			if (line && `${line} ${word}`.length > max) {
				out.push(line);
				line = word;
			} else line = line ? `${line} ${word}` : word;
		}
		out.push(line);
		return out.length > lines
			? [
					...out.slice(0, lines - 1),
					`${out
						.slice(lines - 1)
						.join(' ')
						.slice(0, max - 1)}…`
				]
			: out;
	}
	const headChars = $derived(Math.max(10, Math.floor((2 * LEFT - 8) / 7)));
	const leftLines = $derived(wrap(drawing.left.name, headChars));
	const rightLines = $derived([
		...wrap(drawing.right.name, headChars),
		...drawing.extra.flatMap((e) => wrap(e.name, headChars, 2))
	]);
	const HEAD = $derived(16 + Math.max(leftLines.length, rightLines.length) * 18);

	const stepsOf = (b: ChainBlock) => b.steps;
	const rowHeight = (b: ChainBlock) =>
		b.steps === 1 && drawing.extra.length === 0
			? 56
			: 70 + Math.max(0, drawing.extra.length - 1) * EXTRA_STEP;

	/** Where each block stands: its top, and the top of each of its rows; and the whole height. */
	const layout = $derived.by(() => {
		const out: { top: number; rows: number[]; note: number | null; none: number | null }[] = [];
		let y = HEAD + 8;
		for (const b of blocks) {
			const top = y;
			y += 28;
			let note: number | null = null;
			if (!b.complete) {
				note = y;
				y += 20;
			}
			const h = rowHeight(b);
			const rows = b.rows.map((_, i) => y + i * h);
			let none: number | null = null;
			if (b.rows.length === 0) {
				none = y;
				y += 28;
			}
			y += b.rows.length * h + 20;
			out.push({ top, rows, note, none });
		}
		return { blocks: out, height: y };
	});

	const cut = (s: string, room: number) => {
		const max = Math.max(6, Math.floor(room / 6.8));
		return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
	};
	const markFor = (b: ChainBron) =>
		markOf(
			b.collection ?? 'instruments',
			kindColour(b.collection),
			b.node?.props,
			b.node?.key ?? ''
		);
	/** The sign of a chosen end: the form and colour of its kind. */
	const endMark = (e: PairEnd) =>
		markOf(e.collection ?? 'instruments', kindColour(e.collection), e.props, e.id.split('/')[1]);
	const endOf = (id: string) => drawing.extra.find((e) => e.id === id) ?? drawing.right;
	const aria = (b: ChainBron, what: string) => `${b.name}, ${what}`;

	type Point = { x: number; y: number };
	/** A step's weight gives its line its thickness: weight times 3 px, within what reads. */
	const thick = (weight: number | null) =>
		weight === null ? undefined : Math.min(4.5, Math.max(1.4, weight * 3));
	const leg = (a: Point, b: Point, l: StepLeg, weight: number | null, ra: number, rb: number) =>
		drawnLine(a, b, {
			relation: l.relation,
			from: l.from,
			arrow: l.arrow === 'end' ? 'b' : l.arrow === 'start' ? 'a' : null,
			ra,
			rb,
			width: thick(weight)
		});
	/** The width of a pill: its sign, its name and the room around them. */
	const PILL_PAD = 8;
	const SIGN = 12;
	const pillWidth = (label: string) => PILL_PAD + SIGN + 6 + label.length * 6.9 + PILL_PAD;
	/** The lines of a step from `p` to `q`: one, or two with the pill of its kenmerk between. */
	function segs(s: ChainStep, p: Point, q: Point, label: string) {
		if (!s.via) return [leg(p, q, s.legs[0], s.weight, LINE, LINE)];
		const half = pillWidth(label) / 2;
		const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
		const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
		const t = Math.min(half, d / 2 - LINE) / d;
		const near = { x: mid.x - (q.x - p.x) * t, y: mid.y - (q.y - p.y) * t };
		const far = { x: mid.x + (q.x - p.x) * t, y: mid.y + (q.y - p.y) * t };
		return [
			leg(p, near, s.legs[0], s.weight, LINE, PILL_GAP),
			leg(far, q, s.legs[1], s.weight, PILL_GAP, LINE)
		];
	}
	/** The x of the i-th bron of a row of `n` steps. */
	const xAt = (i: number, n: number) => LEFT + ((RIGHT - LEFT) * i) / n;
	const press = (e: KeyboardEvent, id: string) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		onChoose(id);
	};
	const listLabel = (b: ChainBlock) => `${b.title}, ${drawing.left.name} en ${drawing.right.name}`;
</script>

<div class="rows" bind:clientWidth={width}>
	<svg
		class="drawing"
		style:width="{scale * 100}%"
		viewBox="0 0 {W} {layout.height}"
		role="group"
		aria-label={drawingLabel(drawing)}
	>
		<text class="head" x={LEFT} y="22" text-anchor="middle"
			>{#each leftLines as line, i (i)}<tspan x={LEFT} dy={i ? 18 : 0}>{line}</tspan>{/each}</text
		>
		<text class="head" x={RIGHT} y="22" text-anchor="middle"
			>{#each rightLines as line, i (i)}<tspan x={RIGHT} dy={i ? 18 : 0}>{line}</tspan>{/each}</text
		>
		{#each blocks as b, bi (b.steps)}
			{@const at = layout.blocks[bi]}
			{@const n = stepsOf(b)}
			<text class="kop" x="16" y={at.top + 16} role="heading" aria-level="3"
				>{b.title}{#if b.count}<tspan class="count" dx="12">{b.count}</tspan>{/if}</text
			>
			{#if at.note !== null}
				<text class="count" x="16" y={at.note + 14}
					>Niet alles doorzocht: er kunnen meer ketens zijn.</text
				>
			{/if}
			{#if at.none !== null}
				<text class="count" x="16" y={at.none + 14}
					>{b.complete
						? `Geen keten van ${stepsText(n)}`
						: 'Geen keten gevonden, het zoeken was niet volledig'}</text
				>
			{/if}
			{#each b.rows as r, ri (r.id)}
				{@const y = at.rows[ri] + (n === 1 && drawing.extra.length === 0 ? 22 : 24)}
				<g class="row" class:is-dim={dimmed(r)} class:is-active={active(r)}>
					{#each r.steps as s, si (si)}
						{@const p = { x: xAt(si, n), y }}
						{@const q = { x: xAt(si + 1, n), y }}
						{@const room = Math.abs(q.x - p.x) - 2 * LINE - 12}
						{@const label = s.via ? cut(s.via.name, room - PILL_PAD * 2 - SIGN - 6) : ''}
						{@const ss = segs(s, p, q, label)}
						{@const mx = (p.x + q.x) / 2}
						{#each ss as l, li (li)}
							<path
								class="line"
								d={l.d}
								fill="none"
								stroke={active(r) ? 'var(--ink)' : l.colour}
								stroke-width={l.width * (active(r) ? 1.3 : 1)}
								stroke-dasharray={l.dash}
								stroke-linecap={l.cap}
							/>
							{#if l.head}<polygon
									class="line"
									points={l.head}
									fill={active(r) ? 'var(--ink)' : l.colour}
								/>{/if}
							{#if l.dot}<circle
									cx={l.dot.x}
									cy={l.dot.y}
									r={DOT_RADIUS}
									fill={active(r) ? 'var(--ink)' : l.colour}
								/>{/if}
						{/each}
						{#if s.via}
							{@const v = markFor(s.via)}
							{@const w = pillWidth(label)}
							<g
								class="node"
								role="button"
								tabindex="0"
								aria-label={aria(s.via, s.text)}
								aria-pressed={chosen === s.via.id}
								onclick={() => onChoose(s.via!.id)}
								onkeydown={(e) => press(e, s.via!.id)}
							>
								<title>{aria(s.via, s.text)}</title>
								{#if chosen === s.via.id}<rect
										class="ring"
										x={mx - w / 2 - 3}
										y={y - 15}
										width={w + 6}
										height="30"
										rx="4"
									/>{/if}
								<rect
									class="pill"
									class:is-active={chosen === s.via.id}
									x={mx - w / 2}
									y={y - 12}
									width={w}
									height="24"
									style:stroke={kindColour(s.via.collection)}
								/>
								<path
									d={v.d}
									transform="translate({mx - w / 2 + PILL_PAD} {y - 6}) scale(0.75)"
									fill={v.fill}
									fill-rule="evenodd"
									stroke={v.stroke}
									stroke-width="1.5"
								/>
								<text class="pill__name" x={mx - w / 2 + PILL_PAD + SIGN + 6} y={y + 4}
									>{label}</text
								>
							</g>
						{/if}
						<text class="by" x={mx} y={y + 26} text-anchor="middle">{s.text}</text>
					{/each}
					{#each r.bronnen as b, i (i)}
						{#if i === 0 || i === r.bronnen.length - 1}
							{@const x = i === 0 ? LEFT : RIGHT}
							{@const e = i === 0 ? drawing.left : drawing.right}
							{@const v = endMark(e)}
							<g class="end" data-kind={e.collection}>
								<circle class="end__ring" cx={x} cy={y} r="13" />
								<path
									d={v.d}
									transform="translate({x - 9} {y - 9}) scale(1.125)"
									fill={v.fill}
									fill-rule="evenodd"
									stroke={v.stroke}
									stroke-width="1.5"
								/>
							</g>
						{:else}
							{@const v = markFor(b)}
							{@const x = xAt(i, n)}
							<g
								class="node"
								role="button"
								tabindex="0"
								aria-label={aria(b, 'tussenbron')}
								aria-pressed={chosen === b.id}
								onclick={() => onChoose(b.id)}
								onkeydown={(e) => press(e, b.id)}
							>
								<title>{aria(b, 'tussenbron')}</title>
								<rect class="hit" x={x - 70} y={y - 16} width="140" height="52" />
								{#if chosen === b.id}<rect
										class="ring"
										x={x - 13}
										y={y - 13}
										width="26"
										height="26"
										rx="3"
									/>{/if}
								<path
									d={v.d}
									transform="translate({x - 9} {y - 9}) scale(1.125)"
									fill={v.fill}
									fill-rule="evenodd"
									stroke={v.stroke}
									stroke-width="1.5"
								/>
								<text class="name" {x} y={y + 32} text-anchor="middle"
									>{cut(b.name, (RIGHT - LEFT) / n - 16)}</text
								>
							</g>
						{/if}
					{/each}
					{#each r.also ?? [] as e, ei (e.bron.id)}
						{@const ey = y + 22 + ei * EXTRA_STEP}
						{@const pillX = (LEFT + RIGHT) / 2}
						{@const l = leg(
							{ x: pillX + 24, y: y + 12 },
							{ x: RIGHT, y: ey },
							e.leg,
							null,
							PILL_GAP,
							LINE / 2
						)}
						<path
							class="line"
							d={l.d}
							fill="none"
							stroke={active(r) ? 'var(--ink)' : l.colour}
							stroke-width={l.width * (active(r) ? 1.3 : 1)}
							stroke-dasharray={l.dash}
							stroke-linecap={l.cap}
						/>
						{#if l.head}<polygon
								class="line"
								points={l.head}
								fill={active(r) ? 'var(--ink)' : l.colour}
							/>{/if}
						{@const x3 = endMark(endOf(e.bron.id))}
						<g class="end" data-kind={e.bron.collection}>
							<circle class="end__ring" cx={RIGHT} cy={ey} r="10" />
							<path
								d={x3.d}
								transform="translate({RIGHT - 7} {ey - 7}) scale(0.875)"
								fill={x3.fill}
								fill-rule="evenodd"
								stroke={x3.stroke}
								stroke-width="1.5"
							/>
						</g>
					{/each}
				</g>
			{/each}
		{/each}
	</svg>

	<!-- On a phone: the same rows as a numbered list for each block. -->
	<div class="ladder">
		<ul class="ladder__ends">
			{#each ends as e (e.id)}
				{@const v = endMark(e)}
				<li>
					<svg class="mark--end" viewBox="-3 -3 22 22" width="18" height="18" aria-hidden="true">
						<circle class="end__ring" cx="8" cy="8" r="10" />
						<path d={v.d} fill={v.fill} fill-rule="evenodd" stroke={v.stroke} stroke-width="1.5" />
					</svg>{e.name}
				</li>
			{/each}
		</ul>
		{#each blocks as b (b.steps)}
			<section>
				<h3 class="ladder__head">
					{b.title}{#if b.count}<span class="ladder__count">{b.count}</span>{/if}
				</h3>
				{#if !b.complete}<p class="stil ladder__count">
						Niet alles doorzocht: er kunnen meer ketens zijn.
					</p>{/if}
				{#if b.rows.length === 0}
					<p class="stil">
						{b.complete
							? `Geen keten van ${stepsText(b.steps)}`
							: 'Geen keten gevonden, het zoeken was niet volledig'}
					</p>
				{/if}
				<ol class="ladder__list" aria-label={listLabel(b)}>
					{#each b.rows as r, i (r.id)}
						<li class:is-dim={dimmed(r)} class:is-active={active(r)}>
							<span class="num" aria-hidden="true">{i + 1}</span>
							<span class="ladder__chain">
								{#if b.steps > 1}<span class="ladder__end">{drawing.left.name}</span>{/if}
								{#each r.steps as s, si (si)}
									{#if s.via}
										{@const v = markFor(s.via)}
										<button
											type="button"
											class="ladder__pill"
											aria-pressed={chosen === s.via.id}
											aria-label={aria(s.via, s.text)}
											onclick={() => onChoose(s.via!.id)}
										>
											<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
												<path
													d={v.d}
													fill={v.fill}
													fill-rule="evenodd"
													stroke={v.stroke}
													stroke-width="1.5"
												/>
											</svg>{s.via.name}
										</button>
									{/if}
									<span class="ladder__how">{b.steps === 1 && !s.via ? s.phone : s.text}</span>
									{#if si < r.steps.length - 1}
										{@const m = r.bronnen[si + 1]}
										<button
											type="button"
											class="ladder__between"
											aria-pressed={chosen === m.id}
											aria-label={aria(m, 'tussenbron')}
											onclick={() => onChoose(m.id)}>{m.name}</button
										>
									{/if}
								{/each}
								{#if b.steps > 1}<span class="ladder__end">{drawing.right.name}</span>{/if}
							</span>
						</li>
					{/each}
				</ol>
			</section>
		{/each}
	</div>
</div>

<style>
	.rows {
		position: relative;
	}
	.drawing {
		display: block;
		width: 100%;
		height: auto;
	}
	.head {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		fill: var(--ink);
	}
	.kop {
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		fill: var(--ink-3);
	}
	.count,
	.by {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		letter-spacing: 0;
		text-transform: none;
		font-weight: 400;
		fill: var(--ink-3);
	}
	.by {
		font-size: var(--t-note);
		font-style: italic;
		fill: var(--ink-2);
	}
	.row.is-dim {
		opacity: 0.35;
	}
	.pill {
		fill: var(--paper);
		stroke-width: 1;
		rx: var(--r-1);
	}
	.pill.is-active {
		fill: var(--paper-2);
	}
	.ring {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2;
	}
	.pill__name {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		fill: var(--ink);
	}
	/* A chosen end wears the sign of its kind, as on the canvas, in the ring of "chosen". */
	.end__ring {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 2;
	}
	.name {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-2);
	}
	.node {
		cursor: pointer;
	}
	.node:focus:not(:focus-visible) {
		outline: none;
	}
	.node:hover .name {
		fill: var(--ink);
		text-decoration: underline;
	}
	.hit {
		fill: transparent;
	}
	.ladder {
		display: none;
	}
	@media (max-width: 768px) {
		.drawing {
			display: none;
		}
		.ladder {
			display: block;
			padding: var(--s-2) var(--s-4) var(--s-8);
		}
	}
	.ladder ul,
	.ladder ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ladder__ends {
		display: grid;
		gap: var(--s-1);
		padding-bottom: var(--s-4);
	}
	.ladder__ends li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		font-size: var(--t-ui-raak);
		font-weight: 600;
		color: var(--ink);
	}
	.mark--end {
		flex: none;
	}
	.ladder section + section {
		margin-top: var(--s-5);
	}
	.ladder__head {
		display: flex;
		align-items: baseline;
		gap: var(--s-3);
		margin: 0 0 var(--s-2);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.ladder__count {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		color: var(--ink-3);
	}
	.ladder__list {
		border-top: 1px solid var(--rule);
	}
	.ladder__list li {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
		min-height: var(--veld-h-raak);
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
	}
	.ladder__list li.is-dim {
		opacity: 0.35;
	}
	.ladder__list li.is-active {
		background: var(--paper-2);
	}
	.num {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: var(--r-rond);
		background: var(--ink);
		color: var(--paper);
		font-size: var(--t-ui);
		font-weight: 600;
		line-height: 24px;
		text-align: center;
	}
	.ladder__chain {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
	}
	.ladder__end {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
	.ladder__pill,
	.ladder__between {
		display: inline-flex;
		align-items: flex-start;
		gap: var(--s-2);
		min-height: 24px;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}
	.ladder__pill svg {
		flex: none;
		margin-top: 5px;
	}
	.ladder__pill {
		font-size: var(--t-ui-raak);
		font-weight: 600;
		line-height: 24px;
	}
	.ladder__between {
		font-size: var(--t-body-2);
		line-height: 24px;
		color: var(--ink-2);
	}
	.ladder__pill[aria-pressed='true'],
	.ladder__between[aria-pressed='true'] {
		text-decoration: underline;
		text-decoration-thickness: 2px;
	}
	.ladder__how {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-style: italic;
		line-height: 20px;
		color: var(--ink-2);
	}
</style>
