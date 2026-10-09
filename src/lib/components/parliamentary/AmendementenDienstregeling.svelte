<script lang="ts">
	// The amendments of a bill as a timetable (amendementen.ts): a row per amendment as it
	// came to the vote, a stop on the day of each of its papers, a line while it runs and a
	// dotted one from its last paper to the vote, and at the end the outcome as a shape and a
	// word. Asked once the section comes into view: one request, the dossier's neighbourhood.
	// On a phone each row is its own short timetable: the days under each other.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Uitkomst from './Uitkomst.svelte';
	import { dagMaand, korteDatum } from '$lib/text/datum';
	import { getAmendementen, kolomVan, type Dienstregeling, type Rij } from './amendementen';

	let {
		dossierKey,
		stukken
	}: {
		dossierKey: string;
		/** The papers of amendments the dossier counts (its own counts per kind). */
		stukken: number;
	} = $props();

	let regeling = $state<Dienstregeling | null>(null);
	let fout = $state(false);
	let zichtbaar = $state(false);

	$effect(() => {
		if (!zichtbaar) return;
		const key = dossierKey;
		let weg = false;
		regeling = null;
		fout = false;
		getAmendementen(key)
			.then((r) => {
				if (!weg) regeling = r;
			})
			.catch(() => {
				if (!weg) fout = true;
			});
		return () => {
			weg = true;
		};
	});

	function inBeeld(el: HTMLElement) {
		const kijk = new IntersectionObserver(
			([e]) => {
				if (!e.isIntersecting) return;
				zichtbaar = true;
				kijk.disconnect();
			},
			{ rootMargin: '200px' }
		);
		kijk.observe(el);
		return { destroy: () => kijk.disconnect() };
	}

	const weken = $derived(
		!!regeling &&
			regeling.kolommen.some(
				(k) => !regeling!.rijen.some((r) => r.haltes.some((h) => h.datum === k))
			)
	);
	const kop = (k: string) => (weken ? `week ${dagMaand(k)}` : dagMaand(k));
	/** The day of a stop in full, where it stands alone (the folded table). */
	const dagVol = (k: string) => (weken ? `week van ${korteDatum(k)}` : korteDatum(k));
	const geteld = $derived.by(() => {
		const r = regeling?.rijen ?? [];
		const gestemd = r.filter((x) => x.uitslag);
		return {
			gestemd: gestemd.length,
			aangenomen: gestemd.filter((x) => x.uitslag?.aangenomen).length
		};
	});

	// The full timetable wherever it fits: a name column, a column a day, the vote at the end.
	// Folded only below that, by the dossier's own number of columns (Thijs, 10 Oct: the
	// normal width gave the folded one).
	const NAAM = 124;
	const DAG = 46;
	const EIND = 100;
	let breedte = $state(0);
	const smal = $derived(
		!!regeling && breedte > 0 && breedte < NAAM + regeling.kolommen.length * DAG + EIND
	);

	/** What the section holds, in one line under its heading. */
	const standRegel = $derived.by(() => {
		if (!regeling) return '';
		const n = regeling.rijen.length;
		const delen = [
			`${regeling.metVervanging ? `${n} ${n === 1 ? 'amendement' : 'amendementen'} in ` : ''}${stukken} ${stukken === 1 ? 'stuk' : 'stukken'}, ${geteld.gestemd} in stemming, ${geteld.aangenomen} aangenomen.`
		];
		if (!regeling.metVervanging) delen.push('Vervangingen niet in de gegevens.');
		if (regeling.afgekapt) delen.push('Niet alle stukken passen in één overzicht.');
		return delen.join(' ');
	});

	/** Where a row stands at a column: before its first paper, at a stop, running, or after its last. */
	function stand(r: Rij, k: string): string {
		const eerste = kolomVan(regeling!, r.haltes[0].datum);
		const laatste = kolomVan(regeling!, r.haltes.at(-1)!.datum);
		if (k < eerste) return 'voor';
		if (r.haltes.some((h) => kolomVan(regeling!, h.datum) === k))
			return `halte${k === eerste ? ' eerste' : ''}${k === laatste ? ' laatste' : ''}`;
		return k < laatste ? 'loopt' : 'na';
	}
	const uitkomst = (r: Rij) =>
		!r.uitslag || r.uitslag.aangenomen === null
			? { soort: 'open' as const, woord: r.uitslag ? 'gestemd' : 'geen stemming' }
			: r.uitslag.aangenomen
				? { soort: 'ja' as const, woord: 'aangenomen' }
				: { soort: 'nee' as const, woord: 'verworpen' };
</script>

<div class="amendementen" class:smal bind:clientWidth={breedte} use:inBeeld>
	<Sectie titel="Amendementen" soort="documents" aantal={regeling?.rijen.length ?? null}>
		{#if fout}
			<p class="stand">De amendementen konden niet worden geladen.</p>
		{:else if !regeling}
			<p class="stand">Amendementen laden…</p>
		{:else}
			<p class="stand">{standRegel}</p>
			<table class="regeling">
				{#if !smal}
					<colgroup>
						<col />
						{#each regeling.kolommen as k (k)}<col style:width="{DAG}px" />{/each}
						<col style:width="{EIND}px" />
					</colgroup>
				{/if}
				<thead>
					<tr>
						<th scope="col" class="naam">Amendement</th>
						{#each regeling.kolommen as k (k)}<th scope="col" class="dag"
								>{kop(k)}<span class="jaar">{k.slice(0, 4)}</span></th
							>{/each}
						<th scope="col" class="eind">Stemming</th>
					</tr>
				</thead>
				<tbody>
					{#each regeling.rijen as r (r.stuk.id)}
						{@const u = uitkomst(r)}
						<tr>
							<th scope="row" class="naam">
								{#if r.indiener}
									<span class="indiener"
										>{r.indiener.naam}{r.indiener.fractie ? ` (${r.indiener.fractie})` : ''}{r
											.indiener.anderen > 0
											? ' c.s.'
											: ''}</span
									>
								{/if}
								<span class="titel">{r.stuk.titel}</span>
								{#if r.samengevoegd}<span class="noot">samengevoegd</span>{/if}
							</th>
							{#each regeling.kolommen as k (k)}
								{@const s = stand(r, k)}
								<td class="dag {s}" data-dag={dagVol(k)}>
									{#if s.startsWith('halte')}
										{#each r.haltes.filter((h) => kolomVan(regeling!, h.datum) === k) as h (h.id)}
											<BronLink ref={h.id} class="nr" title={h.titel}>nr. {h.nummer}</BronLink>
										{/each}
									{/if}
								</td>
							{/each}
							<td class="eind">
								{#if r.uitslag}
									<BronLink ref={r.uitslag.id} class="uitslag" preview={false}
										><Uitkomst soort={u.soort} woord={u.woord} /></BronLink
									>
									{#if r.uitslag.voor != null && r.uitslag.tegen != null}
										<span class="stemmen">{r.uitslag.voor} voor, {r.uitslag.tegen} tegen</span>
									{/if}
								{:else if regeling.metVervanging}
									<!-- Not replaced and never voted: withdrawn or still open. Without the
									     chains a paper without a vote may have been replaced: nothing said. -->
									<Uitkomst soort={u.soort} woord={u.woord} />
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Sectie>
</div>

<style>
	/* A state line under the heading, at rung 6. */
	.stand {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.regeling {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
	}
	/* The year under the day of each column, so a column reads as a date. */
	thead .jaar {
		display: block;
		color: var(--ink-3);
		opacity: 0.8;
	}
	thead th {
		padding: var(--s-1) 2px;
		border-bottom: 1px solid var(--rule-strong);
		font-weight: 400;
		color: var(--ink-3);
		text-align: center;
		white-space: nowrap;
	}
	thead th.naam,
	thead th.eind {
		text-align: left;
	}
	tbody tr {
		border-bottom: 1px solid var(--rule);
	}
	/* The amendment: its first signer at rung 4, its title under it at rung 5. */
	tbody th.naam {
		padding: var(--s-2) var(--s-2) var(--s-2) 0;
		text-align: left;
		font-weight: 400;
		vertical-align: top;
	}
	.indiener {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		color: var(--ink);
	}
	.titel {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		color: var(--ink-3);
		line-height: 1.35;
	}
	.noot {
		display: block;
		font-style: italic;
		color: var(--ink-2);
	}
	/* The line of a row: solid while it runs, dotted from its last paper to the vote. */
	td.dag {
		position: relative;
		height: 44px;
		padding: 0 2px;
		text-align: center;
	}
	td.loopt::before,
	td.na::before,
	td.halte:not(.eerste)::before,
	td.halte::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		border-top: 1.5px solid var(--ink);
	}
	td.halte:not(.eerste)::before {
		right: 50%;
	}
	td.halte::after {
		left: 50%;
	}
	td.na::before,
	td.halte.laatste::after {
		border-top-style: dotted;
	}
	/* A stop: the paper's number in a ring, a link to the paper. */
	td.dag :global(.nr) {
		position: relative;
		z-index: 1;
		display: inline-block;
		white-space: nowrap;
		padding: 0 4px;
		font-size: var(--t-label);
		border: 1.5px solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		color: var(--ink);
		font-weight: 600;
		line-height: 18px;
		text-decoration: none;
	}
	td.dag :global(.nr:hover),
	td.dag :global(.nr:focus-visible) {
		background: var(--ink);
		color: var(--paper);
	}
	td.eind {
		padding: var(--s-2) 0 var(--s-2) var(--s-2);
		vertical-align: middle;
		color: var(--ink-2);
	}
	td.eind :global(.uitslag) {
		color: inherit;
		text-decoration: none;
	}
	td.eind :global(.uitslag:hover) {
		text-decoration: underline;
	}
	.stemmen {
		display: block;
		margin-left: calc(10px + var(--s-2));
		color: var(--ink-3);
	}

	/* In a narrow column: each row its own short timetable, the days of its papers under each other. */
	/* Folded, where the timetable does not fit its column (measured, by its own number of
	   columns): each amendment its own short timetable, a dated stop a line. */
	.smal thead {
		display: none;
	}
	.smal .regeling,
	.smal .regeling tbody,
	.smal .regeling tr,
	.smal .regeling th,
	.smal .regeling td {
		display: block;
	}
	.smal tbody tr {
		padding: var(--s-2) 0;
	}
	.smal tbody th.naam {
		width: auto;
		padding: 0 0 var(--s-1);
	}
	.smal td.dag {
		height: auto;
		min-width: 0;
		text-align: left;
	}
	.smal td.dag.voor,
	.smal td.dag.loopt,
	.smal td.dag.na {
		display: none;
	}
	.smal .regeling td.dag.halte {
		display: flex;
		gap: var(--s-1);
		align-items: center;
		margin-left: var(--s-2);
		padding: 2px 0 2px var(--s-3);
		border-left: 1.5px solid var(--ink);
	}
	.smal .regeling td.dag.halte::before,
	.smal .regeling td.dag.halte.eerste::before {
		content: attr(data-dag);
		right: auto;
		position: static;
		width: 92px;
		border: 0;
		color: var(--ink-3);
	}
	.smal .regeling td.dag.halte::after {
		content: none;
	}
	.smal td.eind {
		width: auto;
		padding: var(--s-1) 0 0;
	}
</style>
