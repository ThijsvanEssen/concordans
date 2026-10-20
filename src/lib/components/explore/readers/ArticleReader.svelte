<script lang="ts">
	import { plural } from '$lib/text/words';
	import { langeDatum } from '$lib/text/datum';
	import { bewaarItem } from '$lib/map/map';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { getDossierDocuments, getExplainedBy, getExplanations } from '$lib/api/records';
	import { uniqueBy } from '$lib/util/unique';
	import DossierLink from '$lib/bron/DossierLink.svelte';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { lidAnchor } from '$lib/text/anchor';
	import { onderdeelMark } from '$lib/text/article-parts';
	// Reader for articles: the place of the article, its title, one line with the version
	// picker, the wetsvoorstellen that touch it and Citeer, then the leden with the number
	// of verbindingen of each, and the previous and next article. The picker lists the
	// tekstversies: the BWB versions with one wording, folded together. With ?versies
	// (two tekstversies, `van..tot`, or one lid, `lid-4`) the text gives way to the
	// comparison; a lid changed since the oldest tekstversie says so in the margin.
	import { menu } from '$lib/actions/menu';
	import { getDocumentPassages } from '$lib/api/documents';
	import { getArticleVersion, getDelegated } from '$lib/api/articles';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import type { Schema } from '$lib/api/types';
	import { articleOf, type GraphNode } from '$lib/graph/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import { Lazy } from '$lib/util/lazy.svelte';
	import { page } from '$app/state';
	import { anchorOfHash, landOn } from '$lib/bron/landing';
	import { refId } from '$lib/bron/href';
	import { articleCitation, citeArticle, placeCitation } from '$lib/text/cite';
	import { articleName } from '$lib/text/bw';
	import { placeOf, type Division } from '$lib/text/division';
	import { lidHistory, unitsOf, wordingsOf } from '$lib/text/version-diff';
	import { inForceOn } from '../peildatum';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { filterParams, type VerbondenFilter } from '$lib/verbonden/filter';
	import { formatCount } from '$lib/text/getal';
	import { enactedLawId, enactedLawStatus } from '$lib/text/enacted-law';
	import { proposedTextOf, type ProposedText } from '$lib/verbonden/proposed-text';
	import type { Row } from '$lib/verbonden/rows';
	import { untrack } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import ArticleSuccession from './ArticleSuccession.svelte';
	import { articleKey as keyOfArticle, fetchArticle } from './article';
	import { navigate, withParams, type ParamPatch } from '$lib/util/address';
	import { load } from '$lib/util/load.svelte';
	import { report } from '$lib/api/errors';
	import LoadState from '$lib/components/ui/LoadState.svelte';

	let {
		node,
		prevHref,
		nextHref,
		place = [],
		lidCounts = new Map(),
		lidTellend = false,
		billCount = 0,
		filter,
		proposedRow = null,
		onCloseProposed
	}: {
		node: GraphNode;
		prevHref?: string;
		nextHref?: string;
		place?: Division[];
		lidCounts?: Map<string, number>;
		/** The counts per lid are still on their way. */
		lidTellend?: boolean;
		billCount?: number;
		filter?: VerbondenFilter;
		proposedRow?: Row | null;
		onCloseProposed?: () => void;
	} = $props();

	/** The tekstversie on screen, when it is not geldend recht. */
	let shownIndex = $state<number | null>(null);
	let versionMenu = $state(false);
	/** Dossiers the API does not know: named, but not linked. */
	let missingDossiers = $state<ReadonlySet<string>>(new Set());

	// The toelichting (MvT) that explains this article, if any: a quick popup here, so
	// the panel on the right can stay reserved for verwijzingen (Verbonden). Its own
	// full reading view is still the existing "open naast het artikel" (`?naast=`).
	// `artikel`: the API links the document to this article. `wijziging`: the memorie
	// van toelichting of the wet that made the tekstversie on screen.
	type Explanatory = {
		key: string;
		title: string | null;
		kind: string | null;
		at: string | null;
		basis: 'artikel' | 'wijziging';
		dossier: string | null;
		since: string | null;
		/** The memorie of the verklaringswet: the first reading of a change in the Grondwet. */
		firstReading: boolean;
	};
	let explanatory = $state<Explanatory | null>(null);
	// The title every verklaringswet (art. 137 lid 1 Gw) opens with.
	const FIRST_READING = /^(wijziging van de wet houdende )?verklaring dat er grond bestaat/i;

	// Primitives, so that a new node object for the same article does not reload it.
	const identity = $derived(articleOf(node.raw?.props));
	const bwbId = $derived(identity?.lawId ?? '');
	const articleNumber = $derived(identity?.articleNumber ?? '');

	// Without versions the picker shows the current text alone, and says why.
	const articleKey = $derived(keyOfArticle(bwbId, articleNumber));
	const article = load(() => articleKey, fetchArticle, 'Artikel');
	const loaded = $derived(article.state.status === 'ready' ? article.state.data.detail : null);
	const versionState = $derived(
		article.state.status === 'ready' ? article.state.data.versions : null
	);
	const versions = $derived(versionState?.status === 'ready' ? versionState.data : []);
	// A new article opens at its geldende tekst.
	$effect(() => {
		void articleKey;
		untrack(() => (shownIndex = null));
	});

	// The position in the URL, once the text is on the page and again when it changes.
	let root = $state<HTMLElement | null>(null);
	const anchor = $derived(anchorOfHash(page.url.hash));
	$effect(() => {
		if (!loaded || !anchor || !root) return;
		const container = root;
		afterTick(() => landOn(container, anchor));
	});

	// Whether a toelichting explains this article, for the header. Only the existence
	// and identity; its text loads when the popup opens.
	// TODO(backend B4, B5): EXPLAINS edges at article level are rare, and most memories
	// van toelichting of amending wetten are missing or hold only their opening.
	$effect(() => {
		explanatory = null;
		const bwb = bwbId;
		const num = articleNumber;
		const dossier = wordingDossier?.number ?? null;
		const since = onScreen?.from ?? null;
		const versionKeys = onScreen?.versions.map((v) => v.key) ?? [];
		if (!bwb || !num) return;
		const ac = new AbortController();
		const find = async () => {
			// Asked once per article: this runs again when the tekstversies arrive.
			const data = await getExplainedBy(bwb, num);
			if (ac.signal.aborted) return;
			// An explanation of the instrument is no evidence about this article (API docs).
			// Of the rest, the one that explains the tekstversie on screen comes first, and of
			// those the one that names a passage about this article. A change in the Grondwet
			// has its memorie in the first reading; the second's is `dossier` scope.
			// TODO(backend): the docs name an `instrument` target the enum of `target` lacks.
			const items = (data?.items ?? []).filter((i) => (i.target as string) !== 'instrument');
			const onScreenItems = items.filter(
				(i) => i.article_version_key && versionKeys.includes(i.article_version_key)
			);
			const own =
				onScreenItems.find((i) => i.scope === 'article') ??
				onScreenItems[0] ??
				items.find((i) => i.target === 'article');
			if (own) {
				// `dossier` scope: the memorie explains every change of its wet, not this article.
				const perDossier = own.scope === 'dossier';
				explanatory = {
					key: own.document.key,
					title: own.document.title ?? null,
					kind: own.document.kind ?? null,
					at: own.section_anchor ?? null,
					basis: perDossier ? 'wijziging' : 'artikel',
					dossier: own.document.dossier_number ?? null,
					since: perDossier ? since : null,
					firstReading: FIRST_READING.test(own.document.title ?? '')
				};
				return;
			}
			if (!dossier) return;
			const papers = await getDossierDocuments(dossier);
			if (ac.signal.aborted) return;
			if (!papers) {
				missingDossiers = new Set([...missingDossiers, dossier]);
				return;
			}
			const mvt = papers.items.find((d) => /memorie van toelichting/i.test(d.kind ?? ''));
			if (!mvt || ac.signal.aborted) return;
			explanatory = {
				key: mvt.key,
				title: mvt.title ?? null,
				kind: mvt.kind ?? null,
				at: null,
				basis: 'wijziging',
				dossier,
				since,
				firstReading: FIRST_READING.test(mvt.title ?? '')
			};
		};
		// No button without a confirmed toelichting.
		find()
			.then(() => passage(ac.signal))
			.catch((e) => report('Toelichting', e));
		return () => ac.abort();
	});

	/** A failure the passage goes on without: reported, then no answer. */
	const orNone = (where: string) => (e: unknown) => {
		report(where, e);
		return null;
	};

	/** The memorie's passage on this article, where the data has one: the place it opens at
	 *  (Thijs, 10 Oct: the memorie reader is the place, scrolled to the passage). */
	async function passage(signal: AbortSignal) {
		const e = explanatory;
		if (!e || e.at || !bwbId || !articleNumber) return;
		// The article's own explanations first (one request for every paper); a paper they
		// do not list is asked on its own.
		const uitleg = await getExplanations(bwbId, articleNumber).catch(orNone('Toelichtingen'));
		const hier = uitleg?.items.find((i) => i.document.key === e.key)?.passages[0]?.section_id;
		if (signal.aborted || explanatory?.key !== e.key) return;
		if (hier) {
			explanatory = { ...explanatory, at: hier };
			return;
		}
		if (uitleg) return;
		const r = await getDocumentPassages(
			e.key,
			{ bwb_id: bwbId, article: articleNumber },
			signal
		).catch(orNone('Passage van de toelichting'));
		const eerste = r?.items[0]?.section_id;
		if (eerste && !signal.aborted && explanatory?.key === e.key)
			explanatory = { ...explanatory, at: eerste };
	}

	// The toelichting opens under the article (`?naast=`), at its passage for the article
	// when the document reader finds one; the same link closes it again.
	const explanatoryOpen = $derived(
		!!explanatory &&
			page.url.searchParams.get('naast') ===
				refId({ collection: 'documents', key: explanatory.key })
	);
	const explanatoryHref = $derived.by(() => {
		if (!explanatory) return null;
		if (explanatoryOpen) return withParams(page.url, { naast: null });
		return withParams(
			page.url,
			{ naast: refId({ collection: 'documents', key: explanatory.key }) },
			{ hash: explanatory.at ?? '' }
		);
	});

	const wordings = $derived(wordingsOf(versions));
	const current = $derived(wordings.at(-1)?.until === null ? wordings.at(-1)! : null);
	/** The version that repealed the article: what the reader shows when nothing else is chosen. */
	const lapse = $derived(wordings.at(-1)?.lapsed ? wordings.at(-1)! : null);
	const shown = $derived(shownIndex !== null ? (wordings[shownIndex] ?? null) : null);

	// Opened from the law on a peildatum (?peildatum=2015-01-01): the text of that day, once
	// the versions are in; a later choice in the list is the reader's own.
	const peildatum = $derived(page.url.searchParams.get('peildatum'));
	$effect(() => {
		const day = peildatum;
		if (!day || wordings.length === 0) return;
		const w = inForceOn(wordings, day, (x) => x);
		untrack(() => {
			shownIndex = w && w !== current && w !== lapse ? w.index : null;
		});
	});
	// The text of an earlier tekstversie, asked when it is chosen: the history lists none.
	const shownText = load(
		() => (shown ? `${bwbId}/${articleNumber}/${shown.first.key}` : null),
		(key) => {
			if (!key || !shown) return Promise.resolve(null);
			return getArticleVersion(bwbId, articleNumber, shown.first.key);
		},
		'Tekstversie'
	);
	const shownVersion = $derived(
		shown && shownText.state.status === 'ready' ? shownText.state.data : null
	);
	/** The tekstversie whose text is on screen, and the dossier of the wet that made it. */
	const onScreen = $derived(shown ?? current);
	const wordingDossier = $derived(onScreen?.first.amended_by?.dossiers?.[0] ?? null);
	const validFrom = $derived(
		shown?.from ??
			current?.from ??
			(typeof node.raw?.props?.valid_from === 'string' ? node.raw.props.valid_from : null)
	);
	// A stub is known only from what cites it: no text, no law. Claiming it as geldend
	// recht would state what the dataset does not hold.
	const stubLabel = $derived.by(() => {
		const d = loaded;
		if (!d) return null;
		const stub = node.raw?.props?.stub === true;
		const empty = !d.instrument && !d.article.text && (d.article.parts?.length ?? 0) === 0;
		if (!stub && !empty) return null;
		const cited = Number(d.metadata?.judgment_count ?? 0);
		return cited > 0
			? `Niet in de gegevens. Genoemd in ${formatCount(cited)} ${plural(cited, 'uitspraak', 'uitspraken')}.`
			: 'Niet in de gegevens.';
	});

	const versionLabel = $derived.by(() => {
		if (stubLabel) return stubLabel;
		if (shown) {
			const from = langeDatum(shown.from);
			const until = langeDatum(shown.until);
			return `Eerdere tekst, ${from || '?'}${until ? ` tot ${until}` : ''}`;
		}
		// An article of a law of the Staatsblad the BWB does not hold yet: enacted, not in force.
		const enacted = enactedLawId(loaded?.article.official_id);
		if (enacted) return enactedLawStatus(enacted);
		const from = langeDatum(validFrom);
		// A repealed article has no geldende tekst: its last version only records the repeal.
		if (loaded?.article.repealed) {
			const date = langeDatum(lapse?.from);
			return date ? `Vervallen per ${date}` : 'Vervallen';
		}
		return from ? `Geldend recht, tekst sinds ${from}` : 'Geldend recht';
	});

	// The dossier(s) whose wetgeving the version on screen made: the fastest way to its
	// memorie van toelichting and to the behandeling it was in.
	// TODO(backend B13): a version from before the dossier collection's coverage names a
	// dossier the API 404s on (e.g. a pre-1990s Kamerstuknummer); the link still renders.
	const versionDossiers = $derived(
		uniqueBy(onScreen?.first.amended_by?.dossiers ?? [], (d) => d.key)
	);
	/** How the wet named under the text relates to it. */
	const originVerb = $derived(
		!onScreen
			? ''
			: onScreen.index > 0
				? 'Gewijzigd bij'
				: onScreen.first.change === 'establishes'
					? 'Vastgesteld bij'
					: onScreen.first.change === 'introduces'
						? 'Ingevoerd bij'
						: 'Tekst uit'
	);

	// The law's names for the citation forms.
	const law = $derived($instrumentMetaStore.get(bwbId) ?? null);
	// The name the article itself gives its law: for an EU act the citation title
	// (Verordening 2022/868/EU), where the instrument carries only its full title in capitals.
	const ownCitationTitle = $derived(
		typeof node.raw?.props?.instrument_citation_title === 'string'
			? node.raw.props.instrument_citation_title
			: null
	);
	const citation = $derived(
		loaded
			? articleCitation(loaded.article, {
					own: ownCitationTitle,
					meta: law,
					displayName: loaded.instrument?.display_name
				})
			: null
	);
	// The link opens the text, not the network: a reader who follows it wants to read.
	const readLink = $derived(
		page.url.origin + withParams(page.url, { lezen: '1' }, { hash: page.url.hash.slice(1) })
	);

	// The official text of the version on screen: wetten.overheid.nl, EUR-Lex or the
	// Verdragenbank, as the API names it.
	const officialUrl = $derived(
		loaded ? (shown?.first.official_url ?? loaded.article.official_url ?? null) : null
	);
	const officialName = $derived(
		officialUrl ? new URL(officialUrl).hostname.replace(/^www\./, '') : null
	);

	// An earlier text is cited as geldend on the day it took effect.
	const forms = $derived(
		citation
			? citeArticle({ ...citation, date: shown?.from ? new Date(shown.from) : undefined })
			: null
	);

	// Bewaar in the head follows the place chosen (#lid-3): that lid, else the whole article.
	const bewaarHier = $derived.by(() => {
		if (!citation || !forms) return null;
		// A definition without a letter is a place too, named by its term (Cbw 1).
		const parts = shownVersion?.parts ?? loaded?.article.parts ?? [];
		const deel = anchor ? placeCitation(anchor, parts) : null;
		const plaats = deel && (deel.lid || deel.onderdelen?.length || deel.definitie) ? anchor! : '';
		const f = plaats ? citeArticle({ ...citation, ...deel }) : forms;
		return {
			item: bewaarItem(
				node.id,
				{ at: plaats, kort: f.kort, voluit: f.voluit },
				{ groep: citation.citationTitle, wet: bwbId }
			),
			wat: deel?.lid ? `lid ${deel.lid}` : ''
		};
	});

	const billsHref = $derived(
		withParams(page.url, {
			...filterParams(filter ?? ({} as VerbondenFilter)),
			bronnen: 'wetsvoorstellen',
			lid: null
		})
	);
	const lidHref = (lid: string) => withParams(page.url, { lid: filter?.lid === lid ? null : lid });

	// A comparison of two tekstversies, named in the URL by the dates they took effect,
	// so a comparison can be cited and shared.
	const compareParam = $derived(page.url.searchParams.get('versies'));
	const comparing = $derived(compareParam !== null && wordings.length > 1);
	// The comparison of two versions is a chunk of its own, asked at the first Vergelijken.
	const versionCompare = new Lazy(
		() => import('$lib/components/articles/VersionCompare.svelte'),
		'Vergelijken'
	);
	$effect(() => {
		if (comparing) versionCompare.load();
	});
	const layout = $derived(page.url.searchParams.get('weergave') === 'naast' ? 'naast' : 'een');
	const compareHref = (from: number, to: number) =>
		withParams(page.url, { versies: `${wordings[from].from ?? ''}..${wordings[to].from ?? ''}` });
	const closeCompareHref = $derived(withParams(page.url, { versies: null, weergave: null }));
	const link = (patch: ParamPatch) => withParams(page.url, patch);
	const go = (patch: ParamPatch) => navigate(link(patch));

	// In the margin of the geldende tekst: when a lid got its present wording, if that was
	// after the oldest tekstversie, leading to that lid's history.
	const lidNotes = $derived.by(() => {
		const notes = new Map<string, { label: string; href: string }>();
		if (comparing || shown || !current || !loaded || wordings.length < 2) return notes;
		for (const unit of unitsOf(loaded.article.text, loaded.article.parts)) {
			if (!unit.number) continue;
			const latest = lidHistory(wordings, unit.number)?.formulations.at(-1);
			if (!latest || latest.since.index === 0) continue;
			notes.set(unit.number, {
				label: `${latest.kind === 'added' ? 'ingevoegd' : 'gewijzigd'} ${latest.since.from?.slice(0, 4) ?? ''}`,
				href: withParams(page.url, { versies: lidAnchor(unit.number) })
			});
		}
		return notes;
	});

	// The proposed wording of a lid, from the mutations of the dossier of the wetsvoorstel.
	let proposed = $state<ProposedText | null>(null);
	let proposedMissing = $state(false);
	$effect(() => {
		proposed = null;
		proposedMissing = false;
		const row = proposedRow;
		if (!row || !loaded) return;
		const ac = new AbortController();
		proposedTextOf(row, loaded.article.id, ac.signal)
			.then((p) => {
				if (ac.signal.aborted) return;
				proposed = p;
				proposedMissing = p === null;
			})
			.catch(() => {
				if (!ac.signal.aborted) proposedMissing = true;
			});
		return () => ac.abort();
	});

	// The article with its heading where the law gives one: "Artikel 22. Verwerking van
	// persoonsgegevens".
	const title = (a: Schema<'ArticleSummaryDTO'>) => {
		// A BW article with its book (Artikel 6:162); an article without a number by its label.
		const name = articleName(a.bwb_id, a.article_number, a.label) ?? a.display_name ?? 'Artikel';
		return a.heading && a.article_number ? `${name}. ${a.heading}` : name;
	};
</script>

<!-- Vorig and Volgend, above the article and again under it. -->
{#snippet steps(noun: string)}
	{#if prevHref}
		<a class="reader-nav-link" href={prevHref} data-sveltekit-noscroll>← Vorig{noun}</a>
	{/if}
	{#if nextHref}
		<a class="reader-nav-link reader-nav-link--next" href={nextHref} data-sveltekit-noscroll
			>Volgend{noun} →</a
		>
	{/if}
{/snippet}

<ReaderFrame state={article.state} what="Artikel" retry={article.retry}>
	{#snippet children({ detail: d })}
		{@const a = d.article}
		{@const placeLine = placeOf(place, d.instrument?.display_name ?? law?.citationTitle)}
		<!-- Wet › hoofdstuk › afdeling stands in the band Behoort bij; the head keeps the heading
		     of the innermost layer only, which the band does not say. -->
		<ReaderHead
			collection="articles"
			juris={ownCitationTitle ?? law?.citationTitle ?? d.instrument?.display_name}
			title={title(a)}
			place={[]}
			placeTitle={placeLine?.title}
			acties={{
				bewaar: bewaarHier?.item ?? null,
				wat: bewaarHier?.wat ?? '',
				cite: forms ? citeItems(forms, readLink) : [],
				naam: forms?.kort ?? '',
				bron: officialUrl && officialName ? { label: officialName, href: officialUrl } : null,
				tekst: () => a.text ?? ''
			}}
			laterPlek
		>
			{#snippet nav()}
				{#if prevHref || nextHref}
					<nav class="reader-nav" aria-label="Artikelen">{@render steps('')}</nav>
				{/if}
			{/snippet}
			{#snippet statusLine()}
				<span class="head__stand" class:is-old={!!shown}>{versionLabel}</span>
				{#if wordings.length > 1}
					<span class="menu" use:menu={{ open: versionMenu, close: () => (versionMenu = false) }}>
						<button
							type="button"
							class="head__version-knop"
							aria-haspopup="menu"
							aria-expanded={versionMenu}
							onclick={() => (versionMenu = !versionMenu)}
							>{wordings.length} tekstversies<Caret open={versionMenu} /></button
						>
						{#if versionMenu}
							<!-- One place for the versions: a row reads that text, its change
						     opens the comparison with the text before it. -->
							<div class="pop pop--versions" role="menu" aria-label="Tekstversies">
								<div class="pop__cols" aria-hidden="true">
									<span>Lezen</span><span>Wat veranderde</span>
								</div>
								{#each [...wordings].reverse() as w (w.index)}
									<div class="pop__row">
										<button
											type="button"
											role="menuitemradio"
											aria-checked={(shownIndex ?? (current ?? lapse)?.index) === w.index}
											class="tekstmenu__item"
											onclick={() => {
												shownIndex = w === current || w === lapse ? null : w.index;
												versionMenu = false;
												// Reading one text folds the comparison away; a text chosen here
												// is no longer that of the peildatum.
												if (comparing || peildatum)
													go({ versies: null, weergave: null, peildatum: null });
											}}
											>{w.lapsed
												? `Vervallen per ${langeDatum(w.from)}`
												: `${w === current ? 'Geldend, sinds ' : ''}${langeDatum(w.from)}${w.until ? ` tot ${langeDatum(w.until)}` : ''}`}</button
										>
										{#if w.index > 0}
											<a
												class="pop__change"
												role="menuitem"
												href={compareHref(w.index - 1, w.index)}
												data-sveltekit-noscroll
												title="Vergelijk met de tekst ervoor"
												onclick={() => (versionMenu = false)}>{w.summary} →</a
											>
										{:else}
											<span class="pop__change pop__change--none">oudste tekst</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</span>
				{:else if versionState?.status === 'error'}
					<LoadState state={versionState} what="De tekstversies" plural retry={article.retry} />
				{/if}
				<!-- Its toelichting, as the last phrase of the status: it comes
				     after the text and fill in without moving it (Orchestrator, 10 Oct). -->
				{#if explanatory && explanatoryHref}
					<a
						class="head__mvt"
						class:is-open={explanatoryOpen}
						href={explanatoryHref}
						data-sveltekit-noscroll
						aria-expanded={explanatoryOpen}
						title={explanatoryOpen
							? 'Sluiten'
							: `${explanatory.title ?? explanatory.kind ?? 'Toelichting'}: onder het artikel lezen`}
						>{explanatory.basis === 'wijziging'
							? 'Memorie van toelichting'
							: (explanatory.kind ?? 'Toelichting')}{explanatory.firstReading
							? ', eerste lezing'
							: ''}<span class="head__mvt-mark" aria-hidden="true"
							>{explanatoryOpen ? '×' : '↓'}</span
						></a
					>
				{/if}
			{/snippet}
			<!-- What is coming comes with Verbonden, after the text: on its own line, kept from
			     the start (ReaderHead laterPlek), so it moves nothing. -->
			{#snippet later()}
				{#if billCount > 0}
					<a class="head__pending" href={billsHref} data-sveltekit-noscroll
						><KindGlyph vorm="voorstel" size={12} />{billCount}
						{plural(billCount, 'wetsvoorstel raakt', 'wetsvoorstellen raken')} dit artikel</a
					>
				{/if}
			{/snippet}
			{#snippet extra()}
				{#if wordings.length > 1}
					<a
						class="btn head__compare"
						class:is-active={comparing}
						aria-expanded={comparing}
						href={comparing
							? closeCompareHref
							: compareHref(Math.max(0, wordings.length - 2), wordings.length - 1)}
						data-sveltekit-noscroll>Vergelijken<Caret open={comparing} /></a
					>
				{/if}
			{/snippet}
			<!-- Where the text came from: the wet that made it, its toelichting, the
				     earlier texts. -->
			{#if versionDossiers.length > 0}
				<div class="head__origin">
					{#if versionDossiers.length > 0}
						<span class="head__item"
							>{originVerb}
							{#each versionDossiers as dossier, i (dossier.key)}{#if i > 0},
								{/if}<DossierLink
									{dossier}
									missing={missingDossiers.has(dossier.number)}
								/>{/each}</span
						>
					{/if}
				</div>
			{/if}
			<ArticleSuccession
				successors={d.successors}
				predecessors={d.predecessors}
				own={{
					citationTitle: d.instrument?.citation_title ?? law?.citationTitle ?? null,
					shortTitle: d.instrument?.abbreviation ?? law?.shortTitle ?? null
				}}
			/>
		</ReaderHead>

		{#if proposedMissing && proposedRow}
			<p class="note">
				De voorgestelde tekst van {proposedRow.title} is niet in de gegevens opgenomen.
				{#if onCloseProposed}<button type="button" class="note__close" onclick={onCloseProposed}
						>Sluiten</button
					>{/if}
			</p>
		{/if}

		{#if shown && !comparing}
			<p class="note note--old">
				Niet de geldende tekst. Deze tekst gold {shown.until
					? `van ${langeDatum(shown.from)} tot ${langeDatum(shown.until)}`
					: `sinds ${langeDatum(shown.from)}`}.
				{#if current}
					<a class="link" href={compareHref(shown.index, current.index)} data-sveltekit-noscroll
						>Vergelijk met de geldende tekst</a
					>
					<button
						type="button"
						class="note__close"
						onclick={() => {
							shownIndex = null;
							if (peildatum) go({ peildatum: null });
						}}>Geldend recht lezen</button
					>
				{/if}
			</p>
		{/if}

		<div class="reader-body" class:reader-body--compare={comparing} bind:this={root}>
			{#if comparing}
				{#if versionCompare.component}
					{@const VersionCompare = versionCompare.component}
					<VersionCompare
						{versions}
						{bwbId}
						{articleNumber}
						param={compareParam ?? ''}
						{layout}
						{citation}
						{link}
						{go}
						{missingDossiers}
					/>
				{:else if versionCompare.error}
					<LoadState
						state={{ status: 'error', error: versionCompare.error }}
						what="De vergelijking"
						form="block"
					/>
				{/if}
			{:else if shown && shownText.state.status !== 'ready'}
				<LoadState state={shownText.state} what="De tekst" form="block" retry={shownText.retry} />
			{:else}
				<ArticleText
					text={shownVersion?.text ?? a.text}
					parts={shownVersion?.parts ?? a.parts}
					citations={shownVersion ? [] : d.citations}
					references={shownVersion ? [] : (d.references ?? [])}
					law={bwbId}
					begrippen={shownVersion ? [] : (d.term_spans ?? [])}
					definities={d.definitions ?? []}
					delegaties={shownVersion ? [] : (d.delegations ?? [])}
					grondslag={() => getDelegated(bwbId, articleNumber)}
					counts={shown ? new Map() : lidCounts}
					tellend={!shown && lidTellend}
					{lidHref}
					{citation}
					bewaar={citation ? { id: node.id, groep: citation.citationTitle, wet: bwbId } : null}
					{proposed}
					{onCloseProposed}
					{lidNotes}
					mark={onderdeelMark(bwbId)}
				/>
			{/if}
		</div>

		{#if prevHref || nextHref}
			<nav class="reader-nav-footer" aria-label="Artikelen">{@render steps(' artikel')}</nav>
		{/if}
	{/snippet}
</ReaderFrame>

<style>
	/* Under the status (ReaderHead): where the text came from, what is coming, each quieter
	   than the one before. */
	.head__origin {
		position: relative;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The text on screen: Geldend recht, tekst sinds 1 juli 2024. */
	.head__stand {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.head__stand.is-old {
		color: var(--ink-2);
	}
	/* The versions as a text menu: the words, a caret, no frame. */
	.head__version-knop {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		height: var(--veld-h-klein);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.head__version-knop:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.head__compare {
		text-decoration: none;
	}
	/* Pressed while the comparison is unfolded. */
	.head__compare.is-active {
		background: var(--paper-2);
		border-color: var(--ink-3);
		color: var(--ink);
	}
	/* Where the text came from, in ink: the wetsgeschiedenis is read, not passed over
	   (Thijs, 10 Oct: the memorie "valt weg"). */
	.head__origin,
	.head__origin a {
		color: var(--ink);
	}
	/* The toelichting and the bills in the status line: phrases in its letter, in ink. */
	.head__mvt,
	.head__pending {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.head__mvt:hover,
	.head__pending:hover {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.head__mvt-mark {
		margin-left: var(--s-1);
		color: var(--ink-3);
	}
	.head__mvt.is-open {
		color: var(--ink);
		font-weight: 600;
	}
	.head__origin a:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	/* The status voorgesteld is the one use of the accent outside links. */
	/* Information, not a warning: in ink, with the sign of a wetsvoorstel (UX 8 Oct). */
	.head__pending {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	/* A popup hangs under its row, from the row's start, so it never runs off the reader. */
	/* The versions' popup hangs from the status line (ReaderHead), not from its words. */
	.menu {
		position: static;
	}
	.pop {
		position: absolute;
		left: 0;
		max-width: 100%;
		top: calc(100% + 6px);
		z-index: var(--z-float);
		width: 340px;
		padding: var(--s-2) 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		font-size: var(--t-micro);
	}
	.pop--versions {
		width: 440px;
	}
	.pop__cols {
		display: flex;
		justify-content: space-between;
		padding: 2px var(--s-3) var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.pop__row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.pop__row .tekstmenu__item {
		flex: 1;
		min-width: 0;
	}
	.pop__change {
		flex: none;
		max-width: 50%;
		padding: var(--s-1) var(--s-3) var(--s-1) 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.pop__change:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.pop__change--none {
		color: var(--ink-3);
	}

	.note {
		margin: 0 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* An earlier text is not the law: said where the text starts, not in a caption. */
	.note--old {
		padding: var(--s-2) var(--s-3);
		border-left: 3px solid var(--ink-3);
		background: var(--paper-2);
		color: var(--ink-2);
	}
	.note--old .link {
		margin-left: var(--s-2);
	}
	.note__close {
		margin-left: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-2);
		cursor: pointer;
	}

	/* The leden hang their own numbers in the frame's margin (ArticleText, ReaderFrame). */
	.reader-body {
		margin-left: 0;
	}
	/* The comparison starts at the edge of the head; its leden keep the article's
	   columns, the number included. */
	.reader-body--compare {
		margin-left: 0;
	}

	/* At the end of the place line; Volgend keeps the right edge, also where Vorig is missing. */
	.reader-nav {
		flex: none;
		display: flex;
		gap: var(--s-3);
		margin-left: auto;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		white-space: nowrap;
	}

	.reader-nav-footer {
		display: flex;
		gap: var(--s-3);
		margin-top: var(--s-6);
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
	}
	.reader-nav-footer .reader-nav-link--next {
		margin-left: auto;
	}

	.reader-nav-link {
		color: var(--ink-3);
	}
	.reader-nav-link:hover {
		color: var(--ink);
	}

	@media (max-width: 900px) {
		.reader-body {
			margin-left: 0;
		}
	}
</style>
