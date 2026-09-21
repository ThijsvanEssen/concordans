<script lang="ts">
	// Horizontale tijdlijn van de acht wetgevingsfases. Multi-select.
	// Elke knoop kleurt naar zijn semantische toon (verworpen → spine,
	// aangenomen/in werking → olive/moss, voorbereidend → slate, etc.).

	export type FaseDef = {
		/** URL-waarde, bv. 'wetsvoorstel' */
		id: string;
		/** Weergavelabel, bv. 'Wetsvoorstel' */
		label: string;
		/** Kleurtoon: 'slate' | 'ochre' | 'olive' | 'moss' | 'spine' */
		tone: 'slate' | 'ochre' | 'olive' | 'moss' | 'spine';
	};

	let {
		phases,
		selected,
		counts,
		onToggle
	}: {
		phases: FaseDef[];
		selected: string[];
		counts: Record<string, number>;
		onToggle: (id: string) => void;
	} = $props();
</script>

<div class="fase-tl" role="group" aria-label="Filter op fase">
	{#each phases as p (p.id)}
		{@const on = selected.includes(p.id)}
		<button
			type="button"
			class="fase-tl-step tone-{p.tone}"
			class:fase-tl-step--on={on}
			onclick={() => onToggle(p.id)}
			title={p.label}
			aria-pressed={on}
		>
			<span class="fase-tl-dot" aria-hidden="true"></span>
			<span class="fase-tl-lbl">{p.label}</span>
			<span class="fase-tl-ct">{counts[p.id] ?? 0}</span>
		</button>
	{/each}
</div>

<style>
	.fase-tl {
		flex: 1;
		min-width: 0;
		position: relative;
		display: grid;
		grid-auto-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		padding: 14px 8px 4px;
	}
	.fase-tl::before {
		content: '';
		position: absolute;
		left: 8%;
		right: 8%;
		top: 22px;
		height: 1px;
		background: var(--rule-strong);
		z-index: 0;
	}
	.fase-tl-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		border: 0;
		background: transparent;
		cursor: pointer;
		padding: 0 4px;
		z-index: 1;
		min-width: 0;
	}
	.fase-tl-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--paper);
		border: 1.5px solid var(--rule-strong);
		transition:
			background 120ms,
			border-color 120ms;
	}
	.fase-tl-lbl {
		font-family: var(--font-sans);
		font-size: 10.5px;
		color: var(--fg-3);
		text-align: center;
		line-height: 1.25;
		max-width: 100px;
		transition: color 120ms;
	}
	.fase-tl-ct {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-4);
	}
	.fase-tl-step:hover .fase-tl-dot {
		border-color: var(--ink);
	}
	.fase-tl-step:hover .fase-tl-lbl {
		color: var(--ink-2);
	}

	/* Tone-aware rims voor unselected status */
	.tone-spine .fase-tl-dot {
		border-color: var(--spine);
	}
	.tone-moss .fase-tl-dot {
		border-color: var(--moss);
	}
	.tone-olive .fase-tl-dot {
		border-color: var(--olive);
	}
	.tone-ochre .fase-tl-dot {
		border-color: var(--ochre);
	}

	/* Selected: vul met dezelfde toon */
	.fase-tl-step--on .fase-tl-dot {
		background: var(--ink);
		border-color: var(--ink);
	}
	.fase-tl-step--on.tone-spine .fase-tl-dot {
		background: var(--spine);
		border-color: var(--spine);
	}
	.fase-tl-step--on.tone-moss .fase-tl-dot {
		background: var(--moss);
		border-color: var(--moss);
	}
	.fase-tl-step--on.tone-olive .fase-tl-dot {
		background: var(--olive);
		border-color: var(--olive);
	}
	.fase-tl-step--on.tone-ochre .fase-tl-dot {
		background: var(--ochre);
		border-color: var(--ochre);
	}
	.fase-tl-step--on .fase-tl-lbl {
		color: var(--ink);
		font-weight: 500;
	}
	.fase-tl-step--on .fase-tl-ct {
		color: var(--ink-2);
	}
</style>
