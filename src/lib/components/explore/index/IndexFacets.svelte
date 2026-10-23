<script lang="ts" module>
	import Periode from '$lib/components/ui/Periode.svelte';
	import { rangeLabel } from './range';
	// The filter column of the index: per dimension its options, each with the number of
	// bronnen it holds under the other filters and a bar for its share; a period as two fields.

	type FacetOption = {
		id: string;
		label: string;
		on: boolean;
		onClick: () => void;
		count?: number | string;
		swatch?: string;
		/** Under an option of the same group: a specific area under its rechtsgebied. */
		indent?: boolean;
		/** What holds without a choice (the open dossiers): on, but not shown as a filter. */
		default?: boolean;
	};

	export type FacetGroup = { id: string; label: string; note?: string } & (
		| {
				kind: 'list';
				/** Names what a chosen option is in its chip, where its label alone is ambiguous. */
				chip?: string;
				options: FacetOption[];
				/** While the first answer is on its way and there are no options yet: this many
				 *  lines of room, so nothing under the group moves when the options come. */
				rijen?: number;
				/** Where a column folds its groups: this one stands open too (the rechtsgebied). */
				open?: boolean;
				/** A long list (the rechtsgebieden) shows this many, the chosen one too, then Alle N. */
				preview?: number;
		  }
		| {
				kind: 'select';
				value: string;
				/** The first option, for no choice. */
				all: string;
				options: { value: string; label: string; count?: number }[];
				onChange: (v: string) => void;
		  }
		| {
				kind: 'range';
				/** `year` keeps a year, `date` a day, as the URL holds them. */
				unit: 'year' | 'date';
				from: string;
				to: string;
				onChange: (from: string, to: string) => void;
		  }
		| { kind: 'text'; value: string; placeholder: string; onChange: (v: string) => void }
		| {
				/** One of a few, always one chosen: a choice, not a filter (the Kamer). */
				kind: 'keuze';
				value: string;
				/** `titel` names the option in full where its label is short (Tweede: Tweede Kamer). */
				options: { value: string; label: string; titel?: string }[];
				onChange: (v: string) => void;
		  }
	);

	/**
	 * A menu's options from its counts, the chosen value among them though the counts lack it
	 * (not in yet, or partial): by its name, never its key (#136).
	 */
	export const selectOptions = (
		counts: Map<string, number>,
		chosen: string,
		name: (key: string) => string
	): { value: string; label: string; count?: number }[] => [
		...(chosen && !counts.has(chosen) ? [{ value: chosen, label: name(chosen) }] : []),
		...[...counts].map(([key, count]) => ({ value: key, label: name(key), count }))
	];

	/** A filter that is on, as a chip above the list. */
	type ActiveFilter = { id: string; label: string; onRemove: () => void };

	/** Every filter that is on in these groups, in their order. */
	export function activeFilters(groups: FacetGroup[]): ActiveFilter[] {
		return groups.flatMap((g): ActiveFilter[] => {
			switch (g.kind) {
				case 'list':
					return g.options.flatMap((o) =>
						!o.on || o.default
							? []
							: [
									{
										id: `${g.id}:${o.id}`,
										label: g.chip ? `${g.chip}: ${o.label}` : o.label,
										onRemove: o.onClick
									}
								]
					);
				case 'range':
					return g.from || g.to
						? [
								{
									id: g.id,
									label: `${g.label}: ${rangeLabel(g.from, g.to, g.unit)}`,
									onRemove: () => g.onChange('', '')
								}
							]
						: [];
				case 'select': {
					const on = g.options.find((o) => o.value === g.value);
					return on
						? [{ id: g.id, label: `${g.label}: ${on.label}`, onRemove: () => g.onChange('') }]
						: [];
				}
				case 'text':
					return g.value
						? [{ id: g.id, label: `${g.label}: ${g.value}`, onRemove: () => g.onChange('') }]
						: [];
				// A choice, not a filter: no chip.
				case 'keuze':
					return [];
			}
		});
	}
</script>

<script lang="ts">
	import { formatCount } from '$lib/text/getal';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { isOpen } from '$lib/components/ui/dicht.svelte';

	let {
		groups,
		pending = false,
		stale = false
	}: {
		groups: FacetGroup[];
		/** The first answer is still on its way: no counts yet, rather than a column of zeros. */
		pending?: boolean;
		/** The counts did not come for these filters: none, rather than those of the filters before. */
		stale?: boolean;
	} = $props();
	const hidden = $derived(pending || stale);

	let alle = $state<Record<string, boolean>>({});
	/** The options a long list shows: the first `preview`, and a chosen one beyond them. */
	// An indented option stands under a chosen one (the specific areas of a rechtsgebied):
	// it is shown with it and not counted against the preview.
	const shown = (g: FacetGroup & { kind: 'list' }) => {
		const n = voorproef(g);
		if (!n || alle[g.id]) return g.options;
		let rank = 0;
		return g.options.filter((o) => {
			if (o.indent) return true;
			return rank++ < n || o.on;
		});
	};
	/** The options a preview counts: all but the indented ones. */
	const counted = (g: FacetGroup & { kind: 'list' }) => g.options.filter((o) => !o.indent).length;
	/**
	 * A list longer than LANG shows VOORPROEF, then Alle N, where its page set no `preview`:
	 * the fifty fracties of Actueel were fifty stops of the keyboard before the first event
	 * (audit 3).
	 */
	const LANG = 12;
	const VOORPROEF = 8;
	const voorproef = (g: FacetGroup & { kind: 'list' }) =>
		g.preview ?? (counted(g) > LANG ? VOORPROEF : undefined);

	/**
	 * A column of this many option groups or more folds them (A192): the first stands open, so
	 * does a group that says `open` and every group that holds a chosen option; the others show
	 * their head and total.
	 * Fewer groups all stand open. By the number of groups, not of options, so the column does
	 * not refold when the counts or a late group come in.
	 */
	const FOLDS_FROM = 5;
	const lists = $derived(groups.filter((g) => g.kind === 'list'));
	const folds = $derived(lists.length >= FOLDS_FROM);
	const standsOpen = (g: FacetGroup) =>
		!folds ||
		g.kind !== 'list' ||
		(g.options.some((o) => o.on && !o.default)
			? true
			: isOpen(`facet:${g.label}`, g === lists[0] || !!g.open));
</script>

<!-- While a page loads, the counts read "…" (as in the legend); the text keeps its contrast. -->
<div class="facets" aria-busy={pending}>
	<!-- The period first in every pane (Thijs, 9 Oct). -->
	{#each [...groups.filter((g) => g.kind === 'range'), ...groups.filter((g) => g.kind !== 'range')] as g (g.id)}
		{@const open = standsOpen(g)}
		<section class="group" aria-labelledby="facet-{g.id}">
			<h2 class="group-head" id="facet-{g.id}">
				{#if folds && g.kind === 'list'}
					<FoldButton sleutel="facet:{g.label}" {open} controls="facet-opties-{g.id}"
						>{g.label}</FoldButton
					>
				{:else}
					<span>{g.label}</span>
				{/if}
				{#if g.note && !hidden}<span class="group-note" title={g.note}>{g.note}</span>{/if}
			</h2>

			{#if g.kind === 'list' && open}
				<ul class="options" id="facet-opties-{g.id}">
					{#if pending && g.options.length === 0 && g.rijen}
						{#each { length: g.rijen } as _, n (n)}
							<li class="wacht" aria-hidden="true"></li>
						{/each}
					{/if}
					{#each shown(g) as o (o.id)}
						<li>
							<FilterOptie
								label={o.label}
								on={o.on}
								onToggle={o.onClick}
								count={hidden ? null : o.count}
								loading={pending && o.count !== undefined}
								swatch={o.swatch}
								indent={o.indent}
								wrap
							/>
						</li>
					{/each}
				</ul>
				{#if voorproef(g) && counted(g) > voorproef(g)!}
					<p class="alle">
						<TekstLink onclick={() => (alle = { ...alle, [g.id]: !alle[g.id] })}
							>{alle[g.id] ? 'Minder' : `Alle ${formatCount(counted(g))}`}</TekstLink
						>
					</p>
				{/if}
			{:else if g.kind === 'select'}
				{@const sel = g}
				<!-- One of many: a text menu (docs/bediening.md), the count beside each option. -->
				<TekstMenu
					label={sel.label}
					waarde={sel.value}
					opties={[
						{ waarde: '', label: sel.all },
						...sel.options.map((o) => ({
							waarde: o.value,
							label: `${o.label}${o.count !== undefined && !hidden ? ` (${formatCount(o.count)})` : ''}`
						}))
					]}
					tekst={sel.value
						? (sel.options.find((o) => o.value === sel.value)?.label ?? sel.value)
						: sel.all}
					onSelect={(v) => sel.onChange(v)}
				/>
			{:else if g.kind === 'range'}
				<!-- The same period in every list with dates ($lib/components/ui/Periode). -->
				<Periode from={g.from} to={g.to} label={g.label} onChange={g.onChange} />
			{:else if g.kind === 'keuze'}
				{@const k = g}
				<Keuze
					vol
					label={k.label}
					waarde={k.value}
					onSelect={k.onChange}
					opties={k.options.map((o) => ({ waarde: o.value, label: o.label, titel: o.titel }))}
				/>
			{:else if g.kind === 'text'}
				{@const t = g}
				<input
					class="text"
					type="search"
					aria-label={t.label}
					placeholder={t.placeholder}
					value={t.value}
					onchange={(e) => t.onChange(e.currentTarget.value.trim())}
				/>
			{/if}
		</section>
	{/each}
</div>

<style>
	.facets {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
		font-family: var(--font-serif);
	}
	.group-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--s-3);
		margin: 0 0 var(--s-2);
		/* A group in a section, rung 3 of docs/typografie.md; its note rung 6. */
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	/* One line at the right, cut off where it is long: the whole of it in the title. */
	.group-note {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	/* On a touch screen an option is a finger's height; the folded groups keep the column short. */
	@media (pointer: coarse), (max-width: 768px) {
		.options :global(.optie) {
			min-height: var(--veld-h-raak);
		}
	}
	.options {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* A line of room for an option that is still to come: the height of an option, a faint bar. */
	.wacht {
		display: flex;
		align-items: center;
		min-height: var(--tik-h);
	}
	.wacht::before {
		content: '';
		width: 60%;
		height: var(--s-2);
		border-radius: var(--r-1);
		background: var(--rule);
	}
	.alle {
		margin: var(--s-1) 0 0;
		font-size: var(--t-meta);
	}

	.text {
		width: 100%;
		box-sizing: border-box;
		height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font: inherit;
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.text::placeholder {
		color: var(--ink-3);
	}
</style>
