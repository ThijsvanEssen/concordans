<script lang="ts">
	// The filter sheet: bronnen, verbindingen, lid, rechter, periode, betrouwbaarheid and
	// status, applied with one button. The same sheet opens from the panel and from
	// the legend of the network.
	import type { Collection } from '$lib/vocabulary';
	import {
		BRON_KINDS,
		BRON_KIND_LABEL,
		EMPTY_FILTER,
		PRESETS,
		RECHTERS,
		activePreset,
		formatCount,
		toggleKind,
		withPreset,
		type Betrouwbaarheid,
		type Status,
		type VerbondenFilter
	} from './filter';
	import type { Group } from './groups';
	import { allRows, kindTotals, lidCounts, relationCounts, shownCount, totalCount } from './view';

	let {
		open,
		filter,
		groups,
		selection,
		onApply,
		onClose
	}: {
		open: boolean;
		filter: VerbondenFilter;
		groups: Group[];
		selection: Collection;
		onApply: (f: VerbondenFilter) => void;
		onClose: () => void;
	} = $props();

	// The sheet edits a draft; the button applies it.
	let draft = $state<VerbondenFilter>(filter);
	$effect(() => {
		if (open) draft = filter;
	});

	const totals = $derived(kindTotals(groups));
	const relations = $derived(relationCounts(groups, selection));
	const lids = $derived(
		[...lidCounts(allRows(groups)).entries()]
			.filter(([k]) => k !== '')
			.sort(([a], [b]) => a.localeCompare(b, 'nl', { numeric: true }))
	);
	const noLid = $derived(lidCounts(allRows(groups)).get('') ?? 0);
	const total = $derived(totalCount(groups));
	const count = $derived(shownCount(groups, draft));

	const isOn = (k: (typeof BRON_KINDS)[number]) => draft.bronnen === null || draft.bronnen.has(k);

	const setBetrouwbaarheid = (b: Betrouwbaarheid | null) =>
		(draft = { ...draft, betrouwbaarheid: b });
	const setStatus = (s: Status | null) =>
		(draft = { ...draft, status: draft.status === s ? null : s });

	function yearInput(e: Event, key: 'van' | 'tot') {
		const v = (e.target as HTMLInputElement).value;
		draft = { ...draft, [key]: /^\d{4}$/.test(v) ? Number(v) : null, geldendOp: null };
	}

	let dateMode = $state(false);
	$effect(() => {
		if (open) dateMode = filter.geldendOp !== null;
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) onClose();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if open}
	<div class="scrim" role="presentation" onclick={onClose}></div>
	<aside class="sheet" aria-label="Filter">
		<div class="sheet__head">
			<h2 class="sheet__title">Filter</h2>
			<span class="sheet__count">{formatCount(count)} van {formatCount(total)}</span>
			<span class="sheet__space"></span>
			<button type="button" class="link" onclick={() => (draft = EMPTY_FILTER)}>Wis alles</button>
			<button type="button" class="btn is-text sheet__close" aria-label="Sluiten" onclick={onClose}
				>×</button
			>
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

			<div class="block">
				<div class="block__label">Snel</div>
				<div class="chips">
					{#each PRESETS as p (p.id)}
						<button
							type="button"
							class="btn"
							class:is-primary={activePreset(draft)?.id === p.id}
							onclick={() => (draft = withPreset(draft, p))}>{p.label}</button
						>
					{/each}
				</div>
			</div>

			<div class="block">
				<div class="block__label">Bronnen</div>
				{#each BRON_KINDS as k (k)}
					{@const n = totals[k] ?? 0}
					<label class="check" class:is-empty={n === 0}>
						<input
							type="checkbox"
							checked={isOn(k)}
							onchange={() => (draft = toggleKind(draft, k))}
						/>
						<span class="check__box" aria-hidden="true">{isOn(k) ? '✓' : ''}</span>
						<span class="check__name">{BRON_KIND_LABEL[k]}</span>
						<span class="check__count">{formatCount(n)}</span>
					</label>
				{/each}
			</div>

			{#if relations.length > 0}
				<div class="block">
					<div class="block__label">Verbindingen</div>
					{#each relations as r (r.relation)}
						<div class="check">
							<span class="check__box is-static" aria-hidden="true">✓</span>
							<span class="check__name">{r.label}</span>
							<span class="check__count">{formatCount(r.count)}</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if lids.length > 0}
				<div class="block">
					<div class="block__label">Lid</div>
					<div class="chips">
						<button
							type="button"
							class="btn"
							class:is-primary={draft.lid === null}
							onclick={() => (draft = { ...draft, lid: null })}>Alle</button
						>
						{#each lids as [lid, n] (lid)}
							<button
								type="button"
								class="btn"
								class:is-primary={draft.lid === lid}
								title="{n} verbindingen"
								onclick={() => (draft = { ...draft, lid: draft.lid === lid ? null : lid })}
								>{lid}</button
							>
						{/each}
						{#if noLid > 0}
							<button
								type="button"
								class="btn"
								class:is-primary={draft.lid === 'geen'}
								onclick={() => (draft = { ...draft, lid: draft.lid === 'geen' ? null : 'geen' })}
								>niet genoemd</button
							>
						{/if}
					</div>
				</div>
			{/if}

			<div class="block">
				<div class="block__label">Rechter</div>
				<div class="chips">
					{#each RECHTERS as r (r.id)}
						<button
							type="button"
							class="btn"
							class:is-primary={draft.rechter === r.id}
							onclick={() => (draft = { ...draft, rechter: draft.rechter === r.id ? null : r.id })}
							>{r.label}</button
						>
					{/each}
				</div>
			</div>

			<div class="block">
				<div class="block__label">Periode</div>
				{#if dateMode}
					<div class="period">
						<span class="muted">geldend op</span>
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
						<button
							type="button"
							class="link"
							onclick={() => {
								dateMode = false;
								draft = { ...draft, geldendOp: null };
							}}>een periode</button
						>
					</div>
				{:else}
					<div class="period">
						<input
							class="year"
							type="text"
							inputmode="numeric"
							placeholder="jaar"
							value={draft.van ?? ''}
							onchange={(e) => yearInput(e, 'van')}
							aria-label="Van"
						/>
						<span class="muted">tot</span>
						<input
							class="year"
							type="text"
							inputmode="numeric"
							placeholder="jaar"
							value={draft.tot ?? ''}
							onchange={(e) => yearInput(e, 'tot')}
							aria-label="Tot"
						/>
						<span class="muted">of</span>
						<button type="button" class="link" onclick={() => (dateMode = true)}
							>geldend op een datum</button
						>
					</div>
				{/if}
			</div>

			<div class="block">
				<div class="block__label">Betrouwbaarheid</div>
				<div class="chips">
					<button
						type="button"
						class="btn"
						class:is-primary={draft.betrouwbaarheid === null}
						onclick={() => setBetrouwbaarheid(null)}>Alles</button
					>
					<button
						type="button"
						class="btn"
						class:is-primary={draft.betrouwbaarheid === 'bron'}
						onclick={() => setBetrouwbaarheid('bron')}>Alleen uit de bron gelezen</button
					>
					<button
						type="button"
						class="btn"
						class:is-primary={draft.betrouwbaarheid === 'afgeleid'}
						onclick={() => setBetrouwbaarheid('afgeleid')}>Alleen afgeleid</button
					>
				</div>
			</div>

			<div class="block">
				<div class="block__label">Status</div>
				<div class="chips">
					<button
						type="button"
						class="btn"
						class:is-primary={draft.status === null || draft.status === 'vastgesteld'}
						onclick={() => setStatus('vastgesteld')}>Vastgesteld</button
					>
					<button
						type="button"
						class="btn"
						class:is-primary={draft.status === null || draft.status === 'voorgesteld'}
						onclick={() => setStatus('voorgesteld')}>Voorgesteld</button
					>
				</div>
			</div>
		</div>

		<div class="sheet__foot">
			<button
				type="button"
				class="btn is-primary"
				onclick={() => {
					onApply(draft);
					onClose();
				}}>Toon {formatCount(count)} {count === 1 ? 'verbinding' : 'verbindingen'}</button
			>
			<span class="muted"
				>De keuze staat in de link en geldt voor het paneel, de kantlijn, het netwerk en de tabel.</span
			>
		</div>
	</aside>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-modal) - 1);
		background: rgba(28, 27, 25, 0.12);
	}
	.sheet {
		position: fixed;
		top: 60px;
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
		font-family: var(--font-sans);
		font-size: 12.5px;
		color: var(--ink);
	}
	.sheet__head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 18px 18px 12px;
	}
	.sheet__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 17px;
		font-weight: 500;
	}
	.sheet__count {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.sheet__space {
		flex: 1;
	}
	.sheet__close {
		font-size: 16px;
		line-height: 1;
		padding: 0 4px;
	}
	.sheet__body {
		flex: 1;
		overflow-y: auto;
	}
	.block {
		padding: 14px 18px;
		border-top: 1px solid var(--rule);
	}
	.block:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.block__label {
		margin-bottom: 6px;
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}
	.search {
		width: 100%;
		height: 32px;
		padding: 0 10px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font: inherit;
		color: var(--ink);
	}
	.search::placeholder {
		color: var(--ink-3);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		color: var(--ink-2);
		cursor: pointer;
	}
	.check.is-empty {
		color: var(--ink-3);
	}
	.check input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.check__box {
		width: 14px;
		height: 14px;
		display: grid;
		place-items: center;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: 10px;
		line-height: 1;
		color: var(--paper);
		flex: none;
	}
	.check input:checked + .check__box,
	.check__box.is-static {
		background: var(--ink);
		border-color: var(--ink);
	}
	.check input:focus-visible + .check__box {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.check__name {
		flex: 1;
	}
	.check__count {
		color: var(--ink-3);
	}
	.period {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.year {
		width: 64px;
		height: 26px;
		padding: 0 8px;
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
	.link {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-2);
		cursor: pointer;
	}
	.link:hover {
		color: var(--accent);
	}
	.sheet__foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 18px;
		border-top: 1px solid var(--rule);
		font-size: var(--t-micro);
	}
	@media (max-width: 768px) {
		.sheet {
			top: 0;
		}
	}
</style>
