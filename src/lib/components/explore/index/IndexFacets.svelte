<script lang="ts" module>
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
		| { kind: 'list'; options: (FacetOption | FacetHeading)[] }
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
			}
		});
	}
</script>

<script lang="ts">
	import { formatCount } from '$lib/verbonden/filter';

	let {
		groups,
		pending = false
	}: {
		groups: FacetGroup[];
		/** The first answer is still on its way: no counts yet, rather than a column of zeros. */
		pending?: boolean;
	} = $props();

	// A year field holds `2020`; the URL holds the first or last day of it.
	const toParam = (value: string, unit: 'year' | 'date', end: boolean) =>
		unit === 'date' || !/^\d{4}$/.test(value) ? value : `${value}-${end ? '12-31' : '01-01'}`;
</script>

<div class="facets" class:facets--pending={pending}>
	{#each groups as g (g.id)}
		<section class="group" aria-labelledby="facet-{g.id}">
			<h3 class="group-head" id="facet-{g.id}">
				<span>{g.label}</span>
				{#if g.note && !pending}<span class="group-note">{g.note}</span>{/if}
			</h3>

			{#if g.kind === 'list'}
				<ul class="options">
					{#each g.options as o, i (isHeading(o) ? `h${i}` : o.id)}
						{#if isHeading(o)}
							<li class="subhead">
								<span>{o.heading}</span>
								{#if o.count !== undefined && !pending}<span class="n">{formatCount(o.count)}</span
									>{/if}
							</li>
						{:else}
							<li>
								<button
									type="button"
									class="opt"
									class:opt--on={o.on}
									class:opt--indent={o.indent}
									class:opt--deep={o.indent === 'deep'}
									aria-pressed={o.on}
									title={o.label}
									onclick={o.onClick}
								>
									{#if o.swatch}
										<span class="swatch" style:background={o.swatch}></span>
									{:else}
										<span class="box" aria-hidden="true"></span>
									{/if}
									<span class="label">{o.label}</span>
									{#if o.count !== undefined && !pending}
										<span class="n">{formatCount(o.count)}</span>
									{/if}
								</button>
							</li>
						{/if}
					{/each}
				</ul>
			{:else if g.kind === 'steps'}
				<!-- De fasen als rijen, zoals elk ander filter; geen staafjes. -->
				<ul class="options" aria-label={g.label}>
					{#each g.options as o (o.id)}
						<li>
							<button
								type="button"
								class="opt"
								class:opt--on={o.on}
								aria-pressed={o.on}
								onclick={o.onClick}
							>
								<span class="box" aria-hidden="true"></span>
								<span class="label">{o.label}</span>
								{#if o.count !== undefined && !pending}<span class="n">{formatCount(o.count)}</span
									>{/if}
							</button>
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
				{@const r = g}
				<div class="range">
					<label>
						<span class="visually-hidden">Van</span>
						<input
							type={r.unit === 'year' ? 'number' : 'date'}
							inputmode="numeric"
							placeholder="van"
							value={r.unit === 'year' ? r.from.slice(0, 4) : r.from}
							onchange={(e) => r.onChange(toParam(e.currentTarget.value, r.unit, false), r.to)}
						/>
					</label>
					<span class="range-sep">tot</span>
					<label>
						<span class="visually-hidden">Tot</span>
						<input
							type={r.unit === 'year' ? 'number' : 'date'}
							inputmode="numeric"
							placeholder="nu"
							value={r.unit === 'year' ? r.to.slice(0, 4) : r.to}
							onchange={(e) => r.onChange(r.from, toParam(e.currentTarget.value, r.unit, true))}
						/>
					</label>
				</div>
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
		font-size: var(--t-label);
		font-weight: 500;
		color: var(--ink-3);
	}
	.group-note {
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		font-size: var(--t-micro);
	}

	.options {
		list-style: none;
		margin: 0;
		padding: 0;
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
	.opt {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--s-2);
		width: 100%;
		padding: var(--s-1) 0;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: var(--t-meta);
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.opt--indent {
		padding-left: var(--s-3);
	}
	.opt:hover {
		color: var(--ink);
	}
	.opt:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.opt--on {
		color: var(--ink);
		font-weight: 500;
	}
	.box {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		border: 1px solid var(--rule-strong);
		border-radius: 2px;
		box-sizing: border-box;
	}
	.opt--on .box {
		background: var(--ink);
		border-color: var(--ink);
	}
	.swatch {
		width: 9px;
		height: 9px;
		flex-shrink: 0;
		border-radius: 50%;
	}
	.opt--on .swatch {
		box-shadow:
			0 0 0 2px var(--paper),
			0 0 0 3px var(--ink);
	}
	.label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.n {
		margin-left: auto;
		padding-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	.opt--deep {
		padding-left: var(--s-5);
	}

	.facets--pending {
		opacity: 0.6;
	}
	.range {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.range label {
		flex: 1;
		min-width: 0;
	}
	.range-sep {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.range input,
	.text {
		width: 100%;
		box-sizing: border-box;
		height: 30px;
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
	.range input::placeholder,
	.text::placeholder {
		color: var(--ink-3);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
