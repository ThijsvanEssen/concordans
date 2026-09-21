<script lang="ts">
	import { onMount } from 'svelte';
	import { modKey } from '$lib/utils/platform';

	// Single source of truth for the section sequence. The TOC, prev/next nav,
	// and active-section indicator all read from this array, so reordering or
	// adding a section is a one-line change.
	type DocSection = {
		id: string;
		sigil: string;
		title: string;
		blurb: string; // shown in the "In deze sectie" summary box and as a TOC tooltip
	};
	const SECTIONS: DocSection[] = [
		{
			id: 'overzicht',
			sigil: '0',
			title: 'Overzicht',
			blurb: 'De onderdelen van deze documentatie.'
		},
		{
			id: 'corpus',
			sigil: 'I',
			title: 'Bronnen & dekking',
			blurb: 'Wetgeving, rechtspraak en parlement. Wat buiten het netwerk valt.'
		},
		{
			id: 'zoeken',
			sigil: 'II',
			title: 'Zoeken',
			blurb: 'Notaties die het zoekveld herkent. Posities in de URL.'
		},
		{
			id: 'verbindingen',
			sigil: 'III',
			title: 'Verbindingen',
			blurb: 'De achttien typen, status en betrouwbaarheid.'
		},
		{
			id: 'dossiers-parlement',
			sigil: 'IV',
			title: 'Dossiers & Parlement',
			blurb: 'Fasen van een dossier, stemmingen, wetgevingsgeschiedenis, tellingen.'
		},
		{
			id: 'api',
			sigil: 'V',
			title: 'API & integratie',
			blurb: 'Programmatische toegang tot het netwerk via de REST-API.'
		},
		{
			id: 'beperkingen',
			sigil: 'VI',
			title: 'Bekende beperkingen',
			blurb: 'Eerste Kamer, EU-recht, actualisering, dekking.'
		},
		{
			id: 'verder-lezen',
			sigil: 'VII',
			title: 'Verder lezen',
			blurb: 'Methode-bijlage, sneltoetsen, API-referentie.'
		}
	];

	// Paginated nav. Only one section is visible at any time. The active
	// section lives in the URL hash so deep links and browser back/forward
	// "just work". No global page-scroll: the page is one viewport tall and
	// the active section scrolls internally if its content overflows.
	let activeId = $state(SECTIONS[0].id);
	const activeIndex = $derived(SECTIONS.findIndex((s) => s.id === activeId));
	const prevSection = $derived(activeIndex > 0 ? SECTIONS[activeIndex - 1] : null);
	const nextSection = $derived(
		activeIndex < SECTIONS.length - 1 ? SECTIONS[activeIndex + 1] : null
	);
	const progress = $derived((activeIndex + 1) / SECTIONS.length);

	function isValidId(id: string): boolean {
		return SECTIONS.some((s) => s.id === id);
	}

	function setSection(id: string, opts: { pushHistory?: boolean } = {}) {
		if (!isValidId(id) || id === activeId) return;
		activeId = id;
		// Bring the panel back to its own top: content can be tall, and the
		// user expects to land at the start of a new section, not midway
		// through where the previous one ended.
		const panel = document.querySelector('.doc-panel');
		if (panel) panel.scrollTo({ top: 0, behavior: 'auto' });
		// Also scroll the window back to the top so the new section's header
		// is in view rather than wherever the previous section ended.
		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'auto' });
		}
		if (opts.pushHistory ?? true) {
			history.pushState(null, '', '#' + id);
		}
	}

	function goPrev() {
		if (prevSection) setSection(prevSection.id);
	}
	function goNext() {
		if (nextSection) setSection(nextSection.id);
	}

	function onTocClick(e: MouseEvent, id: string) {
		e.preventDefault();
		setSection(id);
	}

	onMount(() => {
		// Honour the URL hash on mount.
		const initial = window.location.hash.slice(1);
		if (initial && isValidId(initial)) activeId = initial;

		// Browser back/forward replays the hash through popstate. Pull the
		// section id from there rather than the activeId so we don't push a
		// duplicate state.
		function onPop() {
			const id = window.location.hash.slice(1);
			if (id && isValidId(id)) setSection(id, { pushHistory: false });
			else setSection(SECTIONS[0].id, { pushHistory: false });
		}
		window.addEventListener('popstate', onPop);

		// Keyboard nav: ←/→ flip sections when no input/select has focus.
		function onKey(e: KeyboardEvent) {
			const t = e.target;
			if (
				t instanceof HTMLInputElement ||
				t instanceof HTMLTextAreaElement ||
				t instanceof HTMLSelectElement
			)
				return;
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				goPrev();
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				goNext();
			}
		}
		window.addEventListener('keydown', onKey);

		return () => {
			window.removeEventListener('popstate', onPop);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<svelte:head>
	<title>Documentatie · Concordans</title>
</svelte:head>

<!-- Top progress bar. Reflects section progress (which page of how many),
     not pixel-scroll, because pages are paginated now. -->
<div class="doc-progress" aria-hidden="true">
	<div class="doc-progress__fill" style="transform: scaleX({progress})"></div>
</div>

<div class="page-wrap">
	<div class="container">
		<!-- Inhoudsopgave. Floats as a fixed side-rail on wide viewports
		     (out of document flow); on narrow viewports it sits here, between
		     the page header and the sections, as an inline chip-strip. -->
		<nav class="doc-toc" aria-label="Inhoudsopgave">
			<div class="doc-toc__head">
				Inhoud
				<span class="doc-toc__progress">{activeIndex + 1}/{SECTIONS.length}</span>
			</div>
			<ol class="doc-toc__list">
				{#each SECTIONS as s (s.id)}
					<li class="doc-toc__item" class:doc-toc__item--active={activeId === s.id}>
						<a href={'#' + s.id} title={s.blurb} onclick={(e) => onTocClick(e, s.id)}>
							<span class="doc-toc__sigil">{s.sigil}</span>
							<span class="doc-toc__title">{s.title}</span>
						</a>
					</li>
				{/each}
			</ol>
		</nav>

		<div class="doc-sections">
			<!-- ── 0 Overzicht ──────────────────────────────────────────────── -->
			<section
				class="doc-section doc-section--intro"
				id="overzicht"
				hidden={activeId !== 'overzicht'}
			>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">0</span>
					<h2 class="section-title">Overzicht</h2>
				</div>
				<p class="section-intro">
					Concordans verbindt wetsartikelen, rechterlijke uitspraken, parlementaire documenten en
					wetgevingsdossiers in één doorzoekbaar netwerk.
				</p>

				<ol class="overzicht-list">
					{#each SECTIONS.slice(1) as s (s.id)}
						<li>
							<button type="button" class="overzicht-link" onclick={() => setSection(s.id)}>
								<span class="overzicht-sigil">{s.sigil}</span>
								<span class="overzicht-text">
									<span class="overzicht-title">{s.title}</span>
									<span class="overzicht-blurb">{s.blurb}</span>
								</span>
							</button>
						</li>
					{/each}
				</ol>
			</section>

			<!-- ── I Bronnen & dekking ──────────────────────────────────────── -->
			<section class="doc-section" id="corpus" hidden={activeId !== 'corpus'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">I</span>
					<h2 class="section-title">Bronnen &amp; dekking</h2>
				</div>
				<p class="section-intro">Alle inhoud is afkomstig uit officiële overheidsbronnen.</p>
				<div class="corpus-grid">
					<div class="corpus-item">
						<div class="corpus-item__sigil" aria-hidden="true">§</div>
						<div class="corpus-item__body">
							<div class="corpus-item__name">Wetgeving</div>
							<div class="corpus-item__desc">
								Wetten, AMvB's, ministeriële regelingen en verdragen uit wetten.overheid.nl en de
								Verdragenbank, op twee niveaus opgenomen: het <em>instrument</em> als geheel
								(citeertitel, BWB-id) en de <em>artikelen</em> daarbinnen (volledige tekst),
								verbonden door <em>PART_OF</em>. Eerdere versies zijn eigen bronnen (<em
									>VERSION_OF</em
								>). Publicaties uit het Staatsblad wijzigen instrumenten (<em>AMENDS</em>,
								<em>INTRODUCES</em>, <em>REPEALS</em>).
							</div>
						</div>
					</div>
					<div class="corpus-item">
						<div class="corpus-item__sigil corpus-item__sigil--judgment" aria-hidden="true">¶</div>
						<div class="corpus-item__body">
							<div class="corpus-item__name">Rechterlijke uitspraken</div>
							<div class="corpus-item__desc">
								Uitspraken gepubliceerd op uitspraken.rechtspraak.nl, geïdentificeerd via ECLI, en
								uitspraken van het EHRM uit HUDOC. Een uitspraak verwijst naar artikelen,
								instrumenten en andere uitspraken (<em>REFERS_TO</em>); een uitspraak in hoger
								beroep of cassatie verwijst naar de bestreden uitspraak (<em>APPEAL_OF</em>).
							</div>
						</div>
					</div>
					<div class="corpus-item">
						<div class="corpus-item__sigil corpus-item__sigil--tk" aria-hidden="true">‡</div>
						<div class="corpus-item__body">
							<div class="corpus-item__name">Parlementaire documenten</div>
							<div class="corpus-item__desc">
								Kamerstukken van de Tweede en Eerste Kamer (memories van toelichting, voorstellen
								van wet, amendementen, moties, brieven), gekoppeld aan wetgevingsdossiers. Daarnaast
								zaken, activiteiten, stemmingen, toezeggingen, commissies, Kamerleden en fracties.
							</div>
						</div>
					</div>
				</div>

				<div class="scope-note">
					<strong>Reikwijdte:</strong> het netwerk is gericht op Nederlands recht. Gemeentelijke
					verordeningen en niet-gepubliceerde uitspraken vallen buiten scope. Europese regelgeving
					is opgenomen voor zover Nederlandse regelingen ernaar verwijzen. De
					<a href="/docs/methode">methode-bijlage</a> beschrijft per bron wat wordt opgehaald en hoe verbindingen
					ontstaan.
				</div>
			</section>

			<!-- ── II Zoeken ────────────────────────────────────────────────── -->
			<section class="doc-section" id="zoeken" hidden={activeId !== 'zoeken'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">II</span>
					<h2 class="section-title">Zoeken</h2>
				</div>
				<p class="section-intro">
					Het zoekveld (startpagina en <kbd>{modKey}K</kbd>) doorzoekt instrumenten, artikelen,
					uitspraken, dossiers, documenten, commissies, kamerleden en fracties. Een vindplaats in
					een van deze notaties opent met <kbd>Enter</kbd> de bron zelf.
				</p>
				<div class="search-grid">
					<div class="search-item">
						<div class="search-item__label">ECLI</div>
						<div class="search-item__ex">ECLI:NL:HR:2024:1493</div>
					</div>
					<div class="search-item">
						<div class="search-item__label">Artikel</div>
						<div class="search-item__ex">artikel 287 Sr · art. 6:162 BW</div>
					</div>
					<div class="search-item">
						<div class="search-item__label">Dossiernummer</div>
						<div class="search-item__ex">36327 · 36327-3</div>
					</div>
					<div class="search-item">
						<div class="search-item__label">BWB-id of CELEX-nummer</div>
						<div class="search-item__ex">BWBR0001854 · 32016L0680</div>
					</div>
				</div>

				<h3 class="sub-title">Zoekindex</h3>
				<p class="section-body">
					De zoekindex zoekt op tekstdelen: <em>vordering</em> vindt ook <em>Strafvordering</em>.
					Resultaten zijn niet op relevantie gerangschikt. Een net toegevoegde bron kan kort
					ontbreken.
				</p>

				<h3 class="sub-title">Posities in een tekst</h3>
				<p class="section-body">
					Een positie binnen een tekst is deel van de URL: <code>#lid-2</code>,
					<code>#lid-2-onder-a</code>, <code>#aanhef</code>, <code>#rov-5.3</code>.
				</p>
			</section>

			<!-- ── III Verbindingen ─────────────────────────────────────────── -->
			<section class="doc-section" id="verbindingen" hidden={activeId !== 'verbindingen'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">III</span>
					<h2 class="section-title">Verbindingen</h2>
				</div>
				<p class="section-intro">
					Elke verbinding heeft een van achttien typen. Er is één <em>PART_OF</em> en één
					<em>REFERS_TO</em> voor alle brontypen; de brontypen aan beide uiteinden bepalen om welke soort
					het gaat.
				</p>
				<ul class="reader-list">
					<li>
						<code>PART_OF</code> artikel, bijlage, document of zaak → instrument, zaak of dossier. Onderdeel
						van een geheel.
					</li>
					<li>
						<code>VERSION_OF</code> versie → instrument of artikel. Een gedateerde toestand met een begin-
						en einddatum.
					</li>
					<li>
						<code>AMENDS</code> instrument of document → instrument of artikel. Wijzigt bestaande
						tekst; bij een wetsvoorstel met de status <em>voorgesteld</em>.
					</li>
					<li>
						<code>INTRODUCES</code> instrument of document → instrument of artikel. Voegt een artikel
						of instrument toe.
					</li>
					<li>
						<code>REPEALS</code> instrument of document → instrument of artikel. Trekt een artikel of
						instrument in.
					</li>
					<li>
						<code>BASED_ON</code> instrument → artikel. De rechtsgrond uit de aanhef &ldquo;Gelet op&rdquo;.
					</li>
					<li>
						<code>IMPLEMENTS</code> instrument → instrument. Een nationale regeling die een EU-richtlijn
						implementeert.
					</li>
					<li>
						<code>LEGISLATED_IN</code> instrument → dossier. Het dossier waarin een instrument tot stand
						kwam.
					</li>
					<li>
						<code>REFERS_TO</code> artikel, document of uitspraak → artikel, instrument of uitspraak.
						Een verwijzing; tussen artikelen met een semantisch type.
					</li>
					<li>
						<code>EXPLAINS</code> document → artikelversie, artikel of instrument. De toelichting bij
						een invoering of wijziging.
					</li>
					<li>
						<code>APPEAL_OF</code> uitspraak → uitspraak. Hoger beroep of cassatie tegen de bestreden
						uitspraak.
					</li>
					<li>
						<code>SCOPED_BY</code> artikel → bijlage. De reikwijdte van het artikel volgt uit de bijlage.
					</li>
					<li>
						<code>ABOUT</code> activiteit, stemming of toezegging → zaak of dossier. Het onderwerp.
					</li>
					<li><code>LED_BY</code> activiteit → commissie. De voortouwcommissie.</li>
					<li>
						<code>MADE_IN</code> toezegging → activiteit. De activiteit waarin de toezegging is gedaan.
					</li>
					<li>
						<code>MEMBER_OF</code> kamerlid → commissie of fractie. Lidmaatschap met periode en rol.
					</li>
					<li>
						<code>AUTHORED</code> kamerlid → document of zaak. Ondertekenaar of indiener, met rol.
					</li>
					<li>
						<code>VOTED</code> kamerlid of fractie → stemming. Bij een hoofdelijke stemming per kamerlid,
						anders per fractie.
					</li>
				</ul>
				<p class="section-body">
					Een verwijzing tussen twee artikelen kan een semantisch type dragen: voorwaarde,
					reikwijdtebeperking, procedure, definitie, uitzondering, delegatie of een verwijzing
					zonder nadere aard. Elke verbinding heeft een status: <em>canoniek</em> of
					<em>voorgesteld</em>. Een verbinding die niet uit de structuur van de bron volgt, draagt
					een betrouwbaarheid tussen 0 en 1. De waarde 1 betekent: gelezen uit de bron-XML. De
					<a href="/docs/methode#detectoren">methode-bijlage</a> beschrijft hoe elke verbinding ontstaat.
				</p>
			</section>

			<!-- ── IV Dossiers & Parlement ──────────────────────────────────── -->
			<section
				class="doc-section"
				id="dossiers-parlement"
				hidden={activeId !== 'dossiers-parlement'}
			>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">IV</span>
					<h2 class="section-title">Dossiers &amp; Parlement</h2>
				</div>
				<p class="section-intro">
					Een dossier bevat zaken en documenten. Activiteiten, stemmingen en toezeggingen zijn aan
					een zaak of dossier verbonden. De gegevens van de Tweede Kamer zijn de bron.
				</p>
				<ul class="reader-list">
					<li>
						<strong>Fasen.</strong> Een dossier kent acht fasen: wetsvoorstel, memorie van toelichting,
						advies Raad van State, nota's, verslag, amendementen, stemming, afgehandeld. De huidige fase,
						de doorlopen fasen, het trajecttype (wetsvoorstel, initiatiefwetsvoorstel, begroting, motie,
						overig) en de uitkomst van een gesloten dossier (aangenomen, verworpen, ingetrokken) zijn
						afgeleide gegevens.
					</li>
					<li>
						<strong>Stemmingen.</strong> Een stemming is vastgelegd per fractie, bij een hoofdelijke stemming
						per lid. De stem van een lid bij een niet-hoofdelijke stemming is afgeleid van de fractie
						waartoe het lid op dat moment behoorde.
					</li>
					<li>
						<strong>Personen.</strong> Kamerleden en bewindspersonen zijn opgenomen. Alleen personen zijn
						als ondertekenaar aan een document verbonden. Welke fractie tekende, volgt uit het fractielidmaatschap
						van de ondertekenaar.
					</li>
					<li>
						<strong>Wetgevingsgeschiedenis.</strong> Bij een artikel horen de dossiers die het
						hebben ingevoerd, gewijzigd of ingetrokken, en de dossiers die dat voorstellen (status
						<em>voorgesteld</em>).
					</li>
					<li>
						<strong>In behandeling.</strong> Een artikel is in behandeling wanneer een open dossier een
						voorgestelde wijziging van dat artikel bevat.
					</li>
					<li>
						<strong>Citaties per maand.</strong> De telling per bron omvat de inkomende verbindingen die
						in de gekozen periode aan het netwerk zijn toegevoegd. Bepalend is het moment van opname in
						het netwerk, niet de datum van de verwijzende bron.
					</li>
				</ul>
			</section>

			<!-- ── V API ────────────────────────────────────────────────────── -->
			<section class="doc-section" id="api" hidden={activeId !== 'api'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">V</span>
					<h2 class="section-title">API &amp; integratie</h2>
				</div>
				<p class="section-intro">
					De data in Concordans is beschikbaar via een REST-API. Lezen vraagt geen registratie of
					sleutel. De limiet is 200 verzoeken per minuut per IP-adres; herkomsten op de toegestane
					lijst vallen erbuiten. Bij overschrijding volgt 429 met een Retry-After-header.
				</p>
				<a class="api-cta" href="/api">
					<div class="api-cta__head">
						<span class="api-cta__label">API-referentie</span>
						<span class="api-cta__arrow">→</span>
					</div>
					<div class="api-cta__url"><code>concordans.nl/api</code></div>
					<div class="api-cta__desc">
						Referentie van alle endpoints, parameters en responses, gegenereerd uit de OpenAPI-spec
						van de backend. Gegroepeerd per domein (Instrumenten, Artikelen, Uitspraken, Dossiers,
						…), met het schema van elk antwoord en de sleutel die een route vraagt.
					</div>
				</a>
				<ul class="reader-list">
					<li>
						<strong>Identifiers.</strong> Artikelen via BWB-id + artikelnummer (<code
							>/api/articles/BWBR0001854/140</code
						>), uitspraken via ECLI (<code>/api/judgments/ECLI:NL:HR:2024:1493</code>), dossiers via
						kamerstuknummer (<code>/api/dossiers/36410</code>).
					</li>
					<li>
						<strong>Zoeken.</strong> <code>/api/search?q=…&amp;types=…&amp;limit=…</code>
						geeft gegroepeerde resultaten per type. Herhaal <code>types</code> voor meer dan één
						type (<code>types=articles&amp;types=dossiers</code>). Het <code>limit</code>
						is per type, niet totaal.
					</li>
					<li>
						<strong>Netwerk-queries.</strong>
						<code>/api/nodes/&#123;collection&#125;/&#123;key&#125;</code> geeft een bron met al
						haar buren; <code>…/neighborhood</code> de omgeving binnen <code>depth</code> stappen;
						<code>/api/dossiers/&#123;number&#125;/mutations</code> het wijzigingsnetwerk van een dossier.
					</li>
					<li>
						<strong>Omvang.</strong> <code>/api/stats</code> toont het aantal bronnen per collectie en
						het aantal verbindingen per type.
					</li>
					<li>
						<strong>Sleutels.</strong> Routes die schrijven (een bron volgen, het semantisch type
						van een verbinding vastleggen of erop stemmen) vragen de header <code>X-Write-Key</code>
						of
						<code>X-Curation-Key</code>. De sleutel staat op een server; een browser kan er geen
						bewaren.
					</li>
					<li>
						<strong>Cache.</strong> Artikelen worden 30 minuten gecachet, uitspraken 1 uur, statistieken
						5 minuten en overige antwoorden 60 seconden.
					</li>
				</ul>
				<div class="scope-note">
					Voor grootschalig gebruik of integratievragen graag
					<a href="/contact">contact</a> opnemen. Hogere limieten zijn dan in te richten.
				</div>
			</section>

			<!-- ── VI Bekende beperkingen ───────────────────────────────────── -->
			<section class="doc-section" id="beperkingen" hidden={activeId !== 'beperkingen'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">VI</span>
					<h2 class="section-title">Bekende beperkingen</h2>
				</div>
				<p class="section-intro">
					Het netwerk is fragmentarisch waar de officiële bronnen dat ook zijn, en op punten bewust
					afgebakend.
				</p>

				<div class="limit-grid">
					<article class="limit-card">
						<div class="limit-card__kicker">a · institutioneel</div>
						<h3 class="limit-card__title">Eerste Kamer is beperkt gedekt</h3>
						<p class="limit-card__body">
							Van de Eerste Kamer zijn de Kamerstukken opgenomen, gekoppeld aan het dossier van de
							Tweede Kamer met hetzelfde nummer. Kamerleden, fracties, commissies en stemmingen
							dekken uitsluitend de Tweede Kamer. Behandelingen, stemmingen en moties van de Eerste
							Kamer ontbreken, evenals de doorwerking van senaatsamendementen in de
							wetgevingsgeschiedenis. Voor controle op senaatsbehandeling verwijst <a
								href="https://www.eerstekamer.nl">eerstekamer.nl</a
							>.
						</p>
					</article>

					<article class="limit-card">
						<div class="limit-card__kicker">b · supranationaal</div>
						<h3 class="limit-card__title">EU- en verdragsrecht is dun</h3>
						<p class="limit-card__body">
							Europese richtlijnen en verordeningen zijn opgenomen voor zover Nederlandse regelingen
							ernaar verwijzen; de dekking is niet volledig. Verbindingen tussen Nederlandse en
							Unierechtelijke instrumenten zijn fragmentarisch. Verdragen zijn opgenomen als
							instrument. Van het EHRM zijn uitspraken opgenomen; de dekking van het Hof van
							Justitie is niet betrouwbaar. Voor onderzoek met een EU- of EVRM-component blijven
							<a href="https://eur-lex.europa.eu">eur-lex.europa.eu</a>
							en <a href="https://hudoc.echr.coe.int">hudoc.echr.coe.int</a>
							de primaire bronnen.
						</p>
					</article>

					<article class="limit-card">
						<div class="limit-card__kicker">c · actualisering</div>
						<h3 class="limit-card__title">Geen doorlopende actualisering</h3>
						<p class="limit-card__body">
							Actualisering verloopt in runs per bron, niet doorlopend. Tussen twee runs loopt het
							netwerk achter op de officiële bronnen. De geldigheidsdatum bij een bron is de
							inwerkingtredingsdatum, geen synchronisatiedatum. Een tijdstempel van de laatste run
							is niet beschikbaar.
						</p>
					</article>

					<article class="limit-card">
						<div class="limit-card__kicker">d · dekking</div>
						<h3 class="limit-card__title">Onvolledige belading</h3>
						<p class="limit-card__body">
							De belading is een selectie. Niet alle BWB-instrumenten, niet de volledige
							Rechtspraak.nl-collectie en niet het volledige TK-archief zijn opgenomen. Afwezigheid
							van een resultaat is geen bewijs van afwezigheid in de officiële bronnen.
						</p>
					</article>
				</div>

				<div class="scope-note">
					Fouten of lacunes in de dekking melden via
					<a href="/contact">contact</a>. Bronvermeldingen en concrete vindplaatsen helpen het
					meest.
				</div>
			</section>

			<!-- ── VII Verder lezen ─────────────────────────────────────────── -->
			<section class="doc-section" id="verder-lezen" hidden={activeId !== 'verder-lezen'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">VII</span>
					<h2 class="section-title">Verder lezen</h2>
				</div>
				<div class="further-grid">
					<a href="/docs/methode" class="further-card">
						<div class="further-card__title">Methode &amp; ontwerp</div>
						<div class="further-card__desc">Bronnen, pijplijn, detectoren, afgeleide gegevens</div>
						<span class="further-card__arrow">→</span>
					</a>
					<a href="/docs/sneltoetsen" class="further-card">
						<div class="further-card__title">Sneltoetsen</div>
						<div class="further-card__desc">Zoeken en de drie modi</div>
						<span class="further-card__arrow">→</span>
					</a>
					<a href="/api" class="further-card">
						<div class="further-card__title">API-referentie</div>
						<div class="further-card__desc">OpenAPI-documentatie voor alle endpoints</div>
						<span class="further-card__arrow">→</span>
					</a>
					<a href="/contact" class="further-card">
						<div class="further-card__title">Contact</div>
						<div class="further-card__desc">
							Fouten melden, vragen stellen, samenwerking bespreken
						</div>
						<span class="further-card__arrow">→</span>
					</a>
				</div>
			</section>
		</div>

		<nav class="section-nav" aria-label="Sectie-navigatie">
			{#if prevSection}
				<button type="button" class="section-nav__link" onclick={goPrev}>
					<span class="section-nav__dir">← Vorige</span>
					<span class="section-nav__title"
						><span class="section-nav__sigil">{prevSection.sigil}</span>{prevSection.title}</span
					>
				</button>
			{:else}
				<span class="section-nav__link section-nav__link--placeholder" aria-hidden="true"></span>
			{/if}
			{#if nextSection}
				<button type="button" class="section-nav__link section-nav__link--next" onclick={goNext}>
					<span class="section-nav__dir">Volgende →</span>
					<span class="section-nav__title"
						><span class="section-nav__sigil">{nextSection.sigil}</span>{nextSection.title}</span
					>
				</button>
			{:else}
				<button
					type="button"
					class="section-nav__link section-nav__link--next"
					onclick={() => setSection(SECTIONS[0].id)}
				>
					<span class="section-nav__dir">Terug naar boven ↑</span>
					<span class="section-nav__title"
						><span class="section-nav__sigil">{SECTIONS[0].sigil}</span>{SECTIONS[0].title}</span
					>
				</button>
			{/if}
		</nav>
	</div>
</div>

<style>
	.page-wrap {
		padding: 72px 0 96px;
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 0 32px;
	}

	/* ── Sections ─────────────────────────────────────────────────────────── */
	.doc-sections {
		display: flex;
		flex-direction: column;
		gap: 64px;
	}

	.doc-section {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.section-header {
		display: flex;
		align-items: baseline;
		gap: 14px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--rule);
	}

	.section-sigil {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		color: var(--fg-4);
		min-width: 20px;
	}

	.section-title {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-2);
		margin: 0;
	}

	.section-intro,
	.section-body {
		font-family: var(--font-sans);
		font-size: 14px;
		line-height: 1.75;
		color: var(--fg-1);
		margin: 0;
		max-width: 72ch;
	}

	a {
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
	}

	a:hover {
		border-bottom-color: var(--accent);
	}

	code {
		font-family: var(--font-mono);
		font-size: 12px;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 1px 5px;
		color: var(--ink-2);
	}

	kbd {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-2);
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-radius: 4px;
		padding: 2px 6px;
		white-space: nowrap;
	}

	/* ── Corpus grid ─────────────────────────────────────────────────────── */
	.corpus-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.corpus-item {
		display: flex;
		gap: 14px;
		padding: 16px 18px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		align-items: flex-start;
	}

	.corpus-item__sigil {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 22px;
		line-height: 1;
		color: var(--accent);
		flex-shrink: 0;
		width: 24px;
		text-align: center;
		padding-top: 1px;
	}

	.corpus-item__sigil--judgment {
		color: var(--indigo);
	}

	.corpus-item__sigil--tk {
		color: var(--ink-3);
	}

	.corpus-item__name {
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 500;
		color: var(--ink);
		margin-bottom: 4px;
	}

	.corpus-item__desc {
		font-family: var(--font-sans);
		font-size: 12.5px;
		line-height: 1.55;
		color: var(--fg-3);
	}

	/* ── Scope note ───────────────────────────────────────────────────────── */
	.scope-note {
		padding: 14px 18px;
		background: var(--paper-2);
		border-left: 3px solid var(--rule-strong);
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.65;
		color: var(--fg-2);
		border-radius: 0 var(--r-1) var(--r-1) 0;
	}

	/* ── Intro paragraph ───────────────────────────────────────────── */
	.doc-section--intro .section-intro {
		font-size: 16px;
	}

	/* ── Subsection title ──────── */
	.sub-title {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-2);
		margin: 22px 0 6px;
	}

	/* ── Search grid ──────────────────────────────────────────────────────── */
	.search-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: var(--rule);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}

	.search-item {
		background: var(--paper);
		padding: 14px 18px;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.search-item__label {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-2);
	}

	.search-item__ex {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--fg-3);
	}

	/* ── Overzicht (section 0) ─────────────────────────────────────────── */
	.overzicht-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 28px 0 24px;
		padding: 0;
		list-style: none;
		counter-reset: none;
	}
	.overzicht-list li {
		margin: 0;
		padding: 0;
	}
	.overzicht-link {
		display: flex;
		align-items: baseline;
		gap: 16px;
		width: 100%;
		padding: 14px 16px;
		background: var(--paper);
		border: 1px solid var(--rule);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	.overzicht-link:hover {
		background: var(--paper-2);
		border-color: var(--ink-3);
	}
	.overzicht-sigil {
		flex: 0 0 auto;
		min-width: 36px;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--ink-3);
	}
	.overzicht-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.overzicht-title {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 500;
		color: var(--ink);
	}
	.overzicht-blurb {
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.5;
		color: var(--fg-3);
	}

	.further-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.further-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 18px 44px 18px 18px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		text-decoration: none;
		border-bottom: 1px solid var(--rule);
		color: inherit;
		transition:
			background 80ms,
			border-color 80ms;
	}

	.further-card:hover {
		background: var(--paper-2);
		border-color: var(--rule-strong);
	}

	.further-card__title {
		font-family: var(--font-sans);
		font-size: 13.5px;
		font-weight: 600;
		color: var(--ink);
	}

	.further-card__desc {
		font-family: var(--font-sans);
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--fg-3);
	}

	.further-card__arrow {
		position: absolute;
		top: 18px;
		right: 16px;
		font-size: 14px;
		color: var(--fg-3);
		transition:
			color 80ms,
			transform 80ms;
	}

	.further-card:hover .further-card__arrow {
		color: var(--accent);
		transform: translateX(2px);
	}

	/* ── Bekende beperkingen ───────────────────────────────────────────── */
	.limit-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		margin: 20px 0 24px;
	}
	.limit-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 22px 22px 20px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-top: 3px solid var(--ink);
		position: relative;
	}
	.limit-card__kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-4);
	}
	.limit-card__title {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 500;
		line-height: 1.25;
		color: var(--ink);
		margin: 0;
	}
	.limit-card__body {
		font-family: var(--font-sans);
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--fg-2);
		margin: 0;
	}
	.limit-card__body a {
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.limit-card__body a:hover {
		color: var(--accent);
	}

	/* ── Responsive ───────────────────────────────────────────────────────── */
	@media (max-width: 720px) {
		.corpus-grid,
		.search-grid,
		.limit-grid,
		.further-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Paginated mode: hide non-active sections completely. The hidden
	   attribute also hides from accessibility trees. */
	.doc-section[hidden] {
		display: none !important;
	}

	/* Section-nav buttons styled identically to the previous anchor links. */
	button.section-nav__link {
		font: inherit;
		text-align: inherit;
		cursor: pointer;
	}

	/* Progress shown in the TOC head as N/M */
	.doc-toc__progress {
		float: right;
		font-family: var(--font-mono, monospace);
		font-weight: 400;
		font-size: 9px;
		color: var(--ink-4);
		letter-spacing: 0;
	}

	/* Top progress bar: reflects section number / total. */
	.doc-progress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: transparent;
		z-index: 50;
		pointer-events: none;
	}
	.doc-progress__fill {
		height: 100%;
		background: linear-gradient(90deg, var(--spine) 0%, var(--indigo) 100%);
		transform-origin: left center;
		transform: scaleX(0);
		transition: transform 80ms linear;
	}

	/* Side TOC. Fixed on wide screens, anchored to the right edge of the
	   left gutter so it never overlaps the centered content column (max
	   900px wide). At ≤1280px the breakpoint flips this to an inline chip
	   strip instead. */
	.doc-toc {
		position: fixed;
		top: 96px;
		/* TOC right edge sits 16px left of the content column. Content centre
		   is 50vw; column right edge is 50vw + 450px, so column left edge is
		   50vw - 450px. We anchor the TOC right edge 16px short of that. */
		right: calc(50vw + 450px + 16px);
		width: 180px;
		max-height: calc(100vh - 140px);
		overflow-y: auto;
		padding: 14px 12px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		font-family: var(--font-sans);
		font-size: 12px;
		line-height: 1.4;
		z-index: 20;
		scrollbar-width: thin;
	}
	.doc-toc__head {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3);
		padding: 0 6px 8px;
		border-bottom: 1px solid var(--rule);
		margin-bottom: 6px;
	}
	.doc-toc__list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.doc-toc__item a {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 5px 6px;
		border-radius: 3px;
		color: var(--ink-3);
		text-decoration: none;
		border-left: 2px solid transparent;
		transition:
			color 80ms,
			background 80ms,
			border-color 80ms;
	}
	.doc-toc__item a:hover {
		color: var(--ink);
		background: var(--paper-2);
	}
	.doc-toc__item--active a {
		color: var(--ink);
		background: var(--paper-2);
		border-left-color: var(--spine);
		font-weight: 500;
	}
	.doc-toc__sigil {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 11px;
		color: var(--ink-4);
		min-width: 18px;
	}
	.doc-toc__item--active .doc-toc__sigil {
		color: var(--spine);
	}
	.doc-toc__title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── API call-to-action card (Section VI) ───────────────────────────── */
	.api-cta {
		display: block;
		margin: 14px 0 20px;
		padding: 16px 20px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		text-decoration: none;
		color: inherit;
		transition:
			border-color 100ms,
			background 100ms;
	}
	.api-cta:hover {
		border-color: var(--ink);
		background: var(--paper-2);
	}
	.api-cta__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}
	.api-cta__label {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--spine);
	}
	.api-cta__arrow {
		font-size: 16px;
		color: var(--ink-3);
		transition: transform 100ms;
	}
	.api-cta:hover .api-cta__arrow {
		transform: translateX(3px);
		color: var(--spine);
	}
	.api-cta__url {
		font-family: var(--font-mono, monospace);
		font-size: 14px;
		color: var(--ink);
		margin-bottom: 6px;
	}
	.api-cta__desc {
		font-family: var(--font-serif);
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--fg-2);
	}

	/* ── Feature list ───────────────────────────── */
	.reader-list {
		list-style: none;
		padding: 0;
		margin: 6px 0 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.reader-list li {
		font-family: var(--font-sans);
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--fg-1);
		padding-left: 18px;
		position: relative;
	}
	.reader-list li::before {
		content: '◆';
		position: absolute;
		left: 0;
		top: 0;
		color: var(--ink-4);
		font-size: 10px;
	}

	/* ── Inter-section nav (prev/next) ───────────────────────────────────── */

	.section-nav {
		display: flex;
		gap: 12px;
		margin-top: 58px;
		padding-top: 18px;
		border-top: 1px solid var(--rule);
	}
	.section-nav__link {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 14px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		text-decoration: none;
		color: var(--ink-3);
		transition:
			border-color 80ms,
			background 80ms,
			color 80ms;
	}
	.section-nav__link:hover {
		border-color: var(--rule-strong);
		background: var(--paper-2);
		color: var(--ink);
	}
	.section-nav__link--next {
		text-align: right;
	}
	.section-nav__link--placeholder {
		visibility: hidden;
	}
	.section-nav__dir {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
	}
	.section-nav__title {
		font-family: var(--font-serif);
		font-size: 15px;
		font-weight: 500;
		color: var(--ink);
	}
	.section-nav__sigil {
		font-style: italic;
		color: var(--ink-4);
		margin-right: 6px;
	}

	/* Hide the TOC and back-to-top on narrow viewports; replace TOC with a
	   horizontal chip strip pinned below the page header. */
	@media (max-width: 1300px) {
		.doc-toc {
			position: static;
			width: auto;
			max-height: none;
			max-width: 100%;
			margin: 0 auto 32px;
			padding: 8px 10px;
		}
		.doc-toc__head {
			border-bottom: none;
			padding: 0 6px 6px;
		}
		.doc-toc__list {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 2px 4px;
		}
		.doc-toc__item a {
			padding: 4px 8px;
			border-left: none;
			border-bottom: 2px solid transparent;
			border-radius: 14px;
			background: var(--paper-2);
		}
		.doc-toc__item--active a {
			border-left: none;
			border-bottom-color: var(--spine);
			background: var(--paper);
		}
		.doc-toc__title {
			white-space: normal;
		}
	}
	/* Section nav adapts on narrow viewports. The placeholder hides instead
	   of consuming space, since horizontal flex on tiny screens looks tight. */
	@media (max-width: 540px) {
		.section-nav {
			flex-direction: column;
		}
		.section-nav__link--placeholder {
			display: none;
		}
		.section-nav__link--next {
			text-align: left;
		}
	}
</style>
