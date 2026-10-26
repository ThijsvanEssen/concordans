<script lang="ts">
	import { NOT_IN_DATA } from '$lib/text/coverage';
	import { capitalize } from '$lib/text/words';
	import { hasModifier, isTyping } from '$lib/actions/keys';
	import { lidAnchor, lidNumber } from '$lib/text/anchor';
	import { DAY_MS, korteDatum, langeDatum, untilDate } from '$lib/text/datum';
	import { uniqueBy } from '$lib/util/unique';
	import DossierLink from '$lib/bron/DossierLink.svelte';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	// Two tekstversies of an article compared, for research into how its text came to be.
	// A tekstversie is a wording: the BWB versions that only moved the text are folded
	// into the one that introduced it. From the top: the choice of two tekstversies, a
	// line through time with a mark at every change of wording, the publication that made
	// the change, and the leden of both with the words an amendment inserted or struck.
	// A lid rewritten for the most part shows the old wording and the new in full. At the
	// bottom, folded, every BWB version. `?versies=lid-4` shows one lid through all its
	// formulations instead.
	import type { Schema } from '$lib/api/types';
	import type { Citation } from '$lib/text/cite';
	import { citationRecord } from '$lib/text/citation-record';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import IconButtonPaar from '$lib/components/ui/IconButtonPaar.svelte';
	import Badge from './Badge.svelte';
	import Marked from './Marked.svelte';
	import TextCompare from './TextCompare.svelte';
	import { slide } from 'svelte/transition';
	import {
		byYear,
		changedLeden,
		compareUnits,
		compareTexts,
		lidHistory,
		plainDiff,
		sortLeden,
		unitsOf,
		wordingOf,
		wordingsOf,
		type Formulation as LidFormulation,
		type Unit,
		type Wording
	} from '$lib/text/version-diff';
	import { SvelteMap } from 'svelte/reactivity';
	import { getArticleVersion } from '$lib/api/articles';
	import { inView } from '$lib/actions/in-view';
	import { isAborted } from '$lib/api/errors';
	import type { LoadState } from '$lib/util/load.svelte';
	import LoadStateView from '$lib/components/ui/LoadState.svelte';

	/** A version as the history lists it, without its text. */
	type Version = Schema<'ArticleVersionListedDTO'>;
	/** One version with its text, asked when it is read. */
	type FullVersion = Schema<'ArticleVersionDTO'>;
	type Params = Record<string, string | null>;
	type VersionWording = Wording<Version>;

	let {
		versions,
		bwbId,
		articleNumber,
		param,
		layout = 'een',
		citation = null,
		link,
		go
	}: {
		/** Oldest first, as the API delivers them. */
		versions: Version[];
		/** The article, to ask the text of a version by its key. */
		bwbId: string;
		articleNumber: string;
		/** `?versies`: `van..tot` (the dates tekstversies took effect), `lid-4`, or empty. */
		param: string;
		/** `?weergave`: the leden in one text, or the two versions side by side. */
		layout?: 'een' | 'naast';
		/** What is needed to cite the article; without it the copy has no heading. */
		citation?: Omit<Citation, 'lid' | 'onderdelen' | 'aanhef' | 'date'> | null;
		/** The address with these params changed. */
		link: (params: Params) => string;
		/** Go there, replacing the entry: a choice in a list is not a step back. */
		go: (params: Params) => void;
	} = $props();

	const wordings = $derived(wordingsOf(versions));
	const last = $derived(wordings.length - 1);
	const idOf = (w: Wording<Version>) => w.from ?? w.first.key;
	const pairParam = (a: Wording<Version>, b: Wording<Version>) => `${idOf(a)}..${idOf(b)}`;

	// ── What the URL asks for ────────────────────────────────────────────────────

	const lidParam = $derived(lidNumber(param));
	const pair = $derived.by(() => {
		const [a, b] = param.split('..');
		const from = a ? wordingOf(wordings, a) : null;
		const to = b ? wordingOf(wordings, b) : null;
		// A and B in either order: B before A reads the history backwards.
		if (from && to && from.index !== to.index) return { from, to };
		// The last change of wording, against the one before it.
		return { from: wordings[Math.max(0, last - 1)], to: wordings[last] };
	});
	const from = $derived(pair.from);
	const to = $derived(pair.to);
	/** B is older than A: what an amendment inserted shows as struck, and the other way round. */
	const reversed = $derived(to.index < from.index);
	const older = $derived(reversed ? to : from);
	const newer = $derived(reversed ? from : to);
	/** The two texts are one change apart, whichever way round they are held. */
	const adjacent = $derived(newer.index === older.index + 1);

	const showPair = (a: number, b: number) => go({ versies: pairParam(wordings[a], wordings[b]) });
	const showChange = (k: number) => showPair(k - 1, k);

	const prevChange = $derived(
		adjacent && !reversed ? (older.index > 0 ? older.index : null) : newer.index
	);
	const nextChange = $derived(newer.index < last ? newer.index + 1 : null);

	// ← and → step through the changes, unless a field has the keys.
	function onKey(e: KeyboardEvent) {
		if (lidParam || hasModifier(e) || isTyping(e.target)) return;
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		// The keys are the comparison's while it is open, also at its first or last change:
		// the network beside it would otherwise go back to the previous bron.
		e.preventDefault();
		e.stopImmediatePropagation();
		if (e.key === 'ArrowLeft' && prevChange !== null) showChange(prevChange);
		else if (e.key === 'ArrowRight' && nextChange !== null) showChange(nextChange);
	}

	// Registered in the capture phase, so it runs before the network's own listener.
	$effect(() => {
		window.addEventListener('keydown', onKey, { capture: true });
		return () => window.removeEventListener('keydown', onKey, { capture: true });
	});

	// ── The texts, asked as they are read ────────────────────────────────────────
	// The history lists the versions without text: the two compared, and a formulation of a
	// lid as it comes into view, are asked by their key, each once.

	const texts = new SvelteMap<string, LoadState<FullVersion>>();
	function ask(key: string, again = false) {
		if (texts.has(key) && !again) return;
		texts.set(key, { status: 'loading' });
		getArticleVersion(bwbId, articleNumber, key).then(
			(data) => texts.set(key, { status: 'ready', data }),
			(error) => {
				if (!isAborted(error)) texts.set(key, { status: 'error', error });
			}
		);
	}
	const textOf = (key: string): LoadState<FullVersion> => texts.get(key) ?? { status: 'loading' };
	/** Ask again the texts of `keys` that failed. */
	const retry = (keys: string[]) => () => {
		for (const k of keys) if (textOf(k).status === 'error') ask(k, true);
	};
	/** Loading until every text of `keys` is in; a failure if one failed. */
	const allOf = (keys: string[]): LoadState<FullVersion[]> => {
		const states = keys.map(textOf);
		const failed = states.find((s) => s.status === 'error');
		if (failed) return failed;
		const ready = states.flatMap((s) => (s.status === 'ready' ? [s.data] : []));
		return ready.length === keys.length ? { status: 'ready', data: ready } : { status: 'loading' };
	};
	const unitsAt = (key: string): Unit[] | null => {
		const t = texts.get(key);
		return t?.status === 'ready' ? unitsOf(t.data.text, t.data.parts) : null;
	};

	// ── Wording ──────────────────────────────────────────────────────────────────

	const date = (iso: string | null | undefined) => langeDatum(iso) || NOT_IN_DATA;
	const year = (iso: string | null | undefined) => (iso ? iso.slice(0, 4) : '');

	const period = (w: { from: string | null; until: string | null }) =>
		w.until ? `${date(w.from)} tot ${date(w.until)}` : `sinds ${date(w.from)}`;

	const publication = (p: Schema<'PublicationDTO'> | null | undefined) =>
		citationRecord({ kind: 'publication', series: p?.kind, year: p?.year, number: p?.number })
			?.short ?? null;

	const signedAndPublished = (p: Schema<'PublicationDTO'> | null | undefined) =>
		[
			p?.signed ? `vastgesteld ${langeDatum(p.signed)}` : null,
			p?.published ? `uitgegeven ${langeDatum(p.published)}` : null
		]
			.filter(Boolean)
			.join(', ') || undefined;

	/** The BWB's effect, `tekstplaatsing-vernummering`, for its title. */
	const effectOf = (v: Version) => (v.effect ?? '').replaceAll('-', ', ') || null;

	/** Short enough for a list beside another one on a phone: "6 apr. 2006". */
	const optionLabel = (w: VersionWording) => (w.from ? korteDatum(w.from) : w.first.key);

	// ── The line through time ────────────────────────────────────────────────────

	const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
	const today = Date.now();
	/** A period's share of the line: its years, so a long-lived text takes more room. */
	const years = (w: VersionWording) =>
		Math.max(0.1, ((w.until ? time(w.until) : today) - time(w.from)) / (365.25 * DAY_MS));

	/** The changes between A and B, oldest first, whichever way round they are held. */
	const between = $derived(wordings.slice(older.index + 1, newer.index + 1));

	// A line wider than its track (a phone, or beside the network) opens on A and B, not on
	// the oldest text: the track scrolls itself, never the page, to centre A to B.
	let lineEl = $state<HTMLOListElement | null>(null);
	/** Every BWB version stands under the comparison (AlleN, "Minder"). */
	let bwbOpen = $state(false);
	$effect(() => {
		const track = lineEl;
		const marks = [older.index, newer.index];
		if (!track || track.scrollWidth <= track.clientWidth) return;
		const periods = [...track.children] as HTMLElement[];
		const [a, b] = marks.map((i) => periods[i]);
		if (!a || !b) return;
		const left = track.getBoundingClientRect().left - track.scrollLeft;
		const start = a.getBoundingClientRect().left - left;
		const end = b.getBoundingClientRect().right - left;
		track.scrollLeft = Math.max(0, (start + end - track.clientWidth) / 2);
	});

	// ── The leden ────────────────────────────────────────────────────────────────

	$effect(() => {
		ask(from.first.key);
		ask(to.first.key);
	});
	const pairKeys = $derived([from.first.key, to.first.key]);
	/** A and B with their text: loading until both are in, a failure if either fails. */
	const pairState = $derived(allOf(pairKeys));
	const rows = $derived(
		pairState.status === 'ready' ? compareTexts(pairState.data[0], pairState.data[1]) : []
	);

	// Read backwards, "ingevoegd" would claim an amendment that never was: B has it, A not.
	const LABEL = $derived({
		rewritten: 'herschreven',
		added: reversed ? 'alleen in B' : 'ingevoegd',
		removed: reversed ? 'alleen in A' : 'vervallen'
	});

	// ── One lid through time ─────────────────────────────────────────────────────

	const history = $derived(lidParam ? lidHistory(wordings, lidParam) : null);
	/** The leden the history names a change of, and those of A and B. */
	const allLeden = $derived(
		sortLeden([
			...changedLeden(wordings),
			...[from, to].flatMap((w) =>
				(unitsAt(w.first.key) ?? []).flatMap((u) => (u.number ? [u.number] : []))
			)
		])
	);

	/** The text of a formulation, and of the one before it where the words are marked. */
	const formulationKeys = (f: Formulation, before: Formulation | undefined) => [
		f.since.first.key,
		...(before && f.kind === 'changed' ? [before.since.first.key] : [])
	];
	/** Asked as it comes into view. */
	const askFormulation = (f: Formulation, before: Formulation | undefined) => () => {
		for (const k of formulationKeys(f, before)) ask(k);
	};
	/** The lid in a formulation's text; null while it is on its way, or not in it. */
	const lidIn = (f: Formulation) =>
		unitsAt(f.since.first.key)?.find((u) => u.number === lidParam) ?? null;
	/** A formulation against the one before it: the words marked, or the text in full. */
	const formulationRow = (f: Formulation, before: Formulation | undefined) =>
		f.kind === 'changed' && before ? compareUnits(lidIn(before), lidIn(f)) : null;

	// ── Copying ──────────────────────────────────────────────────────────────────

	const copier = createCopier();
	const copy = (text: string, what: string) =>
		copier.copy(text, what, 'citeerwijze met geldigheid');

	const cite = (lid: string | null) =>
		citation
			? citationRecord({ ...citation, kind: 'article', lid }).short
			: lid
				? `lid ${lid}`
				: 'artikel';

	const comparisonText = $derived(
		`${capitalize(cite(null))}, tekst sinds ${date(from.from)} vergeleken met tekst sinds ${date(to.from)}.\n` +
			`[-geschrapt-] [+ingevoegd+]\n\n${plainDiff(rows)}`
	);

	type Formulation = LidFormulation<Version>;
	const formulationPeriod = (f: Formulation) =>
		period({ from: f.since.from, until: f.through.until });
	const formulationCite = (lid: string, f: Formulation) =>
		`${cite(lid)} (tekst geldig ${f.through.until ? 'van ' : ''}${formulationPeriod(f)})`;
</script>

<!-- Where a version came from: the publication that made it, the one that brought it into
     force where that is another, its dossiers; a comma between them. -->
{#snippet herkomst(v: Version)}
	{@const pub = publication(v.amended_by)}
	{@const inForce = publication(v.commencement)}
	<span class="herkomst"
		>{#if pub}<span title={signedAndPublished(v.amended_by)}>{pub}</span
			>{/if}{#if inForce && inForce !== pub}<span title={signedAndPublished(v.commencement)}
				>in werking bij {inForce}</span
			>{/if}{#each uniqueBy(v.amended_by?.dossiers ?? [], (d) => d.key) as dossier (dossier.key)}<span
				><DossierLink {dossier} /></span
			>{/each}</span
	>
{/snippet}

{#snippet made(w: VersionWording, verb: string)}
	<span class="origin__what">{verb} {date(w.from)}</span>
	{@render herkomst(w.first)}
{/snippet}

{#snippet chooser(which: 'A' | 'B', w: VersionWording, other: number, pick: (i: number) => void)}
	<!-- Which text it is, as a text menu (docs/bediening.md): the badge and its dates, the
	     versions under it per year; the one the other side shows cannot be chosen. -->
	<TekstMenu label="Tekstversie {which}" tekst="Tekst sinds {date(w.from)}">
		{#snippet knop()}<Badge {which} /><span class="ab__text"
				>Tekst sinds {optionLabel(w)}, {w.until ? `${untilDate(w.until)}` : 'geldend recht'}</span
			>{/snippet}
		{#snippet inhoud(sluit)}
			<div class="ab__lijst">
				{#each byYear(wordings) as [year, group] (year)}
					<span class="ab__jaar" aria-hidden="true">{year}</span>
					{#each group as option (option.index)}
						<button
							type="button"
							role="menuitemradio"
							class="tekstmenu__item ab__menuitem"
							aria-checked={option.index === w.index}
							disabled={option.index === other}
							onclick={() => {
								sluit();
								if (option.index !== w.index) pick(option.index);
							}}>Tekst sinds {optionLabel(option)}{option.until ? '' : ', geldend'}</button
						>
					{/each}
				{/each}
			</div>
		{/snippet}
	</TekstMenu>
{/snippet}

<section class="vc" aria-label="Versies vergelijken">
	{#if lidParam}
		<!-- ── One lid through all its formulations ── -->
		<div class="bar">
			<a class="bar__back" href={link({ versies: pairParam(from, to) })} data-sveltekit-noscroll
				>← Vergelijking van tekstversies</a
			>
			<nav class="leden" aria-label="Leden">
				{#each allLeden as n (n)}
					<a
						href={link({ versies: lidAnchor(n) })}
						data-sveltekit-noscroll
						aria-current={n === lidParam ? 'page' : undefined}>{n}</a
					>
				{/each}
			</nav>
		</div>
		<h2 class="heading">Geschiedenis van lid {lidParam}</h2>
		{#if !history}
			<p class="empty">Lid {lidParam} komt in geen van de tekstversies voor.</p>
		{:else}
			<ol class="formulations">
				{#each history.formulations as f, i (i)}
					{@const before = history.formulations[i - 1]}
					{@const keys = formulationKeys(f, before)}
					{@const state = allOf(keys)}
					{@const row = state.status === 'ready' ? formulationRow(f, before) : null}
					{@const unit = state.status === 'ready' ? lidIn(f) : null}
					<li class="formulation" use:inView={askFormulation(f, before)}>
						<div class="formulation__head">
							<span class="formulation__when">{capitalize(formulationPeriod(f))}</span>
							{#if f.kind === 'first' && f.since.index === 0}
								<span>Oudste tekst in de gegevens</span>
							{:else}
								{@render made(f.since, f.kind === 'added' ? 'Ingevoegd per' : 'Gewijzigd per')}
							{/if}
							<button
								type="button"
								class="formulation__cite"
								onclick={() => copy(formulationCite(lidParam, f), `f${i}`)}
								>{copier.label(`f${i}`, 'Kopieer citaat')}</button
							>
						</div>
						{#if state.status !== 'ready'}
							<LoadStateView {state} what="De tekst" retry={retry(keys)} />
						{:else if !unit}
							<p class="text text--none">Niet in deze tekst.</p>
						{:else}
							{#if row?.kind === 'rewritten'}<span class="row__label">herschreven</span>{/if}
							<p class="text" class:text--added={f.kind === 'added'}>
								{#if row && row.segments.length > 0}<Marked
										segments={row.segments}
									/>{:else}{unit.text}{/if}
							</p>
						{/if}
					</li>
				{/each}
				{#if history.removedIn}
					<li class="formulations__end">Vervallen per {date(history.removedIn.from)}.</li>
				{/if}
			</ol>
		{/if}
	{:else}
		<!-- ── The choice folds out under the head of the article, in a panel of its own;
		     the text below keeps its place and only gains the marks. ── -->
		<div class="drawer" in:slide={{ duration: 180 }}>
			<!-- ── The choice: the line through time, a period per tekstversie
		     with A and B marked on it, and under it A and B as lists. A period shows the
		     change that began it; ‹ › and the arrow keys step through the changes. -->
			<div class="ab">
				{@render chooser('A', from, to.index, (i) => showPair(i, to.index))}
				<IconButton label="A en B omdraaien" onclick={() => showPair(to.index, from.index)}
					><svg class="ab__ruil" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
						><path d="M2 5.5h11M10 2.5l3 3-3 3M14 10.5H3M6 7.5l-3 3 3 3" /></svg
					></IconButton
				>
				{@render chooser('B', to, from.index, (i) => showPair(from.index, i))}
			</div>

			<div class="pick">
				<ol class="line" aria-label="Tekstversies" data-zijscroll bind:this={lineEl}>
					{#each wordings as w (w.index)}
						{@const isA = w.index === from.index}
						{@const isB = w.index === to.index}
						<li
							class="line__period"
							class:is-a={isA}
							class:is-b={isB}
							class:is-in={w.index > older.index && w.index < newer.index}
							style:flex-grow={years(w)}
						>
							<button
								type="button"
								class="line__label"
								class:is-active={adjacent && w.index === newer.index}
								disabled={w.index === 0}
								title="{capitalize(period(w))}: {w.index === 0
									? 'oudste tekst in de gegevens'
									: w.summary}"
								onclick={() => showChange(w.index)}
								><span class="line__year">{year(w.from)}</span><span class="line__what"
									>{w.index === 0 ? 'oudste tekst' : w.summary}</span
								></button
							>
							<span class="line__bar" aria-hidden="true"
								>{#if isA}<Badge which="A" />{/if}{#if isB}<Badge which="B" />{/if}</span
							>
						</li>
					{/each}
				</ol>
				<span class="pick__steps">
					<IconButtonPaar
						name="Wijzigingen"
						value={adjacent ? `${newer.index} van ${last}` : undefined}
						first={{
							label: 'Vorige wijziging (←)',
							onclick: () => prevChange !== null && showChange(prevChange),
							disabled: prevChange === null,
							sign: '‹'
						}}
						second={{
							label: 'Volgende wijziging (→)',
							onclick: () => nextChange !== null && showChange(nextChange),
							disabled: nextChange === null,
							sign: '›'
						}}
					/>
				</span>
			</div>

			<!-- ── The history between A and B: the shared timeline, oldest first, the publication
			     that made each change under it; the day shows only that change. ── -->
			{#snippet bron(id: string)}
				{@render herkomst(wordings[Number(id)].first)}
			{/snippet}
			<Tijdlijn
				volgorde="oplopend"
				groepen={[
					{
						id: 'wijzigingen',
						titel: reversed ? 'Wijzigingen tussen B en A' : 'Wijzigingen tussen A en B',
						sub: String(between.length),
						regels: between.map((w) => ({
							id: String(w.index),
							datum: w.from,
							teken: 'stuk' as const,
							vorm: 'regel' as const,
							zin: capitalize(w.summary),
							onder: bron,
							datumKnop: adjacent
								? null
								: { titel: 'Alleen deze wijziging tonen', actie: () => showChange(w.index) }
						}))
					}
				]}
			/>
		</div>

		<!-- ── The leden: the one comparison, A on the left and B on the right ── -->
		<TextCompare
			{rows}
			textState={pairState}
			retry={retry(pairKeys)}
			{layout}
			heads={{
				old: { badge: 'A', label: `Tekst sinds ${date(from.from)}` },
				new: { badge: 'B', label: `Tekst sinds ${date(to.from)}` }
			}}
			labels={LABEL}
			legend={reversed
				? { ins: 'alleen in B', del: 'alleen in A' }
				: { ins: 'ingevoegd', del: 'geschrapt' }}
			absent={{ old: 'Niet in deze tekst.', new: 'Vervallen.' }}
			unchanged="De tekst is in A en B gelijk."
			copyText={comparisonText}
			lidHref={(n) => link({ versies: lidAnchor(n) })}
			{go}
		/>
	{/if}

	<!-- ── Every BWB version, for the record ── -->
	<div class="bwb">
		<div hidden={!bwbOpen}>
			<p class="bwb__note">
				Het BWB maakt een nieuwe versie van een artikel bij elke wijziging van de regeling. Versies
				zonder tekstwijziging vallen in de vergelijking samen met de tekstversie ervoor.
			</p>
			<table class="table">
				<thead>
					<tr>
						<th scope="col">Geldig</th>
						<th scope="col">Tekst</th>
						<th scope="col">Publicatie</th>
					</tr>
				</thead>
				<tbody>
					{#each versions as v, k (v.key)}
						{@const changed = k === 0 || v.text_changed}
						{@const w = wordingOf(wordings, v.valid_from ?? v.key)}
						<tr class:is-quiet={!changed}>
							<td class="table__when"
								>{capitalize(
									period({
										from: v.valid_from ?? null,
										until: v === versions.at(-1) && !v.valid_until ? null : (v.valid_until ?? null)
									})
								)}</td
							>
							<td>
								{#if !changed}
									<span title={effectOf(v) ? `BWB: ${effectOf(v)}` : undefined}
										>Geen tekstwijziging</span
									>
								{:else if w}
									{capitalize(w.summary)}
								{/if}
							</td>
							<td class="table__source">{@render herkomst(v)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="bwb__alle">
			<AlleN
				aantal={versions.length}
				noun="BWB-versies"
				open={bwbOpen}
				onclick={() => (bwbOpen = !bwbOpen)}
			/>
		</p>
	</div>
</section>

<style>
	/* Beside the network the reader is narrow, whatever the screen: the layout follows
	   the component's own width. */
	.vc {
		container: vc / inline-size;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	/* ── The bar of a lid's history: back, and the other leden ── */
	.bar {
		position: sticky;
		top: calc(-1 * var(--reader-pad-top, var(--s-6)));
		z-index: var(--z-raised);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2) var(--s-4);
		margin: 0 0 var(--s-4);
		padding: var(--s-2) 0;
		background: var(--paper);
		border-bottom: 1px solid var(--rule);
	}
	.bar__back {
		color: var(--ink-2);
	}
	.bar__back:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	/* ── The choice: the line through time between two arrows; it stays in view ── */
	/* ── The choice: the line through time over A and B; it stays in view ── */
	/* The line through time, with the steps at its end, level with its bar. */
	.pick {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: var(--s-3);
	}
	.pick__steps {
		display: flex;
		gap: var(--s-1);
		margin-bottom: -15px;
	}
	/* The comparison's own panel: set apart from the text like a sheet, closed by the
	   same Vergelijken that opened it. */
	.drawer {
		display: grid;
		gap: var(--s-3);
		margin: 0 0 var(--s-5);
		padding: var(--s-4);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		--badge-ring: var(--paper-2);
	}
	.leden {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
	}
	.leden a {
		min-width: 24px;
		padding: 2px var(--s-2);
		border-radius: var(--r-1);
		text-align: center;
		color: var(--ink-2);
	}
	.leden a:hover {
		background: var(--paper-2);
	}
	.leden a[aria-current='page'] {
		background: var(--ink);
		color: var(--paper);
	}

	/* ── The line through time ── */
	/* One period per tekstversie, as wide as its years allow and never narrower than its
	   label: the labels sit in their periods and never run into one another. */
	/* More periods than fit (a phone): the line scrolls in its own track, not the column. */
	.line {
		display: flex;
		min-width: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		scrollbar-width: thin;
	}
	.line__period {
		flex-basis: 0;
		flex-shrink: 1;
		min-width: 76px;
		display: flex;
		flex-direction: column;
	}
	.line__label {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 0 var(--s-2) var(--s-2) var(--s-2);
		border: 0;
		border-left: 1px solid var(--rule-strong);
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		line-height: 1.35;
		text-align: left;
		color: var(--ink-3);
		cursor: pointer;
	}
	.line__label:disabled {
		cursor: default;
	}
	.line__year {
		font-weight: 600;
		color: var(--ink-2);
	}
	.line__what {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.line__label:hover:not(:disabled) .line__year,
	.line__label:hover:not(:disabled) .line__what {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.line__label.is-active .line__year,
	.line__label.is-active .line__what {
		color: var(--ink);
	}
	.line__bar {
		position: relative;
		display: flex;
		align-items: center;
		gap: 2px;
		height: 6px;
		margin-right: 1px;
		background: var(--rule);
	}
	.is-in .line__bar {
		background: var(--rule-strong);
	}
	.is-a .line__bar {
		background: var(--ink-3);
	}
	.is-b .line__bar {
		background: var(--ink);
	}
	.line__bar :global(.badge) {
		margin-left: var(--s-1);
	}

	.origin__what {
		color: var(--ink-2);
	}

	/* Where a version came from: its parts with a comma between them. */
	.herkomst > span:not(:last-child)::after {
		content: ', ';
	}
	.herkomst :global(a) {
		color: var(--ink-2);
	}
	.herkomst :global(a:hover) {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}

	/* The controls of the choice read as the buttons of the app: 28px high, a hairline
	   border, the interface type, the one chevron. */
	/* A and B: two cards of one width, the swap between them. */
	.ab {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: var(--s-2);
	}
	/* The A and B choosers are text menus: the badge, the dates, a caret. Each stays in its
	   column; the dates end in an ellipsis before they reach the swap (live, 11 Oct). */
	.ab :global(.tekstmenu),
	.ab :global(.tekstmenu__knop) {
		min-width: 0;
		max-width: 100%;
	}
	.ab :global(.tekstmenu__knop > *) {
		flex-shrink: 0;
	}
	.ab :global(.tekstmenu__knop > .ab__text) {
		flex-shrink: 1;
	}
	.ab__text {
		min-width: 0;
		margin-left: var(--s-2);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ab__lijst {
		display: flex;
		flex-direction: column;
		max-height: 60vh;
		overflow-y: auto;
	}
	.ab__jaar {
		padding: var(--s-2) var(--s-3) var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.ab__menuitem {
		white-space: nowrap;
	}
	.ab__ruil {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* A lid's history: what happened to it, and its text. */
	.row__label {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-label);
		font-weight: 600;
		color: var(--ink-3);
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.text--added {
		padding-left: var(--s-3);
		border-left: 3px solid var(--mark-ins-rule);
	}
	.text--none {
		padding-top: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-style: italic;
		color: var(--ink-3);
	}

	/* ── One lid through time ── */
	.heading {
		margin: var(--s-2) 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 600;
		color: var(--ink);
	}
	.empty {
		color: var(--ink-3);
	}
	/* The measure of the article text: the line through time hangs in the gutter, the
	   margin of 150px stays free, so the text stands where the article's does. */
	/* Wetstekst, no timeline: each formulation under its period, a heading at rung 3 as a
	   group of the Tijdlijn has, the text to the column's measure. */
	.formulations {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
		margin: 0 172px 0 31px;
		padding: 0;
		list-style: none;
	}
	.formulation__head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-3);
		margin-bottom: var(--s-2);
		padding-bottom: var(--s-2);
		border-bottom: 2px solid var(--ink);
		color: var(--ink-3);
	}
	.formulation__when {
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.formulation__cite {
		margin-left: auto;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
	}
	.formulation__cite:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.formulation .text {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.formulations__end {
		color: var(--ink-3);
	}

	/* ── Every BWB version ── */
	.bwb {
		margin-top: var(--s-7);
		border-top: 1px solid var(--rule);
	}
	.bwb__alle {
		margin: var(--s-3) 0;
	}
	.bwb__note {
		margin: var(--s-3) 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.table {
		width: 100%;
		border-collapse: collapse;
	}
	.table th {
		padding: 0 var(--s-2) var(--s-1) 0;
		border-bottom: 1px solid var(--rule-strong);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
		text-align: left;
	}
	.table td {
		padding: var(--s-1) var(--s-2) var(--s-1) 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
		color: var(--ink);
	}
	.table__when {
		width: 38%;
		font-variant-numeric: tabular-nums;
	}
	.table__source {
		color: var(--ink-3);
	}
	tr.is-quiet td {
		color: var(--ink-3);
	}

	/* As the article text on a narrow screen: the margin goes under the text. */
	@media (max-width: 900px) {
		.formulations {
			margin: 0 0 0 23px;
		}
	}
	/* A over B, the swap beside both, where the two do not fit side by side in full. */
	@container vc (max-width: 640px) {
		.ab {
			grid-template-columns: minmax(0, max-content) auto;
			justify-content: start;
		}
		.ab > :global(.iconknop) {
			grid-row: 1 / span 2;
			grid-column: 2;
		}
	}
	@container vc (max-width: 560px) {
		.bar {
			position: static;
			gap: var(--s-2);
		}
		.pick {
			position: static;
		}
		.line__what {
			display: none;
		}
		.line__period {
			min-width: 44px;
		}
	}
</style>
