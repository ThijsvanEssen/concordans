<script lang="ts">
	// The cabinets in the time they governed: the block of the posts (`paper-2`, the name in
	// it or right after it), in as many lanes as the names need, over the lines of the years
	// of the shared Tijdas. It scrolls and is dragged sideways, zooms with − and +, and opens
	// at the present or at the cabinet opened. A click opens the cabinet in place under the
	// strip (OpenRij); the bron is one step further, Kabinet lezen. An end no source gives is
	// a dotted frame, as a stand-in on a post.
	import { untrack } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import OpenRij from '$lib/components/open/OpenRij.svelte';
	import { pannable } from './pannable';
	import { cabinetShortName, inOffice, type Cabinet } from './government';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { DAY_MS, korteDatum, vandaag } from '$lib/text/datum';
	import Tijdas from '$lib/components/tijdlijn/Tijdas.svelte';
	import { ms, periodeZin } from '$lib/components/tijdlijn/tijdas';

	let {
		cabinets,
		all,
		openKey = null,
		onToggle
	}: {
		/** The cabinets shown (under the filters). */
		cabinets: Cabinet[];
		/** Every cabinet, to know which one is in office. */
		all: Cabinet[];
		openKey?: string | null;
		onToggle: (key: string) => void;
	} = $props();

	const JAAR = 365.25 * DAY_MS;
	const YEAR_WIDTHS = [10, 16, 28, 48, 80];
	let yearWidth = $state(28);
	let scroller = $state<HTMLElement | null>(null);
	const nu = ms(vandaag());

	const rows = $derived(
		[...cabinets]
			.filter((c) => c.from_date)
			.sort((a, b) => a.from_date!.localeCompare(b.from_date!))
	);
	const open = (c: Cabinet) => inOffice(c, all);
	/** Without a known end: a stub of a year, dotted. */
	const onbekend = (c: Cabinet) => !c.to_date && !open(c);
	const eindVan = (c: Cabinet) =>
		c.to_date ? ms(c.to_date) : open(c) ? nu : ms(c.from_date!) + JAAR;
	const periode = $derived(
		rows.length ? { van: ms(rows[0].from_date!), tot: nu, lopend: true } : null
	);
	const breedte = $derived(periode ? ((periode.tot - periode.van) / JAAR) * yearWidth : 0);
	const x = (t: number) =>
		periode ? ((t - periode.van) / (periode.tot - periode.van)) * breedte : 0;

	// A cabinet takes the first lane where its name stands free.
	const NAAM_PX = 7; // a character on t-micro in the serif, generously
	const geplaatst = $derived.by(() => {
		const banen: number[] = [];
		return rows.map((c) => {
			const van = x(ms(c.from_date!));
			const tot = x(eindVan(c));
			const past = cabinetShortName(c.name).length * NAAM_PX + 8 <= tot - van;
			// A name that does not fit the block stands right after it.
			const eind = past
				? tot
				: Math.max(tot, van + 2) + cabinetShortName(c.name).length * NAAM_PX + 8;
			let baan = banen.findIndex((e) => e + 4 <= van);
			if (baan < 0) baan = banen.push(0) - 1;
			banen[baan] = eind;
			return { c, van, tot, baan, past };
		});
	});
	const aantalBanen = $derived(Math.max(1, ...geplaatst.map((g) => g.baan + 1)));

	function zoom(step: number) {
		const i = YEAR_WIDTHS.indexOf(yearWidth) + step;
		if (i < 0 || i >= YEAR_WIDTHS.length) return;
		const el = scroller;
		const midden = el ? (el.scrollLeft + el.clientWidth / 2) / yearWidth : 0;
		yearWidth = YEAR_WIDTHS[i];
		if (el)
			afterTick(() => {
				el.scrollLeft = midden * yearWidth - el.clientWidth / 2;
			});
	}
	// Opens at the present, or at the cabinet opened.
	$effect(() => {
		const el = scroller;
		void rows.length;
		if (!el) return;
		untrack(() =>
			afterTick(() => {
				const g = geplaatst.find((p) => p.c.key === openKey);
				el.scrollLeft = g ? g.van - el.clientWidth / 2 : el.scrollWidth;
			})
		);
	});

	const gekozen = $derived(rows.find((c) => c.key === openKey) ?? null);
	const zin = (c: Cabinet) =>
		`${c.name}, ${
			onbekend(c)
				? `vanaf ${korteDatum(c.from_date)}, eind niet in de gegevens`
				: periodeZin(c.from_date, c.to_date, korteDatum)
		}${c.prime_minister?.name ? `, minister-president ${c.prime_minister.name}` : ''}${
			c.parties?.length ? `, ${c.parties.map((p) => p.short ?? p.faction).join(', ')}` : ''
		}.`;
</script>

{#if periode}
	<div class="strook">
		<div class="tools">
			<IconButton label="Uitzoomen" onclick={() => zoom(-1)} disabled={yearWidth === YEAR_WIDTHS[0]}
				>−</IconButton
			>
			<IconButton
				label="Inzoomen"
				onclick={() => zoom(1)}
				disabled={yearWidth === YEAR_WIDTHS.at(-1)}>+</IconButton
			>
		</div>
		<div
			class="scroll"
			data-zijscroll
			bind:this={scroller}
			use:pannable
			role="region"
			aria-label="Kabinetten in de tijd"
		>
			<div class="canvas" style:width="{breedte}px" style:--lanes={aantalBanen}>
				<div class="banen">
					{#each geplaatst as g (g.c.key)}
						<button
							type="button"
							class="cab"
							class:cab--open={openKey === g.c.key}
							class:cab--onbekend={onbekend(g.c)}
							class:cab--past={g.past}
							style:left="{g.van}px"
							style:top="calc({g.baan} * var(--lane))"
							style:--w="{Math.max(g.tot - g.van, 2)}px"
							aria-expanded={openKey === g.c.key}
							aria-label={zin(g.c)}
							onclick={() => onToggle(g.c.key)}
						>
							<span class="balk"></span>
							<span class="naam">{cabinetShortName(g.c.name)}</span>
						</button>
					{/each}
				</div>
				<Tijdas {periode} from={rows[0].from_date!.slice(0, 4)} to="nu" plaats="onder" lijnen />
			</div>
		</div>
		{#if gekozen}
			<!-- In place, as an opened row in Bladeren; the bron one step further. -->
			<div class="open">
				<OpenRij
					zin={zin(gekozen)}
					links={[
						{
							label: `${gekozen.members} bewindspersonen`,
							href: indexHref('ministers', { kabinet: gekozen.key })
						}
					]}
					lezen={bronHref(`cabinets/${gekozen.key}`, { keepMode: false, mode: 'read' })}
					lezenLabel="Kabinet lezen"
				/>
			</div>
		{/if}
	</div>
{/if}

<style>
	.strook {
		margin: var(--s-1) 0 var(--s-5);
	}
	.tools {
		display: flex;
		justify-content: flex-end;
		gap: var(--s-2);
		margin-bottom: var(--s-2);
	}
	.scroll {
		overflow-x: auto;
		overscroll-behavior-x: contain;
		cursor: grab;
		padding-bottom: var(--s-1);
	}
	.scroll:global(.is-dragging) {
		cursor: grabbing;
		user-select: none;
	}
	.scroll:global(.is-dragging) .cab {
		pointer-events: none;
	}
	.canvas {
		/* The height of the lanes, for the lines of the years under them (Tijdas). */
		--lijnen: calc(var(--lanes) * var(--lane));
		position: relative;
		min-width: 100%;
	}
	/* The blocks over the lines of the years: a line never runs through a name. */
	.banen {
		position: relative;
		z-index: 1;
		height: var(--lijnen);
	}
	/* A cabinet: the block of the posts, in rest `paper-2`, opened in ink. */
	.cab {
		position: absolute;
		display: flex;
		height: calc(var(--lane) - var(--s-1));
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}
	.balk {
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--w);
		box-sizing: border-box;
		background: var(--paper-2);
	}
	.naam {
		position: relative;
		padding: 0 var(--s-1);
		white-space: nowrap;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink);
	}
	/* A name that does not fit stands right after its block, on the paper. */
	.cab:not(.cab--past) .naam {
		margin-left: var(--w);
		background: var(--paper);
	}
	.cab:hover .balk {
		background: var(--rule);
	}
	.cab--open .balk,
	.cab--open:hover .balk {
		background: var(--ink);
	}
	.cab--open .naam {
		font-weight: 600;
	}
	.cab--open.cab--past .naam {
		color: var(--paper);
		font-weight: 400;
	}
	/* An end no source gives: a dotted frame without fill, as a stand-in on a post. */
	.cab--onbekend .balk,
	.cab--onbekend:hover .balk {
		background: transparent;
		border: 1px dotted var(--ink-3);
	}
	.cab:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}

	/* In place, as an opened row in Bladeren. */
	.open {
		margin-top: var(--s-3);
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule);
	}
</style>
