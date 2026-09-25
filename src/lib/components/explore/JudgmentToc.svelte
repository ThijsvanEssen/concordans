<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	// The table of contents of a judgment in Lezen: samenvatting, partijen, and its
	// headings — the same nav-column slot LezenNav fills for a wet. Shares the judgment
	// request in flight with JudgmentReader (`getJudgmentDetail`'s own cache).
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type { GraphNode } from '$lib/graph/types';
	import { formatEcliLabel } from '$lib/graph/types';
	import {
		headingId,
		judgmentParticipants,
		normalizeParagraphText,
		splitBodyParagraph
	} from './readers/judgment-text';

	let { selection }: { selection: GraphNode | null } = $props();

	type Item = { id: string; label: string; kind: 'summary' | 'parties' | 'heading' };

	let ecliLabel = $state<string | null>(null);
	let items = $state<Item[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const ecli = $derived(
		selection?.collection === 'judgments'
			? String(selection.raw?.props?.ecli ?? selection.key)
			: null
	);

	$effect(() => {
		const e = ecli;
		if (!e) return;
		let stale = false;
		loading = true;
		error = null;
		getJudgmentDetail(e)
			.then((data) => {
				if (stale) return;
				const j = data.judgment;
				ecliLabel = j.ecli ? formatEcliLabel(j.ecli) : (j.display_name ?? 'Uitspraak');
				const paragraphs = j.paragraphs ?? [];
				// The same condition under which JudgmentReader renders its table.
				const hasParties = judgmentParticipants(j).length > 0;

				const out: Item[] = [];
				if (j.summary?.trim()) out.push({ id: 'summary', label: 'Samenvatting', kind: 'summary' });
				if (hasParties) out.push({ id: 'parties', label: 'Partijen', kind: 'parties' });
				for (const para of paragraphs) {
					if (para.kind === 'heading') {
						const clean = normalizeParagraphText(para.text);
						out.push({ id: headingId(clean), label: clean, kind: 'heading' });
						continue;
					}
					if (para.kind !== 'subheading') {
						for (const seg of splitBodyParagraph(para.text)) {
							if (seg.kind === 'heading')
								out.push({ id: headingId(seg.text), label: seg.text, kind: 'heading' });
						}
					}
				}
				items = out;
			})
			.catch(() => {
				if (!stale) error = 'Overzicht niet geladen.';
			})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => (stale = true);
	});

	// A link to the passage, so that it can be copied and opened elsewhere; a plain click
	// scrolls smoothly and puts the passage in the address without a history entry.
	function jump(e: MouseEvent, id: string) {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		replaceState(`#${id}`, page.state);
	}
</script>

{#if ecli}
	<aside class="judgment-toc" aria-label="Inhoud">
		<header class="head">
			<h3 class="head__title">{ecliLabel}</h3>
		</header>

		{#if loading && items.length === 0}
			<p class="note">Laden…</p>
		{:else if error}
			<p class="note">{error}</p>
		{:else if items.length > 0}
			<ol class="list">
				{#each items as it, i (i)}
					<li>
						<a class="row row--{it.kind}" href="#{it.id}" onclick={(e) => jump(e, it.id)}
							>{it.label}</a
						>
					</li>
				{/each}
			</ol>
		{:else if !loading}
			<p class="note">Geen indeling.</p>
		{/if}
	</aside>
{/if}

<style>
	.judgment-toc {
		height: 100%;
		overflow-y: auto;
		padding-top: 22px;
		background: var(--paper-2);
		font-family: var(--font-sans);
		font-size: 12.5px;
	}

	.note {
		margin: 0;
		padding: var(--s-4) 18px;
		color: var(--ink-3);
	}

	.head {
		padding: 0 18px 12px;
	}

	.head__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 500;
		line-height: 1.2;
		color: var(--ink);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0 0 var(--s-5);
	}

	.row {
		display: block;
		width: 100%;
		padding: 4px 18px;
		border: 0;
		background: none;
		text-align: left;
		color: var(--ink-2);
		line-height: 1.3;
		cursor: pointer;
		text-decoration: none;
	}

	.row:hover {
		background: var(--paper);
		color: var(--ink);
	}

	.row--summary,
	.row--parties {
		font-family: var(--font-sans);
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.row--heading {
		font-family: var(--font-serif);
		font-weight: 500;
		color: var(--ink);
	}
</style>
