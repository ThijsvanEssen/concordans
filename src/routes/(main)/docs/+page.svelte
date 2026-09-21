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
			blurb: 'Wat deze documentatie behandelt en waar te beginnen.'
		},
		{
			id: 'aan-de-slag',
			sigil: 'I',
			title: 'Eerste gebruik',
			blurb: 'Basisnavigatie van de verkenner.'
		},
		{
			id: 'corpus',
			sigil: 'II',
			title: 'Het netwerk',
			blurb: 'De drie domeinen: wetgeving, rechtspraak, parlement, en wat buiten scope valt.'
		},
		{
			id: 'verkenner',
			sigil: 'III',
			title: 'De verkenner',
			blurb: 'De vier modi (Ontdekken, Verdiepen, Lezen, Index), inhoud laden, overlays en filters.'
		},
		{
			id: 'zoeken',
			sigil: 'IV',
			title: 'Zoeken',
			blurb: 'Cmd-K, de zoekpagina en de grenzen van de zoekindex.'
		},
		{
			id: 'verbindingen',
			sigil: 'V',
			title: 'Verbindingen',
			blurb: 'De drie categorieën verbindingen, de achttien verbindingstypen en hun weergave.'
		},
		{
			id: 'dossiers-parlement',
			sigil: 'VI',
			title: 'Dossiers & Parlement',
			blurb:
				'Dossiers, commissies, kamerleden, fracties, stemmingen, wetgevingsgeschiedenis en de Mutatie-overlay.'
		},
		{
			id: 'api',
			sigil: 'VII',
			title: 'API & integratie',
			blurb: 'Programmatische toegang tot het netwerk via de REST-API.'
		},
		{
			id: 'beperkingen',
			sigil: 'VIII',
			title: 'Bekende beperkingen',
			blurb: 'Wat ontbreekt of onvolledig is in de huidige dekking.'
		},
		{
			id: 'verder-lezen',
			sigil: 'IX',
			title: 'Verder lezen',
			blurb: 'Methode-bijlage, sneltoetsen en achtergrondbronnen.'
		}
	];

	// Hemicycle seats — mirrors $lib/components/explore/Hemicycle.svelte
	// ROW_CAPS = [14,17,19,21,24,26,29] = 150. Used in FIG. 02 so the docs
	// figure matches the actual parlement-blok in the sidebar.
	const PARL_ROWS = [14, 17, 19, 21, 24, 26, 29];
	type ParlSeat = { x: number; y: number; band: 'l' | 'c' | 'r' };
	function buildParlSeats(cx: number, cy: number, rInner: number, rOuter: number): ParlSeat[] {
		const rows = PARL_ROWS;
		const seats: ParlSeat[] = [];
		for (let i = 0; i < rows.length; i++) {
			const cap = rows[i];
			const r = rInner + (i * (rOuter - rInner)) / (rows.length - 1);
			for (let j = 0; j < cap; j++) {
				const t = cap === 1 ? 0.5 : j / (cap - 1);
				const angle = Math.PI - t * Math.PI;
				const x = cx + r * Math.cos(angle);
				const y = cy - r * Math.sin(angle);
				const band: 'l' | 'c' | 'r' = t < 0.36 ? 'l' : t > 0.64 ? 'r' : 'c';
				seats.push({ x, y, band });
			}
		}
		return seats;
	}
	const PARL_SEATS_LG = buildParlSeats(110, 102, 44, 96);
	const PARL_SEATS_SM = buildParlSeats(80, 40, 14, 40);

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
		// Bring the panel back to its own top — content can be tall, and the
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
				<p class="section-summary">
					<strong>In deze sectie</strong>Wat de documentatie behandelt en waar te beginnen.
				</p>
				<p class="section-intro">
					Concordans verbindt wetsartikelen, rechterlijke uitspraken, parlementaire documenten en
					wetgevingsdossiers in één doorzoekbaar netwerk. Deze documentatie beschrijft de onderdelen
					in negen secties.
				</p>

				<ol class="overzicht-list">
					<li>
						<button type="button" class="overzicht-link" onclick={() => setSection('aan-de-slag')}>
							<span class="overzicht-sigil">I</span>
							<span class="overzicht-text">
								<span class="overzicht-title">Eerste gebruik</span>
								<span class="overzicht-blurb"
									>Basisnavigatie: topbar, Ontdekken-modus, zijbalk en Verdiepen-modus.</span
								>
							</span>
						</button>
					</li>
					<li>
						<button type="button" class="overzicht-link" onclick={() => setSection('corpus')}>
							<span class="overzicht-sigil">II</span>
							<span class="overzicht-text">
								<span class="overzicht-title">Het netwerk</span>
								<span class="overzicht-blurb"
									>Wetgeving, rechtspraak, parlement en wat erbuiten valt.</span
								>
							</span>
						</button>
					</li>
					<li>
						<button type="button" class="overzicht-link" onclick={() => setSection('verkenner')}>
							<span class="overzicht-sigil">III</span>
							<span class="overzicht-text">
								<span class="overzicht-title">De verkenner</span>
								<span class="overzicht-blurb"
									>Modi, inhoud laden, overlays en filters in detail.</span
								>
							</span>
						</button>
					</li>
					<li>
						<button type="button" class="overzicht-link" onclick={() => setSection('zoeken')}>
							<span class="overzicht-sigil">IV</span>
							<span class="overzicht-text">
								<span class="overzicht-title">Zoeken</span>
								<span class="overzicht-blurb">Het zoekvenster en de grenzen van de zoekindex.</span>
							</span>
						</button>
					</li>
					<li>
						<button type="button" class="overzicht-link" onclick={() => setSection('verbindingen')}>
							<span class="overzicht-sigil">V</span>
							<span class="overzicht-text">
								<span class="overzicht-title">Verbindingen</span>
								<span class="overzicht-blurb">Categorieën, typen en weergave van verbindingen.</span
								>
							</span>
						</button>
					</li>
					<li>
						<button
							type="button"
							class="overzicht-link"
							onclick={() => setSection('dossiers-parlement')}
						>
							<span class="overzicht-sigil">VI</span>
							<span class="overzicht-text">
								<span class="overzicht-title">Dossiers &amp; Parlement</span>
								<span class="overzicht-blurb"
									>Wetgevingsgeschiedenis, commissies, kamerleden, stemmingen.</span
								>
							</span>
						</button>
					</li>
					<li>
						<button type="button" class="overzicht-link" onclick={() => setSection('api')}>
							<span class="overzicht-sigil">VII</span>
							<span class="overzicht-text">
								<span class="overzicht-title">API &amp; integratie</span>
								<span class="overzicht-blurb">Programmatische toegang via de REST-API.</span>
							</span>
						</button>
					</li>
					<li>
						<button type="button" class="overzicht-link" onclick={() => setSection('beperkingen')}>
							<span class="overzicht-sigil">VIII</span>
							<span class="overzicht-text">
								<span class="overzicht-title">Bekende beperkingen</span>
								<span class="overzicht-blurb"
									>Wat ontbreekt: Eerste Kamer, EU-recht, actualisering, dekking.</span
								>
							</span>
						</button>
					</li>
					<li>
						<button type="button" class="overzicht-link" onclick={() => setSection('verder-lezen')}>
							<span class="overzicht-sigil">IX</span>
							<span class="overzicht-text">
								<span class="overzicht-title">Verder lezen</span>
								<span class="overzicht-blurb"
									>Methode-bijlage, sneltoetsen en achtergrondbronnen.</span
								>
							</span>
						</button>
					</li>
				</ol>

				<nav class="section-nav" aria-label="Sectie-navigatie">
					<span class="section-nav__link section-nav__link--placeholder" aria-hidden="true">
						<span class="section-nav__dir">—</span>
						<span class="section-nav__title">—</span>
					</span>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('aan-de-slag')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">I</span>Eerste gebruik</span
						>
					</button>
				</nav>
			</section>

			<!-- ── I Eerste gebruik ──────────────────────────────────────────── -->
			<section
				class="doc-section doc-section--intro"
				id="aan-de-slag"
				hidden={activeId !== 'aan-de-slag'}
			>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">I</span>
					<h2 class="section-title">Eerste gebruik</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>Basisnavigatie van de verkenner: focus, inhoud laden,
					overlays, modi en deelbare URL's.
				</p>
				<p class="section-intro">
					Basisnavigatie van de verkenner. De rest van deze pagina is naslag.
				</p>

				<h3 class="sub-title">De topbar</h3>
				<p class="section-body">
					Bovenaan staat een navigatiebalk met logo, hoofdmenu (Verkenner, Index en Docs) en het
					zoekvenster (<kbd>{modKey}K</kbd>). De sub-balk eronder toont het kruimelpad door het
					netwerk, de geldigheidsdatum en de weergaven Ontdekken, Verdiepen en Lezen op de toetsen
					<kbd>1</kbd> tot <kbd>3</kbd>.
				</p>
				<div class="panel-figs">
					<figure class="panel-fig panel-fig--topbar" data-fig="FIG. 01">
						<svg
							viewBox="0 0 760 260"
							role="img"
							aria-labelledby="panel-topbar-title panel-topbar-desc"
							preserveAspectRatio="xMidYMid meet"
						>
							<title id="panel-topbar-title">De topbar</title>
							<desc id="panel-topbar-desc"
								>Navigatiebalk en sub-balk met genummerde labels boven en onder.</desc
							>

							<!-- ── TOP labels (a Navigatie, b Zoek) ──────────────────────── -->
							<g font-family="var(--font-sans, sans-serif)">
								<!-- a Navigatie -->
								<text
									x="200"
									y="22"
									text-anchor="middle"
									font-size="11"
									font-weight="600"
									fill="var(--ink)">Navigatie</text
								>
								<text x="200" y="38" text-anchor="middle" font-size="9.5" fill="var(--ink-3)"
									>Logo, wordmark en hoofdmenu.</text
								>
								<line
									x1="200"
									y1="71"
									x2="200"
									y2="80"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="200" cy="62" r="9" fill="var(--indigo)" />
								<text
									x="200"
									y="65.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">a</text
								>

								<!-- b Zoek -->
								<text
									x="640"
									y="22"
									text-anchor="middle"
									font-size="11"
									font-weight="600"
									fill="var(--ink)">Zoek ({modKey}K)</text
								>
								<text x="640" y="38" text-anchor="middle" font-size="9.5" fill="var(--ink-3)"
									>Globaal zoeken in het netwerk.</text
								>
								<line
									x1="640"
									y1="71"
									x2="640"
									y2="93"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="640" cy="62" r="9" fill="var(--indigo)" />
								<text
									x="640"
									y="65.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">b</text
								>
							</g>

							<!-- ── TOPBAR (header + sub-toolbar, wrapped at y=80) ───────── -->
							<g transform="translate(0 80)">
								<!-- header bar -->
								<rect
									x="0"
									y="0"
									width="760"
									height="34"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<!-- logo -->
								<g transform="translate(6 1) scale(0.6)">
									<line x1="6" y1="10" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
									<line x1="30" y1="8" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
									<line x1="28" y1="28" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
									<line x1="8" y1="28" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
									<circle
										cx="6"
										cy="10"
										r="2"
										fill="var(--paper)"
										stroke="var(--ink-2)"
										stroke-width="1"
									/>
									<circle cx="30" cy="8" r="2" fill="var(--indigo)" />
									<circle
										cx="28"
										cy="28"
										r="2"
										fill="var(--paper)"
										stroke="var(--ink-2)"
										stroke-width="1"
									/>
									<circle
										cx="8"
										cy="28"
										r="2"
										fill="var(--paper)"
										stroke="var(--ink-2)"
										stroke-width="1"
									/>
									<circle
										cx="18"
										cy="18"
										r="3.6"
										fill="var(--paper)"
										stroke="var(--accent)"
										stroke-width="1.6"
									/>
								</g>
								<line x1="34" y1="6" x2="34" y2="28" stroke="var(--rule)" />
								<text
									x="42"
									y="15"
									font-family="var(--font-serif, Georgia, serif)"
									font-size="11"
									font-weight="500"
									fill="var(--ink)">Concordans</text
								>
								<text
									x="42"
									y="26"
									font-family="var(--font-serif, Georgia, serif)"
									font-size="7.5"
									font-style="italic"
									fill="var(--ink-3)">Het Nederlandse recht als netwerk</text
								>
								<!-- nav -->
								<text
									x="200"
									y="21"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									font-weight="600"
									fill="var(--ink)">Verkenner</text
								>
								<line x1="200" y1="27" x2="247" y2="27" stroke="var(--ink)" stroke-width="1.2" />
								<text
									x="256"
									y="21"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-2)">Index</text
								>
								<text
									x="292"
									y="21"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-2)">Docs</text
								>
								<!-- search -->
								<rect
									x="540"
									y="8"
									width="206"
									height="18"
									rx="2"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="552"
									y="20"
									font-family="var(--font-sans, sans-serif)"
									font-size="9"
									font-style="italic"
									fill="var(--ink-4)">Doorzoek het netwerk</text
								>
								<rect
									x="722"
									y="11"
									width="20"
									height="12"
									rx="2"
									fill="var(--paper-3)"
									stroke="var(--rule)"
								/>
								<text
									x="732"
									y="20"
									font-family="var(--font-mono, monospace)"
									font-size="8"
									fill="var(--ink-3)"
									text-anchor="middle">{modKey}K</text
								>

								<!-- sub-toolbar -->
								<rect
									x="0"
									y="34"
									width="760"
									height="26"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="14"
									y="51"
									font-family="var(--font-sans, sans-serif)"
									font-size="11"
									fill="var(--ink-3)">←</text
								>
								<text
									x="28"
									y="51"
									font-family="var(--font-sans, sans-serif)"
									font-size="11"
									fill="var(--ink-4)">→</text
								>
								<!-- breadcrumb (single text, tspan for monospace) -->
								<text
									x="46"
									y="51"
									font-family="var(--font-sans, sans-serif)"
									font-size="9"
									fill="var(--ink-3)"
									>Wetboek van Strafrecht › Tweede. › XII. Valsheid › <tspan
										font-family="var(--font-mono, monospace)"
										fill="var(--ink)">Art. 234</tspan
									></text
								>
								<!-- geldig + ... -->
								<text
									x="430"
									y="51"
									font-family="var(--font-sans, sans-serif)"
									font-size="9"
									fill="var(--ink-3)">Geldig 1 jan 2026</text
								>
								<text
									x="510"
									y="51"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-3)">…</text
								>
								<!-- weergaven chips (Ontdekken active) -->
								<g font-family="var(--font-sans, sans-serif)" font-size="9">
									<rect
										x="530"
										y="40"
										width="42"
										height="14"
										rx="2"
										fill="var(--ink)"
										stroke="var(--ink)"
									/>
									<text x="542" y="49" fill="var(--paper)">Ontdekken</text>
									<rect x="566" y="42" width="8" height="10" rx="1.5" fill="var(--ink-2)" />
									<text x="570" y="49" fill="var(--paper)" text-anchor="middle">1</text>
									<rect
										x="580"
										y="40"
										width="32"
										height="14"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="589" y="49" fill="var(--ink-2)">Verdiepen</text>
									<rect x="606" y="42" width="8" height="10" rx="1.5" fill="var(--paper-3)" />
									<text x="610" y="49" fill="var(--ink-3)" text-anchor="middle">2</text>
									<rect
										x="620"
										y="40"
										width="34"
										height="14"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="629" y="49" fill="var(--ink-2)">Lezen</text>
									<rect x="648" y="42" width="8" height="10" rx="1.5" fill="var(--paper-3)" />
									<text x="652" y="49" fill="var(--ink-3)" text-anchor="middle">3</text>
								</g>
							</g>

							<!-- ── BOTTOM labels (c Kruimelpad, d Weergaven) ────────────── -->
							<g font-family="var(--font-sans, sans-serif)">
								<!-- c Kruimelpad -->
								<line
									x1="200"
									y1="140"
									x2="200"
									y2="151"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="200" cy="160" r="9" fill="var(--indigo)" />
								<text
									x="200"
									y="163.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">c</text
								>
								<text
									x="200"
									y="188"
									text-anchor="middle"
									font-size="11"
									font-weight="600"
									fill="var(--ink)">Kruimelpad</text
								>
								<text x="200" y="204" text-anchor="middle" font-size="9.5" fill="var(--ink-3)"
									>Pad door het netwerk en geldigheidsdatum.</text
								>

								<!-- d Weergaven -->
								<line
									x1="615"
									y1="140"
									x2="615"
									y2="151"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="615" cy="160" r="9" fill="var(--indigo)" />
								<text
									x="615"
									y="163.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">d</text
								>
								<text
									x="615"
									y="188"
									text-anchor="middle"
									font-size="11"
									font-weight="600"
									fill="var(--ink)">Weergaven</text
								>
								<text x="615" y="204" text-anchor="middle" font-size="9.5" fill="var(--ink-3)"
									>Ontdekken, Verdiepen, Lezen (1–3).</text
								>
							</g>
						</svg>
					</figure>
				</div>

				<h3 class="sub-title">De Ontdekken-modus</h3>
				<p class="section-body">
					In de Ontdekken-modus vult het netwerk de werkruimte. Links de zijbalk met inhoud laden,
					legenda's en het parlement-blok; rechts het canvas met bronnen en hun verbindingen.
					Klikken op een bron verplaatst de focus. Hover over een bron toont een kaart met type,
					vindplaats en de eerste regels.
				</p>
				<div class="panel-figs">
					<figure class="panel-fig panel-fig--graph" data-fig="FIG. 02">
						<svg
							viewBox="0 0 1020 600"
							role="img"
							aria-labelledby="panel-graph-title panel-graph-desc"
							preserveAspectRatio="xMidYMid meet"
						>
							<title id="panel-graph-title">Ontdekken-modus: zijbalk en canvas</title>
							<desc id="panel-graph-desc"
								>Werkruimte in Ontdekken-modus met zijbalk links en canvas rechts; halo en
								hover-kaart bij de gekozen bron.</desc
							>

							<!-- LEFT label: a Zijbalk -->
							<g font-family="var(--font-sans, sans-serif)">
								<text
									x="100"
									y="296"
									font-size="12"
									font-weight="600"
									fill="var(--ink)"
									text-anchor="end">Zijbalk</text
								>
								<text x="100" y="312" font-size="10" fill="var(--ink-3)" text-anchor="end"
									>Inhoud laden,</text
								>
								<text x="100" y="326" font-size="10" fill="var(--ink-3)" text-anchor="end"
									>legenda's, overlays en</text
								>
								<text x="100" y="340" font-size="10" fill="var(--ink-3)" text-anchor="end"
									>het parlement-blok.</text
								>
								<line
									x1="121"
									y1="306"
									x2="130"
									y2="306"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="112" cy="306" r="10" fill="var(--indigo)" />
								<text
									x="112"
									y="310"
									font-size="11"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">a</text
								>
							</g>

							<!-- RIGHT labels: b Hover-kaart, c Canvas en focus -->
							<g font-family="var(--font-sans, sans-serif)">
								<text x="920" y="166" font-size="12" font-weight="600" fill="var(--ink)"
									>Hover-kaart</text
								>
								<text x="920" y="182" font-size="10" fill="var(--ink-3)">Type, vindplaats en</text>
								<text x="920" y="196" font-size="10" fill="var(--ink-3)"
									>eerste regels bij hover.</text
								>
								<line
									x1="890"
									y1="176"
									x2="899"
									y2="176"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="908" cy="176" r="10" fill="var(--indigo)" />
								<text
									x="908"
									y="180"
									font-size="11"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">b</text
								>

								<text x="920" y="416" font-size="12" font-weight="600" fill="var(--ink)"
									>Canvas en focus</text
								>
								<text x="920" y="432" font-size="10" fill="var(--ink-3)">Bronnen als netwerk;</text>
								<text x="920" y="446" font-size="10" fill="var(--ink-3)">halo en donkere kern</text>
								<text x="920" y="460" font-size="10" fill="var(--ink-3)">bij de gekozen bron.</text>
								<line
									x1="890"
									y1="426"
									x2="899"
									y2="426"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="908" cy="426" r="10" fill="var(--indigo)" />
								<text
									x="908"
									y="430"
									font-size="11"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">c</text
								>
							</g>

							<!-- ── BODY: sidebar + canvas (no topbar) ────────────────── -->
							<g transform="translate(130 40)">
								<rect
									x="0"
									y="0"
									width="760"
									height="520"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>

								<!-- SIDEBAR -->
								<rect
									x="0"
									y="0"
									width="150"
									height="520"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="14"
									y="24"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">INHOUD LADEN</text
								>
								<g font-family="var(--font-sans, sans-serif)" font-size="10.5">
									<rect x="14" y="32" width="122" height="18" rx="2" fill="var(--ink)" />
									<text x="22" y="45" fill="var(--paper)">§ Wetten</text>
									<text x="130" y="45" fill="var(--paper-3)" text-anchor="end">≈1067</text>
									<rect x="14" y="52" width="122" height="18" rx="2" fill="var(--ink)" />
									<text x="22" y="65" fill="var(--paper)">ℐ Arresten</text>
									<text x="130" y="65" fill="var(--paper-3)" text-anchor="end">+1059</text>
									<rect x="14" y="72" width="122" height="18" rx="2" fill="var(--ink)" />
									<text x="22" y="85" fill="var(--paper)">ƒ Dossiers</text>
									<text x="130" y="85" fill="var(--paper-3)" text-anchor="end">+10</text>
									<rect
										x="14"
										y="92"
										width="122"
										height="18"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="22" y="105" fill="var(--ink-3)">‡ Commissies</text>
									<text x="130" y="105" fill="var(--ink-4)" text-anchor="end">0</text>
									<rect
										x="14"
										y="112"
										width="122"
										height="18"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="22" y="125" fill="var(--ink-3)">✻ Fracties</text>
									<text x="130" y="125" fill="var(--ink-4)" text-anchor="end">0</text>
									<rect
										x="14"
										y="132"
										width="122"
										height="18"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="22" y="145" fill="var(--ink-3)">● Leden</text>
									<text x="130" y="145" fill="var(--ink-4)" text-anchor="end">0</text>
								</g>
								<text
									x="14"
									y="172"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">BRONNEN</text
								>
								<rect
									x="14"
									y="180"
									width="122"
									height="40"
									fill="var(--paper-2)"
									stroke="var(--rule)"
									stroke-dasharray="2 2"
								/>
								<text
									x="75"
									y="204"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-4)"
									text-anchor="middle">legenda</text
								>
								<text
									x="14"
									y="240"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">VERBINDINGEN</text
								>
								<rect
									x="14"
									y="248"
									width="122"
									height="32"
									fill="var(--paper-2)"
									stroke="var(--rule)"
									stroke-dasharray="2 2"
								/>
								<text
									x="14"
									y="298"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">OVERLAYS</text
								>
								<g font-family="var(--font-sans, sans-serif)" font-size="10">
									<rect x="14" y="306" width="38" height="18" rx="2" fill="var(--ink)" />
									<text x="33" y="319" fill="var(--paper)" text-anchor="middle">Geen</text>
									<rect
										x="54"
										y="306"
										width="40"
										height="18"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="74" y="319" fill="var(--ink-2)" text-anchor="middle">Mutatie</text>
									<rect
										x="96"
										y="306"
										width="40"
										height="18"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="116" y="319" fill="var(--ink-2)" text-anchor="middle">Activ.</text>
								</g>
								<text
									x="14"
									y="346"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">PARLEMENT</text
								>
								<g transform="translate(-5 358)">
									{#each PARL_SEATS_SM as s (s.x + ':' + s.y)}
										<circle
											cx={s.x}
											cy={s.y}
											r="1.2"
											fill={s.band === 'l'
												? 'var(--moss)'
												: s.band === 'r'
													? 'var(--spine)'
													: 'var(--indigo)'}
										/>
									{/each}
								</g>
								<text
									x="75"
									y="416"
									font-family="var(--font-sans, sans-serif)"
									font-size="9"
									fill="var(--ink-4)"
									text-anchor="middle">150 zetels</text
								>
								<g font-family="var(--font-sans, sans-serif)" font-size="9.5" fill="var(--ink-2)">
									<text x="14" y="436">→ Dossiers</text>
									<text x="14" y="450">→ Kamerleden</text>
									<text x="14" y="464">→ Stemmingen</text>
								</g>

								<!-- CANVAS -->
								<rect x="150" y="0" width="610" height="520" fill="var(--paper-2)" />
								<g stroke="var(--ink-4)" stroke-width="0.6" opacity="0.5">
									<line x1="220" y1="170" x2="410" y2="320" />
									<line x1="280" y1="120" x2="410" y2="320" />
									<line x1="200" y1="240" x2="410" y2="320" />
									<line x1="410" y1="320" x2="260" y2="420" />
									<line x1="410" y1="320" x2="350" y2="470" />
									<line x1="410" y1="320" x2="560" y2="440" />
									<line x1="410" y1="320" x2="660" y2="380" />
									<line x1="410" y1="320" x2="690" y2="290" />
									<line x1="200" y1="240" x2="220" y2="400" />
									<line x1="220" y1="400" x2="260" y2="420" />
								</g>
								<line x1="410" y1="320" x2="220" y2="170" stroke="var(--moss)" stroke-width="1" />
								<line
									x1="410"
									y1="320"
									x2="350"
									y2="470"
									stroke="var(--spine)"
									stroke-width="1"
									stroke-dasharray="4 3"
								/>
								<g fill="var(--paper)" stroke="var(--ink-3)" stroke-width="1.2">
									<circle cx="220" cy="170" r="7" />
									<circle cx="280" cy="120" r="6" />
									<circle cx="200" cy="240" r="6" />
									<circle cx="260" cy="420" r="6" />
									<circle cx="350" cy="470" r="6" />
									<circle cx="560" cy="440" r="6" />
									<circle cx="660" cy="380" r="6" />
									<circle cx="690" cy="290" r="7" />
									<circle cx="220" cy="400" r="5" />
								</g>
								<circle
									cx="410"
									cy="320"
									r="26"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.4"
									opacity="0.25"
								/>
								<circle
									cx="410"
									cy="320"
									r="14"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.6"
									opacity="0.4"
								/>
								<circle cx="410" cy="320" r="12" fill="var(--ink)" />

								<!-- hover-card -->
								<rect
									x="500"
									y="80"
									width="240"
									height="146"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<circle
									cx="516"
									cy="100"
									r="4"
									fill="none"
									stroke="var(--ink-2)"
									stroke-width="1.3"
								/>
								<text
									x="528"
									y="103"
									font-family="var(--font-sans, sans-serif)"
									font-size="9"
									letter-spacing="0.14em"
									fill="var(--ink-3)">ARTIKEL</text
								>
								<text
									x="732"
									y="103"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--spine)"
									text-anchor="end">Wetboek van Strafrecht</text
								>
								<text
									x="516"
									y="132"
									font-family="var(--font-serif, Georgia, serif)"
									font-size="17"
									font-weight="500"
									fill="var(--ink)">Art. 234</text
								>
								<g stroke="var(--ink-3)" stroke-width="0.6">
									<line x1="516" y1="148" x2="730" y2="148" />
									<line x1="516" y1="160" x2="724" y2="160" />
									<line x1="516" y1="172" x2="730" y2="172" />
									<line x1="516" y1="184" x2="700" y2="184" />
								</g>
								<line x1="516" y1="198" x2="730" y2="198" stroke="var(--rule)" />
								<g font-family="var(--font-sans, sans-serif)" font-size="10.5">
									<text x="520" y="214" fill="var(--spine)">↪ Openen</text>
									<text x="590" y="214" fill="var(--ink-2)">→ Selecteren</text>
									<text x="680" y="214" fill="var(--ink-3)">★ Pin</text>
								</g>
							</g>
						</svg>
					</figure>
				</div>

				<h3 class="sub-title">De zijbalk in detail</h3>
				<p class="section-body">
					De zijbalk groepeert per functie. Inhoud laden voegt of verwijdert hele klassen bronnen
					tegelijk; bij Wetten kiest een sub-knop tussen artikel- en wetniveau. De legenda's tonen
					vorm en kleur per type bron en lijnkleur per categorie verbinding; de categorieën zijn ook
					in of uit te schakelen. Overlays kleurt het hele netwerk op één dimensie (mutaties of
					activiteit). Onderin staat Parlement, met de zetelverdeling van de Tweede Kamer en
					snelkoppelingen naar dossiers, kamerleden en stemmingen.
				</p>
				<div class="panel-figs">
					<figure class="panel-fig panel-fig--sidebar" data-fig="FIG. 03">
						<svg
							viewBox="0 0 760 460"
							role="img"
							aria-labelledby="panel-sidebar-title panel-sidebar-desc"
							preserveAspectRatio="xMidYMid meet"
						>
							<title id="panel-sidebar-title">Zijbalk in Ontdekken-modus</title>
							<desc id="panel-sidebar-desc"
								>Twee delen van de zijbalk met centrale labels: links de lagen, rechts bronnen,
								verbindingen, overlays en het parlement-blok.</desc
							>

							<defs>
								<marker
									id="side-arr-moss"
									viewBox="0 0 10 10"
									refX="9"
									refY="5"
									markerWidth="6"
									markerHeight="6"
									orient="auto"><path d="M0 1 L9 5 L0 9 z" fill="var(--moss)" /></marker
								>
								<marker
									id="side-arr-spine"
									viewBox="0 0 10 10"
									refX="9"
									refY="5"
									markerWidth="6"
									markerHeight="6"
									orient="auto"><path d="M0 1 L9 5 L0 9 z" fill="var(--spine)" /></marker
								>
								<marker
									id="side-arr-indigo"
									viewBox="0 0 10 10"
									refX="9"
									refY="5"
									markerWidth="6"
									markerHeight="6"
									orient="auto"><path d="M0 1 L9 5 L0 9 z" fill="var(--indigo)" /></marker
								>
							</defs>

							<!-- ── LEFT pane: LAGEN ─────────────────────────────────── -->
							<rect
								x="14"
								y="14"
								width="190"
								height="432"
								fill="var(--paper)"
								stroke="var(--rule)"
							/>
							<text
								x="28"
								y="36"
								font-family="var(--font-sans, sans-serif)"
								font-size="10"
								font-weight="600"
								letter-spacing="0.14em"
								fill="var(--ink-3)">INHOUD LADEN</text
							>
							<g font-family="var(--font-sans, sans-serif)" font-size="11">
								<rect x="28" y="44" width="162" height="22" rx="3" fill="var(--ink)" />
								<text x="40" y="59" fill="var(--paper)">§ Wetten</text>
								<text x="182" y="59" fill="var(--paper-3)" text-anchor="end">≈1067</text>
								<!-- sub-toggle Artikelen / § Wetten -->
								<rect
									x="28"
									y="68"
									width="162"
									height="18"
									rx="3"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<rect x="32" y="70" width="76" height="14" rx="2" fill="var(--ink)" />
								<text x="70" y="80" fill="var(--paper)" text-anchor="middle" font-size="10"
									>ℐ Artikelen</text
								>
								<text x="148" y="80" fill="var(--ink-3)" text-anchor="middle" font-size="10"
									>§ Wetten</text
								>

								<rect x="28" y="92" width="162" height="22" rx="3" fill="var(--ink)" />
								<text x="40" y="107" fill="var(--paper)">ℐ Arresten</text>
								<text x="182" y="107" fill="var(--paper-3)" text-anchor="end">+1059</text>

								<rect x="28" y="118" width="162" height="22" rx="3" fill="var(--ink)" />
								<text x="40" y="133" fill="var(--paper)">ƒ Dossiers</text>
								<text x="182" y="133" fill="var(--paper-3)" text-anchor="end">+10</text>

								<rect
									x="28"
									y="144"
									width="162"
									height="22"
									rx="3"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text x="40" y="159" fill="var(--ink-3)">‡ Commissies</text>
								<text x="182" y="159" fill="var(--ink-4)" text-anchor="end">0</text>

								<rect
									x="28"
									y="170"
									width="162"
									height="22"
									rx="3"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text x="40" y="185" fill="var(--ink-3)">✻ Fracties</text>
								<text x="182" y="185" fill="var(--ink-4)" text-anchor="end">0</text>

								<rect
									x="28"
									y="196"
									width="162"
									height="22"
									rx="3"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text x="40" y="211" fill="var(--ink-3)">● Leden</text>
								<text x="182" y="211" fill="var(--ink-4)" text-anchor="end">0</text>
							</g>

							<!-- ── RIGHT pane: legenda's + parlement ────────────────── -->
							<rect
								x="546"
								y="14"
								width="200"
								height="432"
								fill="var(--paper)"
								stroke="var(--rule)"
							/>

							<!-- BRONNEN -->
							<text
								x="560"
								y="36"
								font-family="var(--font-sans, sans-serif)"
								font-size="10"
								font-weight="600"
								letter-spacing="0.14em"
								fill="var(--ink-3)">BRONNEN</text
							>
							<g font-family="var(--font-sans, sans-serif)" font-size="10" fill="var(--ink-2)">
								<!-- col 1 (x=560..645) -->
								<rect
									x="560"
									y="50"
									width="6"
									height="6"
									fill="var(--ink)"
									transform="rotate(45 563 53)"
								/>
								<text x="572" y="58">Wetgeving</text>
								<circle cx="563" cy="71" r="3.5" fill="var(--spine)" /><text x="572" y="74"
									>Dossier</text
								>
								<circle cx="563" cy="87" r="3.5" fill="var(--ochre)" /><text x="572" y="90"
									>Commissie</text
								>
								<circle cx="563" cy="103" r="3.5" fill="var(--indigo)" /><text x="572" y="106"
									>Fractie</text
								>
								<rect x="559" y="116" width="8" height="8" fill="var(--indigo)" /><text
									x="572"
									y="122">Rechterlijk</text
								>
								<!-- col 2 (x=655..740) -->
								<circle cx="660" cy="55" r="3.5" fill="var(--ink)" /><text x="669" y="58"
									>Artikel</text
								>
								<circle cx="660" cy="71" r="3.5" fill="var(--spine-2)" /><text x="669" y="74"
									>Publicatie</text
								>
								<circle cx="660" cy="87" r="3.5" fill="var(--ochre-2)" /><text x="669" y="90"
									>Activiteit</text
								>
								<circle cx="660" cy="103" r="3.5" fill="var(--indigo-2)" /><text x="669" y="106"
									>Kamerlid</text
								>
							</g>

							<!-- VERBINDINGEN -->
							<text
								x="560"
								y="148"
								font-family="var(--font-sans, sans-serif)"
								font-size="10"
								font-weight="600"
								letter-spacing="0.14em"
								fill="var(--ink-3)">VERBINDINGEN</text
							>
							<g font-family="var(--font-sans, sans-serif)" font-size="10" fill="var(--ink-2)">
								<line
									x1="560"
									y1="162"
									x2="606"
									y2="162"
									stroke="var(--moss)"
									stroke-width="1.4"
									marker-end="url(#side-arr-moss)"
								/>
								<text x="612" y="165">Vaste verwijzing</text>
								<line
									x1="560"
									y1="178"
									x2="606"
									y2="178"
									stroke="var(--spine)"
									stroke-width="1.4"
									marker-end="url(#side-arr-spine)"
								/>
								<text x="612" y="181">Wijziging via Kamer</text>
								<line
									x1="560"
									y1="194"
									x2="606"
									y2="194"
									stroke="var(--indigo)"
									stroke-width="1.4"
									marker-end="url(#side-arr-indigo)"
								/>
								<text x="612" y="197">Inhoudelijk verband</text>
							</g>

							<!-- OVERLAYS -->
							<text
								x="560"
								y="222"
								font-family="var(--font-sans, sans-serif)"
								font-size="10"
								font-weight="600"
								letter-spacing="0.14em"
								fill="var(--ink-3)">OVERLAYS</text
							>
							<g font-family="var(--font-sans, sans-serif)" font-size="10">
								<rect x="560" y="230" width="50" height="18" rx="3" fill="var(--ink)" />
								<text x="585" y="243" fill="var(--paper)" text-anchor="middle">Geen</text>
								<rect
									x="614"
									y="230"
									width="58"
									height="18"
									rx="3"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text x="643" y="243" fill="var(--ink-2)" text-anchor="middle">Mutatie</text>
								<rect
									x="676"
									y="230"
									width="62"
									height="18"
									rx="3"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text x="707" y="243" fill="var(--ink-2)" text-anchor="middle">Activiteit</text>
							</g>

							<!-- PARLEMENT -->
							<text
								x="560"
								y="272"
								font-family="var(--font-sans, sans-serif)"
								font-size="10"
								font-weight="600"
								letter-spacing="0.14em"
								fill="var(--ink-3)">PARLEMENT</text
							>
							<text
								x="650"
								y="272"
								font-family="var(--font-sans, sans-serif)"
								font-size="8"
								font-style="italic"
								fill="var(--ink-4)">experimenteel</text
							>
							<!-- hemicycle — row-caps [14,17,19,21,24,26,29] = 150 -->
							<g transform="translate(536 282)">
								{#each PARL_SEATS_LG as s (s.x + ':' + s.y)}
									<circle
										cx={s.x}
										cy={s.y}
										r="2.2"
										fill={s.band === 'l'
											? 'var(--moss)'
											: s.band === 'r'
												? 'var(--spine)'
												: 'var(--indigo)'}
									/>
								{/each}
							</g>
							<text
								x="646"
								y="400"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-4)"
								text-anchor="middle">150 zetels</text
							>
							<g font-family="var(--font-sans, sans-serif)" font-size="10" fill="var(--ink-2)">
								<text x="560" y="412">→ Dossiers</text>
								<text x="560" y="426">→ Kamerleden</text>
								<text x="560" y="440">→ Stemmingen</text>
							</g>

							<!-- ── CENTER column: labels ─────────────────────────────── -->
							<!-- LEFT-source labels (chip on left of title, leader extends west) -->
							<g font-family="var(--font-sans, sans-serif)">
								<!-- a · Lagen aanzetten -->
								<line
									x1="204"
									y1="55"
									x2="218"
									y2="55"
									stroke="var(--ink-4)"
									stroke-dasharray="2 2"
									stroke-width="0.6"
								/>
								<circle cx="226" cy="55" r="9" fill="var(--indigo)" />
								<text
									x="226"
									y="58.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">a</text
								>
								<text x="240" y="50" font-size="10.5" font-weight="600" fill="var(--ink)"
									>Inhoud laden</text
								>
								<text x="240" y="64" font-size="9.5" fill="var(--ink-3)"
									>Donker = actief. Telling toont aantal in het netwerk.</text
								>

								<!-- b · Granulariteit (source: sub-toggle row at y=77) -->
								<path
									d="M 204 77 L 214 77 L 214 140 L 218 140"
									fill="none"
									stroke="var(--ink-4)"
									stroke-dasharray="2 2"
									stroke-width="0.6"
								/>
								<circle cx="226" cy="140" r="9" fill="var(--indigo)" />
								<text
									x="226"
									y="143.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">b</text
								>
								<text x="240" y="135" font-size="10.5" font-weight="600" fill="var(--ink)"
									>Granulariteit</text
								>
								<text x="240" y="149" font-size="9.5" fill="var(--ink-3)"
									>Wisselt Wetten tussen wet- en artikel-niveau.</text
								>
							</g>

							<!-- RIGHT-source labels (chip on right of title, leader extends east) -->
							<g font-family="var(--font-sans, sans-serif)">
								<!-- c · Bron-legenda -->
								<line
									x1="530"
									y1="86"
									x2="544"
									y2="86"
									stroke="var(--ink-4)"
									stroke-dasharray="2 2"
									stroke-width="0.6"
								/>
								<circle cx="522" cy="86" r="9" fill="var(--indigo)" />
								<text
									x="522"
									y="89.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">c</text
								>
								<text
									x="508"
									y="81"
									font-size="10.5"
									font-weight="600"
									fill="var(--ink)"
									text-anchor="end">Bron-legenda</text
								>
								<text x="508" y="95" font-size="9.5" fill="var(--ink-3)" text-anchor="end"
									>Vorm en kleur per type bron.</text
								>

								<!-- d · Verbindings-legenda -->
								<line
									x1="530"
									y1="178"
									x2="544"
									y2="178"
									stroke="var(--ink-4)"
									stroke-dasharray="2 2"
									stroke-width="0.6"
								/>
								<circle cx="522" cy="178" r="9" fill="var(--indigo)" />
								<text
									x="522"
									y="181.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">d</text
								>
								<text
									x="508"
									y="173"
									font-size="10.5"
									font-weight="600"
									fill="var(--ink)"
									text-anchor="end">Verbindings-legenda</text
								>
								<text x="508" y="187" font-size="9.5" fill="var(--ink-3)" text-anchor="end"
									>Verwijzing, wijziging via Kamer, inhoudelijk verband.</text
								>

								<!-- e · Overlay -->
								<line
									x1="530"
									y1="239"
									x2="544"
									y2="239"
									stroke="var(--ink-4)"
									stroke-dasharray="2 2"
									stroke-width="0.6"
								/>
								<circle cx="522" cy="239" r="9" fill="var(--indigo)" />
								<text
									x="522"
									y="242.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">e</text
								>
								<text
									x="508"
									y="234"
									font-size="10.5"
									font-weight="600"
									fill="var(--ink)"
									text-anchor="end">Overlay</text
								>
								<text x="508" y="248" font-size="9.5" fill="var(--ink-3)" text-anchor="end"
									>Kleurt het netwerk op mutaties of activiteit.</text
								>

								<!-- f · Parlement-blok -->
								<line
									x1="530"
									y1="340"
									x2="544"
									y2="340"
									stroke="var(--ink-4)"
									stroke-dasharray="2 2"
									stroke-width="0.6"
								/>
								<circle cx="522" cy="340" r="9" fill="var(--indigo)" />
								<text
									x="522"
									y="343.5"
									font-size="10"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">f</text
								>
								<text
									x="508"
									y="335"
									font-size="10.5"
									font-weight="600"
									fill="var(--ink)"
									text-anchor="end">Parlement-blok</text
								>
								<text x="508" y="349" font-size="9.5" fill="var(--ink-3)" text-anchor="end"
									>Zetelverdeling Tweede Kamer en snelkoppelingen</text
								>
								<text x="508" y="361" font-size="9.5" fill="var(--ink-3)" text-anchor="end"
									>naar dossiers, kamerleden en stemmingen.</text
								>
							</g>
						</svg>
					</figure>
				</div>

				<h3 class="sub-title">Verdiepen-modus: netwerk en tekst tegelijk</h3>
				<p class="section-body">
					In de Verdiepen-modus staan netwerk, wettekst en citatie-rail naast elkaar. Links een
					compact canvas met het gekozen artikel in focus; in het midden de wettekst met de
					wetgevingsgeschiedenis; rechts een rail met bronnen die naar het artikel verwijzen en het
					citatie-blok (verkort en volledig; bij uitspraken ook vindplaats).
				</p>
				<div class="panel-figs">
					<figure class="panel-fig panel-fig--focus" data-fig="FIG. 04">
						<svg
							viewBox="0 0 1020 600"
							role="img"
							aria-labelledby="panel-focus-title panel-focus-desc"
							preserveAspectRatio="xMidYMid meet"
						>
							<title id="panel-focus-title"
								>Verdiepen-modus: canvas, leespaneel en citeer-rail</title
							>
							<desc id="panel-focus-desc"
								>Werkruimte in split-modus met compact canvas links, leespaneel in het midden en
								citeer-rail rechts.</desc
							>

							<!-- LEFT label: a Canvas met focus -->
							<g font-family="var(--font-sans, sans-serif)">
								<text
									x="100"
									y="296"
									font-size="12"
									font-weight="600"
									fill="var(--ink)"
									text-anchor="end">Canvas met focus</text
								>
								<text x="100" y="312" font-size="10" fill="var(--ink-3)" text-anchor="end"
									>Het gekozen artikel met</text
								>
								<text x="100" y="326" font-size="10" fill="var(--ink-3)" text-anchor="end"
									>halo en donkere kern.</text
								>
								<line
									x1="121"
									y1="306"
									x2="130"
									y2="306"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="112" cy="306" r="10" fill="var(--indigo)" />
								<text
									x="112"
									y="310"
									font-size="11"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">a</text
								>
							</g>

							<!-- TOP label: b Leespaneel -->
							<g font-family="var(--font-sans, sans-serif)">
								<text
									x="500"
									y="14"
									font-size="12"
									font-weight="600"
									fill="var(--ink)"
									text-anchor="middle">Leespaneel</text
								>
								<text x="500" y="30" font-size="10" fill="var(--ink-3)" text-anchor="middle"
									>Wettekst en</text
								>
								<text x="500" y="44" font-size="10" fill="var(--ink-3)" text-anchor="middle"
									>wetgevingsgeschiedenis.</text
								>
								<line
									x1="500"
									y1="79"
									x2="500"
									y2="92"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="500" cy="70" r="10" fill="var(--indigo)" />
								<text
									x="500"
									y="74"
									font-size="11"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">b</text
								>
							</g>

							<!-- RIGHT labels: c Verwijst naar, d Citeer dit -->
							<g font-family="var(--font-sans, sans-serif)">
								<text x="920" y="186" font-size="12" font-weight="600" fill="var(--ink)"
									>Verwijst naar</text
								>
								<text x="920" y="202" font-size="10" fill="var(--ink-3)"
									>Bronnen die dit artikel</text
								>
								<text x="920" y="216" font-size="10" fill="var(--ink-3)">noemen.</text>
								<line
									x1="890"
									y1="196"
									x2="899"
									y2="196"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="908" cy="196" r="10" fill="var(--indigo)" />
								<text
									x="908"
									y="200"
									font-size="11"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">c</text
								>

								<text x="920" y="426" font-size="12" font-weight="600" fill="var(--ink)"
									>Citeer dit</text
								>
								<text x="920" y="442" font-size="10" fill="var(--ink-3)"
									>Verkort en volledig; bij</text
								>
								<text x="920" y="456" font-size="10" fill="var(--ink-3)"
									>uitspraken ook vindplaats.</text
								>
								<line
									x1="890"
									y1="436"
									x2="899"
									y2="436"
									stroke="var(--ink-4)"
									stroke-width="0.6"
									stroke-dasharray="2 2"
								/>
								<circle cx="908" cy="436" r="10" fill="var(--indigo)" />
								<text
									x="908"
									y="440"
									font-size="11"
									font-weight="700"
									fill="var(--paper)"
									text-anchor="middle">d</text
								>
							</g>

							<!-- ── BODY: 3 panes (no topbar) ─────────────────────────── -->
							<g transform="translate(130 90)">
								<rect
									x="0"
									y="0"
									width="760"
									height="490"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>

								<!-- CANVAS (left, 180 wide) -->
								<rect
									x="0"
									y="0"
									width="180"
									height="490"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<rect
									x="10"
									y="10"
									width="50"
									height="16"
									rx="2"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="35"
									y="21"
									font-family="var(--font-sans, sans-serif)"
									font-size="9"
									fill="var(--ink-3)"
									text-anchor="middle">⊟ Filters</text
								>
								<g stroke="var(--ink-4)" stroke-width="0.7" opacity="0.55">
									<line x1="50" y1="170" x2="95" y2="270" />
									<line x1="70" y1="120" x2="95" y2="270" />
									<line x1="35" y1="220" x2="95" y2="270" />
									<line x1="95" y1="270" x2="55" y2="370" />
									<line x1="95" y1="270" x2="150" y2="360" />
									<line x1="95" y1="270" x2="155" y2="210" />
									<line x1="95" y1="270" x2="160" y2="150" />
								</g>
								<line x1="95" y1="270" x2="50" y2="170" stroke="var(--moss)" stroke-width="1" />
								<line
									x1="95"
									y1="270"
									x2="150"
									y2="360"
									stroke="var(--spine)"
									stroke-width="1"
									stroke-dasharray="4 3"
								/>
								<g fill="var(--paper)" stroke="var(--ink-3)" stroke-width="1.2">
									<circle cx="50" cy="170" r="5" />
									<circle cx="70" cy="120" r="4" />
									<circle cx="35" cy="220" r="4" />
									<circle cx="55" cy="370" r="5" />
									<circle cx="150" cy="360" r="5" />
									<circle cx="155" cy="210" r="5" />
									<circle cx="160" cy="150" r="4" />
								</g>
								<circle
									cx="95"
									cy="270"
									r="18"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.3"
									opacity="0.25"
								/>
								<circle
									cx="95"
									cy="270"
									r="10"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.5"
									opacity="0.4"
								/>
								<circle cx="95" cy="270" r="8" fill="var(--ink)" />

								<!-- READER (middle, 380 wide) -->
								<rect
									x="180"
									y="0"
									width="380"
									height="490"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="200"
									y="30"
									font-family="var(--font-sans, sans-serif)"
									font-size="9"
									letter-spacing="0.16em"
									fill="var(--ink-3)">§ ARTIKEL</text
								>
								<rect
									x="498"
									y="20"
									width="16"
									height="16"
									rx="2"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="506"
									y="31"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-3)"
									text-anchor="middle">←</text
								>
								<rect
									x="516"
									y="20"
									width="16"
									height="16"
									rx="2"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="524"
									y="31"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-3)"
									text-anchor="middle">→</text
								>
								<rect
									x="540"
									y="20"
									width="16"
									height="16"
									rx="2"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="548"
									y="32"
									font-family="var(--font-sans, sans-serif)"
									font-size="11"
									fill="var(--ink-3)"
									text-anchor="middle">★</text
								>
								<text
									x="200"
									y="68"
									font-family="var(--font-serif, Georgia, serif)"
									font-size="20"
									font-weight="500"
									fill="var(--ink)">Artikel 234 Sr.</text
								>
								<text
									x="200"
									y="84"
									font-family="var(--font-mono, monospace)"
									font-size="10"
									fill="var(--ink-3)">Art. 234</text
								>
								<g stroke="var(--ink-3)" stroke-width="0.6">
									<line x1="200" y1="108" x2="544" y2="108" />
									<line x1="200" y1="120" x2="538" y2="120" />
									<line x1="200" y1="132" x2="544" y2="132" />
									<line x1="200" y1="144" x2="520" y2="144" />
									<line x1="200" y1="156" x2="544" y2="156" />
									<line x1="200" y1="168" x2="540" y2="168" />
									<line x1="200" y1="180" x2="544" y2="180" />
									<line x1="200" y1="192" x2="500" y2="192" />
									<line x1="200" y1="208" x2="544" y2="208" />
									<line x1="200" y1="220" x2="540" y2="220" />
									<line x1="200" y1="232" x2="544" y2="232" />
									<line x1="200" y1="244" x2="480" y2="244" />
									<line x1="200" y1="260" x2="544" y2="260" />
									<line x1="200" y1="272" x2="544" y2="272" />
									<line x1="200" y1="284" x2="510" y2="284" />
								</g>
								<rect
									x="200"
									y="306"
									width="344"
									height="20"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="210"
									y="320"
									font-family="var(--font-sans, sans-serif)"
									font-size="9"
									letter-spacing="0.14em"
									fill="var(--ink-3)">WETGEVINGSGESCHIEDENIS</text
								>
								<text
									x="536"
									y="320"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-3)"
									text-anchor="end">›</text
								>

								<!-- RAIL (right, 200 wide) -->
								<rect
									x="560"
									y="0"
									width="200"
									height="490"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="574"
									y="30"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									letter-spacing="0.14em"
									fill="var(--ink-3)">VERWIJST NAAR</text
								>
								<text
									x="746"
									y="30"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-2)"
									text-anchor="end">12</text
								>
								<text
									x="574"
									y="50"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-2)">⌄ Deze wet</text
								>
								<text
									x="746"
									y="50"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-3)"
									text-anchor="end">12</text
								>
								<g
									font-family="var(--font-serif, Georgia, serif)"
									font-size="11"
									fill="var(--ink-2)"
								>
									<text x="580" y="72">§ Artikel 225 Sr.</text>
									<text x="580" y="88">§ Artikel 226 Sr.</text>
									<text x="580" y="104">§ Artikel 231 Sr.</text>
									<text x="580" y="120">§ Artikel 231a Sr.</text>
									<text x="580" y="136">§ Artikel 231b Sr.</text>
									<text x="580" y="152">§ Artikel 232 Sr.</text>
									<text x="580" y="168">§ Artikel 310 Sr.</text>
									<text x="580" y="184">§ Artikel 311 Sr.</text>
									<text x="580" y="200">§ Artikel 312 Sr.</text>
								</g>
								<line x1="574" y1="226" x2="746" y2="226" stroke="var(--rule)" />
								<text
									x="574"
									y="246"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									letter-spacing="0.14em"
									fill="var(--ink-3)">CITEER DIT</text
								>
								<g font-family="var(--font-sans, sans-serif)" font-size="9">
									<rect x="574" y="256" width="42" height="16" fill="var(--ink)" />
									<text x="595" y="267" fill="var(--paper)" text-anchor="middle">VERKORT</text>
									<rect
										x="618"
										y="256"
										width="44"
										height="16"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="640" y="267" fill="var(--ink-3)" text-anchor="middle">VOLLEDIG</text>
								</g>
								<rect
									x="574"
									y="296"
									width="172"
									height="24"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="582"
									y="312"
									font-family="var(--font-mono, monospace)"
									font-size="11"
									fill="var(--ink)">Art. 234</text
								>
								<rect
									x="574"
									y="326"
									width="62"
									height="20"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="605"
									y="340"
									font-family="var(--font-sans, sans-serif)"
									font-size="10"
									fill="var(--ink-2)"
									text-anchor="middle">Kopieer</text
								>
							</g>
						</svg>
					</figure>
				</div>

				<h3 class="sub-title">In de praktijk</h3>
				<ol class="tour-steps">
					<li>
						<strong>Begin.</strong> Open <a href="/explore">de verkenner</a>. Het netwerk is bij
						eerste opening leeg. Kies een wetboek, zoals <em>Sr</em> of <em>Awb</em>, of typ
						<kbd>{modKey}K</kbd> en kies een wet, artikel, uitspraak of dossier.
					</li>
					<li>
						<strong>Verschuif de focus.</strong> Klik een bron om de focus te verleggen en het netwerk
						rondom die bron uit te breiden.
					</li>
					<li>
						<strong>Wissel weergave.</strong> Toetsen <kbd>1</kbd> tot
						<kbd>3</kbd> schakelen tussen Ontdekken, Verdiepen en Lezen. Verdiepen toont netwerk en wettekst
						tegelijk. Index staat in het hoofdmenu.
					</li>
					<li>
						<strong>Deel de weergave.</strong> Weergave, focus en overlay staan in de URL. Kopieer de
						link om een weergave te delen.
					</li>
				</ol>
				<h3 class="sub-title">Sneltoetsen</h3>
				<p class="section-body">
					De meest gebruikte toetsen. <a href="/docs/sneltoetsen">Volledige lijst</a>.
				</p>
				<dl class="keys">
					<div class="keys__row">
						<dt><kbd>⌘</kbd><kbd>K</kbd></dt>
						<dd>Open het zoekvenster</dd>
					</div>
					<div class="keys__row">
						<dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt>
						<dd>Wissel tussen Ontdekken, Verdiepen en Lezen</dd>
					</div>
					<div class="keys__row">
						<dt><kbd>←</kbd> <kbd>→</kbd></dt>
						<dd>
							Vorige / volgende focus in de geschiedenis (op deze pagina: vorige / volgende sectie)
						</dd>
					</div>
					<div class="keys__row">
						<dt><kbd>Esc</kbd></dt>
						<dd>Sluit zoekvenster of geopend paneel</dd>
					</div>
					<div class="keys__row">
						<dt><kbd>?</kbd></dt>
						<dd>Open het sneltoetsen-overzicht</dd>
					</div>
				</dl>
				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button type="button" class="section-nav__link" onclick={() => setSection('overzicht')}>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">0</span>Overzicht</span
						>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('corpus')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">II</span>Het netwerk</span
						>
					</button>
				</nav>
			</section>

			<!-- ── I Het corpus ───────────────────────────────────────────────── -->
			<section class="doc-section" id="corpus" hidden={activeId !== 'corpus'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">II</span>
					<h2 class="section-title">Het netwerk</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>De drie domeinen (wetgeving, rechtspraak, parlement) en wat
					buiten scope valt.
				</p>
				<p class="section-intro">
					Het netwerk bestaat uit drie domeinen, dezelfde drie waarop het zoekvenster groepeert.
					Alle inhoud is afkomstig uit officiële overheidsbronnen.
				</p>
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
								<em>INTRODUCES</em>, <em>REPEALS</em>). Op <em>Detail-niveau: Wetten</em> worden artikelen
								samengevouwen tot één cluster per wet.
							</div>
						</div>
					</div>
					<div class="corpus-item">
						<div class="corpus-item__sigil corpus-item__sigil--judgment" aria-hidden="true">¶</div>
						<div class="corpus-item__body">
							<div class="corpus-item__name">Rechterlijke uitspraken</div>
							<div class="corpus-item__desc">
								Uitspraken gepubliceerd op uitspraken.rechtspraak.nl, geïdentificeerd via ECLI, en
								uitspraken van het EHRM uit HUDOC. Gegroepeerd per instantie (Hoge Raad · Hoven
								&amp; RvS · Rechtbanken), zodat het gewicht van een uitspraak direct afleesbaar is.
								Een uitspraak verwijst naar artikelen, instrumenten en andere uitspraken (<em
									>REFERS_TO</em
								>); een uitspraak in hoger beroep of cassatie verwijst naar de bestreden uitspraak (<em
									>APPEAL_OF</em
								>).
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
				<figure class="diagram diagram--corpus">
					<svg
						viewBox="0 0 640 280"
						role="img"
						aria-labelledby="corpus-title corpus-desc"
						preserveAspectRatio="xMidYMid meet"
					>
						<title id="corpus-title">Het netwerk en de verbanden</title>
						<desc id="corpus-desc"
							>Vier brontypen (wetsartikel, uitspraak, instrument, kamerstuk) met representatieve
							verbindingen.</desc
						>
						<!-- background grid hint -->
						<defs>
							<marker
								id="arrow-corpus"
								viewBox="0 0 10 10"
								refX="8"
								refY="5"
								markerWidth="6"
								markerHeight="6"
								orient="auto-start-reverse"
							>
								<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-3)" />
							</marker>
							<marker
								id="arrow-mut"
								viewBox="0 0 10 10"
								refX="8"
								refY="5"
								markerWidth="6"
								markerHeight="6"
								orient="auto-start-reverse"
							>
								<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--spine)" />
							</marker>
							<marker
								id="arrow-cite"
								viewBox="0 0 10 10"
								refX="8"
								refY="5"
								markerWidth="6"
								markerHeight="6"
								orient="auto-start-reverse"
							>
								<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--indigo)" />
							</marker>
						</defs>
						<!-- edges first so they sit behind the nodes -->
						<line
							x1="178"
							y1="140"
							x2="332"
							y2="76"
							stroke="var(--ink-3)"
							stroke-width="1.4"
							marker-end="url(#arrow-corpus)"
						/>
						<text
							x="232"
							y="100"
							font-family="var(--font-serif, Georgia, serif)"
							font-size="11"
							font-style="italic"
							fill="var(--ink-3)">PART_OF</text
						>
						<line
							x1="332"
							y1="204"
							x2="178"
							y2="140"
							stroke="var(--indigo)"
							stroke-width="1.4"
							marker-end="url(#arrow-cite)"
						/>
						<text
							x="220"
							y="184"
							font-family="var(--font-serif, Georgia, serif)"
							font-size="11"
							font-style="italic"
							fill="var(--indigo)">REFERS_TO</text
						>
						<line
							x1="332"
							y1="76"
							x2="488"
							y2="140"
							stroke="var(--ink-3)"
							stroke-width="1.4"
							marker-end="url(#arrow-corpus)"
						/>
						<text
							x="384"
							y="94"
							font-family="var(--font-serif, Georgia, serif)"
							font-size="11"
							font-style="italic"
							fill="var(--ink-3)">LEGISLATED_IN</text
						>
						<line
							x1="488"
							y1="140"
							x2="178"
							y2="140"
							stroke="var(--spine)"
							stroke-width="1.4"
							stroke-dasharray="6 3"
							marker-end="url(#arrow-mut)"
						/>
						<text
							x="296"
							y="134"
							font-family="var(--font-serif, Georgia, serif)"
							font-size="11"
							font-style="italic"
							fill="var(--spine)">AMENDS</text
						>
						<!-- nodes -->
						<!-- artikel (center-left): circle -->
						<g>
							<circle
								cx="178"
								cy="140"
								r="32"
								fill="var(--paper-2)"
								stroke="var(--ink)"
								stroke-width="2"
							/>
							<text
								x="178"
								y="138"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="13"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">Artikel</text
							>
							<text
								x="178"
								y="154"
								font-family="var(--font-sans, sans-serif)"
								font-size="10"
								fill="var(--ink-3)"
								text-anchor="middle">§ 6:162 BW</text
							>
						</g>
						<!-- instrument (top-center): diamond -->
						<g>
							<polygon
								points="332,46 372,76 332,106 292,76"
								fill="var(--paper-2)"
								stroke="var(--ink)"
								stroke-width="2"
							/>
							<text
								x="332"
								y="80"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="12"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">Wet</text
							>
						</g>
						<!-- uitspraak (bottom-center): pentagon-ish -->
						<g>
							<rect
								x="296"
								y="184"
								width="72"
								height="40"
								rx="4"
								fill="var(--paper-2)"
								stroke="var(--ink)"
								stroke-width="2"
							/>
							<text
								x="332"
								y="201"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="12"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">Uitspraak</text
							>
							<text
								x="332"
								y="216"
								font-family="var(--font-mono, monospace)"
								font-size="9"
								fill="var(--ink-3)"
								text-anchor="middle">ECLI</text
							>
						</g>
						<!-- kamerstuk (right): hexagon -->
						<g>
							<polygon
								points="456,140 472,112 504,112 520,140 504,168 472,168"
								fill="var(--paper-2)"
								stroke="var(--spine)"
								stroke-width="2"
							/>
							<text
								x="488"
								y="138"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="12"
								font-weight="600"
								fill="var(--spine)"
								text-anchor="middle">Dossier</text
							>
							<text
								x="488"
								y="154"
								font-family="var(--font-mono, monospace)"
								font-size="9"
								fill="var(--ink-3)"
								text-anchor="middle">36410</text
							>
						</g>
					</svg>
					<figcaption>
						<span class="cap-key"
							><span class="cap-line cap-line--structural"></span>Structureel</span
						>
						<span class="cap-key"><span class="cap-line cap-line--mutation"></span>Wijziging</span>
						<span class="cap-key"><span class="cap-line cap-line--cite"></span>Citatie</span>
					</figcaption>
				</figure>

				<div class="scope-note">
					<strong>Reikwijdte:</strong> het netwerk is gericht op Nederlands recht. Gemeentelijke
					verordeningen en niet-gepubliceerde uitspraken vallen buiten scope. Europese regelgeving
					is opgenomen voor zover Nederlandse regelingen ernaar verwijzen. Zie de
					<a href="/docs/methode">methode-bijlage</a> voor een volledige verantwoording van inclusie-
					en exclusiekeuzes.
				</div>
				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button type="button" class="section-nav__link" onclick={() => setSection('aan-de-slag')}>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">I</span>Eerste gebruik</span
						>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('verkenner')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">III</span>De verkenner</span
						>
					</button>
				</nav>
			</section>

			<!-- ── II De verkenner ────────────────────────────────────────────── -->
			<section class="doc-section" id="verkenner" hidden={activeId !== 'verkenner'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">III</span>
					<h2 class="section-title">De verkenner</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>De drie weergavemodi van de verkenner en de
					zijbalk-onderdelen: lagen, pinnen, overlays, filters.
				</p>
				<p class="section-intro">
					De <a href="/explore">verkenner</a> toont het netwerk interactief. Drie weergavemodi vormen
					een continuüm van structuur-overzicht naar volledige tekst.
				</p>

				<!-- Detail-gradient diagram -->
				<div class="detail-gradient" aria-hidden="true">
					<div class="dg-axis">
						<span class="dg-axis-label dg-axis-left">Structuur</span>
						<span class="dg-axis-arrow">────────────────────────────▶</span>
						<span class="dg-axis-label dg-axis-right">Tekst</span>
					</div>
					<div class="dg-row">
						<div class="dg-col">
							<span class="dg-glyph">◐</span>
							<span class="dg-name">Ontdekken</span>
							<span class="dg-ratio">100% structuur</span>
						</div>
						<div class="dg-col">
							<span class="dg-glyph">◑</span>
							<span class="dg-name">Verdiepen</span>
							<span class="dg-ratio">structuur · tekst · context</span>
						</div>
						<div class="dg-col">
							<span class="dg-glyph">●</span>
							<span class="dg-name">Lezen</span>
							<span class="dg-ratio">100% tekst</span>
						</div>
					</div>
				</div>

				<div class="mode-cards">
					<div class="mode-card">
						<div class="mode-card__head">
							<span class="mode-card__name">Ontdekken</span>
							<kbd>1</kbd>
							<span class="mode-card__url">?mode=graph</span>
						</div>
						<p class="mode-card__desc">
							Vertrekpunt voor verkenning zonder concreet zoekdoel. Bronnen (artikelen, uitspraken,
							dossiers, commissies, kamerleden, fracties) staan in een krachtgerichte layout;
							verbindingen zijn lijnen ertussen. Geen tekst, alleen structuur. Klik een bron om de
							focus te verplaatsen en het netwerk daaromheen uit te breiden. Hover toont een kaart
							met <em>Openen</em>, <em>Selecteren</em> en <em>Pin</em>.
						</p>
						<ul class="mode-card__tips">
							<li>
								Hover over een bron en klik <em>☆ Pin</em> om haar te verankeren; vastgehouden bronnen
								worden niet verdrongen
							</li>
							<li>Scroll om in en uit te zoomen</li>
							<li>
								Filters in de zijbalk: brontypen en de drie categorieën verbindingen (Vaste
								verwijzing · Wijziging via Kamer · Inhoudelijk verband)
							</li>
						</ul>
					</div>

					<div class="mode-card">
						<div class="mode-card__head">
							<span class="mode-card__name">Verdiepen</span>
							<kbd>2</kbd>
							<span class="mode-card__url">?mode=split</span>
						</div>
						<p class="mode-card__desc">
							Weergave voor wie een concreet document voor ogen heeft. Drie panelen naast elkaar:
							netwerk links (compact), volledige wettekst of uitspraak in het midden, citatiespoor
							rechts. Klik een bron in het netwerk om het document te openen. Het citatiespoor toont
							welke bronnen ernaar verwijzen of erdoor worden aangehaald.
						</p>
						<ul class="mode-card__tips">
							<li>Versleep elke kolomscheiding; breedtes worden per sessie onthouden</li>
							<li>
								Wetsartikelen tonen onderaan hun wetgevingsgeschiedenis (welke dossiers ze raakten)
							</li>
							<li>Beschikbaar zodra een bron geselecteerd is</li>
						</ul>
					</div>

					<div class="mode-card">
						<div class="mode-card__head">
							<span class="mode-card__name">Lezen</span>
							<kbd>3</kbd>
							<span class="mode-card__url">?mode=read</span>
						</div>
						<p class="mode-card__desc">
							Weergave voor lectuur van de wettekst of uitspraak zelf. Volledig scherm in
							serif-leeskwaliteit. Inklapbare inhoudsopgave links toont alle artikelen van de
							huidige wet met directe sprong; het citatiespoor rechts blijft beschikbaar voor
							referentie. Onderaan elk artikel staat de wetgevingsgeschiedeniskaart.
						</p>
						<ul class="mode-card__tips">
							<li><em>Verdiepen</em> schakelt terug naar de netwerk-context</li>
							<li>De URL bevat altijd de actieve wet (<code>?wet=BWB…</code>) en is deelbaar</li>
							<li>Beschikbaar zodra een bron geselecteerd is</li>
						</ul>
					</div>
					<div class="mode-card">
						<div class="mode-card__head">
							<span class="mode-card__name">Index</span>
							<kbd>4</kbd>
							<span class="mode-card__url">?mode=index&amp;kind=…</span>
						</div>
						<p class="mode-card__desc">
							Filterbare catalogus per brontype, zonder vertrekpunt in het netwerk. Geschikt voor
							zoeken zonder bekende naam, en voor een eerste verkenning van het netwerk.
						</p>
						<ul class="mode-card__tips">
							<li>
								Categorieën via <code>?kind=</code>: <em>instruments</em>, <em>judgments</em>,
								<em>dossiers</em>, <em>committees</em>, <em>members</em>, <em>factions</em>,
								<em>decisions</em>.
							</li>
							<li>
								Klik een rij om die bron in <em>Verdiepen</em> te openen; het netwerk bouwt zich op rondom
								die bron.
							</li>
							<li>Altijd bereikbaar, ook zonder geselecteerde bron.</li>
						</ul>
					</div>
				</div>

				<h3 class="sub-title">Inhoud laden: brontypen aan- of uitzetten</h3>
				<p class="section-body">
					De linker zijbalk toont onder <em>Inhoud laden</em> één knop per brontype:
					<em>Wetten</em>, <em>Arresten</em>, <em>Dossiers</em>, <em>Commissies</em>,
					<em>Fracties</em>, <em>Leden</em>. Een actieve knop toont het aantal bronnen van dat type
					dat op dit moment in het netwerk staat. Een inactieve knop toont een <em>+N</em>-preview:
					zoveel bronnen komen erbij na klikken. Klikken op een actieve knop vraagt om bevestiging
					voor verwijdering; bronnen zonder verbindingen worden automatisch opgeruimd.
				</p>

				<h3 class="sub-title">Pinnen: een bron verankeren</h3>
				<p class="section-body">
					Hover over een bron en klik <em>☆ Pin</em> in het zweefvenster. Een vastgehouden bron blijft
					staan bij verdere expansie of opschoning van het netwerk. Onderaan de zijbalk staat een lijst
					van alle vastgehouden bronnen met een loslaat-knop.
				</p>

				<h3 class="sub-title">Overlays: signaal op het netwerk</h3>
				<p class="section-body">
					Twee overlays kleuren extra informatie over het netwerk. Ze zijn wederzijds uitsluitend:
					één staat aan, of geen.
				</p>
				<div class="overlay-grid">
					<div class="overlay-card overlay-card--heat">
						<div class="overlay-card__name">Activiteit</div>
						<p class="overlay-card__desc">
							Hitte-halo rondom bronnen op basis van het aantal verbindingen dat in de afgelopen 3,
							6, 12 of 24 maanden is toegevoegd. Een bron met minder dan twee nieuwe verbindingen
							krijgt geen halo. Een zwakke halo duidt op weinig nieuwe verwijzingen, een duidelijke
							halo op actuele belangstelling. URL: <code>?overlay=heat:12</code>.
						</p>
					</div>
					<div class="overlay-card overlay-card--mutatie">
						<div class="overlay-card__name">Mutatie</div>
						<p class="overlay-card__desc">
							Klein gekleurd badge boven bronnen waarvoor een wetsvoorstel aanhangig is. Het cijfer
							toont het aantal voorgestelde wijzigingen. URL: <code>?overlay=open</code>
							voor alle lopende dossiers, of <code>?overlay=dossier:36410</code> voor één dossier.
						</p>
					</div>
				</div>
				<figure class="diagram diagram--overlays">
					<svg
						viewBox="0 0 640 220"
						role="img"
						aria-labelledby="overlay-title overlay-desc"
						preserveAspectRatio="xMidYMid meet"
					>
						<title id="overlay-title">Overlays: Activiteit en Mutatie</title>
						<desc id="overlay-desc"
							>Voorbeeldnetwerk met aan de linker zijde een Activiteit-hitte-halo rond drie bronnen,
							en aan de rechter zijde Mutatie-badges met aantallen open dossiers.</desc
						>
						<!-- divider -->
						<line
							x1="320"
							y1="20"
							x2="320"
							y2="200"
							stroke="var(--rule)"
							stroke-width="1"
							stroke-dasharray="4 4"
						/>
						<text
							x="160"
							y="34"
							font-family="var(--font-sans, sans-serif)"
							font-size="11"
							font-weight="600"
							fill="var(--ink-3)"
							letter-spacing="0.08em"
							text-anchor="middle">ACTIVITEIT</text
						>
						<text
							x="480"
							y="34"
							font-family="var(--font-sans, sans-serif)"
							font-size="11"
							font-weight="600"
							fill="var(--ink-3)"
							letter-spacing="0.08em"
							text-anchor="middle">MUTATIE</text
						>
						<!-- LEFT panel: heat halos -->
						<!-- edges -->
						<line x1="80" y1="100" x2="160" y2="130" stroke="var(--ink-4)" stroke-width="1" />
						<line x1="160" y1="130" x2="240" y2="100" stroke="var(--ink-4)" stroke-width="1" />
						<line x1="160" y1="130" x2="100" y2="180" stroke="var(--ink-4)" stroke-width="1" />
						<line x1="160" y1="130" x2="220" y2="180" stroke="var(--ink-4)" stroke-width="1" />
						<line x1="80" y1="100" x2="100" y2="180" stroke="var(--ink-4)" stroke-width="1" />
						<!-- halos (drawn before nodes so they sit behind) -->
						<!-- hot: large halo -->
						<circle
							cx="160"
							cy="130"
							r="26"
							fill="none"
							stroke="var(--ink)"
							stroke-width="1.5"
							opacity="0.85"
						/>
						<!-- medium halo -->
						<circle
							cx="80"
							cy="100"
							r="18"
							fill="none"
							stroke="var(--ink)"
							stroke-width="1.4"
							opacity="0.55"
						/>
						<!-- faint halo -->
						<circle
							cx="240"
							cy="100"
							r="14"
							fill="none"
							stroke="var(--ink)"
							stroke-width="1.2"
							opacity="0.32"
						/>
						<!-- nodes -->
						<circle
							cx="80"
							cy="100"
							r="7"
							fill="var(--paper)"
							stroke="var(--ink-2)"
							stroke-width="1.4"
						/>
						<circle
							cx="160"
							cy="130"
							r="9"
							fill="var(--paper)"
							stroke="var(--ink-2)"
							stroke-width="1.5"
						/>
						<circle
							cx="240"
							cy="100"
							r="7"
							fill="var(--paper)"
							stroke="var(--ink-2)"
							stroke-width="1.4"
						/>
						<circle
							cx="100"
							cy="180"
							r="6"
							fill="var(--paper)"
							stroke="var(--ink-3)"
							stroke-width="1.2"
						/>
						<circle
							cx="220"
							cy="180"
							r="6"
							fill="var(--paper)"
							stroke="var(--ink-3)"
							stroke-width="1.2"
						/>
						<!-- legend strip -->
						<text
							x="55"
							y="206"
							font-family="var(--font-sans, sans-serif)"
							font-size="9"
							fill="var(--ink-3)">0</text
						>
						<rect x="90" y="200" width="140" height="6" rx="3" fill="url(#heat-gradient)" />
						<text
							x="248"
							y="206"
							font-family="var(--font-sans, sans-serif)"
							font-size="9"
							fill="var(--ink-3)">5+</text
						>
						<defs>
							<linearGradient id="heat-gradient" x1="0" y1="0" x2="1" y2="0">
								<stop offset="0%" stop-color="var(--paper-3)" />
								<stop offset="100%" stop-color="var(--ink)" />
							</linearGradient>
						</defs>
						<!-- RIGHT panel: mutatie badges -->
						<line x1="400" y1="100" x2="480" y2="130" stroke="var(--ink-4)" stroke-width="1" />
						<line x1="480" y1="130" x2="560" y2="100" stroke="var(--ink-4)" stroke-width="1" />
						<line x1="480" y1="130" x2="420" y2="180" stroke="var(--ink-4)" stroke-width="1" />
						<line x1="480" y1="130" x2="540" y2="180" stroke="var(--ink-4)" stroke-width="1" />
						<line x1="400" y1="100" x2="420" y2="180" stroke="var(--ink-4)" stroke-width="1" />
						<!-- nodes -->
						<circle
							cx="400"
							cy="100"
							r="7"
							fill="var(--paper)"
							stroke="var(--ink-2)"
							stroke-width="1.4"
						/>
						<circle
							cx="480"
							cy="130"
							r="9"
							fill="var(--paper)"
							stroke="var(--ink-2)"
							stroke-width="1.5"
						/>
						<circle
							cx="560"
							cy="100"
							r="7"
							fill="var(--paper)"
							stroke="var(--ink-2)"
							stroke-width="1.4"
						/>
						<circle
							cx="420"
							cy="180"
							r="6"
							fill="var(--paper)"
							stroke="var(--ink-3)"
							stroke-width="1.2"
						/>
						<circle
							cx="540"
							cy="180"
							r="6"
							fill="var(--paper)"
							stroke="var(--ink-3)"
							stroke-width="1.2"
						/>
						<!-- mutatie badges on three of the nodes -->
						<!-- node @ (400,100): single dossier -->
						<circle
							cx="405"
							cy="95"
							r="5"
							fill="var(--spine)"
							stroke="var(--paper)"
							stroke-width="1.4"
						/>
						<!-- node @ (480,130): multiple dossiers (count badge "3") -->
						<rect
							x="484"
							y="118"
							width="18"
							height="11"
							rx="5.5"
							fill="var(--spine-2)"
							stroke="var(--paper)"
							stroke-width="1.4"
						/>
						<text
							x="493"
							y="126"
							font-family="var(--font-sans, sans-serif)"
							font-size="8"
							font-weight="700"
							fill="var(--paper)"
							text-anchor="middle">3</text
						>
						<!-- node @ (540,180): single dossier -->
						<circle
							cx="544"
							cy="176"
							r="4"
							fill="var(--spine)"
							stroke="var(--paper)"
							stroke-width="1.2"
						/>
						<!-- legend strip -->
						<g transform="translate(380, 200)">
							<circle
								cx="6"
								cy="3"
								r="4"
								fill="var(--spine)"
								stroke="var(--paper)"
								stroke-width="1.2"
							/>
							<text
								x="16"
								y="7"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-3)">1 wijziging</text
							>
							<rect
								x="80"
								y="-2"
								width="14"
								height="9"
								rx="4.5"
								fill="var(--spine-2)"
								stroke="var(--paper)"
								stroke-width="1.2"
							/>
							<text
								x="86.5"
								y="5"
								font-family="var(--font-sans, sans-serif)"
								font-size="7"
								font-weight="700"
								fill="var(--paper)"
								text-anchor="middle">N</text
							>
							<text
								x="100"
								y="7"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-3)">meerdere wijzigingen</text
							>
						</g>
					</svg>
					<figcaption>
						<span class="cap-key"
							>Activiteit toont recent toegevoegde verbindingen als hitte-halo rondom de bron.</span
						>
						<span class="cap-key"
							>Mutatie toont open wetsvoorstellen als badge rechtsboven de bron.</span
						>
					</figcaption>
				</figure>

				<h3 class="sub-title">Filters: wat is zichtbaar</h3>
				<p class="section-body">
					Onder <em>Filters</em> staan de drie verbindingscategorieën als schakelaar:
					<em>Vaste verwijzing</em> (structureel), <em>Wijziging via Kamer</em> (wijziging) en
					<em>Inhoudelijk verband</em> (citatie). De bronnen blijven staan; alleen de getekende lijnen
					veranderen.
				</p>

				<h3 class="sub-title">Detail-niveau: Wetten of Artikelen</h3>
				<p class="section-body">
					Bij <em>Wetten</em> onder <em>Inhoud laden</em> staat een tweestandige schakelaar:
					<em>Artikelen</em> / <em>Wetten</em>. In <em>Artikelen</em> verschijnt elk wetsartikel als
					eigen bron (standaardweergave). In <em>Wetten</em> worden artikelen samengevouwen tot één bron
					per wet. Geschikt voor een overzicht van de verbindingen tussen wetten. De labels boven elk
					wet-cluster blijven zichtbaar zolang het beeld niet sterk is ingezoomd.
				</p>

				<h3 class="sub-title">Citatiespoor: wie verwijst naar wat</h3>
				<p class="section-body">
					In <em>Verdiepen</em>-modus verschijnt rechts naast de wettekst een derde kolom: het
					citatiespoor. Het toont per geselecteerde bron waar de bron naar verwijst (<em
						>Verwijst naar</em
					>) en welke bronnen ernaar verwijzen (<em>Aangehaald door</em>), gegroepeerd per wet. Klik
					op een rij om die bron te focussen; netwerk en wettekst springen mee.
				</p>

				<h3 class="sub-title">Wettekst-paneel: wat zit erin</h3>
				<p class="section-body">
					Het leespaneel toont per brontype een eigen weergave. Voor wetsartikelen:
				</p>
				<ul class="reader-list">
					<li>De volledige wettekst.</li>
					<li>
						Een <em>In behandeling</em>-label met het aantal open dossiers, bij aanhangige
						wetsvoorstellen die dit artikel beogen te wijzigen.
					</li>
					<li>
						Een wetgevingsgeschiedenis-kaart onderaan: alle dossiers die dit artikel hebben
						gewijzigd of voorgesteld te wijzigen, met datum en status.
					</li>
				</ul>

				<h3 class="sub-title">Index-modus: bronnen bladeren</h3>
				<p class="section-body">
					Naast Ontdekken / Verdiepen / Lezen kent de verkenner een vierde weergave:
					<em>Index</em> (URL: <code>?mode=index&amp;kind=dossiers</code>). Geen netwerk, maar een
					filterbare lijst per brontype. Geschikt voor verkenning zonder vertrekpunt en voor zoeken
					naar een bron zonder bekende naam. Een klik op een rij opent die bron in
					<em>Verdiepen</em>.
				</p>
				<p class="section-body">De index telt zeven categorieën, elk met eigen filters:</p>
				<ul class="reader-list">
					<li>
						<a href="/explore?mode=index&amp;kind=instruments"><code>?kind=instruments</code></a>:
						wet- en regelgeving (BWB). Filter op jurisdictie en soort regeling.
					</li>
					<li>
						<a href="/explore?mode=index&amp;kind=judgments"><code>?kind=judgments</code></a>:
						jurisprudentie. Filter op instantie (cassatie, hof, rechtbank) en periode.
					</li>
					<li>
						<a href="/explore?mode=index&amp;kind=dossiers"><code>?kind=dossiers</code></a>:
						kamerstukdossiers. Filter op huidige fase (<code>?stage=</code>), op fase ooit doorlopen
						(<code>?has_stage=</code>) of op trajecttype (<code>?track=</code>).
					</li>
					<li>
						<a href="/explore?mode=index&amp;kind=committees"><code>?kind=committees</code></a>:
						vaste en tijdelijke commissies, met telling van lopende dossiers.
					</li>
					<li>
						<a href="/explore?mode=index&amp;kind=members"><code>?kind=members</code></a>: leden van
						de Tweede Kamer. Filter op partij (<code>?party=</code>).
					</li>
					<li>
						<a href="/explore?mode=index&amp;kind=factions"><code>?kind=factions</code></a>:
						fracties, met zetelaantallen en partijkleur.
					</li>
					<li>
						<a href="/explore?mode=index&amp;kind=decisions"><code>?kind=decisions</code></a>:
						plenaire stemmingen. Filter op uitslag (<code>?passed=</code>), partij en periode (<code
							>?from=</code
						>, <code>?to=</code>).
					</li>
				</ul>

				<h3 class="sub-title">Deelbare URL</h3>
				<p class="section-body">
					Een weergave delen gebeurt via de URL. Modus, focus, overlay en de keuze om alle bronnen
					van een uitbreiding te tonen (<code>all</code>) zijn erin opgenomen. Het netwerk wordt bij
					de ontvanger opnieuw opgebouwd rond de focus. Voorbeelden:
				</p>
				<ul class="reader-list">
					<li>
						<code>/explore?focus=articles/bwbr0001854_140&amp;mode=split</code>
						(art. 140 Sr geopend in Verdiepen-modus).
					</li>
					<li>
						<code>/explore?focus=dossiers/36281&amp;overlay=dossier:36281</code>
						(dossier 36281 in het netwerk, met Mutatie-overlay aan).
					</li>
					<li><code>/explore?mode=index&amp;kind=members</code> (index van kamerleden).</li>
				</ul>

				<div class="scope-note scope-note--tip">
					<strong>Deelbare URL:</strong> modus, geselecteerde bron, actieve wet en overlay staan in
					de URL. De <em>Deel</em>-knop in de statusbalk kopieert de link.
				</div>
				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button type="button" class="section-nav__link" onclick={() => setSection('corpus')}>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">II</span>Het netwerk</span
						>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('zoeken')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"><span class="section-nav__sigil">IV</span>Zoeken</span>
					</button>
				</nav>
			</section>

			<!-- ── III Zoeken ─────────────────────────────────────────────────── -->
			<section class="doc-section" id="zoeken" hidden={activeId !== 'zoeken'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">IV</span>
					<h2 class="section-title">Zoeken</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>Het zoekvenster, de groepering van resultaten en de
					patronen die de zoekindex herkent.
				</p>
				<p class="section-intro">
					Vanaf elke pagina opent <kbd>{modKey}K</kbd> het zoekvenster. Het doorzoekt instrumenten, artikelen,
					uitspraken, dossiers, documenten, commissies, kamerleden en fracties via een volledige-tekstindex.
				</p>
				<div class="search-grid">
					<div class="search-item">
						<div class="search-item__label">Op wettekst</div>
						<div class="search-item__ex">"aansprakelijkheid onrechtmatige daad"</div>
					</div>
					<div class="search-item">
						<div class="search-item__label">Op ECLI-nummer</div>
						<div class="search-item__ex">"ECLI:NL:HR:2024:1"</div>
					</div>
					<div class="search-item">
						<div class="search-item__label">Op citeertitel</div>
						<div class="search-item__ex">"Huisvestingswet 2014"</div>
					</div>
					<div class="search-item">
						<div class="search-item__label">Op dossiernummer of titel</div>
						<div class="search-item__ex">"36831", "Klimaatwet"</div>
					</div>
				</div>

				<div class="search-mock-frame" aria-hidden="true">
					<!-- Faded page silhouette beneath, with a dim backdrop, conveying
					     that the cmd-K modal pops over your current screen. -->
					<div class="search-mock-frame__page">
						<div class="search-mock-frame__bar"></div>
						<div class="search-mock-frame__col search-mock-frame__col--left">
							<div class="search-mock-frame__line"></div>
							<div class="search-mock-frame__line search-mock-frame__line--short"></div>
							<div class="search-mock-frame__line"></div>
							<div class="search-mock-frame__line"></div>
							<div class="search-mock-frame__line search-mock-frame__line--short"></div>
						</div>
						<div class="search-mock-frame__col search-mock-frame__col--right">
							<div class="search-mock-frame__h"></div>
							<div class="search-mock-frame__line"></div>
							<div class="search-mock-frame__line"></div>
							<div class="search-mock-frame__line search-mock-frame__line--short"></div>
							<div class="search-mock-frame__line"></div>
							<div class="search-mock-frame__line"></div>
							<div class="search-mock-frame__line search-mock-frame__line--short"></div>
						</div>
					</div>
					<div class="search-mock-frame__backdrop"></div>
					<div class="search-mock">
						<div class="search-mock__chrome">
							<div class="search-mock__kbd"><kbd>{modKey}K</kbd></div>
							<div class="search-mock__input">huisvestingswet</div>
							<div class="search-mock__count">31</div>
						</div>
						<div class="search-mock__chips">
							<span class="search-mock__chip search-mock__chip--on">Wet</span>
							<span class="search-mock__chip search-mock__chip--on">Rechtspraak</span>
							<span class="search-mock__chip search-mock__chip--on">Parlementair</span>
						</div>
						<div class="search-mock__body">
							<div class="search-mock__domain">
								<div class="search-mock__head"><span class="domain__glyph">§</span>Wetgeving</div>
								<div class="search-mock__sub">Instrumenten</div>
								<div class="search-mock__row search-mock__row--focused">
									<span class="search-mock__row-title">Huisvestingswet 2014</span>
									<span class="search-mock__row-cite">BWBR0035303</span>
								</div>
								<div class="search-mock__sub">Artikelen · Huisvestingswet 2014</div>
								<div class="search-mock__row">
									<span class="search-mock__row-title">Artikel 1 · Begripsbepalingen</span>
									<span class="search-mock__row-cite">1</span>
								</div>
								<div class="search-mock__row">
									<span class="search-mock__row-title">Artikel 12 · Huisvestingsvergunning</span>
									<span class="search-mock__row-cite">12</span>
								</div>
								<a class="search-mock__more">+ 14 meer wetsartikelen →</a>
							</div>
							<div class="search-mock__domain search-mock__domain--recht">
								<div class="search-mock__head"><span class="domain__glyph">¶</span>Rechtspraak</div>
								<div class="search-mock__sub">Hoge Raad</div>
								<div class="search-mock__row">
									<span class="search-mock__row-title"
										>HR 21 oktober 2022, ECLI:NL:HR:2022:1493</span
									>
									<span class="search-mock__row-cite">ECLI</span>
								</div>
								<div class="search-mock__sub">Hoven &amp; RvS</div>
								<div class="search-mock__row">
									<span class="search-mock__row-title">RvS 12 juni 2024, ECLI:NL:RVS:2024:2418</span
									>
									<span class="search-mock__row-cite">ECLI</span>
								</div>
							</div>
							<div class="search-mock__domain search-mock__domain--tk">
								<div class="search-mock__head">
									<span class="domain__glyph">∮</span>Parlementair
								</div>
								<div class="search-mock__sub">Wetgevingsdossiers</div>
								<div class="search-mock__row">
									<span class="search-mock__row-title"
										>Wijziging van de Huisvestingswet 2014 (vergunninghouders)</span
									>
									<span class="search-mock__row-cite">36281</span>
								</div>
								<div class="search-mock__row">
									<span class="search-mock__row-title">Wet versterking regie volkshuisvesting</span>
									<span class="search-mock__row-cite">36881</span>
								</div>
								<a class="search-mock__more">+ 6 meer dossiers →</a>
							</div>
						</div>
					</div>
				</div>

				<h3 class="sub-title">Resultaten en grenzen</h3>
				<p class="section-body">
					Resultaten worden gegroepeerd per type: Wetgeving (instrumenten en artikelen), Rechtspraak
					(per rechterlijke laag), Parlementair (dossiers, commissies, kamerleden, fracties,
					documenten). <kbd>↓</kbd> /
					<kbd>↑</kbd> en <kbd>Enter</kbd> navigeren de lijst.
				</p>
				<p class="section-body">
					Per type worden maximaal zes tot tien resultaten getoond. Bij meer treffers verschijnt
					onderaan de groep <em>+ N meer →</em>, dat naar de volledige
					<a href="/search">zoekpagina</a>
					leidt met tot vijftig resultaten per type. De zoekpagina kent diepe links naar afzonderlijke
					groepen via een hash, bijvoorbeeld
					<code>/search?q=Klimaatwet#dossiers</code>.
				</p>

				<h3 class="sub-title">Wat de zoekindex wel en niet ziet</h3>
				<p class="section-body">
					De zoekindex zoekt op tekstdelen: <em>vordering</em> vindt ook <em>Strafvordering</em>.
					Resultaten zijn niet op relevantie gerangschikt. Een artikelnotatie als <em>BW 6:162</em> wordt
					niet omgezet naar het artikel; zoek in dat geval op de naam van de wet of op de wettekst. Een
					net toegevoegde bron kan kort ontbreken.
				</p>
				<p class="section-body">
					Een klik op een resultaat opent de verkenner op die bron. Het omliggende netwerk wordt
					rondom dat punt opgebouwd.
				</p>
				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button type="button" class="section-nav__link" onclick={() => setSection('verkenner')}>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">III</span>De verkenner</span
						>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('verbindingen')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">V</span>Verbindingen</span
						>
					</button>
				</nav>
			</section>

			<!-- ── IV Verbindingen ────────────────────────────────────────────── -->
			<section class="doc-section" id="verbindingen" hidden={activeId !== 'verbindingen'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">V</span>
					<h2 class="section-title">Verbindingen</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>De drie typen verbindingen tussen bronnen, hun visuele
					codering en de filter in de zijbalk.
				</p>
				<p class="section-intro">
					Elke bron in het netwerk is via getypeerde verbindingen gekoppeld aan andere bronnen. Er
					zijn drie categorieën, elk met een eigen visuele codering:
				</p>
				<div class="edge-table">
					<div class="edge-row">
						<span class="edge-vis" aria-hidden="true">
							<svg width="40" height="14"
								><line x1="0" y1="7" x2="40" y2="7" stroke="var(--ink-3)" stroke-width="2" /></svg
							>
						</span>
						<div class="edge-body">
							<span class="edge-label">Structureel</span>
							<span class="edge-desc"
								>Plaats van een bron in een geheel en de vaste verwijzingen in de wettekst: een
								artikel is onderdeel van een instrument (<em>PART_OF</em>), artikelen verwijzen naar
								elkaar (<em>REFERS_TO</em>).</span
							>
						</div>
					</div>
					<div class="edge-row">
						<span class="edge-vis" aria-hidden="true">
							<svg width="40" height="14"
								><line
									x1="0"
									y1="7"
									x2="40"
									y2="7"
									stroke="var(--accent)"
									stroke-width="1.5"
								/></svg
							>
						</span>
						<div class="edge-body">
							<span class="edge-label">Citatie</span>
							<span class="edge-desc"
								>Een uitspraak of document verwijst naar een artikel, instrument of uitspraak (<em
									>REFERS_TO</em
								>). Een uitspraak in hoger beroep verwijst naar de bestreden uitspraak (<em
									>APPEAL_OF</em
								>).</span
							>
						</div>
					</div>
					<div class="edge-row">
						<span class="edge-vis" aria-hidden="true">
							<svg width="40" height="14"
								><line
									x1="0"
									y1="7"
									x2="40"
									y2="7"
									stroke="var(--ink-2)"
									stroke-width="2"
									stroke-dasharray="6 3"
								/></svg
							>
						</span>
						<div class="edge-body">
							<span class="edge-label">Wijziging</span>
							<span class="edge-desc"
								>Een instrument of wetsvoorstel wijzigt (<em>AMENDS</em>), voegt toe (<em
									>INTRODUCES</em
								>) of trekt in (<em>REPEALS</em>) een artikel of instrument. Een vastgestelde
								wijziging heeft de status <em>canoniek</em>, een voorstel de status
								<em>voorgesteld</em>.</span
							>
						</div>
					</div>
				</div>
				<p class="section-body">
					Het citatiespoor toont per bron de inkomende en uitgaande verwijzingen. Een hoog aantal
					inkomende verwijzingen duidt doorgaans op een juridisch actief of omstreden artikel. De
					categorie van een verbinding volgt uit het type en de bron: <em>REFERS_TO</em> tussen twee artikelen
					is structureel, vanuit een uitspraak of document een citatie. In de zijbalk is elke categorie
					afzonderlijk in- of uit te schakelen; de bronnen blijven staan, alleen de getekende lijnen veranderen.
				</p>
				<figure class="diagram diagram--graph-types">
					<svg
						viewBox="0 0 660 300"
						role="img"
						aria-labelledby="edges-title edges-desc"
						preserveAspectRatio="xMidYMid meet"
					>
						<title id="edges-title">De drie verbindingstypen tussen bronnen</title>
						<desc id="edges-desc"
							>Wet, artikel, uitspraak en dossier verbonden door respectievelijk een structurele,
							citatie- en wijzigingslijn.</desc
						>
						<!-- edges -->
						<line x1="160" y1="80" x2="160" y2="180" stroke="var(--ink-3)" stroke-width="2" />
						<text
							x="166"
							y="138"
							font-family="var(--font-serif, Georgia, serif)"
							font-size="12"
							font-style="italic"
							fill="var(--ink-3)">PART_OF</text
						>
						<text
							x="166"
							y="152"
							font-family="var(--font-sans, sans-serif)"
							font-size="9"
							fill="var(--ink-4)"
							letter-spacing="0.04em">structureel</text
						>
						<line x1="180" y1="200" x2="356" y2="200" stroke="var(--indigo)" stroke-width="1.5" />
						<text
							x="220"
							y="194"
							font-family="var(--font-serif, Georgia, serif)"
							font-size="12"
							font-style="italic"
							fill="var(--indigo)">REFERS_TO</text
						>
						<text
							x="220"
							y="208"
							font-family="var(--font-sans, sans-serif)"
							font-size="9"
							fill="var(--indigo)"
							letter-spacing="0.04em">citatie</text
						>
						<line
							x1="500"
							y1="100"
							x2="180"
							y2="200"
							stroke="var(--spine)"
							stroke-width="2"
							stroke-dasharray="6 3"
						/>
						<text
							x="318"
							y="138"
							font-family="var(--font-serif, Georgia, serif)"
							font-size="12"
							font-style="italic"
							fill="var(--spine)">AMENDS</text
						>
						<text
							x="318"
							y="152"
							font-family="var(--font-sans, sans-serif)"
							font-size="9"
							fill="var(--spine)"
							letter-spacing="0.04em">wijziging</text
						>
						<!-- nodes -->
						<!-- Wet (top left) -->
						<g>
							<polygon
								points="160,40 200,80 160,120 120,80"
								fill="var(--paper-2)"
								stroke="var(--ink)"
								stroke-width="2"
							/>
							<text
								x="160"
								y="84"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="12"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">Wet</text
							>
						</g>
						<text
							x="208"
							y="56"
							font-family="var(--font-sans, sans-serif)"
							font-size="10"
							fill="var(--ink-3)">Wetboek van Strafvordering</text
						>
						<!-- Artikel (bottom left) -->
						<g>
							<circle
								cx="160"
								cy="200"
								r="20"
								fill="var(--paper-2)"
								stroke="var(--ink)"
								stroke-width="2"
							/>
							<text
								x="160"
								y="197"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">Artikel</text
							>
							<text
								x="160"
								y="211"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-3)"
								text-anchor="middle">140 Sv</text
							>
						</g>
						<!-- Uitspraak (bottom right) -->
						<g>
							<rect
								x="356"
								y="180"
								width="80"
								height="40"
								rx="4"
								fill="var(--paper-2)"
								stroke="var(--ink)"
								stroke-width="2"
							/>
							<text
								x="396"
								y="198"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">Uitspraak</text
							>
							<text
								x="396"
								y="213"
								font-family="var(--font-mono, monospace)"
								font-size="9"
								fill="var(--ink-3)"
								text-anchor="middle">ECLI:NL:HR:2024</text
							>
						</g>
						<!-- Dossier (top right) -->
						<g>
							<polygon
								points="468,80 484,52 516,52 532,80 516,108 484,108"
								fill="var(--paper-2)"
								stroke="var(--spine)"
								stroke-width="2"
							/>
							<text
								x="500"
								y="80"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--spine)"
								text-anchor="middle">Dossier</text
							>
							<text
								x="500"
								y="96"
								font-family="var(--font-mono, monospace)"
								font-size="9"
								fill="var(--ink-3)"
								text-anchor="middle">36410</text
							>
						</g>
						<!-- Helper labels -->
					</svg>
					<figcaption>
						<span class="cap-key"
							><span class="cap-line cap-line--structural"></span>Structureel: hiërarchie binnen een
							wet</span
						>
						<span class="cap-key"
							><span class="cap-line cap-line--cite"></span>Inhoudelijk: citatie of verwijzing</span
						>
						<span class="cap-key"
							><span class="cap-line cap-line--mutation"></span>Wijziging: dossier raakt wet</span
						>
					</figcaption>
				</figure>

				<h3 class="sub-title">Achttien verbindingstypen</h3>
				<p class="section-body">
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
						<code>EXPLAINS</code> document → artikel of instrument. De toelichting bij een invoering of
						wijziging.
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
					zonder nadere aard. Elke verbinding heeft een status en, waar ze is afgeleid, een
					betrouwbaarheid tussen 0 en 1.
				</p>

				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button type="button" class="section-nav__link" onclick={() => setSection('zoeken')}>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"><span class="section-nav__sigil">IV</span>Zoeken</span>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('dossiers-parlement')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">VI</span>Dossiers &amp; Parlement</span
						>
					</button>
				</nav>
			</section>

			<!-- ── V Dossiers & Parlement ─────────────────────────────────────── -->
			<section
				class="doc-section"
				id="dossiers-parlement"
				hidden={activeId !== 'dossiers-parlement'}
			>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">VI</span>
					<h2 class="section-title">Dossiers &amp; Parlement</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>De plek van wetgevingsdossiers, commissies, kamerleden,
					fracties en stemmingen in het netwerk, plus de wetgevingsgeschiedenis op artikelniveau en
					de Mutatie- en Activiteit-overlays.
				</p>
				<p class="section-intro">
					Concordans bevat de parlementaire context van wetgeving. Elk dossier kent een fase-cyclus
					die de huidige stand beschrijft. Aan de artikelkant is per artikel zichtbaar welke
					dossiers het hebben gewijzigd. Twee overlays tonen welke artikelen in beweging zijn of
					recent veel verbindingen kregen.
				</p>
				<figure class="diagram diagram--lifecycle">
					<svg
						viewBox="0 0 720 130"
						role="img"
						aria-labelledby="lifecycle-title lifecycle-desc"
						preserveAspectRatio="xMidYMid meet"
					>
						<title id="lifecycle-title">Stages van een wetgevingsdossier</title>
						<desc id="lifecycle-desc"
							>Acht stages (wetsvoorstel, memorie van toelichting, advies Raad van State, nota's,
							verslag, amendementen, stemming, afhandeling) als horizontale stepper.</desc
						>
						<line x1="40" y1="60" x2="680" y2="60" stroke="var(--rule-strong)" stroke-width="1.2" />
						<!-- Stage labels matched to LegislativeStepper.svelte. The current
						     fase is highlighted in spine; future stages are dashed. -->
						<g>
							<circle
								cx="50"
								cy="60"
								r="14"
								fill="var(--paper-2)"
								stroke="var(--ink-2)"
								stroke-width="1.8"
							/>
							<text
								x="50"
								y="64"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">1</text
							>
							<text
								x="50"
								y="92"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-2)"
								text-anchor="middle">Wetsvoorstel</text
							>
						</g>
						<g>
							<circle
								cx="140"
								cy="60"
								r="14"
								fill="var(--paper-2)"
								stroke="var(--ink-2)"
								stroke-width="1.8"
							/>
							<text
								x="140"
								y="64"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">2</text
							>
							<text
								x="140"
								y="92"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-2)"
								text-anchor="middle">MvT</text
							>
						</g>
						<g>
							<circle
								cx="230"
								cy="60"
								r="14"
								fill="var(--paper-2)"
								stroke="var(--ink-2)"
								stroke-width="1.8"
							/>
							<text
								x="230"
								y="64"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">3</text
							>
							<text
								x="230"
								y="92"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-2)"
								text-anchor="middle">Advies RvS</text
							>
						</g>
						<g>
							<circle
								cx="320"
								cy="60"
								r="14"
								fill="var(--paper-2)"
								stroke="var(--ink-2)"
								stroke-width="1.8"
							/>
							<text
								x="320"
								y="64"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">4</text
							>
							<text
								x="320"
								y="92"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-2)"
								text-anchor="middle">Nota's</text
							>
						</g>
						<g>
							<circle
								cx="410"
								cy="60"
								r="14"
								fill="var(--paper-2)"
								stroke="var(--ink-2)"
								stroke-width="1.8"
							/>
							<text
								x="410"
								y="64"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">5</text
							>
							<text
								x="410"
								y="92"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-2)"
								text-anchor="middle">Verslag</text
							>
						</g>
						<g>
							<circle
								cx="500"
								cy="60"
								r="14"
								fill="var(--paper-2)"
								stroke="var(--ink-2)"
								stroke-width="1.8"
							/>
							<text
								x="500"
								y="64"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink)"
								text-anchor="middle">6</text
							>
							<text
								x="500"
								y="92"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-2)"
								text-anchor="middle">Amendementen</text
							>
						</g>
						<g>
							<circle
								cx="590"
								cy="60"
								r="14"
								fill="var(--spine)"
								stroke="var(--spine)"
								stroke-width="1.8"
							/>
							<text
								x="590"
								y="64"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--paper)"
								text-anchor="middle">7</text
							>
							<text
								x="590"
								y="92"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								font-weight="600"
								fill="var(--spine)"
								text-anchor="middle">Stemming</text
							>
							<text
								x="590"
								y="105"
								font-family="var(--font-sans, sans-serif)"
								font-size="8"
								font-style="italic"
								fill="var(--ink-4)"
								text-anchor="middle">huidige fase</text
							>
						</g>
						<g>
							<circle
								cx="680"
								cy="60"
								r="14"
								fill="var(--paper)"
								stroke="var(--ink-4)"
								stroke-width="1.6"
								stroke-dasharray="2 2"
							/>
							<text
								x="680"
								y="64"
								font-family="var(--font-serif, Georgia, serif)"
								font-size="11"
								font-weight="600"
								fill="var(--ink-3)"
								text-anchor="middle">8</text
							>
							<text
								x="680"
								y="92"
								font-family="var(--font-sans, sans-serif)"
								font-size="9"
								fill="var(--ink-3)"
								text-anchor="middle">Afgehandeld</text
							>
						</g>
					</svg>
					<figcaption>
						<span class="cap-key"
							>Concordans onderhoudt de fase per dossier en kleurt de huidige stap.</span
						>
					</figcaption>
				</figure>

				<div class="parl-grid">
					<div class="parl-card">
						<a href="/explore?mode=index&kind=dossiers" class="parl-card__link">
							<div class="parl-card__title">Wetgevingsdossiers</div>
							<div class="parl-card__desc">
								Elk wetgevingsdossier heeft een tijdlijn van documenten, activiteiten, stemmingen en
								toezeggingen. De tijdlijn is gesorteerd op datum en te filteren op type. Vanaf de
								dossierpagina is direct doorklikken naar de bijbehorende bronnen in het netwerk
								mogelijk.
							</div>
							<span class="parl-card__arrow">→</span>
						</a>
					</div>
					<div class="parl-card">
						<a href="/explore?mode=index&kind=committees" class="parl-card__link">
							<div class="parl-card__title">Commissies</div>
							<div class="parl-card__desc">
								Overzicht van parlementaire commissies met hun actieve dossiertellingen. De
								commissiepagina toont de huidige leden en de dossiers waarvoor de commissie de
								voortouwcommissie is.
							</div>
							<span class="parl-card__arrow">→</span>
						</a>
					</div>
					<div class="parl-card">
						<a href="/publications" class="parl-card__link">
							<div class="parl-card__title">Parlementaire documenten</div>
							<div class="parl-card__desc">
								Doorzoekbaar archief van Kamerstukken van de Tweede en Eerste Kamer (memories van
								toelichting, voorstellen van wet, nota's van wijziging, amendementen, moties en
								brieven), met filter op soort en Kamer en het aantal gekoppelde artikelen.
							</div>
							<span class="parl-card__arrow">→</span>
						</a>
					</div>
					<div class="parl-card">
						<a href="/explore?mode=index&kind=members" class="parl-card__link">
							<div class="parl-card__title">Kamerleden</div>
							<div class="parl-card__desc">
								De leden van de Tweede Kamer, gefilterd op partij. Een ledenpagina toont
								fractielidmaatschap, commissiezetels, stemmen en de instrumenten waarvoor het lid
								wijzigingen heeft voorgesteld.
							</div>
							<span class="parl-card__arrow">→</span>
						</a>
					</div>
					<div class="parl-card">
						<a href="/explore?mode=index&kind=factions" class="parl-card__link">
							<div class="parl-card__title">Fracties &amp; zetelverdeling</div>
							<div class="parl-card__desc">
								De huidige fracties met hun zetelaantal en partijkleur. De indexweergave bevat een
								hemicycle (halve cirkel met 150 stoelen) waarin elke stoel aan een fractie is
								toegewezen; hover op een stoel toont de fractienaam.
							</div>
							<span class="parl-card__arrow">→</span>
						</a>
					</div>
					<div class="parl-card">
						<a href="/explore?mode=index&kind=decisions" class="parl-card__link">
							<div class="parl-card__title">Stemmingen</div>
							<div class="parl-card__desc">
								Plenaire stemmingen met uitslag, datum en het dossier waarop ze betrekking hebben.
								Filter op aangenomen of verworpen, en op periode. Een stemmingspagina toont de
								stemming per fractie, bij een hoofdelijke stemming per lid.
							</div>
							<span class="parl-card__arrow">→</span>
						</a>
					</div>
					<div class="parl-card parl-card--overlay">
						<div class="parl-card__title">Wetgevingsgeschiedenis</div>
						<div class="parl-card__desc">
							Een artikel toont in de leesweergave de dossiers die het hebben ingevoerd, gewijzigd
							of ingetrokken, of voorstellen dat te doen, met de fase per dossier en een directe
							link naar het netwerk van dat dossier.
						</div>
					</div>
					<div class="parl-card parl-card--overlay">
						<div class="parl-card__title">Mutatie-overlay</div>
						<div class="parl-card__desc">
							Markeert in de netwerkweergave bronnen waarvoor een wetsvoorstel aanhangig is. Een
							klein gekleurd badge boven de bron toont het aantal voorgestelde wijzigingen.
							<code>?overlay=open</code> voor alle lopende dossiers,
							<code>?overlay=dossier:36410</code> voor één dossier.
						</div>
					</div>
					<div class="parl-card parl-card--overlay">
						<div class="parl-card__title">Activiteit-overlay</div>
						<div class="parl-card__desc">
							Hitte-halo rond bronnen op basis van het aantal verbindingen dat in de afgelopen 3, 6,
							12 of 24 maanden is toegevoegd. Langere vensters laten halo's groeien naarmate
							verbindingen zich opstapelen.
							<code>?overlay=heat:12</code> activeert de overlay direct. Activiteit en Mutatie sluiten
							elkaar uit.
						</div>
					</div>
				</div>
				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button
						type="button"
						class="section-nav__link"
						onclick={() => setSection('verbindingen')}
					>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">V</span>Verbindingen</span
						>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('api')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">VII</span>API &amp; integratie</span
						>
					</button>
				</nav>
			</section>

			<!-- ── VI API ─────────────────────────────────────────────────────── -->
			<section class="doc-section" id="api" hidden={activeId !== 'api'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">VII</span>
					<h2 class="section-title">API &amp; integratie</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>Routekaart naar de API. De volledige referentie staat op
					een aparte pagina.
				</p>
				<p class="section-intro">
					De data in Concordans is beschikbaar via een REST-API, te gebruiken voor eigen analyses,
					integraties in juridische tools of academisch onderzoek. Lezen vraagt geen registratie of
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
				<p class="section-body">Enkele oriëntatiepunten:</p>
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
						<strong>Sleutels.</strong> Routes die schrijven (volgen, stemmen op een verband, taggen
						van verbanden) vragen de header <code>X-Write-Key</code> of
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
				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button
						type="button"
						class="section-nav__link"
						onclick={() => setSection('dossiers-parlement')}
					>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">VI</span>Dossiers &amp; Parlement</span
						>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('beperkingen')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">VIII</span>Bekende beperkingen</span
						>
					</button>
				</nav>
			</section>

			<!-- ── VII Bekende beperkingen ───────────────────────────────────── -->
			<section class="doc-section" id="beperkingen" hidden={activeId !== 'beperkingen'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">VIII</span>
					<h2 class="section-title">Bekende beperkingen</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>Onderdelen die ontbreken of waarvan de dekking onvolledig
					is. Niet een planning, een toestandsbeschrijving.
				</p>
				<p class="section-intro">
					Het netwerk is fragmentarisch waar de officiële bronnen dat ook zijn, en op punten bewust
					afgebakend. Vier zaken zijn relevant voor onderzoekers die het gebruiken.
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
							netwerk achter op de officiële bronnen. De geldigheidsdatum in de werkbalk is de
							inwerkingtredingsdatum van de getoonde bron, geen synchronisatiedatum. Een tijdstempel
							van de laatste run is niet beschikbaar.
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
					Fouten of lacunes in de dekking zijn welkom via
					<a href="/contact">contact</a>. Bronvermeldingen en concrete vindplaatsen helpen het
					meest.
				</div>

				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button type="button" class="section-nav__link" onclick={() => setSection('api')}>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">VII</span>API &amp; integratie</span
						>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('verder-lezen')}
					>
						<span class="section-nav__dir">Volgende →</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">IX</span>Verder lezen</span
						>
					</button>
				</nav>
			</section>

			<!-- ── VIII Sneltoetsen & verder ─────────────────────────────────── -->
			<section class="doc-section" id="verder-lezen" hidden={activeId !== 'verder-lezen'}>
				<div class="section-header">
					<span class="section-sigil" aria-hidden="true">IX</span>
					<h2 class="section-title">Verder lezen</h2>
				</div>
				<p class="section-summary">
					<strong>In deze sectie</strong>Onderliggende methode, sneltoetsen en aanvullende bronnen.
				</p>
				<div class="further-grid">
					<a href="/docs/sneltoetsen" class="further-card">
						<div class="further-card__title">Sneltoetsen</div>
						<div class="further-card__desc">Lijst van toetsenbordsnelkoppelingen</div>
						<span class="further-card__arrow">→</span>
					</a>
					<a href="/docs/methode" class="further-card">
						<div class="further-card__title">Methode &amp; ontwerp</div>
						<div class="further-card__desc">Oorsprong, grondslagen en ontwerpkeuzes</div>
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
				<nav class="section-nav" aria-label="Sectie-navigatie">
					<button type="button" class="section-nav__link" onclick={() => setSection('beperkingen')}>
						<span class="section-nav__dir">← Vorige</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">VIII</span>Bekende beperkingen</span
						>
					</button>
					<button
						type="button"
						class="section-nav__link section-nav__link--next"
						onclick={() => setSection('overzicht')}
					>
						<span class="section-nav__dir">Terug naar boven ↑</span>
						<span class="section-nav__title"
							><span class="section-nav__sigil">0</span>Overzicht</span
						>
					</button>
				</nav>
			</section>
		</div>
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
	.corpus-item__sigil--instrument {
		color: var(--ink-3);
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

	.scope-note--tip {
		border-left-color: var(--indigo, #5b6af5);
	}

	/* ── "Aan de slag" prelude ───────────────────────────────────────────── */
	.doc-section--intro .section-intro {
		font-size: 16px;
	}
	.tour-steps {
		list-style: decimal inside;
		padding: 0;
		margin: 16px 0 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		counter-reset: tour;
	}
	.tour-steps li {
		font-family: var(--font-serif);
		font-size: 15px;
		line-height: 1.55;
		color: var(--fg-1);
		padding-left: 4px;
	}
	.tour-steps li strong {
		font-weight: 600;
	}

	/* ── Inline diagrams ─────────────────────────────────────────────────── */
	.diagram {
		margin: 18px 0 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		padding: 14px 16px;
	}
	.diagram svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 380px;
	}
	.diagram figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		letter-spacing: 0.02em;
	}
	.cap-key {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.cap-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--indigo);
		color: var(--paper);
		font-size: 9px;
		font-weight: 700;
	}
	.diagram--corpus svg {
		max-height: 300px;
	}
	.diagram--overlays svg {
		max-height: 220px;
	}
	.diagram--graph-types svg {
		max-height: 260px;
	}
	.diagram--lifecycle svg {
		max-height: 130px;
	}

	.panel-figs {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin: 18px 0 28px;
	}
	.panel-fig {
		margin: 0;
		padding: 24px 28px 28px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-top: 3px solid var(--ink);
		position: relative;
	}
	.panel-fig::before {
		content: attr(data-fig);
		position: absolute;
		top: -3px;
		right: 16px;
		transform: translateY(-50%);
		background: var(--paper);
		padding: 0 6px;
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--ink-3);
	}
	.panel-fig svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 660px;
	}
	.panel-fig--focus svg {
		max-height: 660px;
	}

	/* Legend-line swatches for the edge-typology figures */
	.cap-line {
		display: inline-block;
		width: 24px;
		height: 0;
	}
	.cap-line--structural {
		border-top: 1.6px solid var(--ink-3);
	}
	.cap-line--mutation {
		border-top: 1.6px dashed var(--spine);
	}
	.cap-line--cite {
		border-top: 1.6px solid var(--indigo);
	}
	.cap-line--mention {
		border-top: 1.4px dotted var(--ink-4);
	}

	/* ── Search mock (Section III) ───────────────────────────────────────── */
	/* Outer "screenshot" frame — a stylised page silhouette behind a dimming
	   backdrop, with the cmd-K modal floating on top. Makes the overlay's
	   relationship to the rest of the app legible at a glance. */
	.search-mock-frame {
		position: relative;
		margin: 14px 0 24px;
		padding: 24px 24px 28px;
		min-height: 360px;
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		background: var(--paper-2);
		overflow: hidden;
	}
	.search-mock-frame__page {
		position: absolute;
		inset: 0;
		padding: 14px 20px;
		display: grid;
		grid-template-columns: 110px 1fr;
		grid-template-rows: 22px 1fr;
		gap: 10px 16px;
		opacity: 0.85;
	}
	.search-mock-frame__bar {
		grid-column: 1 / -1;
		height: 22px;
		background: var(--paper-3);
		border-radius: 3px;
		border: 1px solid var(--rule);
	}
	.search-mock-frame__col {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 4px;
	}
	.search-mock-frame__col--left {
		border-right: 1px solid var(--rule);
		padding-right: 12px;
	}
	.search-mock-frame__line {
		height: 8px;
		background: var(--paper-3);
		border-radius: 2px;
	}
	.search-mock-frame__line--short {
		width: 60%;
	}
	.search-mock-frame__h {
		height: 14px;
		background: var(--paper-3);
		border-radius: 2px;
		width: 50%;
		margin-bottom: 4px;
	}
	.search-mock-frame__backdrop {
		position: absolute;
		inset: 0;
		background: rgba(26, 24, 20, 0.32);
		backdrop-filter: blur(0.5px);
	}

	.search-mock {
		position: relative;
		width: min(520px, calc(100% - 24px));
		margin: 0 auto;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		box-shadow: 0 8px 28px -10px rgba(0, 0, 0, 0.35);
		overflow: hidden;
		font-family: var(--font-sans);
		font-size: 12px;
	}
	.search-mock__chrome {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--rule);
	}
	.search-mock__kbd kbd {
		font-size: 11px;
		color: var(--ink-3);
		background: var(--paper-3);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 1px 5px;
	}
	.search-mock__input {
		flex: 1;
		font-family: var(--font-mono, monospace);
		font-size: 13px;
		color: var(--ink);
	}
	.search-mock__count {
		font-size: 10px;
		color: var(--ink-4);
		padding: 2px 6px;
		background: var(--paper-3);
		border-radius: 3px;
	}
	.search-mock__chips {
		display: flex;
		gap: 6px;
		padding: 6px 14px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper-2);
	}
	.search-mock__chip {
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 10px;
		border: 1px solid var(--rule);
		color: var(--ink-3);
		background: var(--paper);
	}
	.search-mock__chip--on {
		color: var(--paper);
		background: var(--ink-2);
		border-color: var(--ink-2);
	}
	.search-mock__body {
		padding: 6px 0 8px;
	}
	.search-mock__domain + .search-mock__domain {
		border-top: 1px solid var(--rule);
		margin-top: 6px;
		padding-top: 6px;
	}
	.search-mock__head {
		padding: 6px 14px 2px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3);
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.search-mock__head .domain__glyph {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink);
	}
	.search-mock__domain--recht .domain__glyph {
		color: var(--indigo);
	}
	.search-mock__domain--tk .domain__glyph {
		color: var(--spine);
	}
	.search-mock__sub {
		padding: 6px 18px 2px;
		font-size: 10px;
		font-style: italic;
		color: var(--ink-4);
	}
	.search-mock__row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 4px 18px;
	}
	.search-mock__row--focused {
		background: var(--paper-2);
	}
	.search-mock__row-title {
		flex: 1;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.search-mock__row-cite {
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		color: var(--ink-4);
	}
	.search-mock__more {
		display: block;
		padding: 4px 18px 6px;
		font-size: 11px;
		color: var(--spine);
		text-decoration: none;
		letter-spacing: 0.02em;
		cursor: default;
	}

	/* ── Subsection title used inside Verkenner / Zoeken sections ──────── */
	.sub-title {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-2);
		margin: 22px 0 6px;
	}

	/* ── Overlay cards in Section II ─────────────────────────────────────── */
	.overlay-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		margin: 8px 0 14px;
	}
	.overlay-card {
		padding: 14px 16px;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
	}
	.overlay-card--heat {
		border-left: 3px solid var(--ink);
	}
	.overlay-card--mutatie {
		border-left: 3px solid var(--spine);
	}
	.overlay-card__name {
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.02em;
		margin-bottom: 4px;
	}
	.overlay-card__desc {
		font-family: var(--font-serif);
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--fg-2);
		margin: 0;
	}
	@media (max-width: 600px) {
		.overlay-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ── Detail gradient diagram ──────────────────────────────────────────── */
	.detail-gradient {
		padding: 18px 24px;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.dg-axis {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.dg-axis-arrow {
		flex: 1;
		text-align: center;
		color: var(--rule-strong);
	}
	.dg-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}
	.dg-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-align: center;
	}
	.dg-glyph {
		font-size: 22px;
		color: var(--ink-2);
		font-family: var(--font-serif);
	}
	.dg-name {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink);
	}
	.dg-ratio {
		font-family: var(--font-sans);
		font-size: 10px;
		color: var(--ink-4);
		font-style: italic;
	}

	/* ── Mode cards ───────────────────────────────────────────────────────── */
	.mode-cards {
		display: flex;
		flex-direction: column;
		gap: 1px;
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}

	.mode-card {
		background: var(--paper);
		padding: 0;
	}

	.mode-card__head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 13px 20px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper-2);
	}

	.mode-card__name {
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
	}

	.mode-card__url {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-4);
		margin-left: auto;
	}

	.mode-card__desc {
		font-family: var(--font-sans);
		font-size: 13.5px;
		line-height: 1.7;
		color: var(--fg-1);
		margin: 0;
		padding: 14px 20px 10px;
	}

	.mode-card__tips {
		list-style: none;
		margin: 0;
		padding: 0 20px 14px;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.mode-card__tips li {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
		padding-left: 14px;
		position: relative;
	}

	.mode-card__tips li::before {
		content: '→';
		position: absolute;
		left: 0;
		color: var(--fg-4);
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

	/* ── Edge table ───────────────────────────────────────────────────────── */
	.edge-table {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}

	.edge-row {
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
	}

	.edge-row:last-child {
		border-bottom: none;
	}

	.edge-vis {
		flex-shrink: 0;
		width: 40px;
	}

	.edge-body {
		display: flex;
		align-items: baseline;
		gap: 16px;
		flex: 1;
		min-width: 0;
	}

	.edge-label {
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 500;
		color: var(--ink);
		white-space: nowrap;
		width: 90px;
		flex-shrink: 0;
	}

	.edge-desc {
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--fg-2);
		line-height: 1.45;
	}

	/* ── Parliamentary grid ───────────────────────────────────────────────── */
	.parl-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.parl-card {
		padding: 18px 20px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		position: relative;
		transition:
			background 80ms,
			border-color 80ms;
	}

	.parl-card--overlay {
		border-style: dashed;
	}

	.parl-card__link {
		display: block;
		text-decoration: none;
		border-bottom: none;
		color: inherit;
	}

	.parl-card:has(.parl-card__link):hover {
		background: var(--paper-2);
		border-color: var(--rule-strong);
	}

	.parl-card__title {
		font-family: var(--font-sans);
		font-size: 13.5px;
		font-weight: 600;
		color: var(--ink);
		margin-bottom: 8px;
	}

	.parl-card__desc {
		font-family: var(--font-sans);
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--fg-3);
	}

	.parl-card__arrow {
		display: block;
		margin-top: 12px;
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--fg-3);
		transition:
			color 80ms,
			transform 80ms;
	}

	.parl-card:has(.parl-card__link):hover .parl-card__arrow {
		color: var(--accent);
		transform: translateX(2px);
	}

	/* ── API grid ─────────────────────────────────────────────────────────── */
	.api-grid {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}

	.api-item {
		display: flex;
		align-items: baseline;
		gap: 20px;
		padding: 12px 18px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
	}

	.api-item:last-child {
		border-bottom: none;
	}

	.api-item__path {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--ink-2);
		background: none;
		border: none;
		padding: 0;
		flex-shrink: 0;
		width: 280px;
	}

	.api-item__desc {
		font-family: var(--font-sans);
		font-size: 12.5px;
		color: var(--fg-2);
	}

	/* ── Further grid ─────────────────────────────────────────────────────── */
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
		.parl-grid,
		.limit-grid,
		.further-grid {
			grid-template-columns: 1fr;
		}

		.edge-body {
			flex-direction: column;
			gap: 3px;
		}

		.api-item {
			flex-direction: column;
			gap: 4px;
		}

		.api-item__path {
			width: auto;
		}
	}

	/* ── Navigation chrome (TOC + progress) ─────────────────────────────── */

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

	/* Top progress bar — reflects section number / total. */
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

	/* ── Reader feature list inside Verkenner ───────────────────────────── */
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

	/* ── Sneltoetsen cheat-sheet ─────────────────────────────────────────── */
	.keys {
		margin: 8px 0 18px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px 16px;
	}
	.keys__row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 4px 0;
		border-bottom: 1px dotted var(--rule);
	}
	.keys__row dt {
		flex-shrink: 0;
		display: inline-flex;
		gap: 4px;
		min-width: 70px;
	}
	.keys__row dt kbd {
		display: inline-block;
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		padding: 1px 5px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-bottom-width: 2px;
		border-radius: 3px;
		color: var(--ink);
	}
	.keys__row dd {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 13.5px;
		color: var(--ink-2);
		line-height: 1.5;
	}
	@media (max-width: 600px) {
		.keys {
			grid-template-columns: 1fr;
		}
	}

	/* ── Section summary boxes ───────────────────────────────────────────── */

	/* "In deze sectie..." card right after the section header. Compact,
	   serif italic so it reads as a stage-direction. Acts as a TL;DR. */
	.section-summary {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		line-height: 1.6;
		color: var(--fg-2);
		padding: 10px 14px;
		background: var(--paper-2);
		border-left: 3px solid var(--ink-4);
		border-radius: 0 var(--r-1) var(--r-1) 0;
		margin: 0 0 18px;
	}
	.section-summary strong {
		font-family: var(--font-sans);
		font-style: normal;
		font-weight: 600;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-right: 8px;
	}

	/* ── Inter-section nav (prev/next) ───────────────────────────────────── */

	.section-nav {
		display: flex;
		gap: 12px;
		margin-top: 36px;
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
