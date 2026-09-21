<script lang="ts">
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { formatEcliLabel, type GraphNode } from '$lib/graph/types';
	import { textProp } from './readers/_shared';

	let { node }: { node: GraphNode | null } = $props();

	let active = $state('verkort');
	let copied = $state<string | null>(null);

	// Only what the node itself says: the API supplies no ready-made citations.
	const formats = $derived.by<Record<string, string> | null>(() => {
		const props = node?.raw?.props;
		if (!node || !props) return null;

		const number = textProp(props.article_number);
		if (node.collection === 'articles' && number) {
			const meta = $instrumentMetaStore.get(String(props.bwb_id));
			const law = meta?.shortTitle ?? meta?.citationTitle ?? meta?.title;
			return {
				verkort: `Art. ${number}${law ? ` ${law}` : ''}`,
				volledig: textProp(props.display_name) ?? node.label
			};
		}

		const ecli = textProp(props.ecli);
		if (node.collection === 'judgments' && ecli) {
			return {
				verkort: formatEcliLabel(ecli),
				volledig: ecli,
				...(props.source === 'rechtspraak' && {
					vindplaats: `https://deeplink.rechtspraak.nl/uitspraak?id=${ecli}`
				})
			};
		}

		return null;
	});

	// A judgment has a format that an article lacks.
	const shown = $derived(formats ? (formats[active] ? active : 'verkort') : null);

	async function handleCopy() {
		if (!formats || !shown) return;
		const format = shown;
		try {
			await navigator.clipboard.writeText(formats[format]);
			copied = format;
			setTimeout(() => {
				if (copied === format) copied = null;
			}, 1600);
		} catch {
			// The clipboard is unavailable in some contexts.
		}
	}
</script>

{#if formats}
	<section class="cite-copy" aria-label="Citeer dit">
		<h3 class="cite-h">Citeer dit</h3>

		<div class="cite-tabs" role="tablist">
			{#each Object.keys(formats) as f (f)}
				<button
					type="button"
					role="tab"
					class="cite-tab"
					class:on={shown === f}
					aria-selected={shown === f}
					onclick={() => (active = f)}>{f.toUpperCase()}</button
				>
			{/each}
		</div>

		<pre class="cite-text">{formats[shown!]}</pre>

		<button type="button" class="cite-copy-btn" onclick={handleCopy}>
			{copied === shown ? 'Gekopieerd' : 'Kopieer'}
		</button>
	</section>
{/if}

<style>
	.cite-copy {
		padding: var(--s-5) var(--s-5) var(--s-4);
		border-bottom: 1px solid var(--rule);
	}

	.cite-h {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin: 0 0 var(--s-3);
	}

	.cite-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: var(--s-2);
	}

	.cite-tab {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 0.08em;
		padding: 3px 7px;
		background: transparent;
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		color: var(--fg-3);
		cursor: pointer;
		transition: all var(--dur-1) var(--ease);
	}

	.cite-tab:hover {
		color: var(--ink);
		border-color: var(--rule-strong);
	}

	.cite-tab.on {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.cite-text {
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.5;
		color: var(--ink-2);
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		padding: var(--s-2) var(--s-3);
		margin: 0 0 var(--s-2);
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 120px;
		overflow-y: auto;
	}

	.cite-copy-btn {
		font-family: var(--font-sans);
		font-size: 11px;
		padding: 4px 10px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.cite-copy-btn:hover {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
</style>
