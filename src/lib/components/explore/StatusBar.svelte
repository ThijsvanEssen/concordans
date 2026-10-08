<script lang="ts">
	// The bar above the panels: a back arrow, the name of the bron once its title is out of
	// view, Deel, and the switch Netwerk / Tekst (WeergaveSchakelaar). In Bladeren: where.
	// Bladeren is a place to go, not a view of the selected bron, so it lives in the top
	// nav only, not here.
	import type { GraphNode } from '$lib/graph/types';
	import type { Mode } from '$lib/vocabulary';
	import { tabTitle } from '$lib/bron/tab-title';
	import { kop } from '$lib/stores/kop.svelte';
	import { categoryLabel, isIndexCategory } from './index/categories';
	import WeergaveSchakelaar from './WeergaveSchakelaar.svelte';

	let {
		node,
		focusError = null,
		mode = 'graph',
		tableMode = false,
		indexCategory = null,
		indexResultCount = null,
		shareLabel = 'Deel',
		shareAnnouncement = '',
		onGoBack,
		onShareView,
		readAction = null,
		onRead
	}: {
		node: GraphNode | null;
		focusError?: string | null;
		mode?: Mode;
		/** The verbindingen of the bron as a table. */
		tableMode?: boolean;
		indexCategory?: string | null;
		/** `total` is null when the list does not say how many there are. */
		indexResultCount?: { filtered: number; total: number | null } | null;
		/** The share button's label: Deel, or what the last copy did. */
		shareLabel?: string;
		shareAnnouncement?: string;
		onGoBack?: () => void;
		onShareView?: () => void;
		/** `read` offers Tekst, `network` the way back to Netwerk; null shows neither. */
		readAction?: 'read' | 'network' | null;
		onRead?: (on: boolean) => void;
	} = $props();

	// The place of the bron is the band above its text (Behoort bij); this bar holds the
	// actions, and names the bron once its title has scrolled away (Thijs, 9 Oct, option A of
	// statusbalk-voorstel.md). The kind's list is the link above the title (SoortLink).
	const naam = $derived(node ? tabTitle(node) : '');
	// The table of verbindingen has no title of its own: the name stands from the start.
	const zichtbaar = $derived(kop.uitBeeld || tableMode);
</script>

<div class="status-bar" class:status-bar--bron={!!node && mode !== 'index'}>
	<button type="button" class="back" onclick={onGoBack} aria-label="Terug">←</button>

	{#if mode === 'index'}
		<div class="path">
			{#if isIndexCategory(indexCategory)}
				<a class="seg seg--link" href="/explore?mode=index">Bladeren</a>
			{:else}
				<span>Bladeren</span>
			{/if}
			{#if isIndexCategory(indexCategory)}
				<span class="sep" aria-hidden="true">›</span>
				<span>{categoryLabel(indexCategory)}</span>
			{/if}
		</div>
		{#if indexResultCount}
			<span class="count">
				{#if indexResultCount.total === null}
					{indexResultCount.filtered.toLocaleString('nl-NL')} geladen
				{:else}
					{indexResultCount.filtered.toLocaleString('nl-NL')} van {indexResultCount.total.toLocaleString(
						'nl-NL'
					)}
				{/if}
			</span>
		{/if}
	{:else if node}
		<div class="naam" class:naam--zichtbaar={zichtbaar} aria-hidden={!zichtbaar}>
			{tableMode ? `${naam}, verbindingen` : naam}
		</div>
	{:else if focusError}
		<div class="error">{focusError}</div>
	{/if}

	<span class="space"></span>

	{#if onShareView}
		<button type="button" class="btn is-text" onclick={onShareView}>{shareLabel}</button>
		<span class="sr-only" aria-live="polite">{shareAnnouncement}</span>
	{/if}

	{#if readAction}
		<span class="weergave">
			<WeergaveSchakelaar
				stand={readAction === 'read' ? 'netwerk' : 'tekst'}
				onKies={(k) => onRead?.(k === 'tekst')}
			/>
		</span>
	{:else if node && mode !== 'index'}
		<span class="weergave">
			<WeergaveSchakelaar stand="netwerk" onKies={() => {}} tekstMogelijk={false} />
		</span>
	{/if}
</div>

<style>
	.status-bar {
		height: 40px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: 0 20px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		position: relative;
		z-index: var(--z-topbar);
	}

	.back {
		padding: 2px var(--s-1);
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-body-2);
		line-height: 1;
		color: var(--ink-2);
		cursor: pointer;
	}
	.back:hover {
		color: var(--accent);
	}

	.path {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		min-width: 0;
		overflow: hidden;
		color: var(--ink-3);
	}
	.seg {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 40px;
	}
	.seg--link {
		color: inherit;
		text-decoration: none;
	}
	.seg--link:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	.sep {
		flex-shrink: 0;
	}
	.naam {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ink-2);
		opacity: 0;
		transition: opacity var(--dur-1) var(--ease);
	}
	.naam--zichtbaar {
		opacity: 1;
	}
	.count,
	.error {
		color: var(--ink-3);
		white-space: nowrap;
	}
	.space {
		flex: 1;
	}
	.weergave {
		position: relative;
	}
	/* On a phone the tabs under the bar (Tekst, Netwerk, Verbonden) are the one control,
	   and the breadcrumb gets the room. */
	@media (max-width: 768px) {
		.weergave {
			display: none;
		}
		/* A bron on a phone: ← and Deel stand beside the tabs (explore/+page), the bar goes. */
		.status-bar--bron {
			display: none;
		}
	}
</style>
