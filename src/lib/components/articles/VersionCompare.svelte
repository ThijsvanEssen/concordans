<script lang="ts">
	import { korteDatum } from '$lib/text/datum';
	import { uniqueBy } from '$lib/util/unique';
	import DossierLink from '$lib/bron/DossierLink.svelte';
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
	import { citeArticle, type Citation } from '$lib/text/cite';
	import { longDate } from '$lib/verbonden/rows';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { slide } from 'svelte/transition';
	import {
		byYear,
		compareVersions,
		lidHistory,
		plainDiff,
		sameText,
		wordingOf,
		wordingsOf,
		type CompareRow,
		type Segment,
		type Wording
	} from '$lib/text/version-diff';

	type Version = Schema<'ArticleVersionDTO'>;
	type Params = Record<string, string | null>;
	type VersionWording = Wording<Version>;

	let {
		versions,
		param,
		layout = 'een',
		citation = null,
		link,
		go,
		missingDossiers = new Set()
	}: {
		/** Oldest first, as the API delivers them. */
		versions: Version[];
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
		/** Dossiers the API does not hold: named, not linked. */
		missingDossiers?: ReadonlySet<string>;
	} = $props();

	const wordings = $derived(wordingsOf(versions));
	const last = $derived(wordings.length - 1);
	const idOf = (w: Wording<Version>) => w.from ?? w.first.key;
	const pairParam = (a: Wording<Version>, b: Wording<Version>) => `${idOf(a)}..${idOf(b)}`;

	// ── What the URL asks for ────────────────────────────────────────────────────

	const lidParam = $derived(/^lid-(.+)$/.exec(param)?.[1] ?? null);
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
		if (lidParam || e.altKey || e.ctrlKey || e.metaKey) return;
		const el = e.target as HTMLElement | null;
		if (el?.closest?.('input, select, textarea, [contenteditable]')) return;
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

	// ── Wording ──────────────────────────────────────────────────────────────────

	const date = (iso: string | null | undefined) => longDate(iso ?? null) ?? 'niet in de gegevens';
	const year = (iso: string | null | undefined) => (iso ? iso.slice(0, 4) : '');
	const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

	const period = (w: { from: string | null; until: string | null }) =>
		w.until ? `${date(w.from)} tot ${date(w.until)}` : `sinds ${date(w.from)}`;

	const publication = (p: Schema<'PublicationDTO'> | null | undefined) =>
		p?.kind && p.year && p.number ? `${p.kind}. ${p.year}, ${p.number}` : null;

	const signedAndPublished = (p: Schema<'PublicationDTO'> | null | undefined) =>
		[
			p?.signed ? `vastgesteld ${longDate(p.signed)}` : null,
			p?.published ? `uitgegeven ${longDate(p.published)}` : null
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
		Math.max(0.1, ((w.until ? time(w.until) : today) - time(w.from)) / (365.25 * 864e5));

	/** The changes between A and B, oldest first, whichever way round they are held. */
	const between = $derived(wordings.slice(older.index + 1, newer.index + 1));

	// ── The leden ────────────────────────────────────────────────────────────────

	let showSame = $state(false);
	const rows = $derived.by(() => {
		// Adjacent tekstversies were compared already, to name the change.
		if (adjacent && !reversed && to.rows) return to.rows;
		return compareVersions(from.first, to.first);
	});

	// The same wording in A and B: the text itself, not one fold that hides it.
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

	// Read backwards, "ingevoegd" would claim an amendment that never was: B has it, A not.
	const LABEL = $derived<Record<CompareRow['kind'], string>>({
		same: '',
		changed: '',
		rewritten: 'herschreven',
		added: reversed ? 'alleen in B' : 'ingevoegd',
		removed: reversed ? 'alleen in A' : 'vervallen'
	});

	// ── One lid through time ─────────────────────────────────────────────────────

	const history = $derived(lidParam ? lidHistory(wordings, lidParam) : null);
	const allLeden = $derived.by(() => {
		const numbers: string[] = [];
		for (const w of wordings)
			for (const r of w.rows ?? [])
				for (const n of [r.old?.number, r.new?.number])
					if (n && !numbers.includes(n)) numbers.push(n);
		return numbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
	});

	// ── Copying ──────────────────────────────────────────────────────────────────

	const copier = createCopier();
	const copy = (text: string, what: string) => copier.copy(text, what);

	const cite = (lid: string | null) =>
		citation ? citeArticle({ ...citation, lid }).kort : lid ? `lid ${lid}` : 'artikel';

	const comparisonText = $derived(
		`${capital(cite(null))}, tekst sinds ${date(from.from)} vergeleken met tekst sinds ${date(to.from)}.\n` +
			`[-geschrapt-] [+ingevoegd+]\n\n${plainDiff(rows)}`
	);

	const formulationCite = (
		lid: string,
		f: { since: Wording<Version>; through: Wording<Version> }
	) =>
		`${cite(lid)} (tekst geldig ${f.through.until ? `van ${date(f.since.from)} tot ${date(f.through.until)}` : `sinds ${date(f.since.from)}`})`;
</script>

{#snippet marked(segments: Segment[], side: 'both' | 'old' | 'new')}
	{#each segments as s, i (i)}
		{@const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(s.text) ?? ['', '', s.text, '']}
		{#if s.op === 'eq'}{s.text}{:else if s.op === 'del' && side !== 'new'}{lead}<del
				><span class="sr-only">geschrapt: </span>{core}</del
			>{trail}{:else if s.op === 'ins' && side !== 'old'}{lead}<ins
				><span class="sr-only">ingevoegd: </span>{core}</ins
			>{trail}{/if}
	{/each}
{/snippet}

{#snippet made(w: VersionWording, verb: string)}
	{@const v = w.first}
	{@const pub = publication(v.amended_by)}
	{@const inForce = publication(v.commencement)}
	<span class="origin__what">{verb} {date(w.from)}</span>
	{#if pub}<span title={signedAndPublished(v.amended_by)}>{pub}</span>{/if}
	{#if inForce && inForce !== pub}<span title={signedAndPublished(v.commencement)}
			>in werking bij {inForce}</span
		>{/if}
	{#each uniqueBy(v.amended_by?.dossiers ?? [], (d) => d.key) as dossier (dossier.key)}
		<DossierLink {dossier} missing={missingDossiers.has(dossier.number)} />
	{/each}
{/snippet}

{#snippet chooser(which: 'A' | 'B', w: VersionWording, other: number, pick: (i: number) => void)}
	<!-- A card that says which text it is; the list of the system lies over it, unseen,
	     so choosing works as any list does, by pointer, keyboard or screen reader. -->
	<label class="ab__card">
		<span class="badge badge--{which.toLowerCase()}">{which}</span>
		<span class="ab__text">
			<span class="ab__date">Tekst sinds {date(w.from)}</span>
			<span class="ab__period">{w.until ? `tot ${date(w.until)}` : 'geldend recht'}</span>
		</span>
		<Caret />
		<select
			class="ab__native"
			aria-label="Tekstversie {which}"
			value={w.index}
			onchange={(e) => pick(Number(e.currentTarget.value))}
		>
			{#each byYear(wordings) as [year, group] (year)}
				<optgroup label={year}>
					{#each group as option (option.index)}
						<option value={option.index} disabled={option.index === other}
							>Tekst sinds {optionLabel(option)}{option.until ? '' : ', geldend'}</option
						>
					{/each}
				</optgroup>
			{/each}
		</select>
	</label>
{/snippet}

<section class="vc" aria-label="Versies vergelijken">
	{#if lidParam}
		<!-- ── One lid through all its formulations ── -->
		<div class="bar">
			<a class="bar__back" href={link({ versies: '' })} data-sveltekit-noscroll
				>← Vergelijking van tekstversies</a
			>
			<nav class="leden" aria-label="Leden">
				{#each allLeden as n (n)}
					<a
						href={link({ versies: `lid-${n}` })}
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
					<li class="formulation">
						<div class="formulation__head">
							<span class="formulation__when"
								>{capital(period({ from: f.since.from, until: f.through.until }))}</span
							>
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
						{#if f.kind === 'rewritten'}<span class="row__label">herschreven</span>{/if}
						<p class="text" class:text--added={f.kind === 'added'}>
							{#if f.kind === 'changed'}{@render marked(f.segments, 'both')}{:else}{f.unit
									.text}{/if}
						</p>
					</li>
				{/each}
			</ol>
			{#if history.removedIn}
				<p class="formulations__end">Vervallen per {date(history.removedIn.from)}.</p>
			{/if}
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
				<button
					type="button"
					class="ab__btn"
					title="A en B omdraaien"
					aria-label="A en B omdraaien"
					onclick={() => showPair(to.index, from.index)}
					><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
						><path d="M2 5.5h11M10 2.5l3 3-3 3M14 10.5H3M6 7.5l-3 3 3 3" /></svg
					></button
				>
				{@render chooser('B', to, from.index, (i) => showPair(from.index, i))}
			</div>

			<div class="pick">
				<ol class="line" aria-label="Tekstversies">
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
								class:is-on={adjacent && w.index === newer.index}
								disabled={w.index === 0}
								title="{capital(period(w))}: {w.index === 0
									? 'oudste tekst in de gegevens'
									: w.summary}"
								onclick={() => showChange(w.index)}
								><span class="line__year">{year(w.from)}</span><span class="line__what"
									>{w.index === 0 ? 'oudste tekst' : w.summary}</span
								></button
							>
							<span class="line__bar" aria-hidden="true"
								>{#if isA}<span class="badge badge--a">A</span>{/if}{#if isB}<span
										class="badge badge--b">B</span
									>{/if}</span
							>
						</li>
					{/each}
				</ol>
				<span class="pick__steps">
					<button
						type="button"
						class="ab__btn ab__btn--prev"
						aria-label="Vorige wijziging"
						title="Vorige wijziging (←)"
						disabled={prevChange === null}
						onclick={() => prevChange !== null && showChange(prevChange)}><Caret side /></button
					>
					<button
						type="button"
						class="ab__btn"
						aria-label="Volgende wijziging"
						title="Volgende wijziging (→)"
						disabled={nextChange === null}
						onclick={() => nextChange !== null && showChange(nextChange)}><Caret side /></button
					>
				</span>
			</div>

			<!-- ── The history between A and B: a row per change, the publication that made it ── -->
			<div class="history">
				<p class="history__head">
					{between.length === 1 ? 'Eén wijziging' : `${between.length} wijzigingen`}
					{reversed ? 'tussen B en A; A is de latere tekst, B de eerdere' : 'tussen A en B'}
				</p>
				<table class="history__table">
					<tbody>
						{#each between as w (w.index)}
							{@const pub = publication(w.first.amended_by)}
							{@const inForce = publication(w.first.commencement)}
							<tr>
								<td class="history__when">
									{#if adjacent}{date(w.from)}{:else}<button
											type="button"
											class="history__step"
											title="Alleen deze wijziging tonen"
											onclick={() => showChange(w.index)}>{date(w.from)}</button
										>{/if}
								</td>
								<td class="history__what">{capital(w.summary)}</td>
								<td class="history__source">
									{#if pub}<span title={signedAndPublished(w.first.amended_by)}>{pub}</span>{/if}
									{#if inForce && inForce !== pub}<span
											title={signedAndPublished(w.first.commencement)}
											>in werking bij {inForce}</span
										>{/if}
									{#each uniqueBy(w.first.amended_by?.dossiers ?? [], (d) => d.key) as dossier (dossier.key)}
										<DossierLink {dossier} missing={missingDossiers.has(dossier.number)} />
									{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- ── How it is shown ── -->
			<div class="tools">
				<span class="tools__keys" aria-label="Legenda">
					<span class="text"><ins>{reversed ? 'alleen in B' : 'ingevoegd'}</ins></span>
					<span class="text"><del>{reversed ? 'alleen in A' : 'geschrapt'}</del></span>
				</span>
				<span class="tools__acts">
					<span class="toggle" role="radiogroup" aria-label="Weergave">
						<button
							type="button"
							role="radio"
							aria-checked={layout === 'een'}
							onclick={() => go({ weergave: null })}>In één tekst</button
						>
						<button
							type="button"
							role="radio"
							aria-checked={layout === 'naast'}
							onclick={() => go({ weergave: 'naast' })}>Naast elkaar</button
						>
					</span>
					{#if sameCount > 0}
						<button type="button" class="btn is-text" onclick={() => (showSame = !showSame)}
							>{showSame ? 'Alleen wijzigingen' : 'Alle leden'}</button
						>
					{/if}
					<button type="button" class="btn is-text" onclick={() => copy(comparisonText, 'diff')}
						>{copier.label('diff', 'Kopieer')}</button
					>
				</span>
			</div>
		</div>

		<!-- ── The leden ── -->
		<div class="compare compare--{layout}" class:is-whole={whole}>
			{#if layout === 'naast'}
				<div class="row row--head" aria-hidden="true">
					<span></span>
					<span class="side-head"
						><span class="badge badge--a">A</span>Tekst sinds {date(from.from)}</span
					>
					<span class="side-head"
						><span class="badge badge--b">B</span>Tekst sinds {date(to.from)}</span
					>
				</div>
			{/if}
			{#if unchanged}
				<p class="unchanged">De tekst is in A en B gelijk.</p>
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
					<div class="row row--{row.kind}">
						<span class="row__no">
							{#if n && allLeden.includes(n)}
								<a
									href={link({ versies: `lid-${n}` })}
									data-sveltekit-noscroll
									title="Geschiedenis van lid {n}">{n}</a
								>
							{:else}{n}{/if}
							{#if was}<span class="row__was">was {was}</span>{/if}
						</span>
						{#if layout === 'een'}
							<div class="row__body">
								{#if row.kind === 'same'}
									<p class="text">{row.new?.text}</p>
								{:else if row.kind === 'changed'}
									<p class="text">{@render marked(row.segments, 'both')}</p>
								{:else if row.kind === 'rewritten'}
									<div class="pair">
										<div class="pair__old">
											<span class="pair__when"
												><span class="badge badge--a">A</span>Tekst sinds {date(from.from)}</span
											>
											<p class="text">{row.old?.text}</p>
										</div>
										<div class="pair__new">
											<span class="pair__when"
												><span class="badge badge--b">B</span>Tekst sinds {date(to.from)}</span
											>
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
							<span class="row__aside">{LABEL[row.kind]}</span>
						{:else}
							<div class="row__side">
								{#if row.kind === 'rewritten' || row.kind === 'removed'}<span class="row__label"
										>{LABEL[row.kind]}</span
									>{/if}
								{#if row.old}
									<p class="text" class:text--removed={row.kind === 'removed'}>
										{#if row.kind === 'changed'}{@render marked(row.segments, 'old')}{:else}{row.old
												.text}{/if}
									</p>
								{:else}
									<p class="text text--none">Niet in deze tekst.</p>
								{/if}
							</div>
							<div class="row__side">
								{#if row.kind === 'rewritten' || row.kind === 'added'}<span class="row__label"
										>{LABEL[row.kind]}</span
									>{/if}
								{#if row.new}
									<p class="text" class:text--added={row.kind === 'added'}>
										{#if row.kind === 'changed'}{@render marked(row.segments, 'new')}{:else}{row.new
												.text}{/if}
									</p>
								{:else}
									<p class="text text--none">Vervallen.</p>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- ── Every BWB version, for the record ── -->
	<details class="bwb">
		<summary>Alle BWB-versies ({versions.length})</summary>
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
					{@const changed = k === 0 || !sameText(versions[k - 1].text, v.text)}
					{@const w = wordingOf(wordings, v.valid_from ?? v.key)}
					<tr class:is-quiet={!changed}>
						<td class="table__when"
							>{capital(
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
								{capital(w.summary)}
							{/if}
						</td>
						<td class="table__source">
							{#if publication(v.amended_by)}<span title={signedAndPublished(v.amended_by)}
									>{publication(v.amended_by)}</span
								>{/if}
							{#each uniqueBy(v.amended_by?.dossiers ?? [], (d) => d.key) as dossier (dossier.key)}
								<DossierLink {dossier} missing={missingDossiers.has(dossier.number)} />
							{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
	<p class="sr-only" aria-live="polite">{copier.announcement}</p>
</section>

<style>
	/* Beside the network the reader is narrow, whatever the screen: the layout follows
	   the component's own width. */
	.vc {
		container: vc / inline-size;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
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
		color: var(--accent);
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
		margin-bottom: -11px;
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
	}
	.toggle {
		display: inline-flex;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		overflow: hidden;
	}
	/* 28px with its border, as the other controls of the comparison. */
	.toggle button {
		height: 26px;
		padding: 0 var(--s-3);
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
	}
	.toggle button + button {
		border-left: 1px solid var(--rule-strong);
	}
	.toggle button[aria-checked='true'] {
		background: var(--ink);
		color: var(--paper);
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
		padding: 0 var(--s-2) 6px 6px;
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
		font-weight: 500;
		color: var(--ink-2);
	}
	.line__what {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.line__label:hover:not(:disabled) .line__year,
	.line__label:hover:not(:disabled) .line__what {
		color: var(--accent);
	}
	.line__label.is-on .line__year,
	.line__label.is-on .line__what {
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
	.line__bar .badge {
		margin-left: var(--s-1);
	}

	/* A and B: the same marks on the line and at the lists. */
	.badge {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border: 2px solid var(--paper-2);
		border-radius: 50%;
		background: var(--ink);
		font-family: var(--font-sans);
		font-size: var(--t-label);
		font-weight: 600;
		line-height: 1;
		color: var(--paper);
	}
	.badge--a {
		background: var(--ink-3);
	}

	.origin__what {
		color: var(--ink-2);
	}
	.formulation__head a {
		color: var(--ink-2);
	}
	.formulation__head a:hover {
		color: var(--accent);
	}

	.history {
		margin: 0;
	}
	.history__head {
		margin: 0 0 var(--s-1);
		color: var(--ink-3);
	}
	.history__table {
		width: 100%;
		border-collapse: collapse;
	}
	.history__table td {
		padding: var(--s-1) var(--s-3) var(--s-1) 0;
		border-top: 1px solid var(--rule);
		vertical-align: baseline;
	}
	.history__when {
		width: 1%;
		white-space: nowrap;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.history__what {
		color: var(--ink);
		font-weight: 500;
	}
	.history__source {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0 var(--s-3);
		color: var(--ink-3);
		text-align: right;
	}
	.history__source a {
		color: var(--ink-2);
	}
	.history__source a:hover,
	.history__step:hover {
		color: var(--accent);
	}
	.history__step {
		padding: 0;
		border: 0;
		border-bottom: 1px solid var(--rule-strong);
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
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
	.ab__card {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--s-3);
		min-width: 0;
		padding: var(--s-2) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
		color: var(--ink-3);
		cursor: pointer;
	}
	.ab__card:hover {
		border-color: var(--ink-3);
	}
	.ab__card:focus-within {
		outline: 2px solid var(--ink-3);
		outline-offset: 1px;
	}
	.ab__card .badge {
		border-color: var(--paper);
	}
	.ab__text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.ab__date,
	.ab__period {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ab__date {
		font-weight: 500;
		color: var(--ink);
	}
	.ab__period {
		font-size: var(--t-micro);
	}
	.ab__card :global(.caret) {
		margin: 0;
	}
	.ab__native {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}
	.ab__btn {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: none;
		color: var(--ink-2);
		cursor: pointer;
	}
	.ab__btn:hover:not(:disabled) {
		background: var(--paper);
		color: var(--ink);
	}
	.ab__btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.ab__btn :global(.caret) {
		margin: 0;
		opacity: 1;
	}
	/* The chevron points right; the previous change turns it round. */
	.ab__btn--prev :global(.caret.is-side) {
		transform: rotate(90deg);
	}
	.ab__btn svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
	}
	.tools__keys {
		display: flex;
		gap: var(--s-3);
		font-size: var(--t-micro);
	}
	.tools__keys .text {
		font-family: var(--font-sans);
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
		padding: 6px 10px 6px 0;
	}
	.compare--naast .row {
		grid-template-columns: 36px 1fr 1fr;
		gap: 0 20px;
	}
	.row--head {
		padding: 0 0 var(--s-1);
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}
	.row__no {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-top: 7px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		line-height: 1.3;
	}
	.row__no a {
		color: var(--ink-2);
	}
	.row__no a:hover {
		color: var(--accent);
	}
	/* Level with the old wording, under its date. */
	.compare--een .row--rewritten .row__no,
	.compare--een .row--rewritten .row__aside {
		padding-top: 26px;
	}
	.row__aside {
		padding-top: 7px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: right;
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
		font-family: var(--font-sans);
		font-size: var(--t-label);
		font-weight: 500;
		color: var(--ink-3);
	}
	.row--same .text {
		color: var(--ink-2);
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.text ins {
		text-decoration: none;
		background: var(--mark-ins);
		box-shadow: inset 0 -1.5px 0 var(--mark-ins-rule);
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
		padding: 0 1px;
	}
	.text del {
		color: var(--ink-3);
		text-decoration: line-through;
		text-decoration-color: var(--ink-2);
		text-decoration-thickness: 1px;
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
		padding-top: 7px;
		font-family: var(--font-sans);
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
	/* A and B at the head of their column, as on the line through time. */
	.side-head {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		color: var(--ink-2);
	}
	.row--head .badge,
	.pair__when .badge {
		border-color: var(--paper);
	}
	.pair__when {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin-bottom: 2px;
		font-family: var(--font-sans);
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
		font-family: var(--font-sans);
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

	/* ── One lid through time ── */
	.heading {
		margin: var(--s-2) 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
	}
	.empty {
		color: var(--ink-3);
	}
	/* The measure of the article text: the line through time hangs in the gutter, the
	   margin of 150px stays free, so the text stands where the article's does. */
	.formulations {
		margin: 0 172px 0 31px;
		padding: 0;
		list-style: none;
		border-left: 1px solid var(--rule-strong);
	}
	.formulation {
		position: relative;
		padding: 0 0 var(--s-5) var(--s-4);
	}
	.formulation::before {
		content: '';
		position: absolute;
		left: -4px;
		top: 5px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--ink);
	}
	.formulation__head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px var(--s-3);
		margin-bottom: var(--s-1);
		color: var(--ink-3);
	}
	.formulation__when {
		font-weight: 500;
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
		color: var(--accent);
	}
	.formulation .text {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.formulations__end {
		margin: 0;
		padding-left: var(--s-4);
		color: var(--ink-3);
	}

	/* ── Every BWB version ── */
	.bwb {
		margin-top: var(--s-7);
		border-top: 1px solid var(--rule);
	}
	.bwb summary {
		padding: var(--s-3) 0;
		color: var(--ink-2);
		cursor: pointer;
	}
	.bwb summary:hover {
		color: var(--accent);
	}
	.bwb__note {
		margin: 0 0 var(--s-3);
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
		font-weight: 500;
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
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-3);
		color: var(--ink-3);
	}
	tr.is-quiet td {
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
			padding-top: 2px !important;
			text-align: left;
		}
		.formulations {
			margin: 0 0 0 23px;
		}
		.compare--naast .row {
			grid-template-columns: 28px 1fr 1fr;
			gap: 0 var(--s-3);
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
		.history__source {
			justify-content: flex-start;
			text-align: left;
		}
		.history__table tr {
			display: grid;
			grid-template-columns: auto 1fr;
		}
		.history__source {
			grid-column: 1 / -1;
		}
		.compare--naast .row {
			grid-template-columns: 28px 1fr 1fr;
			gap: 0 var(--s-3);
		}
	}
	.unchanged {
		margin: 0 0 var(--s-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>
