<script lang="ts" module>
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
									label: `${g.label}: ${shown(g.from, g.unit) || '…'} tot ${shown(g.to, g.unit) || 'nu'}`,
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

	const shown = (value: string, unit: 'year' | 'date') =>
		!value
			? ''
			: unit === 'year'
				? value.slice(0, 4)
				: new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(new Date(value));
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

	const maxOf = (options: (FacetOption | FacetHeading)[]) =>
		Math.max(1, ...options.flatMap((o) => (isHeading(o) ? [] : [o.count ?? 0])));

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
				{@const max = maxOf(g.options)}
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
										<span class="bar" style:width="{(o.count / max) * 100}%" aria-hidden="true"
										></span>
									{/if}
								</button>
							</li>
						{/if}
					{/each}
				</ul>
			{:else if g.kind === 'steps'}
				{@const max = maxOf(g.options)}
				<div class="steps" class:steps--compact={g.compact} role="group" aria-label={g.label}>
					{#each g.options as o (o.id)}
						<button
							type="button"
							class="step"
							class:step--on={o.on}
							aria-pressed={o.on}
							title="{o.label}{o.count !== undefined ? `: ${o.count}` : ''}"
							onclick={o.onClick}
						>
							{#if !g.compact}<span class="step-n">{pending ? '' : (o.count ?? '')}</span>{/if}
							<span class="step-col" style:height="{((o.count ?? 0) / max) * 56 + 2}px"></span>
							<span class="visually-hidden">{o.label}</span>
						</button>
					{/each}
				</div>
				<div class="steps-ends" aria-hidden="true">
					<span>{g.ends[0]}</span><span>{g.ends[1]}</span>
				</div>
				{@const on = g.options.find((o) => o.on)}
				<p class="steps-on">{on ? on.label : g.none}</p>
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
		gap: var(--s-5);
		font-family: var(--font-sans);
	}
	.group-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin: 0 0 var(--s-2);
		font-size: var(--t-label);
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
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
		padding: var(--s-1) 0 5px;
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
		width: 11px;
		height: 11px;
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
	/* The share of the option, a hairline under it. */
	.bar {
		position: absolute;
		left: 0;
		bottom: 0;
		height: 2px;
		background: var(--rule);
	}
	.opt--indent .bar {
		left: 12px;
	}
	.opt--deep {
		padding-left: var(--s-5);
	}
	.opt--deep .bar {
		left: 24px;
	}
	.opt--on .bar {
		background: var(--ink);
	}

	.facets--pending {
		opacity: 0.6;
	}
	/* Ordered steps: one column per step, its height the count. */
	.steps {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 80px;
	}
	.step {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-end;
		gap: var(--s-1);
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}
	.steps--compact {
		gap: 1px;
		height: 64px;
	}
	.step-n {
		font-size: var(--t-label);
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	.step-col {
		background: var(--rule-strong);
		transition: background var(--dur-1) var(--ease);
	}
	.step:hover .step-col {
		background: var(--ink-3);
	}
	.step--on .step-col {
		background: var(--ink);
	}
	.step--on .step-n {
		color: var(--ink);
		font-weight: 500;
	}
	.step:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.steps-ends {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.steps-on {
		margin: 6px 0 0;
		font-size: var(--t-meta);
		color: var(--ink-2);
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
