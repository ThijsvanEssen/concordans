<script lang="ts">
	import { AMENDEMENTEN_ID } from './naar';
	// The amendments of a bill as a timetable (amendementen.ts; Thijs, 10 Oct: "schematisch
	// als spoorboekje wel beter, omdat het info communiceert zonder al die tekst, dus een
	// tussenweg"). A row per amendment as it came to the vote; a column per day on which a
	// paper appeared (the days cluster, so not to scale), each with its day written out, the
	// month above the days it holds, a rule where the month changes and a dotted one where
	// the week does, so the distance can be read. A stop is the paper's number in a ring; the
	// card on it says the rest. At the end the outcome as a shape and the tally. Where the
	// column is narrower than the timetable, it scrolls in its own box, the names standing.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Uitkomst from './Uitkomst.svelte';
	import { maandNaam } from '$lib/text/datum';
	import {
		getAmendementen,
		kolomVan,
		maandagVan,
		type Dienstregeling,
		type Rij
	} from './amendementen';

	let { dossierKey }: { dossierKey: string } = $props();

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

	/** The columns are weeks where the days are too many (amendementen.ts). */
	const weken = $derived(
		!!regeling &&
			regeling.kolommen.some(
				(k) => !regeling!.rijen.some((r) => r.haltes.some((h) => h.datum === k))
			)
	);
	/** The months over the columns: the whole name over three days or more, else short; the
	 *  year where it changes (the first year stands at the start of the row). */
	const maanden = $derived.by(() => {
		const uit: { maand: string; span: number }[] = [];
		for (const k of regeling?.kolommen ?? []) {
			const vorige = uit.at(-1);
			if (vorige?.maand === k.slice(0, 7)) vorige.span++;
			else uit.push({ maand: k.slice(0, 7), span: 1 });
		}
		return uit.map((m, i) => {
			const kort = maandNaam(`${m.maand}-01`, m.span < 3);
			const jaar = i > 0 && uit[i - 1].maand.slice(0, 4) !== m.maand.slice(0, 4);
			return { ...m, label: jaar ? `${kort} ${m.maand.slice(0, 4)}` : kort };
		});
	});
	/** Where a column starts a new month or a new week: the rule that shows the distance. */
	const grens = (i: number) => {
		const k = regeling!.kolommen;
		if (i === 0) return '';
		if (k[i].slice(0, 7) !== k[i - 1].slice(0, 7)) return 'maandgrens';
		return !weken && maandagVan(k[i]) !== maandagVan(k[i - 1]) ? 'weekgrens' : '';
	};

	/** Where a row stands at a column: before its first paper, at a stop, running, or after its last. */
	function stand(r: Rij, k: string): string {
		const eerste = kolomVan(regeling!, r.haltes[0].datum);
		const laatste = kolomVan(regeling!, r.haltes.at(-1)!.datum);
		if (k < eerste) return 'voor';
		// Without a vote the line stops at the last paper: it goes nowhere.
		if (r.haltes.some((h) => kolomVan(regeling!, h.datum) === k))
			return `halte${k === eerste ? ' eerste' : ''}${k === laatste ? (r.uitslag ? ' laatste' : ' laatste stil') : ''}`;
		return k < laatste ? 'loopt' : r.uitslag ? 'na' : 'voor';
	}
	// Without a vote the word of the decision (ingetrokken, aangehouden), never "gestemd".
	const uitkomst = (r: Rij) =>
		!r.uitslag || r.uitslag.aangenomen === null
			? {
					soort: 'open' as const,
					woord: r.uitslag?.soort ?? (r.nogNiet ? 'nog niet gestemd' : null),
					titel: r.uitslag ? 'geen uitslag in de gegevens' : 'geen stemming'
				}
			: r.uitslag.aangenomen
				? { soort: 'ja' as const, woord: null, titel: 'aangenomen' }
				: { soort: 'nee' as const, woord: null, titel: 'verworpen' };
</script>

<div class="amendementen" use:inBeeld>
	<Sectie
		id={AMENDEMENTEN_ID}
		titel="Amendementen"
		soort="documents"
		aantal={regeling?.rijen.length ?? null}
	>
		{#if fout}
			<p class="stand">De amendementen konden niet worden geladen.</p>
		{:else if !regeling}
			<p class="stand">Amendementen laden…</p>
		{:else}
			<div class="rol" data-zijscroll>
				<table class="regeling" style:--dagen={regeling.kolommen.length}>
					<colgroup>
						<col class="c-naam" />
						{#each regeling.kolommen as k (k)}<col class="c-dag" />{/each}
						<col class="c-eind" />
					</colgroup>
					<thead>
						<tr class="maanden">
							<th class="naam" scope="col">{regeling.kolommen[0]?.slice(0, 4)}</th>
							{#each maanden as m, i (m.maand)}
								<th scope="colgroup" colspan={m.span} class:maandgrens={i > 0}>{m.label}</th>
							{/each}
							<th class="eind"></th>
						</tr>
						<tr class="dagen">
							<th class="naam" scope="col">Amendement</th>
							{#each regeling.kolommen as k, i (k)}
								<th scope="col" class="dag {grens(i)}"
									>{weken ? `wk ${Number(k.slice(8))}` : Number(k.slice(8))}<span class="nr"
										>nr.</span
									></th
								>
							{/each}
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
									<span class="titel" title={r.stuk.titel}>{r.stuk.titel}</span>
								</th>
								{#each regeling.kolommen as k, i (k)}
									{@const s = stand(r, k)}
									<td class="dag {s} {grens(i)}">
										{#if s.startsWith('halte')}
											{#each r.haltes.filter((h) => kolomVan(regeling!, h.datum) === k) as h (h.id)}
												<BronLink
													ref={h.id}
													class="nr-ring"
													title={h.vervangenDoor
														? `Vervangen door nr. ${h.vervangenDoor}`
														: undefined}>{h.nummer}</BronLink
												>
											{/each}
										{/if}
									</td>
								{/each}
								<td class="eind">
									{#if r.uitslag}
										<BronLink ref={r.uitslag.id} class="uitslag"
											><Uitkomst
												soort={u.soort}
												woord={u.woord}
												titel={u.titel}
											/>{#if r.uitslag.voor != null && r.uitslag.tegen != null}<span
													>{r.uitslag.voor}–{r.uitslag.tegen}</span
												>{/if}</BronLink
										>
									{:else if regeling.metVervanging || r.nogNiet}
										<!-- Not replaced and never voted: withdrawn or still open. Without the
										     chains a paper without a vote may have been replaced: nothing said. -->
										<Uitkomst soort={u.soort} woord={u.woord} titel={u.titel} />
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Sectie>
</div>

<style>
	.stand {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The timetable scrolls in its own box where its column is narrower; never the page. */
	.rol {
		overflow-x: auto;
		overscroll-behavior-x: contain;
	}
	.regeling {
		--naam: 150px;
		--dag: 48px;
		/* The vote, or the word of the decision without one: `ingetrokken` beside its box. */
		--eind: 104px;
		width: 100%;
		min-width: calc(var(--naam) + var(--dagen) * var(--dag) + var(--eind));
		table-layout: fixed;
		border-collapse: collapse;
		font-size: var(--t-micro);
	}
	.c-dag {
		width: var(--dag);
	}
	.c-eind {
		width: var(--eind);
	}
	/* The months over their days, the days under them: what a column means, readable. */
	thead th {
		padding: 2px;
		font-weight: 400;
		color: var(--ink-3);
		text-align: center;
		white-space: nowrap;
	}
	.maanden th {
		padding-left: 6px;
		text-align: left;
		font-weight: 600;
		color: var(--ink-2);
	}
	/* The day under its month: the number large enough to find at a glance. */
	.dagen th {
		border-bottom: 1px solid var(--rule-strong);
		color: var(--ink);
		font-size: var(--t-meta);
		font-weight: 600;
		line-height: 1.2;
	}
	.dagen .nr {
		display: block;
		font-weight: 400;
		color: var(--ink-3);
	}
	thead .naam,
	thead .eind {
		text-align: left;
	}
	.dagen .naam,
	.dagen .eind {
		font-weight: 400;
		color: var(--ink-3);
		vertical-align: bottom;
	}
	/* A rule where the month changes, a dotted one where the week does. */
	.maandgrens {
		border-left: 1px solid var(--rule-strong);
	}
	.weekgrens {
		border-left: 1px dotted var(--rule);
	}
	tbody tr {
		border-bottom: 1px solid var(--rule);
	}
	/* The name stays while the days scroll. */
	.naam {
		position: sticky;
		left: 0;
		z-index: 2;
		background: var(--paper);
		box-shadow: 1px 0 0 var(--rule);
	}
	tbody th.naam {
		padding: var(--s-2) var(--s-2) var(--s-2) 0;
		text-align: left;
		font-weight: 400;
		vertical-align: middle;
	}
	.indiener {
		display: block;
		overflow: hidden;
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.titel {
		display: block;
		overflow: hidden;
		color: var(--ink-3);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	/* The line of a row: solid while it runs, dotted from its last paper to the vote. */
	td.dag {
		position: relative;
		height: 44px;
		padding: 0;
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
	td.halte.stil::after {
		content: none;
	}
	/* A stop: the paper's number in a ring; its card tells the rest. */
	td.dag :global(.nr-ring) {
		position: relative;
		z-index: 1;
		display: inline-block;
		min-width: 26px;
		margin: 1px 0;
		padding: 0 4px;
		border: 1.5px solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		color: var(--ink);
		font-weight: 600;
		line-height: 18px;
		text-decoration: none;
	}
	td.dag :global(.nr-ring:hover),
	td.dag :global(.nr-ring:focus-visible) {
		background: var(--ink);
		color: var(--paper);
	}
	/* The outcome: the shape, and the votes for and against. */
	td.eind {
		padding: 0 0 0 var(--s-2);
		white-space: nowrap;
		vertical-align: middle;
	}
	td.eind :global(.uitslag) {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-1);
		color: var(--ink-2);
		text-decoration: none;
	}
	@media (max-width: 640px) {
		.regeling {
			--naam: 120px;
			--dag: 44px;
			--eind: 104px;
		}
	}
</style>
