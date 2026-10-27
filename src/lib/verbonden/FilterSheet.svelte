<script lang="ts">
	import { capitalize } from '$lib/text/words';
	import { panel } from './panel-groups.svelte';
	import { NL } from '$lib/text/collator';
	import Periode from '$lib/components/ui/Periode.svelte';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import Tekstveld from '$lib/components/ui/Tekstveld.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Blad from '$lib/components/ui/Blad.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { SORT_SHAPE } from '$lib/bron/vormen';
	import { STUKSOORTEN, STUKSOORT_LABEL } from '$lib/bron/rubrieken';
	// The filter sheet: soort, relatie, lid, rechter, periode, zekerheid and
	// status, applied with one button. The same sheet opens from the panel and from
	// the legend of the network. A Blad: the focus goes to the search field on open, stays inside
	// while it is open, and returns to where it was on close.
	import type { Collection } from '$lib/vocabulary';
	import {
		FILTER_GROUPS,
		FILTER_GROUP_LABEL,
		EMPTY_FILTER,
		hasChoice,
		toggleRelation,
		PRESETS,
		RECHTERS,
		activePreset,
		stuksoortOn,
		toggleFilterGroup,
		toggleStuksoort,
		withPreset,
		type Betrouwbaarheid,
		type Status,
		type VerbondenFilter
	} from './filter';
	import { formatCount } from '$lib/text/getal';
	import type { Group } from './groups';
	import {
		allRows,
		groupTotals,
		lidCounts,
		courtCounts,
		relationCounts,
		shownCount,
		stuksoortTotals
	} from './view';

	let {
		open,
		filter,
		groups: rawGroups,

		lidTellingen = null,
		selection,
		onApply,
		onClose
	}: {
		open: boolean;
		filter: VerbondenFilter;
		groups: Group[];
		/** An article's counts per lid from the API, while its rows are not all in. */
		lidTellingen?: Map<string, number> | null;
		selection: Collection;
		onApply: (f: VerbondenFilter) => void;
		onClose: () => void;
	} = $props();

	// The groups as the head of Verbonden counts them, so button and head name one number.
	const groups = $derived(panel.groups ?? rawGroups);

	// The sheet edits a draft; the button applies it.
	let draft = $state<VerbondenFilter>(filter);
	$effect(() => {
		if (open) draft = filter;
	});

	const totals = $derived(groupTotals(groups));
	const perStuksoort = $derived(stuksoortTotals(groups));
	// Only what holds anything is offered; with one stuksoort the stukken need no facet.
	const stuksoortenToChoose = $derived(
		STUKSOORTEN.filter((s) => (perStuksoort[s] ?? 0) > 0 || !stuksoortOn(draft, s))
	);
	const perCourt = $derived(courtCounts(groups));
	// Only what holds anything is offered (T11); what is chosen stays, to be undone.
	const sourcesToChoose = $derived(
		FILTER_GROUPS.filter((k) => (totals[k] ?? 0) > 0 || !!draft.bronnen?.has(k))
	);
	const courtsToChoose = $derived(
		RECHTERS.filter((r) => (perCourt[r.id] ?? 0) > 0 || draft.rechter === r.id)
	);
	const presetsToChoose = $derived(
		PRESETS.filter(
			(p) =>
				activePreset(draft)?.id === p.id ||
				p.bronnen === null ||
				(p.rechter
					? (perCourt[p.rechter] ?? 0) > 0
					: p.bronnen.some((k) => (totals[k] ?? 0) > 0) &&
						// Not the same as Alles: a preset that leaves nothing out is no choice.
						FILTER_GROUPS.some((k) => (totals[k] ?? 0) > 0 && !p.bronnen?.includes(k)))
		)
	);
	const relations = $derived(relationCounts(groups, selection));
	const perLid = $derived(lidTellingen ?? lidCounts(allRows(groups)));
	const lids = $derived(
		[...perLid.entries()].filter(([k]) => k !== '').sort(([a], [b]) => NL.compare(a, b))
	);
	const noLid = $derived(perLid.get('') ?? 0);
	const perStatus = $derived.by(() => {
		const rows = allRows(groups);
		const proposed = rows.filter((r) => r.proposed).length;
		return { proposed, enacted: rows.length - proposed };
	});
	const count = $derived(shownCount(groups, draft));

	// The main areas of law of the judgments, where the API counts them (a wet's or an article's);
	// the one chosen stays to be undone.
	const gebieden = $derived.by(() => {
		const counted = groups.flatMap((g) => g.areas ?? []);
		const chosen = draft.area;
		return chosen && !counted.some((a) => a.area === chosen)
			? [...counted, { area: chosen, count: 0 }]
			: counted;
	});

	const isOn = (k: (typeof FILTER_GROUPS)[number]) =>
		draft.bronnen === null || draft.bronnen.has(k);

	const setBetrouwbaarheid = (b: Betrouwbaarheid | null) =>
		(draft = { ...draft, betrouwbaarheid: b });
	// Two switches, at least one on: both (null), or one of them.
	const statusAan = (s: Status) => draft.status === null || draft.status === s;
	const andere = (s: Status): Status => (s === 'vastgesteld' ? 'voorgesteld' : 'vastgesteld');
	function toggleStatus(s: Status) {
		if (!statusAan(s)) draft = { ...draft, status: null };
		else if (draft.status === null) draft = { ...draft, status: andere(s) };
	}

	/** The period, as every list with dates has it ($lib/components/ui/Periode). */
	function periode(van: string, tot: string) {
		const next = { ...draft, van: van || null, tot: tot || null, geldendOp: null };
		// A period given the wrong way round is read the right way round.
		draft =
			next.van !== null && next.tot !== null && next.van > next.tot
				? { ...next, van: next.tot, tot: next.van }
				: next;
	}

	let dateMode = $state(false);
	$effect(() => {
		if (open) dateMode = filter.geldendOp !== null;
	});
</script>

{#if open}
	<Blad title="Filter" place="rechts" tall focus=".search" {onClose}>
		<div class="sheet__inhoud">
			<div class="block">
				<Tekstveld
					class="search"
					type="search"
					label="Zoek in deze verbindingen"
					placeholder="Zoek in deze verbindingen"
					bind:value={() => draft.zoek, (zoek) => (draft = { ...draft, zoek })}
				/>
			</div>

			<!-- The period first, as in every filter pane (Thijs, 9 Oct). -->
			<div class="block">
				<div class="block__label">Periode</div>
				{#if dateMode}
					<div class="period">
						<span class="muted">tot en met</span>
						<input
							class="year"
							type="date"
							value={draft.geldendOp ?? ''}
							onchange={(e) =>
								(draft = {
									...draft,
									geldendOp: (e.target as HTMLInputElement).value || null,
									van: null,
									tot: null
								})}
						/>
						<span class="muted">of</span>
						<TekstLink
							onclick={() => {
								dateMode = false;
								draft = { ...draft, geldendOp: null };
							}}>een periode</TekstLink
						>
					</div>
				{:else}
					<Periode from={draft.van ?? ''} to={draft.tot ?? ''} onChange={periode} />
					<p class="period">
						<TekstLink onclick={() => (dateMode = true)}>Of geldend op een datum</TekstLink>
					</p>
				{/if}
			</div>

			<div class="block">
				<div class="block__label">Snel</div>
				<Keuze
					vol
					label="Snel"
					opties={presetsToChoose.map((p) => ({ waarde: p.id, label: p.label }))}
					waarde={activePreset(draft)?.id ?? null}
					onSelect={(w) => {
						const p = PRESETS.find((x) => x.id === w);
						if (p) draft = withPreset(draft, p);
					}}
				/>
			</div>

			<div class="block">
				<div class="block__label">Soort</div>
				{#each sourcesToChoose as k (k)}
					{@const n = totals[k] ?? 0}
					<FilterOptie
						label={FILTER_GROUP_LABEL[k]}
						on={isOn(k)}
						onToggle={() => (draft = toggleFilterGroup(draft, k))}
						count={n}
					>
						{#snippet voor()}<KindGlyph vorm={SORT_SHAPE[k]} size={11} />{/snippet}
					</FilterOptie>
				{/each}
			</div>

			{#if (totals.stukken ?? 0) > 0 && (stuksoortenToChoose.length > 1 || draft.stuksoort)}
				<div class="block">
					<div class="block__label">Stuksoort</div>
					{#each stuksoortenToChoose as s (s)}
						<FilterOptie
							label={STUKSOORT_LABEL[s]}
							on={stuksoortOn(draft, s)}
							onToggle={() => (draft = toggleStuksoort(draft, s))}
							count={perStuksoort[s] ?? 0}
						>
							{#snippet voor()}<KindGlyph
									vorm={s === 'wetsvoorstellen' ? 'voorstel' : 'stuk'}
									size={11}
								/>{/snippet}
						</FilterOptie>
					{/each}
				</div>
			{/if}

			{#if relations.length > 0}
				<div class="block">
					<div class="block__label">Relatie</div>
					{#each relations as r (r.relation)}
						<FilterOptie
							label={capitalize(r.label)}
							count={r.count}
							on={draft.relations === null || draft.relations.has(r.relation)}
							onToggle={() =>
								(draft = toggleRelation(
									draft,
									r.relation,
									relations.map((x) => x.relation)
								))}
						/>
					{/each}
				</div>
			{/if}

			{#if lids.length > 0}
				<div class="block">
					<div class="block__label">Lid</div>
					<FilterOptie
						label="Alle leden"
						on={draft.lid === null}
						onToggle={() => (draft = { ...draft, lid: null })}
					/>
					{#each lids as [lid, n] (lid)}
						<FilterOptie
							label="lid {lid}"
							count={n}
							on={draft.lid === lid}
							onToggle={() => (draft = { ...draft, lid: draft.lid === lid ? null : lid })}
						/>
					{/each}
					{#if noLid > 0}
						<FilterOptie
							label="Geen lid genoemd"
							count={noLid}
							on={draft.lid === 'geen'}
							onToggle={() => (draft = { ...draft, lid: draft.lid === 'geen' ? null : 'geen' })}
						/>
					{/if}
				</div>
			{/if}

			{#if courtsToChoose.length > 0}
				<div class="block">
					<div class="block__label">Rechter</div>
					{#each courtsToChoose as r (r.id)}
						<FilterOptie
							label={r.label}
							count={perCourt[r.id] ?? 0}
							on={draft.rechter === r.id}
							onToggle={() => (draft = { ...draft, rechter: draft.rechter === r.id ? null : r.id })}
						/>
					{/each}
				</div>
			{/if}

			{#if gebieden.length > 0}
				<div class="block">
					<div class="block__label">Rechtsgebied</div>
					{#each gebieden as a (a.area)}
						<FilterOptie
							label={a.area}
							count={a.count}
							on={draft.area === a.area}
							onToggle={() => (draft = { ...draft, area: draft.area === a.area ? null : a.area })}
						/>
					{/each}
				</div>
			{/if}

			<div class="block">
				<div class="block__label">Zekerheid</div>
				<Keuze
					vol
					label="Zekerheid"
					opties={[
						{ waarde: 'alles', label: 'Alles' },
						{ waarde: 'bron', label: 'Alleen hoog' },
						{ waarde: 'afgeleid', label: 'Matig of laag' }
					]}
					waarde={draft.betrouwbaarheid ?? 'alles'}
					onSelect={(w) => setBetrouwbaarheid(w === 'alles' ? null : (w as Betrouwbaarheid))}
				/>
			</div>

			<div class="block">
				<div class="block__label">Status</div>
				<FilterOptie
					label="Vastgesteld"
					count={perStatus.enacted}
					on={statusAan('vastgesteld')}
					onToggle={() => toggleStatus('vastgesteld')}
				/>
				<FilterOptie
					label="Voorgesteld"
					count={perStatus.proposed}
					on={statusAan('voorgesteld')}
					onToggle={() => toggleStatus('voorgesteld')}
				/>
			</div>
		</div>
		{#snippet foot()}
			{#if hasChoice(draft)}
				<TekstLink onclick={() => (draft = EMPTY_FILTER)}>Wis alles</TekstLink>
			{/if}
			<span class="sheet__space"></span>
			<button
				type="button"
				class="btn is-primary"
				onclick={() => {
					onApply(draft);
					onClose();
				}}>Toon {formatCount(count)}</button
			>
		{/snippet}
	</Blad>
{/if}

<style>
	/* The content of the Blad: the serif of the filter panes. */
	.sheet__inhoud {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink);
	}
	.sheet__space {
		flex: 1;
	}
	.block {
		padding: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	.block:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.block__label {
		margin-bottom: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.period {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.year {
		width: 64px;
		height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink);
	}
	.year[type='date'] {
		width: auto;
	}
	.muted {
		color: var(--ink-3);
	}
</style>
