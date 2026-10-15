<script lang="ts">
	import { gewoneKlik } from '$lib/actions/klik';
	import NavKolom from './NavKolom.svelte';
	import { judgmentCite } from '$lib/text/judgment-cite';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	// The table of contents of a judgment in Lezen: samenvatting, partijen, and its
	// headings — the same nav-column slot LezenNav fills for a wet. Shares the judgment
	// request in flight with JudgmentReader (`getJudgmentDetail`'s own cache).
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type { GraphNode } from '$lib/graph/types';
	import { bodyItems, judgmentParticipants, signatureStart } from './readers/judgment-text';

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
				ecliLabel = j.ecli
					? judgmentCite(
							j.ecli,
							typeof j.props?.date === 'string' ? j.props.date : null,
							typeof j.props?.court === 'string' ? j.props.court : null
						).short
					: (j.display_name ?? 'Uitspraak');
				const paragraphs = j.paragraphs ?? [];
				// The same condition under which JudgmentReader renders its table.
				const hasParties = judgmentParticipants(j).length > 0;

				const out: Item[] = [];
				if (j.summary?.trim()) out.push({ id: 'summary', label: 'Samenvatting', kind: 'summary' });
				if (hasParties) out.push({ id: 'parties', label: 'Partijen', kind: 'parties' });
				// The headings as the reader lays the body out, the text left in the kop included.
				for (const item of bodyItems(paragraphs.slice(0, signatureStart(paragraphs))))
					if (item.kind === 'heading') out.push({ id: item.id, label: item.text, kind: 'heading' });
				items = out;
			})
			.catch(() => {
				if (!stale) error = 'De inhoudsopgave kon niet worden geladen.';
			})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => (stale = true);
	});

	// A link to the passage, so that it can be copied and opened elsewhere; a plain click
	// scrolls smoothly and puts the passage in the address without a history entry.
	function jump(e: MouseEvent, id: string) {
		if (!gewoneKlik(e)) return;
		e.preventDefault();
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		replaceState(`#${id}`, page.state);
	}
</script>

{#if ecli}
	<NavKolom label="Inhoud" title={ecliLabel}>
		{#if loading && items.length === 0}
			<p class="nav-kolom__note">Laden…</p>
		{:else if error}
			<p class="nav-kolom__note">{error}</p>
		{:else if items.length > 0}
			<ol class="nav-kolom__lijst">
				{#each items as it, i (i)}
					<li>
						<a class="nav-kolom__rij row--{it.kind}" href="#{it.id}" onclick={(e) => jump(e, it.id)}
							>{it.label}</a
						>
					</li>
				{/each}
			</ol>
		{:else if !loading}
			<p class="nav-kolom__note">Geen indeling.</p>
		{/if}
	</NavKolom>
{/if}

<style>
	.row--summary,
	.row--parties {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}

	.row--heading {
		font-family: var(--font-serif);
		font-weight: 600;
		color: var(--ink);
	}
</style>
