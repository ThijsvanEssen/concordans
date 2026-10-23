<script lang="ts">
	// What one button of FilterBar holds, in its menu on a wide screen and in its fold of the
	// sheet on a phone: per group its options with their counts (an option of 0 grey, never
	// left out), the period, a choice or a field; the group's name over it where the button
	// does not say it. A long list has a field to find an option by its name.
	import Periode from '$lib/components/ui/Periode.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { isOpen } from '$lib/components/ui/dicht.svelte';
	import { FIND_FROM, headed, type FacetButton, type FacetGroup } from './facets';

	let {
		button,
		pending = false,
		stale = false,
		menu = false,
		heads = false,
		folds = false,
		close
	}: {
		button: FacetButton;
		/** The first answer is still on its way: "…" for the counts, rather than zeros. */
		pending?: boolean;
		/** The counts did not come for these filters: none, rather than those of the filters before. */
		stale?: boolean;
		/** In a menu: its options are menu items, and a choice closes it (`close`). */
		menu?: boolean;
		/** Every group under its name (in Meer, where no button names them). */
		heads?: boolean;
		/** A long list folded under its name until opened or chosen (in Meer, among others). */
		folds?: boolean;
		close?: () => void;
	} = $props();
	const uid = $props.id();
	const hidden = $derived(pending || stale);

	/** A choice made: the menu closes first, so the focus is back on its button. */
	const choose = (act: () => void) => () => {
		close?.();
		act();
	};

	let typed = $state<Record<string, string>>({});
	type Option = { id: string; label: string; on: boolean };
	/** The options of a long list that hold what was typed; the chosen one always. */
	const matching = <T extends Option>(g: FacetGroup, options: T[]): T[] => {
		const w = (typed[g.id] ?? '').trim().toLowerCase();
		return w ? options.filter((o) => o.on || o.label.toLowerCase().includes(w)) : options;
	};
	const countOf = (count: number | string | undefined) => (hidden ? null : count);
	/** How many options a group of choices has, to fold a long one. */
	const size = (g: FacetGroup) => (g.kind === 'list' || g.kind === 'select' ? g.options.length : 0);
	/** Folded: a long list among others, without a choice, not opened by the reader. */
	const folded = (g: FacetGroup) =>
		folds &&
		size(g) > FIND_FROM &&
		!(g.kind === 'list' ? g.options.some((o) => o.on) : g.kind === 'select' && !!g.value) &&
		!isOpen(`facet:${g.label}`, false);
</script>

{#each button.groups as g (g.id)}
	{@const head = heads || headed(button, g)}
	<div
		class="group"
		role={menu ? 'group' : undefined}
		aria-labelledby={head ? `${uid}-${g.id}` : undefined}
		aria-label={head ? undefined : g.label}
	>
		{#if head}
			<p class="head" id="{uid}-{g.id}">
				{#if folds && size(g) > FIND_FROM}
					<FoldButton sleutel="facet:{g.label}" open={!folded(g)} controls="{uid}-o-{g.id}"
						>{g.label}</FoldButton
					>
				{:else}
					<span>{g.label}</span>
				{/if}
				{#if g.note && !hidden}<span class="note">{g.note}</span>{/if}
			</p>
		{/if}
		{#if folded(g)}
			<!-- Folded: its name opens it. -->
		{:else if g.kind === 'list' || g.kind === 'select'}
			{@const options =
				g.kind === 'list'
					? g.options
					: g.options.map((o) => ({
							id: o.value,
							label: o.label,
							count: o.count,
							on: o.value === g.value,
							onClick: () => g.onChange(o.value === g.value ? '' : o.value)
						}))}
			{#if options.length > FIND_FROM}
				<input
					type="search"
					aria-label="Zoek in {g.label.toLowerCase()}"
					placeholder="Zoek een {g.label.toLowerCase()}"
					value={typed[g.id] ?? ''}
					oninput={(e) => (typed = { ...typed, [g.id]: e.currentTarget.value })}
				/>
			{/if}
			<ul class="options" id="{uid}-o-{g.id}">
				{#each matching(g, options) as o (o.id)}
					<li>
						<FilterOptie
							{menu}
							label={o.label}
							on={o.on}
							onToggle={choose(o.onClick)}
							count={countOf(o.count)}
							empty={!hidden && o.count === 0}
							loading={pending && o.count !== undefined}
							swatch={'swatch' in o ? o.swatch : undefined}
							indent={'indent' in o ? o.indent : undefined}
							wrap
						/>
					</li>
				{/each}
			</ul>
			{#if options.length === 0}
				<!-- A group whose counts are on their way, or that has none under these filters. -->
				<p class="stil">{pending ? 'tellen…' : `Geen ${g.label.toLowerCase()}`}</p>
			{/if}
		{:else if g.kind === 'range'}
			<Periode from={g.from} to={g.to} label={g.label} onChange={g.onChange} />
		{:else if g.kind === 'keuze'}
			{@const k = g}
			<Keuze
				vol
				label={k.label}
				waarde={k.value}
				onSelect={(v) => choose(() => k.onChange(v))()}
				opties={k.options.map((o) => ({ waarde: o.value, label: o.label, titel: o.titel }))}
			/>
		{:else if g.kind === 'text'}
			{@const t = g}
			<input
				type="search"
				aria-label={t.label}
				placeholder={t.placeholder}
				value={t.value}
				onchange={(e) => t.onChange(e.currentTarget.value.trim())}
			/>
		{/if}
	</div>
{/each}

<style>
	.group + .group {
		margin-top: var(--s-3);
	}
	/* The name of a group in its menu: a quiet line over its options. */
	.head {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		margin: 0 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.note {
		font-weight: 400;
	}
	.options {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* An option a line of a menu: 32 px for a pointer, a finger's 44 below 768 and on touch. */
	.options :global(.optie) {
		min-height: var(--veld-h);
	}
	/* The box in the middle of its line, as the label: a label of two lines too (over the
	   top line FilterOptie gives a label that wraps in a column). */
	.options li :global(.optie:has(.label.wrap)) {
		align-items: center;
	}
	.options li :global(.optie:has(.label.wrap) > .vinkje) {
		margin-top: 0;
	}
	@media (pointer: coarse), (max-width: 768px) {
		.options :global(.optie) {
			min-height: var(--veld-h-raak);
		}
	}
	input {
		display: block;
		width: 100%;
		height: var(--veld-h);
		margin: 0 0 var(--s-2);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	input::placeholder {
		color: var(--ink-3);
	}
	@media (max-width: 768px) {
		input {
			height: var(--veld-h-raak);
			font-size: var(--t-input);
		}
	}
</style>
