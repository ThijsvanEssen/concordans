<script lang="ts">
	// An article against another (onderzoeksflow O1, `?vergelijk=`): the old text on the left,
	// the new on the right, in the one comparison of two texts (TextCompare). Opened from the
	// line of a recodification, the leden pair as the transposition table places them; opened
	// for two articles the reader chose, nothing pairs them but their likeness ("eigen keuze").
	// The other article is asked as one version with its text: the geldende, or the one text an
	// article of a law of the Staatsblad has before it takes effect.
	import { getArticleDetail, getArticleHistory, getArticleVersion } from '$lib/api/articles';
	import type { Schema } from '$lib/api/types';
	import { articleRef, lawShortName } from '$lib/text/bw';
	import { citationRecord } from '$lib/text/citation-record';
	import { langeDatum } from '$lib/text/datum';
	import { compareTexts, plainDiff, type LidPairing } from '$lib/text/version-diff';
	import { capitalize } from '$lib/text/words';
	import { load } from '$lib/util/load.svelte';
	import TextCompare from './TextCompare.svelte';

	type Part = Schema<'ArticlePartDTO'>;
	/** A version as the history lists it: when its text is from. */
	type Listed = Pick<Schema<'ArticleVersionListedDTO'>, 'valid_from' | 'amended_by'>;

	let {
		current,
		target,
		side,
		basis,
		pairings = [],
		layout = 'een',
		go
	}: {
		/** The article on screen, with its geldende tekst and the version that has it. */
		current: {
			name: string;
			version: Listed | null;
			text?: string | null;
			parts?: Part[] | null;
		};
		/** The other article: its address in the API, and its name where the line gave one. */
		target: { law: string; number: string; name: string | null };
		/** Where the article on screen reads: `old` on the left, `new` on the right. */
		side: 'old' | 'new';
		/** The source that pairs the two (a transposition table); null for the reader's own choice. */
		basis: { url: string | null; id?: string | null } | null;
		pairings?: LidPairing[];
		layout?: 'een' | 'naast';
		go: (params: Record<string, string | null>) => void;
	} = $props();

	/** The other article's text and name, asked once per article. */
	const other = load(
		() => `${target.law}/${target.number}`,
		async () => {
			const { law, number, name } = target;
			const [history, detail] = await Promise.all([
				getArticleHistory(law, number),
				name ? null : getArticleDetail(law, number)
			]);
			const versions = history.versions ?? [];
			const listed = versions.find((v) => v.current) ?? versions.at(-1);
			if (!listed) throw new Error(`Geen tekst van ${law} ${number}`);
			const version = await getArticleVersion(law, number, listed.key);
			const cited = detail
				? citationRecord({
						kind: 'article',
						bwbId: detail.article.bwb_id,
						articleNumber: number,
						shortTitle: lawShortName(detail.article.bwb_id, detail.instrument?.abbreviation),
						citationTitle: detail.instrument?.citation_title ?? detail.instrument?.title ?? ''
					}).short
				: null;
			return { version, name: name ?? cited ?? articleRef(law, number) };
		},
		'Vergelijking'
	);

	/** When a text is from: geldend since a day, or enacted in a publication not yet in force. */
	const sinceOf = (v: Listed) =>
		v.valid_from
			? `tekst sinds ${langeDatum(v.valid_from)}`
			: (citationRecord({
					kind: 'publication',
					series: v.amended_by?.kind,
					year: v.amended_by?.year,
					number: v.amended_by?.number
				})?.short ?? 'vastgestelde tekst');

	const here = $derived({
		label: capitalize(
			current.version ? `${current.name}, ${sinceOf(current.version)}` : current.name
		),
		text: current.text,
		parts: current.parts
	});
	const there = $derived(
		other.state.status === 'ready'
			? {
					label: capitalize(`${other.state.data.name}, ${sinceOf(other.state.data.version)}`),
					text: other.state.data.version.text,
					parts: other.state.data.version.parts
				}
			: null
	);
	const old = $derived(side === 'old' ? here : there);
	const now = $derived(side === 'old' ? there : here);

	const rows = $derived(old && now ? compareTexts(old, now, pairings) : []);
	const waiting = '…';
	const heads = $derived({
		old: { label: old?.label ?? waiting },
		new: { label: now?.label ?? waiting }
	});
	const copyText = $derived(
		`${heads.old.label} vergeleken met ${heads.new.label}.\n[-oud-] [+nieuw+]\n\n${plainDiff(rows)}`
	);
</script>

<section class="ac" aria-label="Oud en nieuw vergelijken">
	<div class="ac__head">
		{#if layout === 'een'}
			<dl class="ac__texts">
				<dt>Oud</dt>
				<dd>{heads.old.label}</dd>
				<dt>Nieuw</dt>
				<dd>{heads.new.label}</dd>
			</dl>
		{/if}
		{#if basis}
			{#if basis.url}
				<a
					class="ac__basis"
					href={basis.url}
					target="_blank"
					rel="noopener noreferrer"
					title={basis.id ?? undefined}>Transponeringstabel ↗</a
				>
			{:else}
				<span class="ac__basis">Transponeringstabel</span>
			{/if}
		{:else}
			<span class="ac__basis">eigen keuze</span>
		{/if}
	</div>
	<TextCompare
		{rows}
		textState={other.state}
		retry={other.retry}
		{layout}
		{heads}
		labels={{ rewritten: 'herschreven', added: 'alleen nieuw', removed: 'alleen oud' }}
		legend={{ ins: 'nieuw', del: 'oud' }}
		absent={{ old: 'Niet in het oude artikel.', new: 'Niet in het nieuwe artikel.' }}
		unchanged="De tekst is in beide artikelen gelijk."
		{copyText}
		source={basis ? { label: basis.id ?? 'Transponeringstabel', url: basis.url } : null}
		{go}
	/>
</section>

<style>
	.ac {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	/* The two texts named once: here in one text, at the head of their columns side by side. */
	.ac__head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2) var(--s-4);
		margin-bottom: var(--s-3);
	}
	.ac__texts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--s-1) var(--s-3);
		margin: 0;
	}
	.ac__texts dt {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.ac__texts dd {
		margin: 0;
		color: var(--ink);
	}
	.ac__basis {
		margin-left: auto;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	a.ac__basis:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>
