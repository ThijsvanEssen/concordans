<script lang="ts">
	// The rows Doen of ⌘K (doen.svelte.ts): what the line asks to do, or before anything is
	// typed what can be done here. Each says its word and, where the register has one, its key,
	// so the key is learnt by doing it this way first; one that cannot be done here says why.
	import SearchOption from './SearchOption.svelte';
	import KeyCaps from '$lib/keys/KeyCaps.svelte';
	import { SHORTCUTS } from '$lib/keys/register';
	import type { DoRow } from '$lib/keys/doen.svelte';

	let {
		uid,
		rows,
		at,
		here = false,
		ondo,
		onpoint
	}: {
		uid: string;
		rows: readonly DoRow[];
		at: number | null;
		/** Nothing typed: the rows are what can be done here. */
		here?: boolean;
		ondo: (row: DoRow) => void;
		onpoint: (i: number) => void;
	} = $props();

	const comboOf = (id: string | undefined) => SHORTCUTS.find((s) => s.id === id)?.keys[0];
	/** The rows under their headings, each keeping its place in the one list the keys walk. */
	const sections = $derived.by(() => {
		const out: { name: string; rows: { row: DoRow; i: number }[] }[] = [];
		rows.forEach((row, i) => {
			const name = row.group ?? (here ? 'Hier' : 'Doen');
			if (out.at(-1)?.name !== name) out.push({ name, rows: [] });
			out.at(-1)!.rows.push({ row, i });
		});
		return out;
	});
</script>

{#each sections as section (section.name)}
	<div class="group" role="group" aria-labelledby="{uid}-{section.name}">
		<div class="group-label" id="{uid}-{section.name}">{section.name}</div>
		{#each section.rows as { row, i } (row.id)}
			{@const combo = comboOf(row.key)}
			<SearchOption
				id="{uid}-doen-{i}"
				active={at === i}
				citation
				onchoose={() => ondo(row)}
				onpoint={() => onpoint(i)}
			>
				<span class="doen" class:doen--niet={!!row.why}>
					<span class="doen__wat">{row.label}</span>
					{#if row.now}<span class="doen__nu">nu</span>{/if}
					{#if row.why}<span class="doen__waarom">{row.why}</span>{/if}
				</span>
				{#if row.word}<code class="doen__woord">{row.word}</code>{/if}
				{#if combo}<span class="doen__toets" aria-hidden="true"><KeyCaps {combo} /></span>{/if}
			</SearchOption>
		{/each}
	</div>
{/each}

<style>
	.group + .group {
		margin-top: var(--s-2);
	}
	.group-label {
		padding: var(--s-2) var(--s-4) var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.doen {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 var(--s-2);
	}
	.doen--niet .doen__wat {
		color: var(--ink-3);
	}
	.doen__nu,
	.doen__waarom {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.doen__woord {
		flex-shrink: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.doen__toets {
		flex-shrink: 0;
		font-size: var(--t-micro);
	}
	/* No keyboard to name on a touch screen or a phone. */
	@media (pointer: coarse), (max-width: 768px) {
		.doen__toets {
			display: none;
		}
	}
</style>
