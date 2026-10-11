<script lang="ts" module>
	import type { RichtingRij, RichtingTelling } from './overzicht';

	/** The filters of a number's list, as the address takes them. */
	export type RichtingPatch = Partial<
		Record<'richting' | 'uitkomst' | 'stem' | 'coalitie' | 'oppositie', string>
	>;
	export type RichtingRijen = [RichtingRij, RichtingTelling][];
</script>

<script lang="ts">
	// Richting as a table in the form of the Kruiswoord above it: the researcher's directions as
	// rows; all, the outcome, the chosen fractie's vote and the side of the coalition and the
	// opposition as columns, all first (on a phone it stays in view). Every number is a link to its list
	// (`?richting=positief&uitkomst=aangenomen`); the chosen one stands in ink. On a phone the
	// heads stand upright and the table pans under its labels, as the Kruiswoord.
	import { formatCount } from '$lib/text/getal';
	import { RICHTING_LABEL } from './richting';

	let {
		rijen,
		fractie = null,
		kanten = false,
		gekozen = {},
		hrefVan
	}: {
		/** Null while the moties are asked. */
		rijen: RichtingRijen | null;
		fractie?: string | null;
		/** The columns of the coalition and the opposition, where the API counts them. */
		kanten?: boolean;
		/** The list shown now: its cell is marked. */
		gekozen?: RichtingPatch;
		hrefVan: (patch: RichtingPatch) => string;
	} = $props();

	type Kolom = {
		k: string;
		label: string;
		groep?: string;
		vorm?: 'ja' | 'nee';
		patch: RichtingPatch;
		n: (t: RichtingTelling) => number;
	};
	const kolommen = $derived<Kolom[]>([
		{ k: 'alle', label: 'Alle', patch: {}, n: (t) => t.totaal },
		{
			k: 'aangenomen',
			label: 'Aangenomen',
			groep: 'Uitkomst',
			vorm: 'ja',
			patch: { uitkomst: 'aangenomen' },
			n: (t) => t.aangenomen
		},
		{
			k: 'verworpen',
			label: 'Verworpen',
			groep: 'Uitkomst',
			vorm: 'nee',
			patch: { uitkomst: 'verworpen' },
			n: (t) => t.verworpen
		},
		...(fractie
			? (['voor', 'tegen'] as const).map((s) => ({
					k: `stem-${s}`,
					label: s === 'voor' ? 'Voor' : 'Tegen',
					groep: fractie,
					patch: { stem: s },
					n: (t: RichtingTelling) => t[s]
				}))
			: []),
		...(kanten
			? (['coalitie', 'oppositie'] as const).flatMap((kant) =>
					(['voor', 'tegen'] as const).map((s) => ({
						k: `${kant}-${s}`,
						label: s === 'voor' ? 'Voor' : 'Tegen',
						groep: kant === 'coalitie' ? 'Coalitie' : 'Oppositie',
						patch: { [kant]: s },
						n: (t: RichtingTelling) => t[kant][s]
					}))
				)
			: [])
	]);
	const groepen = $derived(
		kolommen.reduce<{ label: string; van: number; n: number }[]>((g, c, i) => {
			if (!c.groep) return g;
			const last = g.at(-1);
			if (last && last.label === c.groep && last.van + last.n === i) last.n++;
			else g.push({ label: c.groep, van: i, n: 1 });
			return g;
		}, [])
	);
	const RIJ_LABEL: Record<RichtingRij, string> = { ...RICHTING_LABEL, geen: 'Niet gecodeerd' };
	const LEGE_RIJEN: RichtingRij[] = ['positief', 'negatief', 'neutraal', 'geen'];

	const patchVan = (r: RichtingRij, c: Kolom): RichtingPatch => ({ richting: r, ...c.patch });
	const sleutels = ['richting', 'uitkomst', 'stem', 'coalitie', 'oppositie'] as const;
	const isGekozen = (p: RichtingPatch) =>
		!!gekozen.richting && sleutels.every((k) => (p[k] ?? '') === (gekozen[k] ?? ''));
</script>

<div class="schuif" data-zijscroll>
	<div class="tabel" style:--n={kolommen.length} role="table" aria-label="Richting">
		<div class="rij kopregel" role="row">
			<span class="k k--per" role="columnheader">Richting</span>
			{#each groepen as g (g.label)}
				<span class="groepkop" style:grid-column="{g.van + 2} / span {g.n}" aria-hidden="true"
					>{g.label}</span
				>
			{/each}
			{#each kolommen as c (c.k)}
				<span
					class="k"
					role="columnheader"
					aria-label={c.groep ? `${c.groep}, ${c.label}` : c.label}
					><span class="w"
						>{#if c.vorm}<span class="vorm vorm--{c.vorm}" aria-hidden="true"
							></span>{/if}{c.label}</span
					></span
				>
			{/each}
		</div>
		{#each rijen ?? LEGE_RIJEN.map((r) => [r, null] as const) as [r, t] (r)}
			<div class="rij" role="row">
				<span class="per" role="rowheader">{RIJ_LABEL[r]}</span>
				{#each kolommen as c (c.k)}
					{@const n = t ? c.n(t) : null}
					<span role="cell">
						{#if n === null}
							<span class="cel wacht" aria-label="Laden">…</span>
						{:else if n > 0}
							{@const p = patchVan(r, c)}
							<a
								class="cel vol"
								class:som={c.k === 'alle'}
								href="{hrefVan(p)}#t-lijst"
								aria-current={isGekozen(p) ? 'true' : undefined}
								aria-label="{RIJ_LABEL[r]}, {c.groep ? `${c.groep} ` : ''}{c.label}: {n}"
								>{formatCount(n)}</a
							>
						{:else}
							<span class="cel leeg" aria-label="Geen"></span>
						{/if}
					</span>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	/* The form of the Kruiswoord (Kruiswoord.svelte): its heads, its cells and its phone. */
	.schuif {
		--label: 150px;
		min-width: 0;
	}
	.rij {
		display: grid;
		grid-template-columns: var(--label) repeat(var(--n), minmax(0, 1fr));
		column-gap: var(--s-1);
		align-items: center;
		margin-top: var(--s-1);
	}
	.rij > * {
		min-width: 0;
	}
	.kopregel {
		margin-top: 0;
		align-items: end;
	}
	.groepkop {
		grid-row: 1;
		margin-bottom: var(--s-1);
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink);
		text-align: center;
	}
	.k {
		grid-row: 2;
		padding: var(--s-1) 0;
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: center;
	}
	.k--per {
		text-align: left;
	}
	.vorm {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: var(--s-1);
		vertical-align: -1px;
	}
	.vorm--ja {
		background: var(--uitkomst-ja);
	}
	.vorm--nee {
		box-sizing: border-box;
		border: 2px solid var(--uitkomst-nee);
	}
	.per {
		padding-right: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
		white-space: nowrap;
	}
	.cel {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		text-decoration: none;
		font-variant-numeric: tabular-nums lining-nums;
	}
	.cel.leeg {
		background: repeating-linear-gradient(135deg, transparent 0 5px, var(--paper-2) 5px 7px);
	}
	.cel.wacht {
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.cel.vol {
		background: var(--paper);
		box-shadow: inset 0 0 0 1px var(--rule-strong);
	}
	.cel.vol.som {
		font-weight: 600;
	}
	.cel.vol:hover,
	.cel.vol:focus-visible {
		box-shadow: inset 0 0 0 1.5px var(--ink);
		outline: none;
	}
	.cel.vol[aria-current='true'] {
		background: var(--ink);
		color: var(--paper);
		box-shadow: none;
	}
	@media (max-width: 640px) {
		.schuif {
			--label: 96px;
			overflow-x: auto;
		}
		.tabel {
			min-width: calc(var(--label) + var(--n) * 44px);
		}
		.rij {
			column-gap: var(--s-1);
		}
		.rij > :first-child {
			position: sticky;
			left: 0;
			z-index: 1;
			background: var(--paper);
		}
		.k {
			display: flex;
			flex-direction: column;
			justify-content: flex-end;
			align-items: center;
			height: 100px;
		}
		.k--per {
			align-items: flex-start;
		}
		.k .w {
			writing-mode: vertical-rl;
			transform: rotate(180deg);
		}
		.vorm {
			margin: 0 0 var(--s-1);
		}
		.per {
			font-size: var(--t-micro);
		}
	}
</style>
