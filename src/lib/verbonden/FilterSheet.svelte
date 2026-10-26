<script lang="ts">
	import { plural } from '$lib/text/words';
	import { NL } from '$lib/text/collator';
	import Periode from '$lib/components/ui/Periode.svelte';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { FILTER_GROUP_VORM } from '$lib/bron/vormen';
	// The filter sheet: bronnen, verbindingen, lid, rechter, periode, betrouwbaarheid and
	// status, applied with one button. The same sheet opens from the panel and from
	// the legend of the network. A modal dialog: the focus goes to the search field on
	// open, stays inside while it is open, and returns to where it was on close.
	import { afterTick } from '$lib/util/after-tick';
	import type { Collection } from '$lib/vocabulary';
	import {
		FILTER_GROUPS,
		FILTER_GROUP_LABEL,
		EMPTY_FILTER,
		PRESETS,
		RECHTERS,
		activePreset,
		toggleFilterGroup,
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
		totalCount
	} from './view';

	let {
		open,
		filter,
		groups,
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

	const uid = $props.id();

	// The sheet edits a draft; the button applies it.
	let draft = $state<VerbondenFilter>(filter);
	$effect(() => {
		if (open) draft = filter;
	});

	let sheet = $state<HTMLElement | null>(null);
	let opener: HTMLElement | null = null;
	$effect(() => {
		if (!open) return;
		afterTick(() => {
			const at = document.activeElement;
			opener =
				at instanceof HTMLElement && at !== document.body && !sheet?.contains(at) ? at : null;
			sheet?.querySelector<HTMLElement>('.search')?.focus();
		});
		return () => {
			const back = opener;
			opener = null;
			if (back?.isConnected) back.focus();
		};
	});

	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

	/** Tab and Shift+Tab go round inside the sheet. */
	function trap(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !sheet) return;
		const els = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
		const first = els[0];
		const last = els.at(-1);
		if (!first || !last) return;
		const at = document.activeElement;
		if (e.shiftKey && (at === first || !sheet.contains(at))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (at === last || !sheet.contains(at))) {
			e.preventDefault();
			first.focus();
		}
	}

	const totals = $derived(groupTotals(groups));
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
	const total = $derived(totalCount(groups));
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

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !open || e.defaultPrevented) return;
		// Stopped, so that Escape does not also clear the selection of the network.
		e.preventDefault();
		e.stopPropagation();
		onClose();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if open}
	<div class="scrim" role="presentation" onclick={onClose}></div>
	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-labelledby="{uid}-title"
		tabindex="-1"
		bind:this={sheet}
		onkeydown={(e) => {
			onKey(e);
			trap(e);
		}}
	>
		<div class="sheet__head">
			<h2 class="sheet__title" id="{uid}-title">Filter</h2>
			<span class="sheet__count">{formatCount(count)} van {formatCount(total)}</span>
			<span class="sheet__space"></span>
			<TekstLink onclick={() => (draft = EMPTY_FILTER)}>Wissen</TekstLink>
			<IconButton label="Sluiten" onclick={onClose}>×</IconButton>
		</div>

		<div class="sheet__body">
			<div class="block">
				<input
					class="search"
					type="search"
					placeholder="Zoek in deze verbindingen"
					value={draft.zoek}
					oninput={(e) => (draft = { ...draft, zoek: (e.target as HTMLInputElement).value })}
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
				{#each presetsToChoose as p (p.id)}
					<FilterOptie
						label={p.label}
						on={activePreset(draft)?.id === p.id}
						onToggle={() => (draft = withPreset(draft, p))}
					/>
				{/each}
			</div>

			<div class="block">
				<div class="block__label">Bronnen</div>
				{#each sourcesToChoose as k (k)}
					{@const n = totals[k] ?? 0}
					<FilterOptie
						label={FILTER_GROUP_LABEL[k]}
						on={isOn(k)}
						onToggle={() => (draft = toggleFilterGroup(draft, k))}
						count={n}
					>
						{#snippet voor()}<KindGlyph vorm={FILTER_GROUP_VORM[k]} size={11} />{/snippet}
					</FilterOptie>
				{/each}
			</div>

			{#if relations.length > 0}
				<div class="block">
					<div class="block__label">Verbindingen</div>
					<ul class="list">
						{#each relations as r (r.relation)}
							<li class="list__row">
								<span class="check__name">{r.label}</span>
								<span class="check__count">{formatCount(r.count)}</span>
							</li>
						{/each}
					</ul>
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
				<div class="block__label">Betrouwbaarheid</div>
				<Keuze
					vol
					label="Betrouwbaarheid"
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
					on={statusAan('vastgesteld')}
					onToggle={() => toggleStatus('vastgesteld')}
				/>
				<FilterOptie
					label="Voorgesteld"
					on={statusAan('voorgesteld')}
					onToggle={() => toggleStatus('voorgesteld')}
				/>
			</div>
		</div>

		<div class="sheet__foot">
			<button
				type="button"
				class="btn is-primary"
				onclick={() => {
					onApply(draft);
					onClose();
				}}>Toon {formatCount(count)} {plural(count, 'verbinding', 'verbindingen')}</button
			>
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-modal) - 1);
		background: var(--scherm);
	}
	.sheet {
		position: fixed;
		top: var(--topbar-h);
		right: 0;
		bottom: 0;
		z-index: var(--z-modal);
		width: 400px;
		max-width: 100vw;
		display: flex;
		flex-direction: column;
		background: var(--paper);
		border-left: 1px solid var(--rule-strong);
		box-shadow: var(--shadow-modal);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink);
	}
	.sheet__head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: var(--s-4) var(--s-4) var(--s-3);
	}
	.sheet__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
	}
	.sheet__count {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.sheet__space {
		flex: 1;
	}
	.sheet__body {
		flex: 1;
		overflow-y: auto;
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
	.search {
		width: 100%;
		height: 32px;
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font: inherit;
		color: var(--ink);
	}
	.search::placeholder {
		color: var(--ink-3);
	}
	.check__name {
		flex: 1;
	}
	.check__count {
		color: var(--ink-3);
	}
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.list__row {
		display: flex;
		gap: var(--s-3);
		padding: var(--s-1) 0;
		color: var(--ink-2);
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
	.sheet__foot {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-4);
		border-top: 1px solid var(--rule);
		font-size: var(--t-micro);
	}
	@media (max-width: 768px) {
		.sheet {
			top: 0;
		}
	}
</style>
