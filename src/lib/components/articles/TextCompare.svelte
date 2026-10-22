<script lang="ts">
	// The one comparison of two texts: the old on the left, the new on the right, lid by lid
	// (onderzoeksflow O1). Two tekstversies of one article (VersionCompare) and an article
	// against the one that takes its place in a new law (ArticleCompare) read alike: the leden
	// in one text with the words struck and inserted, or the two side by side; the leden that
	// stayed the same folded; a lid the source pairs marked with that source.
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import LoadStateView from '$lib/components/ui/LoadState.svelte';
	import type { LoadState } from '$lib/util/load.svelte';
	import type { CompareRow } from '$lib/text/version-diff';
	import Badge from './Badge.svelte';
	import Marked from './Marked.svelte';

	/** The head of one text: its name, with A or B where the two are tekstversies. */
	type Head = { label: string; badge?: 'A' | 'B' };

	let {
		rows,
		textState,
		retry,
		layout = 'een',
		heads,
		labels,
		legend,
		absent,
		unchanged: unchangedText,
		copyText,
		lidHref,
		source = null,
		go
	}: {
		rows: CompareRow[];
		/** The texts on their way, or failed: the leden wait for both. */
		textState: LoadState<unknown>;
		retry?: () => void;
		/** `?weergave`: the leden in one text, or the two side by side. */
		layout?: 'een' | 'naast';
		heads: { old: Head; new: Head };
		/** What happened to a lid, in the margin. */
		labels: { rewritten: string; added: string; removed: string };
		/** The marks, named. */
		legend: { ins: string; del: string };
		/** Side by side, where one text has no such lid. */
		absent: { old: string; new: string };
		/** Both texts the same. */
		unchanged: string;
		/** The comparison as plain text, for Kopieer. */
		copyText: string;
		/** A lid's own history, where there is one. */
		lidHref?: (lid: string) => string;
		/** The source that pairs leden (a transposition table), one step further. */
		source?: { label: string; url: string | null } | null;
		go: (params: Record<string, string | null>) => void;
	} = $props();

	let showSame = $state(false);

	// The same wording in both: the text itself, not one fold that hides it.
	const unchanged = $derived(rows.length > 0 && rows.every((r) => r.kind === 'same'));

	type Block = { kind: 'row'; row: CompareRow } | { kind: 'same'; rows: CompareRow[] };
	const blocks = $derived.by(() => {
		const out: Block[] = [];
		for (const row of rows) {
			const prev = out.at(-1);
			if (row.kind === 'same' && !showSame && !unchanged) {
				if (prev?.kind === 'same') prev.rows.push(row);
				else out.push({ kind: 'same', rows: [row] });
			} else out.push({ kind: 'row', row });
		}
		return out;
	});
	const sameCount = $derived(rows.filter((r) => r.kind === 'same').length);

	/** An article without leden has no numbers to keep a column for. */
	const whole = $derived(rows.every((r) => !r.old?.number && !r.new?.number));

	const numberOf = (row: CompareRow) => row.new?.number ?? row.old?.number ?? '';
	const renumbered = (row: CompareRow) =>
		row.old && row.new && row.old.number !== row.new.number ? row.old.number : null;

	function foldedLabel(folded: CompareRow[]) {
		const numbers = folded.map(numberOf).filter(Boolean);
		if (numbers.length === 0) return 'Tekst ongewijzigd';
		if (numbers.length === 1) return `Lid ${numbers[0]} ongewijzigd`;
		return `Leden ${numbers[0]}–${numbers.at(-1)} ongewijzigd`;
	}

	const label = (row: CompareRow) =>
		row.kind === 'same' || row.kind === 'changed' ? '' : labels[row.kind];

	const copier = createCopier();
</script>

{#snippet head(h: Head)}
	{#if h.badge}<Badge which={h.badge} />{/if}{h.label}
{/snippet}

{#snippet bySource(row: CompareRow)}
	{#if row.bySource && source}
		{#if source.url}<a
				class="row__source"
				href={source.url}
				target="_blank"
				rel="noopener noreferrer"
				title={source.label}>volgens de transponeringstabel</a
			>{:else}<span class="row__source">volgens de transponeringstabel</span>{/if}
	{/if}
{/snippet}

<div class="tc">
	<!-- ── How it is shown ── -->
	<div class="tools">
		<span class="tools__keys" aria-label="Legenda">
			<span class="text"><Marked plain segments={[{ op: 'ins', text: legend.ins }]} /></span>
			<span class="text"><Marked plain segments={[{ op: 'del', text: legend.del }]} /></span>
		</span>
		<span class="tools__acts">
			<Keuze
				label="Weergave"
				opties={[
					{ waarde: 'een', label: 'In één tekst' },
					{ waarde: 'naast', label: 'Naast elkaar' }
				]}
				waarde={layout}
				onSelect={(w) => go({ weergave: w === 'naast' ? 'naast' : null })}
			/>
			{#if sameCount > 0}
				<button type="button" class="btn is-text" onclick={() => (showSame = !showSame)}
					>{showSame ? 'Alleen wijzigingen' : 'Alle leden'}</button
				>
			{/if}
			<button type="button" class="btn is-text" onclick={() => copier.copy(copyText, 'diff')}
				>{copier.label('diff', 'Kopieer')}</button
			>
		</span>
	</div>

	<!-- ── The leden ── -->
	<div class="compare compare--{layout}" class:is-whole={whole}>
		{#if layout === 'naast'}
			<div class="row row--head" aria-hidden="true">
				<span></span>
				<span class="side-head">{@render head(heads.old)}</span>
				<span class="side-head">{@render head(heads.new)}</span>
			</div>
		{/if}
		{#if textState.status !== 'ready'}
			<LoadStateView state={textState} what="De tekst" form="block" {retry} />
		{:else if unchanged}
			<p class="unchanged">{unchangedText}</p>
		{/if}
		{#each blocks as block, i (i)}
			{#if block.kind === 'same'}
				<button type="button" class="fold" onclick={() => (showSame = true)}
					>{foldedLabel(block.rows)}</button
				>
			{:else}
				{@const row = block.row}
				{@const was = renumbered(row)}
				{@const n = numberOf(row)}
				<!-- Leden taken together name their numbers beside the text, not in the gutter. -->
				{@const longWas = !!was && /\s/.test(was)}
				{@const marked =
					row.kind === 'changed' || (row.kind === 'rewritten' && row.segments.length > 0)}
				<div class="row row--{row.kind}" class:row--marked={marked}>
					<span class="row__no">
						{#if n && lidHref}
							<a href={lidHref(n)} data-sveltekit-noscroll title="Geschiedenis van lid {n}">{n}</a>
						{:else}{n}{/if}
						{#if was && !longWas}<span class="row__was">was {was}</span>{/if}
					</span>
					{#if layout === 'een'}
						<div class="row__body">
							{#if row.kind === 'same'}
								<p class="text">{row.new?.text}</p>
							{:else if marked}
								<p class="text"><Marked segments={row.segments} /></p>
							{:else if row.kind === 'rewritten'}
								<div class="pair">
									<div class="pair__old">
										<span class="pair__when">{@render head(heads.old)}</span>
										<p class="text">{row.old?.text}</p>
									</div>
									<div class="pair__new">
										<span class="pair__when">{@render head(heads.new)}</span>
										<p class="text">{row.new?.text}</p>
									</div>
								</div>
							{:else if row.kind === 'added'}
								<p class="text text--added">{row.new?.text}</p>
							{:else}
								<p class="text text--removed">{row.old?.text}</p>
							{/if}
						</div>
						<!-- The margin, as in the article text: what happened to the lid. -->
						<span class="row__aside"
							>{#if longWas}<span>was leden {was}</span>{/if}{#if label(row)}<span
									>{label(row)}</span
								>{/if}{@render bySource(row)}</span
						>
					{:else}
						<div class="row__side">
							{#if longWas}<span class="row__label">was leden {was}</span>{/if}
							{#if row.kind === 'rewritten' || row.kind === 'removed'}<span class="row__label"
									>{label(row)}</span
								>{/if}
							{#if row.old}
								<p class="text" class:text--removed={row.kind === 'removed'}>
									{#if marked}<Marked segments={row.segments} side="old" />{:else}{row.old
											.text}{/if}
								</p>
							{:else}
								<p class="text text--none">{absent.old}</p>
							{/if}
						</div>
						<div class="row__side">
							{#if row.kind === 'rewritten' || row.kind === 'added'}<span class="row__label"
									>{label(row)}</span
								>{/if}
							{@render bySource(row)}
							{#if row.new}
								<p class="text" class:text--added={row.kind === 'added'}>
									{#if marked}<Marked segments={row.segments} side="new" />{:else}{row.new
											.text}{/if}
								</p>
							{:else}
								<p class="text text--none">{absent.new}</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	/* Beside the network the reader is narrow, whatever the screen: the layout follows the
	   comparison's own width. */
	.tc {
		container: tc / inline-size;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2);
		margin-bottom: var(--s-4);
		padding-bottom: var(--s-3);
		border-bottom: 1px solid var(--rule);
	}
	.tools__keys {
		display: flex;
		gap: var(--s-3);
		font-size: var(--t-micro);
	}
	.tools__acts {
		display: flex;
		align-items: center;
		gap: var(--s-1);
	}

	/* ── The leden, as in the article text: the number in the gutter ── */
	.compare {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	/* The columns of the article text (ArticleText): the number, the text, a margin of
	   150px. The text keeps its width when the comparison opens. */
	.row {
		display: grid;
		grid-template-columns: 36px 1fr 150px;
		gap: 0 var(--s-3);
		padding: var(--s-2) var(--s-3) var(--s-2) 0;
	}
	.compare--naast .row {
		grid-template-columns: 36px 1fr 1fr;
		gap: 0 var(--s-5);
	}
	.row--head {
		padding: 0 0 var(--s-1);
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.row__no {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-top: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
		line-height: 1.3;
	}
	.row__no a {
		color: var(--ink-2);
	}
	.row__no a:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	/* Level with the old wording, under its head. */
	.compare--een .row--rewritten:not(.row--marked) .row__no,
	.compare--een .row--rewritten:not(.row--marked) .row__aside {
		padding-top: var(--s-5);
	}
	.row__aside {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--s-1);
		padding-top: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: right;
	}
	.row__source {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	a.row__source:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.row__side .row__source {
		display: block;
	}
	.row__was {
		font-weight: 400;
		white-space: nowrap;
	}
	.row__body,
	.row__side {
		min-width: 0;
	}
	.row__label {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-label);
		font-weight: 600;
		color: var(--ink-3);
	}
	.row--same .text {
		color: var(--ink-2);
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.text--added {
		padding-left: var(--s-3);
		border-left: 3px solid var(--mark-ins-rule);
	}
	.text--removed {
		padding-left: var(--s-3);
		border-left: 3px solid var(--rule-strong);
		color: var(--ink-3);
		text-decoration: line-through;
		text-decoration-color: var(--rule-strong);
	}
	.text--none {
		padding-top: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-style: italic;
		color: var(--ink-3);
	}
	.pair {
		display: grid;
		gap: var(--s-2);
	}
	.pair__old .text {
		color: var(--ink-3);
	}
	.pair__old,
	.pair__new {
		padding-left: var(--s-3);
		border-left: 3px solid var(--rule);
	}
	.pair__new {
		border-left-color: var(--mark-ins-rule);
	}
	/* The head at the top of its column, as on the line through time. */
	.side-head {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		color: var(--ink-2);
	}
	.pair__when {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin-bottom: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.fold {
		display: block;
		width: calc(100% - 48px);
		margin: var(--s-1) 0 var(--s-1) var(--s-7);
		padding: var(--s-1) 0;
		border: 0;
		border-top: 1px dashed var(--rule);
		border-bottom: 1px dashed var(--rule);
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: left;
		cursor: pointer;
	}
	.compare--een:not(.is-whole) .fold {
		width: calc(100% - 48px - 172px);
	}
	.fold:hover {
		color: var(--ink);
	}

	.compare.is-whole .row {
		grid-template-columns: 1fr 150px;
	}
	.compare--naast.is-whole .row {
		grid-template-columns: 1fr 1fr;
	}
	.compare.is-whole .row__no,
	.compare.is-whole .row--head > span:first-child {
		display: none;
	}
	.compare.is-whole .fold {
		width: 100%;
		margin-left: 0;
	}
	.unchanged {
		margin: 0 0 var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}

	/* As the article text on a narrow screen: the margin goes under the text. */
	@media (max-width: 900px) {
		.compare--een .row {
			grid-template-columns: 28px 1fr;
		}
		.compare--een.is-whole .row {
			grid-template-columns: 1fr;
		}
		.row__aside {
			grid-column: -2;
			flex-direction: row;
			flex-wrap: wrap;
			gap: 0 var(--s-2);
			padding-top: 2px !important;
			text-align: left;
		}
		.compare--naast .row {
			grid-template-columns: 28px 1fr 1fr;
			gap: 0 var(--s-3);
		}
	}
	@container tc (max-width: 560px) {
		.compare--naast .row {
			grid-template-columns: 28px 1fr 1fr;
			gap: 0 var(--s-3);
		}
	}
</style>
