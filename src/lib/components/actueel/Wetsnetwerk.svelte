<script lang="ts">
	// The network of the last passed bill, in fixed columns: no force layout, no movement.
	// Lines are drawn between the measured places. A click on a bron chooses it here (its
	// verbindingen dark, the rest faint); the line under the sketch opens it. On a phone the
	// chain stands one step a line, and the sketch is the Verkenner's.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { langeDatum } from '$lib/text/datum';
	import { onMount, tick } from 'svelte';
	import type { Schets, SchetsBron } from './wetsnetwerk';

	let { schets }: { schets: Schets } = $props();

	const KAMER = { TK: 'Tweede Kamer', EK: 'Eerste Kamer' } as const;
	const k = $derived(schets.kandidaat);
	const keten = $derived(schets.keten);
	const telwoord = (n: number, een: string, meer: string) =>
		`${n.toLocaleString('nl-NL')} ${n === 1 ? een : meer}`;

	/** The chain in counts, one step a line: what a phone shows before the sketch. */
	const stappen = $derived(
		[
			{ vorm: 'stuk' as const, tekst: telwoord(keten.stukken, 'stuk', 'stukken') },
			{
				vorm: 'regel-o' as const,
				tekst: `${telwoord(keten.artikelen, 'artikel', 'artikelen')} in ${keten.wet}`
			},
			keten.uitspraken
				? {
						vorm: 'uitspraak' as const,
						tekst: `${telwoord(keten.uitspraken, 'uitspraak', 'uitspraken')} over ${keten.artikel.toLowerCase()}`
					}
				: null
		].filter((x) => x !== null)
	);

	let root = $state<HTMLElement>();
	let paden = $state<{ id: string; d: string; aan: boolean }[]>([]);
	let gekozen = $state<SchetsBron | null>(null);

	const buren = $derived.by(() => {
		const id = gekozen?.id;
		if (!id) return null;
		return new Set(schets.lijnen.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])));
	});

	function meet() {
		if (!root) return;
		const o = root.getBoundingClientRect();
		const rect = (id: string, sel: string) =>
			root!
				.querySelector<HTMLElement>(`[data-bron="${CSS.escape(id)}"] ${sel}`)
				?.getBoundingClientRect();
		paden = schets.lijnen.flatMap(([a, b]) => {
			// From the end of the name to the sign of the next bron.
			const p = rect(a, 'button');
			const t = rect(a, '.teken');
			const q = rect(b, '.teken');
			if (!p || !t || !q) return [];
			const x1 = p.right - o.left + 4;
			const y1 = t.top + t.height / 2 - o.top;
			const x2 = q.left - o.left - 4;
			const y2 = q.top + q.height / 2 - o.top;
			const mx = (x1 + x2) / 2;
			const aan = !!gekozen && (gekozen.id === a || gekozen.id === b);
			return [{ id: `${a}>${b}`, d: `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, aan }];
		});
	}

	onMount(() => {
		const ro = new ResizeObserver(() => meet());
		if (root) ro.observe(root);
		return () => ro.disconnect();
	});
	$effect(() => {
		void gekozen;
		void schets;
		tick().then(meet);
	});
</script>

<section class="wetsnetwerk" aria-labelledby="wetsnetwerk-heading">
	<p class="waarom">Laatst aangenomen wetsvoorstel: {KAMER[k.kamer]}, {langeDatum(k.datum)}</p>
	<h2 id="wetsnetwerk-heading">{k.naam}</h2>

	<ol class="keten">
		{#each stappen as st (st.vorm)}
			<li><span class="kteken"><KindGlyph vorm={st.vorm} size={12} /></span>{st.tekst}</li>
		{/each}
	</ol>
	<a class="toon" href={schets.verkenner}>Toon in de Verkenner →</a>

	<figure class="schets">
		<div class="veld" bind:this={root} style:--kolommen={schets.kolommen.length}>
			<svg class="lijnen" aria-hidden="true">
				{#each paden as p (p.id)}<path d={p.d} class:aan={p.aan} />{/each}
			</svg>
			{#each schets.kolommen as kol (kol.titel)}
				<div class="kolom">
					<div class="kop">{kol.titel}</div>
					<div class:kader={!!kol.kader}>
						{#if kol.kader}<a class="wet" href={kol.kader.href}
								><KindGlyph vorm="regel" size={10} /> {kol.kader.label}</a
							>{/if}
						<ul>
							{#each kol.bronnen as b (b.id)}
								<li
									data-bron={b.id}
									class:dim={!!buren && gekozen?.id !== b.id && !buren.has(b.id)}
								>
									<button
										type="button"
										aria-pressed={gekozen?.id === b.id}
										onclick={() => (gekozen = gekozen?.id === b.id ? null : b)}
									>
										<span class="teken"><KindGlyph vorm={b.vorm} size={14} /></span>
										<span class="naam" class:groep={b.groep}>{b.label}</span>
										{#if b.sub}<span class="sub">{b.sub}</span>{/if}
									</button>
								</li>
							{/each}
						</ul>
					</div>
					{#if kol.na}<a class="na" href={kol.na.href}>{kol.na.label}</a>{/if}
				</div>
			{/each}
		</div>
		<figcaption>
			{#if gekozen}
				<span class="keuze"
					><KindGlyph vorm={gekozen.vorm} size={12} />
					{gekozen.label}{gekozen.sub ? `, ${gekozen.sub}` : ''}</span
				>
				<a href={gekozen.href}>{gekozen.groep ? 'Open de lijst' : 'Open de bron'} →</a>
			{:else}
				<span class="hint">Kies een bron voor haar verbindingen.</span>
			{/if}
			<a class="verkenner" href={schets.verkenner}>Open in de Verkenner →</a>
		</figcaption>
	</figure>
</section>

<style>
	.waarom {
		margin: 0 0 var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	h2 {
		margin: 0 0 var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		line-height: var(--lh-snug);
	}
	.keten,
	.toon {
		display: none;
	}
	.schets {
		margin: 0;
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		background: var(--paper);
		padding: var(--s-4);
	}
	.veld {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--kolommen), minmax(0, 1fr));
		column-gap: var(--s-8);
	}
	.lijnen {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.lijnen path {
		fill: none;
		stroke: var(--rule-strong);
		stroke-width: 1;
	}
	.lijnen path.aan {
		stroke: var(--ink);
	}
	.kolom {
		position: relative;
		min-width: 0;
	}
	.kop {
		margin-bottom: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.kader {
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: var(--s-2);
		background: var(--paper);
	}
	.wet,
	.na {
		display: block;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink);
		text-decoration: none;
	}
	.wet {
		margin-bottom: var(--s-1);
		font-weight: 500;
	}
	.na {
		margin-top: var(--s-2);
		color: var(--ink-2);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	li.dim {
		opacity: 0.35;
	}
	li button {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		column-gap: var(--s-2);
		align-items: baseline;
		width: fit-content;
		max-width: 100%;
		padding: var(--s-1) 0;
		border: 0;
		background: none;
		font-family: var(--font-sans);
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}
	.teken {
		position: relative;
		top: 2px;
		display: inline-flex;
	}
	.naam {
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		overflow-wrap: anywhere;
	}
	.naam.groep {
		color: var(--ink-2);
	}
	li button[aria-pressed='true'] .naam {
		box-shadow: inset 0 -2px 0 var(--accent);
	}
	.sub {
		grid-column: 2;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-4);
		margin-top: var(--s-4);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	figcaption a {
		color: var(--ink);
	}
	.hint {
		color: var(--ink-3);
	}
	.verkenner {
		margin-left: auto;
		font-weight: 500;
	}

	/* A phone: the chain one step a line, and a link to the same network in the Verkenner. */
	@media (max-width: 640px) {
		h2 {
			margin-bottom: var(--s-2);
		}
		/* One step a line, the signs joined by a rule, as on the timeline. */
		.keten {
			display: flex;
			flex-direction: column;
			gap: var(--s-1);
			margin: 0 0 var(--s-3);
			padding: 0;
			list-style: none;
			font-family: var(--font-sans);
			font-size: var(--t-meta);
			color: var(--ink-2);
		}
		/* A line of 20px with the sign centred in it: 4px above and below the sign, 4px
		   between the lines, so the rule between two signs is 8px with 2px clear. */
		.keten li {
			position: relative;
			display: grid;
			grid-template-columns: 12px minmax(0, 1fr);
			column-gap: var(--s-2);
			align-items: start;
			line-height: 20px;
		}
		.kteken {
			display: flex;
			align-items: center;
			height: 20px;
		}
		.keten li + li::before {
			content: '';
			position: absolute;
			/* Under the middle of a 12px sign. */
			left: 5.5px;
			top: -6px;
			height: var(--s-2);
			width: 1px;
			background: var(--rule-strong);
		}
		.toon {
			display: inline-block;
			padding: var(--s-2) var(--s-3);
			border: 1px solid var(--rule-strong);
			border-radius: var(--r-1);
			background: var(--paper);
			font-family: var(--font-sans);
			font-size: var(--t-meta);
			color: var(--ink);
			text-decoration: none;
		}
		.schets {
			display: none;
		}
	}
</style>
