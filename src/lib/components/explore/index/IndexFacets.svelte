<script lang="ts" module>
	import Periode from '$lib/components/ui/Periode.svelte';
	import { rangeLabel } from './range';
	// The filter column of the index: per dimension its options, each with the number of
	// bronnen it holds under the other filters and a bar for its share. A dimension of
	// ordered steps (the stages of a bill) is drawn as columns, a period as two fields.

	export type FacetOption = {
		id: string;
		label: string;
		on: boolean;
		onClick: () => void;
		count?: number;
		swatch?: string;
		/** Under a heading of the same group; `deep` under an option of it (a court in its tier). */
		indent?: boolean | 'deep';
		/** What holds without a choice (the open dossiers): on, but not shown as a filter. */
		default?: boolean;
	};

	/** A heading within a list (a group of courts), not itself a filter. */
	export type FacetHeading = { heading: string; count?: number };

	export type FacetGroup = { id: string; label: string; note?: string } & (
		| {
				kind: 'list';
				options: (FacetOption | FacetHeading)[];
				/** A long list (the rechtsgebieden) shows this many, the chosen one too, then Alle N. */
				preview?: number;
		  }
		| {
				kind: 'steps';
				options: FacetOption[];
				ends: [string, string];
				/** What the line under the columns says when none is chosen. */
				none: string;
				/** Many narrow columns (years): no number above each. */
				compact?: boolean;
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
				options: { value: string; label: string }[];
				onChange: (v: string) => void;
		  }
	);

	/** A filter that is on, as a chip above the list. */
	export type ActiveFilter = { id: string; label: string; onRemove: () => void };

	const isHeading = (o: FacetOption | FacetHeading): o is FacetHeading => 'heading' in o;

	/** Every filter that is on in these groups, in their order. */
	export function activeFilters(groups: FacetGroup[]): ActiveFilter[] {
		return groups.flatMap((g): ActiveFilter[] => {
			switch (g.kind) {
				case 'list':
				case 'steps':
					return g.options.flatMap((o) =>
						isHeading(o) || !o.on || o.default
							? []
							: [{ id: `${g.id}:${o.id}`, label: o.label, onRemove: o.onClick }]
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
				case 'keuze':
					return [];
			}
		});
	}
</script>

<script lang="ts">
	import { formatCount } from '$lib/verbonden/filter';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';

	let {
		groups,
		pending = false
	}: {
		groups: FacetGroup[];
		/** The first answer is still on its way: no counts yet, rather than a column of zeros. */
		pending?: boolean;
	} = $props();

	let alle = $state<Record<string, boolean>>({});
	/** The options a long list shows: the first `preview`, and a chosen one beyond them. */
	// An indented option stands under a chosen one (the specific areas of a rechtsgebied):
	// it is shown with it and not counted against the preview.
	const shown = (g: FacetGroup & { kind: 'list' }) => {
		if (!g.preview || alle[g.id]) return g.options;
		let rank = 0;
		return g.options.filter((o) => {
			if (!isHeading(o) && o.indent) return true;
			return rank++ < g.preview! || (!isHeading(o) && o.on);
		});
	};
	/** The options a preview counts: all but the indented ones. */
	const counted = (g: FacetGroup & { kind: 'list' }) =>
		g.options.filter((o) => isHeading(o) || !o.indent).length;

	// A year field holds `2020`; the URL holds the first or last day of it.
</script>

<!-- While a page loads, the counts read "…" (as in the legend); the text keeps its contrast. -->
<div class="facets" aria-busy={pending}>
	<!-- The period first in every pane (Thijs, 9 Oct). -->
	{#each [...groups.filter((g) => g.kind === 'range'), ...groups.filter((g) => g.kind !== 'range')] as g (g.id)}
		<section class="group" aria-labelledby="facet-{g.id}">
			<h2 class="group-head" id="facet-{g.id}">
				<span>{g.label}</span>
				{#if g.note && !pending}<span class="group-note">{g.note}</span>{/if}
			</h2>

			{#if g.kind === 'list'}
				<ul class="options">
					{#each shown(g) as o, i (isHeading(o) ? `h${i}` : o.id)}
						{#if isHeading(o)}
							<li class="subhead">
								<span>{o.heading}</span>
								{#if o.count !== undefined && !pending}<span class="n">{formatCount(o.count)}</span
									>{/if}
							</li>
						{:else}
							<li>
								<FilterOptie
									label={o.label}
									on={o.on}
									onToggle={o.onClick}
									count={pending ? null : o.count}
									bezig={pending && o.count !== undefined}
									swatch={o.swatch}
									indent={o.indent}
								/>
							</li>
						{/if}
					{/each}
				</ul>
				{#if g.preview && counted(g) > g.preview}
					<button
						type="button"
						class="meer"
						aria-expanded={alle[g.id] ?? false}
						onclick={() => (alle = { ...alle, [g.id]: !alle[g.id] })}
						>{alle[g.id] ? 'Minder' : `Alle ${formatCount(counted(g))}`}</button
					>
				{/if}
			{:else if g.kind === 'steps'}
				<!-- De fasen als rijen, zoals elk ander filter; geen staafjes. -->
				<ul class="options" aria-label={g.label}>
					{#each g.options as o (o.id)}
						<li>
							<FilterOptie
								label={o.label}
								on={o.on}
								onToggle={o.onClick}
								count={pending ? null : o.count}
								bezig={pending && o.count !== undefined}
							/>
						</li>
					{/each}
				</ul>
			{:else if g.kind === 'select'}
				{@const sel = g}
				<select
					class="text select"
					value={sel.value}
					aria-label={sel.label}
					onchange={(e) => sel.onChange(e.currentTarget.value)}
				>
					<option value="">{sel.all}</option>
					{#each sel.options as o (o.value)}
						<option value={o.value}
							>{o.label}{o.count !== undefined ? ` (${formatCount(o.count)})` : ''}</option
						>
					{/each}
				</select>
			{:else if g.kind === 'range'}
				<!-- The same period in every list with dates ($lib/components/ui/Periode). -->
				<Periode van={g.from} tot={g.to} label={g.label} onChange={g.onChange} />
			{:else if g.kind === 'keuze'}
				{@const k = g}
				<Keuze
					label={k.label}
					waarde={k.value}
					onKies={k.onChange}
					opties={k.options.map((o) => ({ waarde: o.value, label: o.label }))}
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
		gap: var(--s-6);
		font-family: var(--font-sans);
	}
	.group-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin: 0 0 var(--s-2);
		/* A group in a section, rung 3 of docs/typografie.md; its note rung 6. */
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.group-note {
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.options {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.meer {
		margin-top: var(--s-1);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.meer:hover {
		color: var(--accent);
	}
	.subhead {
		display: flex;
		justify-content: space-between;
		padding: var(--s-2) 0 2px;
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
	}
	.subhead:first-child {
		padding-top: 0;
	}
	.n {
		margin-left: auto;
		padding-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
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
	.select {
		cursor: pointer;
	}
	.text::placeholder {
		color: var(--ink-3);
	}
</style>
