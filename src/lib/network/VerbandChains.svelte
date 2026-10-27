<script lang="ts">
	// The ketens of Verband at two and three steps (DS Verband, "Diepte 2 en 3"): the two
	// chosen bronnen left and right, a row for each chain between them, a block for each length
	// (Twee stappen, Drie stappen). Each tussenbron stands once, in the row of the first chain
	// that reaches it; a chain that touches it later runs to that place. A chain alone is the
	// Verbindingsketen: its steps named "Stap 1", "Stap 2". On a phone the same as numbered
	// steps. A step joins by what both share (a pill) or by a line (its verb).
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import SlowLoad from '$lib/components/ui/SlowLoad.svelte';
	import { kindColour } from '$lib/bron/kleur';
	import { VORMEN, vormVanBron } from '$lib/bron/vormen';
	import { chainsLabel, type ChainBron, type ChainRow, type ChainsState } from './linkchains';

	let {
		result,
		steps,
		scale = 1,
		chosen = null,
		onChoose
	}: {
		result: ChainsState;
		/** The longest chain asked: 2 or 3. */
		steps: number;
		scale?: number;
		/** The tussenbron marked, its card in the strip. */
		chosen?: string | null;
		onChoose: (b: ChainBron) => void;
	} = $props();

	const model = $derived(result.status === 'ready' ? result.model : null);
	/** One chain in all: the Verbindingsketen, each step named. */
	const single = $derived(!!model && model.blocks.flatMap((b) => b.rows).length === 1);
	const lengthWord = (n: number) => (n === 2 ? 'twee' : 'drie');

	let width = $state(760);
	const W = $derived(Math.max(width, 640));
	const ROW = 72;
	const HEAD = 40;
	const TOP = 56;
	const LEFT = 184;
	const RIGHT = $derived(W - 184);

	/** Where each block's rows stand, and the height of the whole. */
	const layout = $derived.by(() => {
		const blocks: { head: number; count: number | null; rows: number[]; empty: boolean }[] = [];
		let y = TOP;
		for (const b of model?.blocks ?? []) {
			const head = y;
			y += 24;
			let count: number | null = null;
			if (b.count) {
				count = y;
				y += 20;
			}
			const rows = b.rows.map((_, i) => y + 16 + i * ROW);
			y += Math.max(1, b.rows.length) * ROW + HEAD - 16;
			blocks.push({ head, count, rows, empty: b.rows.length === 0 });
		}
		return { blocks, height: y };
	});
	const placed = $derived.by(() => {
		const out = new Map<string, { x: number; y: number }>();
		if (!model) return out;
		for (const [id, p] of model.between) {
			const b = model.blocks[p.block];
			out.set(id, {
				x: LEFT + ((RIGHT - LEFT) * p.at) / b.steps,
				y: layout.blocks[p.block].rows[p.row]
			});
		}
		return out;
	});
	const points = (r: ChainRow, y: number) =>
		r.bronnen.map((b, i) =>
			i === 0
				? { x: LEFT, y }
				: i === r.bronnen.length - 1
					? { x: RIGHT, y }
					: (placed.get(b.id) ?? { x: LEFT, y })
		);

	const cut = (s: string, room: number) => {
		const max = Math.max(8, Math.floor(room / 7));
		return s.length > max ? `${s.slice(0, max - 1)}…` : s;
	};
	const vormOf = (b: ChainBron) =>
		VORMEN[vormVanBron(b.collection ?? 'instruments', b.node?.props, b.node?.key ?? '')];
	const press = (e: KeyboardEvent, b: ChainBron) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		onChoose(b);
	};
</script>

<div class="chains" bind:clientWidth={width}>
	{#if result.status === 'loading'}
		<!-- Cold, the route takes 10 to 12 s: the line stands still, after 3 s it says so. -->
		<SlowLoad label="Ketens zoeken…" visible />
	{:else if result.status === 'error'}
		<LoadState
			state={{ status: 'error', error: result.error }}
			what="De ketens"
			plural
			retry={result.retry}
			form="block"
		/>
	{:else if model}
		<svg
			class="drawing"
			style:width="{scale * 100}%"
			viewBox="0 0 {W} {layout.height}"
			role="group"
			aria-label={chainsLabel(model)}
		>
			<text class="name name--end" x={LEFT} y="24" text-anchor="middle"
				>{cut(model.ends[0].name, 200)}</text
			>
			<text class="name name--end" x={RIGHT} y="24" text-anchor="middle"
				>{cut(model.ends[1].name, 200)}</text
			>
			{#each model.blocks as b, bi (b.steps)}
				{@const at = layout.blocks[bi]}
				<text class="head" x="16" y={at.head + 16} role="heading" aria-level="3">{b.title}</text>
				{#if b.count && at.count !== null}
					<text class="count" x="16" y={at.count + 16}>{b.count}</text>
				{/if}
				{#if at.empty}
					<text class="count" x="16" y={at.head + 24 + (at.count ? 20 : 0) + 36}
						>{b.complete
							? `Geen keten van ${lengthWord(b.steps)} stappen`
							: 'Geen keten gevonden, het zoeken was niet volledig'}</text
					>
				{/if}
				{#each b.rows as r, ri (r.id)}
					{@const y = at.rows[ri]}
					{@const pts = points(r, y)}
					{#each r.steps as s, si (si)}
						{@const p = pts[si]}
						{@const q = pts[si + 1]}
						{@const mx = (p.x + q.x) / 2}
						{@const my = (p.y + q.y) / 2}
						{@const label = cut(s.via ? s.via.name : s.text, Math.abs(q.x - p.x) - 24)}
						<line class="line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
						{#if single}<text class="kop" x={mx} y={my - 28} text-anchor="middle"
								>Stap {si + 1}</text
							>{/if}
						<rect
							class="pill"
							x={mx - label.length * 3.4 - 8}
							y={my - 11}
							width={label.length * 6.8 + 16}
							height="22"
							style:stroke={s.via ? kindColour(s.via.collection) : undefined}
						/>
						<text class="pill__name" x={mx} y={my + 4} text-anchor="middle">{label}</text>
						{#if s.via}
							<text class="by" x={mx} y={my + 28} text-anchor="middle">{s.text}</text>
						{/if}
						<title>{s.pair}: {s.via ? `${s.via.name} ${s.text}` : s.text}</title>
					{/each}
					<rect class="end" x={LEFT - 9} y={y - 9} width="18" height="18" />
					<rect class="end" x={RIGHT - 9} y={y - 9} width="18" height="18" />
				{/each}
			{/each}
			{#each [...model.between.values()] as m (m.bron.id)}
				{@const p = placed.get(m.bron.id)}
				{#if p}
					{@const v = vormOf(m.bron)}
					<g
						class="node"
						class:is-active={chosen === m.bron.id}
						role="button"
						tabindex="0"
						aria-label={m.bron.name}
						aria-pressed={chosen === m.bron.id}
						onclick={() => onChoose(m.bron)}
						onkeydown={(e) => press(e, m.bron)}
					>
						<rect class="hit" x={p.x - 56} y={p.y - 16} width="112" height="56" />
						{#if chosen === m.bron.id}<rect
								class="sel"
								x={p.x - 13}
								y={p.y - 13}
								width="26"
								height="26"
								rx="2"
							/>{/if}
						<path
							d={v.d}
							transform="translate({p.x - 9} {p.y - 9}) scale(1.125)"
							fill={v.wijze === 'lijn' ? 'var(--paper)' : kindColour(m.bron.collection)}
							fill-rule="evenodd"
							stroke={v.wijze === 'lijn' ? kindColour(m.bron.collection) : 'none'}
							stroke-width="1.5"
						/>
						<text class="name" x={p.x} y={p.y + 32} text-anchor="middle"
							>{cut(m.bron.name, 112)}</text
						>
						<title>{m.bron.name}</title>
					</g>
				{/if}
			{/each}
		</svg>

		<!-- On a phone: the same as numbered steps, a list for each chain. -->
		<div class="ladder">
			{#each model.blocks as b (b.steps)}
				<section aria-labelledby="ketens-{b.steps}">
					<h3 id="ketens-{b.steps}" class="ladder__head">{b.title}</h3>
					{#if b.count}<p class="stil ladder__count">{b.count}</p>{/if}
					{#if b.rows.length === 0}
						<p class="stil">
							{b.complete
								? `Geen keten van ${lengthWord(b.steps)} stappen`
								: 'Geen keten gevonden, het zoeken was niet volledig'}
						</p>
					{/if}
					{#each b.rows as r (r.id)}
						<ol class="ladder__chain" aria-label="Verbindingsketen, {b.steps} stappen">
							{#each r.steps as s, i (i)}
								<li>
									<span class="num" aria-hidden="true">{i + 1}</span>
									<span class="ladder__step">
										<span class="ladder__pair">{s.pair}</span>
										<span class="ladder__how">{s.via ? `${s.via.name} ${s.text}` : s.text}</span>
									</span>
								</li>
							{/each}
						</ol>
					{/each}
				</section>
			{/each}
		</div>
	{/if}
</div>

<style>
	.chains {
		position: relative;
	}
	.drawing {
		display: block;
		width: 100%;
		height: auto;
	}
	.head {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		fill: var(--ink-3);
	}
	.kop {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		fill: var(--ink-3);
	}
	.count,
	.by {
		font-family: var(--font-serif);
		font-size: 12px;
		fill: var(--ink-3);
	}
	.by {
		font-style: italic;
		fill: var(--ink-2);
	}
	.line {
		stroke: color-mix(in srgb, var(--soort-wet) 55%, var(--paper));
		stroke-width: 2;
		stroke-dasharray: 4 3;
	}
	.pill {
		fill: var(--paper);
		stroke: var(--rule-strong);
		stroke-width: 1;
		rx: var(--r-1);
	}
	.pill__name {
		font-family: var(--font-serif);
		font-size: 13px;
		font-weight: 600;
		fill: var(--ink);
	}
	.end {
		fill: var(--ink);
	}
	.name {
		font-family: var(--font-serif);
		font-size: 13px;
		fill: var(--ink-2);
	}
	.name--end {
		font-size: 14px;
		font-weight: 600;
		fill: var(--ink);
	}
	.node {
		cursor: pointer;
	}
	.node:focus:not(:focus-visible) {
		outline: none;
	}
	.node:hover .name,
	.node.is-active .name {
		fill: var(--ink);
		font-weight: 600;
	}
	.node:hover .name {
		text-decoration: underline;
	}
	.hit {
		fill: transparent;
	}
	.sel {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2;
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
			padding: var(--s-4) var(--s-4) var(--s-8);
		}
	}
	.ladder section + section {
		margin-top: var(--s-5);
	}
	.ladder__head {
		margin: 0 0 var(--s-2);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.ladder__count {
		margin: 0 0 var(--s-2);
		font-size: var(--t-meta);
	}
	.ladder__chain {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--rule);
	}
	.ladder__chain li {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
		min-height: var(--veld-h-raak);
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
	}
	.num {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: var(--r-rond);
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 600;
		line-height: 24px;
		text-align: center;
	}
	.ladder__step {
		display: flex;
		flex-direction: column;
	}
	.ladder__pair {
		font-family: var(--font-serif);
		font-size: 15px;
		font-weight: 600;
		line-height: 24px;
		color: var(--ink);
	}
	.ladder__how {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
</style>
