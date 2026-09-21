<script lang="ts">
	import { onMount } from 'svelte';

	const TOC = [
		{ id: 'bronnen', label: 'i · Bronnen' },
		{ id: 'model', label: 'ii · Pijplijn & model' },
		{ id: 'praktijk', label: 'iii · Per bron, in praktijk' },
		{ id: 'detectoren', label: 'iv · Detectoren' }
	] as const;

	let activeSection = $state<string>('bronnen');

	onMount(() => {
		const observers: IntersectionObserver[] = [];
		const sectionEls = TOC.map(({ id }) => document.getElementById(id)).filter(
			Boolean
		) as HTMLElement[];
		const visible = new Set<string>();

		for (const el of sectionEls) {
			const obs = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (entry.isIntersecting) visible.add(el.id);
						else visible.delete(el.id);
					}
					for (const { id } of TOC) {
						if (visible.has(id)) {
							activeSection = id;
							break;
						}
					}
				},
				{ rootMargin: '-20% 0px -60% 0px', threshold: 0 }
			);
			obs.observe(el);
			observers.push(obs);
		}

		return () => observers.forEach((o) => o.disconnect());
	});
</script>

<svelte:head>
	<title>Methode & Ontwerp · Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="pg">
		<div class="pg-intro">
			<div class="pg-title-block">
				<div class="pg-kicker"><span class="dot"></span>Hoe Concordans werkt</div>
				<h1 class="pg-title">Methode &amp; ontwerp</h1>
				<div class="pg-title-rest">
					<p class="pg-lede">
						Concordans haalt officiële bronnen uit vier domeinen op, normaliseert ze tot één
						datamodel en legt de verbindingen vast die in de tekst besloten liggen. Ophalen,
						normaliseren, verbinden.
					</p>
					<p class="pg-lede pg-lede--sub">
						Aanleiding was onderzoek voor een bachelorscriptie naar artikel 126ffa Sv: een artikel
						dat naar drie andere verwijst, die op hun beurt heen en weer verwijzen. Zonder
						geheugenwerk of eindeloos kopiëren van teksten was die structuur niet te overzien,
						terwijl het recht zelf juist gestructureerd is.
					</p>
					<dl class="pg-notes">
						<div class="pg-note">
							<dt>Naam</dt>
							<dd>
								Naar de bijbelconcordantie, niet om religieuze redenen maar om de betekenis: een
								volledig register van alle vindplaatsen.
							</dd>
						</div>
						<div class="pg-note">
							<dt>Filosofie</dt>
							<dd>
								Onderzoeksinstrument voor wie de structuur van het recht wil doorgronden. Geen
								antwoordmachine die conclusies levert zonder de wet zelf.
							</dd>
						</div>
						<div class="pg-note">
							<dt>Openheid</dt>
							<dd>
								Uitsluitend open data. De pijplijnen die data ophalen en verwerken zijn integraal
								gedocumenteerd: hier ontstaat de waarde, en hier moet kritiek mogelijk zijn.
							</dd>
						</div>
					</dl>
				</div>
			</div>

			<figure class="pg-overview-v">
				<svg
					viewBox="0 0 280 580"
					preserveAspectRatio="xMidYMid meet"
					role="img"
					aria-label="Systeemoverzicht: bronnen naar pijplijn naar netwerk"
				>
					<defs>
						<marker
							id="ov-v-arr"
							viewBox="0 0 10 10"
							refX="8"
							refY="5"
							markerWidth="7"
							markerHeight="7"
							orient="auto"><path d="M 0 1 L 9 5 L 0 9 z" fill="#1A1814" /></marker
						>
					</defs>

					<!-- ─────── i · BRONNEN ─────── -->
					<g
						font-family="IBM Plex Sans, sans-serif"
						font-size="9"
						letter-spacing="1.4"
						fill="#9A9485"
					>
						<text x="0" y="14">I · BRONNEN</text>
					</g>
					<line x1="0" y1="22" x2="280" y2="22" stroke="#E2DBCC" />

					<g font-family="EB Garamond, serif" font-size="12" fill="#1A1814">
						<rect x="0" y="34" width="280" height="26" fill="#FFFDF4" stroke="#E2DBCC" />
						<line x1="0" y1="34" x2="0" y2="60" stroke="#1A1814" stroke-width="3" />
						<text x="12" y="52">wetten.overheid.nl</text>

						<rect x="0" y="66" width="280" height="26" fill="#FFFDF4" stroke="#E2DBCC" />
						<line x1="0" y1="66" x2="0" y2="92" stroke="#2B3A5C" stroke-width="3" />
						<text x="12" y="84">rechtspraak.nl</text>

						<rect x="0" y="98" width="280" height="26" fill="#FFFDF4" stroke="#E2DBCC" />
						<line x1="0" y1="98" x2="0" y2="124" stroke="#7A1F1A" stroke-width="3" />
						<text x="12" y="116">tweedekamer.nl</text>

						<rect x="0" y="130" width="280" height="26" fill="#FFFDF4" stroke="#E2DBCC" />
						<line x1="0" y1="130" x2="0" y2="156" stroke="#1F5A56" stroke-width="3" />
						<text x="12" y="148">eur-lex.europa.eu</text>
					</g>

					<!-- single straight arrow into the pipeline -->
					<line
						x1="140"
						y1="166"
						x2="140"
						y2="208"
						stroke="#1A1814"
						stroke-width="1.4"
						marker-end="url(#ov-v-arr)"
					/>

					<!-- ─────── ii · PIJPLIJN ─────── -->
					<g
						font-family="IBM Plex Sans, sans-serif"
						font-size="9"
						letter-spacing="1.4"
						fill="#9A9485"
					>
						<text x="0" y="232">II · PIJPLIJN</text>
					</g>
					<line x1="0" y1="240" x2="280" y2="240" stroke="#E2DBCC" />

					<g font-family="EB Garamond, serif" fill="#1A1814">
						<rect x="0" y="252" width="280" height="36" fill="#FFFDF4" stroke="#1A1814" />
						<text
							x="12"
							y="266"
							font-family="IBM Plex Sans, sans-serif"
							font-size="8"
							letter-spacing="1.4"
							fill="#9A9485">FASE I</text
						>
						<text x="12" y="282" font-size="14"
							>Ophalen <tspan font-style="italic" fill="#6B6558" font-size="11">
								· raw_sources</tspan
							></text
						>
						<rect x="0" y="294" width="280" height="36" fill="#FFFDF4" stroke="#1A1814" />
						<text
							x="12"
							y="308"
							font-family="IBM Plex Sans, sans-serif"
							font-size="8"
							letter-spacing="1.4"
							fill="#9A9485">FASE II</text
						>
						<text x="12" y="324" font-size="14"
							>Normaliseren <tspan font-style="italic" fill="#6B6558" font-size="11">
								· structuur</tspan
							></text
						>
						<rect x="0" y="336" width="280" height="36" fill="#FFFDF4" stroke="#1A1814" />
						<text
							x="12"
							y="350"
							font-family="IBM Plex Sans, sans-serif"
							font-size="8"
							letter-spacing="1.4"
							fill="#9A9485">FASE III</text
						>
						<text x="12" y="366" font-size="14"
							>Verbinden <tspan font-style="italic" fill="#6B6558" font-size="11">
								· semantisch</tspan
							></text
						>
						<line x1="140" y1="288" x2="140" y2="294" stroke="#9A9485" />
						<line x1="140" y1="330" x2="140" y2="336" stroke="#9A9485" />
					</g>
					<line
						x1="140"
						y1="372"
						x2="140"
						y2="392"
						stroke="#1A1814"
						stroke-width="1.4"
						marker-end="url(#ov-v-arr)"
					/>

					<!-- ─────── iii · NETWERK, concrete momentopname ─────── -->
					<g
						font-family="IBM Plex Sans, sans-serif"
						font-size="9"
						letter-spacing="1.4"
						fill="#9A9485"
					>
						<text x="0" y="412">III · IN HET NETWERK</text>
						<text x="280" y="412" text-anchor="end" font-size="8" fill="#9A9485"
							>art. 47 Sr &amp; omgeving</text
						>
					</g>
					<line x1="0" y1="420" x2="280" y2="420" stroke="#E2DBCC" />

					<g font-family="EB Garamond, serif" fill="#1A1814">
						<rect x="0" y="432" width="280" height="148" fill="#FFFDF4" stroke="#E2DBCC" />

						<!-- HR uitspraak (top) -->
						<text
							x="140"
							y="454"
							font-style="italic"
							font-size="14"
							fill="#2B3A5C"
							text-anchor="middle">¶</text
						>
						<text
							x="140"
							y="466"
							font-family="iA Writer Mono, monospace"
							font-size="8"
							fill="#6B6558"
							text-anchor="middle">HR:2023:1234</text
						>
						<!-- dashed: HR REFERS_TO art. 47 -->
						<line
							x1="140"
							y1="472"
							x2="140"
							y2="494"
							stroke="#3A362E"
							stroke-width="0.9"
							stroke-dasharray="3 2"
						/>
						<text x="148" y="486" font-style="italic" font-size="8" fill="#6B6558">REFERS_TO</text>

						<!-- Wetboek Sr (left) -->
						<text x="38" y="510" font-style="italic" font-size="14" text-anchor="middle">§</text>
						<text
							x="38"
							y="524"
							font-family="iA Writer Mono, monospace"
							font-size="8"
							fill="#6B6558"
							text-anchor="middle">Wetboek Sr</text
						>
						<!-- solid: art. 47 PART_OF Wetboek -->
						<line x1="52" y1="508" x2="124" y2="508" stroke="#1A1814" stroke-width="0.9" />
						<text
							x="88"
							y="503"
							font-style="italic"
							font-size="8"
							fill="#6B6558"
							text-anchor="middle">PART_OF</text
						>

						<!-- art. 47 Sr (center, emphasized) -->
						<circle cx="140" cy="508" r="14" fill="#FFFDF4" stroke="#1A1814" stroke-width="1.5" />
						<text
							x="140"
							y="506"
							font-style="italic"
							font-size="14"
							fill="#1A1814"
							text-anchor="middle">❡</text
						>
						<text
							x="140"
							y="518"
							font-family="iA Writer Mono, monospace"
							font-size="8"
							fill="#6B6558"
							text-anchor="middle">art. 47 Sr</text
						>

						<!-- art. 51 Sr (right) -->
						<text x="242" y="510" font-style="italic" font-size="14" text-anchor="middle">❡</text>
						<text
							x="242"
							y="524"
							font-family="iA Writer Mono, monospace"
							font-size="8"
							fill="#6B6558"
							text-anchor="middle">art. 51 Sr</text
						>
						<!-- dashed: art. 47 REFERS_TO art. 51 -->
						<line
							x1="156"
							y1="508"
							x2="228"
							y2="508"
							stroke="#3A362E"
							stroke-width="0.9"
							stroke-dasharray="3 2"
						/>
						<text
							x="192"
							y="503"
							font-style="italic"
							font-size="8"
							fill="#6B6558"
							text-anchor="middle">REFERS_TO</text
						>

						<!-- Amendement (bottom) -->
						<text
							x="140"
							y="562"
							font-style="italic"
							font-size="14"
							fill="#7A1F1A"
							text-anchor="middle">▤</text
						>
						<text
							x="140"
							y="574"
							font-family="iA Writer Mono, monospace"
							font-size="8"
							fill="#6B6558"
							text-anchor="middle">amendement 36558/7</text
						>
						<!-- red: Amendement AMENDS art. 47 -->
						<line x1="140" y1="522" x2="140" y2="548" stroke="#7A1F1A" stroke-width="1.1" />
						<text x="148" y="538" font-style="italic" font-size="8" fill="#7A1F1A">AMENDS</text>
					</g>
				</svg>
			</figure>
		</div>

		<!-- ───────────── TOC ───────────── -->
		<nav class="pg-toc">
			<div class="pg-toc-h">Inhoud</div>
			<ol class="pg-toc-list">
				{#each TOC as { id, label }, i (i)}
					<li>
						<a href="#{id}" class:active={activeSection === id}>
							<span class="pg-toc-num">{label.split(' · ')[0]}</span>
							<span class="pg-toc-name">{label.split(' · ')[1]}</span>
						</a>
					</li>
				{/each}
			</ol>
		</nav>

		<!-- ═══════════════════════════════════════════════════ -->
		<!-- §1 Bronnen -->
		<!-- ═══════════════════════════════════════════════════ -->
		<section id="bronnen">
			<div class="sec-head">
				<div class="sec-num"><strong>i</strong></div>
				<div>
					<h2 class="sec-title">De databronnen</h2>
					<p class="sec-deck">
						Officiële overheidsbronnen in vier domeinen, elk met een eigen dataformaat en
						identificatiestelsel. De ruwe bouwstenen waaruit alles volgt.
					</p>
				</div>
			</div>

			<div class="sources">
				<article class="src is-wet">
					<div class="src-num">Bron 01</div>
					<div class="src-domain">Wet- en regelgeving · NL</div>
					<h3 class="src-name">wetten.overheid.nl<span class="url">wetten.nl</span></h3>
					<p class="src-desc">
						De volledige tekst van Nederlandse wetten, opgesplitst per artikel, inclusief
						historische toestanden. Staatsblad, Staatscourant en Verdragenbank vullen aan met
						wijzigende publicaties, ministeriële regelingen en verdragen.
					</p>
					<div class="src-id">
						<span class="src-id-label">Identifier · Formaat</span>
						<span>BWBR0001854 · XML</span>
					</div>
				</article>

				<article class="src is-recht">
					<div class="src-num">Bron 02</div>
					<div class="src-domain">Rechtspraak · NL</div>
					<h3 class="src-name">rechtspraak.nl<span class="url">uitspraken.rechtspraak.nl</span></h3>
					<p class="src-desc">
						Uitspraken van rechtbanken, gerechtshoven, de Raad van State en de Hoge Raad: volledige
						tekst, samenvatting en metadata. Uitspraken van het EHRM komen uit HUDOC.
					</p>
					<div class="src-id">
						<span class="src-id-label">Identifier · Formaat</span>
						<span>ECLI:NL:HR:2023:1234 · XML</span>
					</div>
				</article>

				<article class="src is-tk">
					<div class="src-num">Bron 03</div>
					<div class="src-domain">Parlementair · NL</div>
					<h3 class="src-name">tweedekamer.nl<span class="url">gegevensmagazijn</span></h3>
					<p class="src-desc">
						Dossiers, documenten, debatten, stemmingen, toezeggingen, commissies en Kamerleden, in
						een rijk gestructureerd geheel. Kamerstukken van de Eerste Kamer komen uit de
						KOOP-repository.
					</p>
					<div class="src-id">
						<span class="src-id-label">Identifier · Formaat</span>
						<span>kamerstuk 36558 · JSON OData</span>
					</div>
				</article>

				<article class="src is-eu">
					<div class="src-num">Bron 04</div>
					<div class="src-domain">Wet- en regelgeving · EU</div>
					<h3 class="src-name">
						eur-lex.europa.eu<span class="url">europese publicatieblad</span>
					</h3>
					<p class="src-desc">
						Europese richtlijnen en verordeningen waarnaar Nederlandse regelingen verwijzen,
						inclusief de verbinding met de regeling die ze implementeert.
					</p>
					<div class="src-id">
						<span class="src-id-label">Identifier · Formaat</span>
						<span>CELEX 32016L0343 · HTML</span>
					</div>
				</article>
			</div>
		</section>

		<!-- ═══════════════════════════════════════════════════ -->
		<!-- §ii Pijplijn & model -->
		<!-- ═══════════════════════════════════════════════════ -->
		<section id="model">
			<div class="sec-head">
				<div class="sec-num"><strong>ii</strong></div>
				<div>
					<h2 class="sec-title">Pijplijn &amp; model</h2>
					<p class="sec-deck">
						Drie fasen waarmee ruwe overheidsbestanden tot een netwerk worden, gevolgd door het
						uniforme model dat daaruit volgt: brontypen en de verbindingen die ze dragen.
					</p>
				</div>
			</div>

			<figure class="phase-fig">
				<svg
					viewBox="0 0 720 150"
					preserveAspectRatio="xMidYMid meet"
					role="img"
					aria-label="Pijplijn: bronnen via ophalen, normaliseren en verbinden naar netwerk"
				>
					<defs>
						<marker
							id="ph-arr"
							viewBox="0 0 10 10"
							refX="8"
							refY="5"
							markerWidth="7"
							markerHeight="7"
							orient="auto"
						>
							<path d="M 0 1 L 9 5 L 0 9 z" fill="#1A1814" />
						</marker>
					</defs>

					<!-- input: bronnen -->
					<text
						x="0"
						y="76"
						font-family="EB Garamond, serif"
						font-size="13"
						font-style="italic"
						fill="#6B6558">bronnen</text
					>
					<line
						x1="60"
						y1="72"
						x2="100"
						y2="72"
						stroke="#1A1814"
						stroke-width="1.2"
						marker-end="url(#ph-arr)"
					/>

					<!-- Fase I -->
					<a href="#bronnen" class="phase-link" aria-label="Naar §i Bronnen">
						<rect
							x="106"
							y="50"
							width="150"
							height="44"
							fill="#FFFDF4"
							stroke="#1A1814"
							stroke-width="1"
						/>
						<text
							x="116"
							y="65"
							font-family="IBM Plex Sans, sans-serif"
							font-size="9"
							letter-spacing="1.4"
							fill="#9A9485">FASE I</text
						>
						<text x="116" y="84" font-family="EB Garamond, serif" font-size="15" fill="#1A1814"
							>Ophalen</text
						>
						<text
							x="248"
							y="65"
							font-family="EB Garamond, serif"
							font-style="italic"
							font-size="11"
							fill="#9A9485"
							text-anchor="end"
							class="phase-link-cue">§i ↗</text
						>
						<text
							x="181"
							y="113"
							font-family="iA Writer Mono, monospace"
							font-size="9"
							fill="#9A9485"
							text-anchor="middle">raw_sources</text
						>
						<text
							x="181"
							y="128"
							font-family="EB Garamond, serif"
							font-size="11"
							font-style="italic"
							fill="#6B6558"
							text-anchor="middle">fotokopie van de bron</text
						>
					</a>

					<line
						x1="256"
						y1="72"
						x2="290"
						y2="72"
						stroke="#1A1814"
						stroke-width="1.2"
						marker-end="url(#ph-arr)"
					/>

					<!-- Fase II -->
					<a href="#praktijk" class="phase-link" aria-label="Naar §iii Per bron, in praktijk">
						<rect
							x="296"
							y="50"
							width="150"
							height="44"
							fill="#FFFDF4"
							stroke="#1A1814"
							stroke-width="1"
						/>
						<text
							x="306"
							y="65"
							font-family="IBM Plex Sans, sans-serif"
							font-size="9"
							letter-spacing="1.4"
							fill="#9A9485">FASE II</text
						>
						<text x="306" y="84" font-family="EB Garamond, serif" font-size="15" fill="#1A1814"
							>Normaliseren</text
						>
						<text
							x="438"
							y="65"
							font-family="EB Garamond, serif"
							font-style="italic"
							font-size="11"
							fill="#9A9485"
							text-anchor="end"
							class="phase-link-cue">§iii ↗</text
						>
						<text
							x="371"
							y="113"
							font-family="iA Writer Mono, monospace"
							font-size="9"
							fill="#9A9485"
							text-anchor="middle">bronnen + structuur</text
						>
						<text
							x="371"
							y="128"
							font-family="EB Garamond, serif"
							font-size="11"
							font-style="italic"
							fill="#6B6558"
							text-anchor="middle">vaste adressen, verbindingen uit nesting</text
						>
					</a>

					<line
						x1="446"
						y1="72"
						x2="480"
						y2="72"
						stroke="#1A1814"
						stroke-width="1.2"
						marker-end="url(#ph-arr)"
					/>

					<!-- Fase III -->
					<a href="#detectoren" class="phase-link" aria-label="Naar §iv Detectoren">
						<rect
							x="486"
							y="50"
							width="150"
							height="44"
							fill="#FFFDF4"
							stroke="#1A1814"
							stroke-width="1"
						/>
						<text
							x="496"
							y="65"
							font-family="IBM Plex Sans, sans-serif"
							font-size="9"
							letter-spacing="1.4"
							fill="#9A9485">FASE III</text
						>
						<text x="496" y="84" font-family="EB Garamond, serif" font-size="15" fill="#1A1814"
							>Verbinden</text
						>
						<text
							x="628"
							y="65"
							font-family="EB Garamond, serif"
							font-style="italic"
							font-size="11"
							fill="#9A9485"
							text-anchor="end"
							class="phase-link-cue">§iv ↗</text
						>
						<text
							x="561"
							y="113"
							font-family="iA Writer Mono, monospace"
							font-size="9"
							fill="#9A9485"
							text-anchor="middle">verbindingen tussen bronnen</text
						>
						<text
							x="561"
							y="128"
							font-family="EB Garamond, serif"
							font-size="11"
							font-style="italic"
							fill="#6B6558"
							text-anchor="middle">verwijzingen uit tekst en bron</text
						>
					</a>

					<line
						x1="636"
						y1="72"
						x2="676"
						y2="72"
						stroke="#1A1814"
						stroke-width="1.2"
						marker-end="url(#ph-arr)"
					/>

					<!-- output: netwerk -->
					<text
						x="720"
						y="76"
						font-family="EB Garamond, serif"
						font-size="13"
						font-style="italic"
						fill="#6B6558"
						text-anchor="end">netwerk</text
					>
				</svg>
			</figure>

			<h3 class="block-h">Bronnen: vijftien typen, drie domeinen</h3>

			<dl class="brontype-inventory">
				<div class="brontype-domain is-wet">
					<dt class="brontype-domain-h">Wetgeving</dt>
					<dd class="brontype-domain-list">
						<span class="brontype-item"><span class="g-glyph g-wet">§</span>Instrument</span>
						<span class="brontype-item"><span class="g-glyph g-wet">❡</span>Artikel</span>
						<span class="brontype-item"><span class="g-glyph g-wet">§</span>Instrumentversie</span>
						<span class="brontype-item"><span class="g-glyph g-wet">❡</span>Artikelversie</span>
						<span class="brontype-item"><span class="g-glyph g-wet">▪</span>Bijlage</span>
					</dd>
				</div>
				<div class="brontype-domain is-recht">
					<dt class="brontype-domain-h">Rechtspraak</dt>
					<dd class="brontype-domain-list">
						<span class="brontype-item"><span class="g-glyph g-recht">¶</span>Uitspraak</span>
					</dd>
				</div>
				<div class="brontype-domain is-tk">
					<dt class="brontype-domain-h">Parlementair</dt>
					<dd class="brontype-domain-list">
						<span class="brontype-item"><span class="g-glyph g-tk">∮</span>Dossier</span>
						<span class="brontype-item"><span class="g-glyph g-tk">▤</span>Document</span>
						<span class="brontype-item"><span class="g-glyph g-tk">□</span>Zaak</span>
						<span class="brontype-item"><span class="g-glyph g-tk">◇</span>Activiteit</span>
						<span class="brontype-item"><span class="g-glyph g-tk">⊞</span>Stemming</span>
						<span class="brontype-item"><span class="g-glyph g-tk">⊙</span>Toezegging</span>
						<span class="brontype-item"><span class="g-glyph g-tk">‡</span>Commissie</span>
						<span class="brontype-item"><span class="g-glyph g-tk">·</span>Kamerlid</span>
						<span class="brontype-item"><span class="g-glyph g-tk">◊</span>Fractie</span>
					</dd>
				</div>
			</dl>

			<p class="block-note">
				Elk type wordt geadresseerd via een eigen stelsel: BWB-id of CELEX voor instrumenten, ECLI
				voor uitspraken, dossiernummer en GUID voor het parlementaire deel. Elke bron heeft een
				adres van de vorm collectie/sleutel, bijvoorbeeld <span class="mono">dossiers/36558</span>.
			</p>

			<h3 class="block-h">Verbindingen: drie herkomsten</h3>
			<p class="block-deck">
				Eén voorbeeld per herkomst. De volledige inventaris telt achttien verbindingstypen; zie §iii
				en §iv voor wat elke pijplijnstap oplevert.
			</p>

			<div class="edge-legend">
				<article class="edge-legend-row">
					<div class="edge-legend-cat">
						<div class="edge-legend-name">Structureel</div>
						<p class="edge-legend-desc">
							Volledig bepaald door de structuur van de brondata. Draagt geen betrouwbaarheid.
						</p>
					</div>
					<div class="edge-row edge-row--legend">
						<div class="edge-from">
							<span class="g-glyph g-wet">❡</span><span class="edge-noun">Artikel</span>
						</div>
						<div class="edge-rel">
							<svg class="edge-rel-svg" viewBox="0 0 100 14" preserveAspectRatio="none"
								><line x1="0" y1="7" x2="92" y2="7" stroke="#3A362E" stroke-width="1.5" /><polygon
									points="92,3 100,7 92,11"
									fill="#3A362E"
								/></svg
							>
							<span class="edge-rel-name">PART_OF</span>
						</div>
						<div class="edge-to">
							<span class="g-glyph g-wet">§</span><span class="edge-noun">Instrument</span>
						</div>
					</div>
				</article>

				<article class="edge-legend-row">
					<div class="edge-legend-cat">
						<div class="edge-legend-name">Mutatie</div>
						<p class="edge-legend-desc">
							Een instrument voert een wijziging door (status <em>canoniek</em>). Een wetsvoorstel
							stelt dezelfde wijziging voor (status <em>voorgesteld</em>). Beide dragen
							<em>AMENDS</em>, <em>INTRODUCES</em> of <em>REPEALS</em>.
						</p>
					</div>
					<div class="edge-row edge-row--legend">
						<div class="edge-from">
							<span class="g-glyph g-tk">▤</span><span class="edge-noun">Document</span>
						</div>
						<div class="edge-rel">
							<svg class="edge-rel-svg" viewBox="0 0 100 14" preserveAspectRatio="none"
								><line x1="0" y1="7" x2="92" y2="7" stroke="#7A1F1A" stroke-width="1.5" /><polygon
									points="92,3 100,7 92,11"
									fill="#7A1F1A"
								/></svg
							>
							<span class="edge-rel-name">AMENDS</span>
						</div>
						<div class="edge-to">
							<span class="g-glyph g-wet">❡</span><span class="edge-noun">Artikel</span>
						</div>
					</div>
				</article>

				<article class="edge-legend-row">
					<div class="edge-legend-cat">
						<div class="edge-legend-name">Verwijzing</div>
						<p class="edge-legend-desc">
							Gelezen uit de bron-XML (betrouwbaarheid 1) of herkend in de tekst (betrouwbaarheid
							tussen 0 en 1).
						</p>
					</div>
					<div class="edge-row edge-row--legend">
						<div class="edge-from">
							<span class="g-glyph g-recht">¶</span><span class="edge-noun">Uitspraak</span>
						</div>
						<div class="edge-rel">
							<svg class="edge-rel-svg" viewBox="0 0 100 14" preserveAspectRatio="none"
								><line
									x1="0"
									y1="7"
									x2="92"
									y2="7"
									stroke="#3A362E"
									stroke-width="1.5"
									stroke-dasharray="4 3"
								/><polygon points="92,3 100,7 92,11" fill="#3A362E" /></svg
							>
							<span class="edge-rel-name">REFERS_TO</span>
						</div>
						<div class="edge-to">
							<span class="g-glyph g-wet">❡</span><span class="edge-noun">Artikel</span>
						</div>
					</div>
				</article>
			</div>
		</section>
		<!-- ═══════════════════════════════════════════════════ -->
		<!-- §iii Per bron, in praktijk -->
		<!-- ═══════════════════════════════════════════════════ -->
		<section id="praktijk">
			<div class="sec-head">
				<div class="sec-num"><strong>iii</strong></div>
				<div>
					<h2 class="sec-title">Per bron, in praktijk</h2>
					<p class="sec-deck">
						Per bron: wat erin gaat, en welke bronnen en structurele verbindingen eruit komen.
						Detail per bron staat in de bijlage onderaan.
					</p>
				</div>
			</div>

			<table class="bron-compare bron-compare--full">
				<thead>
					<tr>
						<th>Bron</th>
						<th>Wat erin gaat</th>
						<th>Parse-bijzonderheid</th>
						<th>Wat eruit komt</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td class="bron"><span class="bron-stripe is-wet"></span>BWB &middot; wetten</td>
						<td
							>XML-toestand per BWBR, geneste <span class="mono">&lt;artikel&gt;</span>/<span
								class="mono">&lt;lid&gt;</span
							></td
						>
						<td
							>Genest XML doorlopen; tekst uit <span class="mono">&lt;lid&gt;</span>+<span
								class="mono">&lt;al&gt;</span
							>, titel uit <span class="mono">citeertitel</span>; een artikel houdt zijn
							<span class="mono">stam-id</span> over versies en hernummering heen</td
						>
						<td>
							<span class="g-glyph g-wet">&sect;</span> Instrument
							<span class="bron-sep">&middot;</span>
							<span class="g-glyph g-wet">&#10081;</span> Artikel
							<span class="bron-sep">&middot;</span>
							<span class="g-glyph g-wet">&#9642;</span> Bijlage
							<div class="bron-edge"><em>PART_OF</em>, <em>VERSION_OF</em></div>
						</td>
					</tr>
					<tr>
						<td class="bron"><span class="bron-stripe is-recht"></span>Rechtspraak</td>
						<td
							>RDF-record + uitspraak-XML, &eacute;&eacute;n per ECLI; voor het EHRM een
							HUDOC-record</td
						>
						<td
							>RDF levert metadata, <span class="mono">&lt;inhoudsindicatie&gt;</span> de
							samenvatting,
							<span class="mono">&lt;uitspraak&gt;</span> de alinea&rsquo;s</td
						>
						<td>
							<span class="g-glyph g-recht">&para;</span> Uitspraak
						</td>
					</tr>
					<tr>
						<td class="bron"><span class="bron-stripe is-eu"></span>EUR-Lex</td>
						<td>HTML zonder structurele <span class="mono">&lt;artikel&gt;</span>-tags</td>
						<td>Structuur reconstrueren uit tekstgrenzen; regex op "Artikel N"</td>
						<td>
							<span class="g-glyph g-eu">&sect;</span> Instrument
							<span class="bron-sep">&middot;</span>
							<span class="g-glyph g-eu">&#10081;</span> Artikel
							<div class="bron-edge"><em>PART_OF</em></div>
						</td>
					</tr>
					<tr>
						<td class="bron"><span class="bron-stripe is-tk"></span>Parlementair</td>
						<td>OData JSON, geneste payloads</td>
						<td>Geneste verbindingen uitvouwen; stemmingen groeperen; fracties afleiden</td>
						<td>
							Negen typen; <span class="bron-bijlage">fan-out in bijlage</span>
						</td>
					</tr>
					<tr>
						<td class="bron"
							><span class="bron-stripe is-wet"></span>Staatsblad &middot; Staatscourant</td
						>
						<td>XML uit de KOOP-repository, opgehaald via SRU</td>
						<td>Toelichting of regeling als tekst; het BWB-id staat in de XML</td>
						<td>
							<span class="g-glyph g-tk">&#9636;</span> Document
							<div class="bron-edge"><em>EXPLAINS</em></div>
						</td>
					</tr>
					<tr>
						<td class="bron"><span class="bron-stripe is-tk"></span>Eerste Kamer</td>
						<td>SRU-records van Kamerstukken: metadata, geen tekst en geen stemmingen</td>
						<td
							>Dossiernummer en toevoeging staan gescheiden; eigen dossiers dragen een Romeins
							cijfer</td
						>
						<td>
							<span class="g-glyph g-tk">&#9636;</span> Document
							<div class="bron-edge"><em>PART_OF</em> het dossier van de Tweede Kamer</div>
						</td>
					</tr>
					<tr>
						<td class="bron"><span class="bron-stripe is-wet"></span>Verdragenbank</td>
						<td>JSON per verdrag</td>
						<td>Verdragen zijn instrumenten, net als in de BWB</td>
						<td>
							<span class="g-glyph g-wet">&sect;</span> Instrument
						</td>
					</tr>
				</tbody>
			</table>
		</section>

		<!-- ═══════════════════════════════════════════════════ -->
		<!-- §iv Detectoren -->
		<!-- ═══════════════════════════════════════════════════ -->
		<section id="detectoren">
			<div class="sec-head">
				<div class="sec-num"><strong>iv</strong></div>
				<div>
					<h2 class="sec-title">Detectoren</h2>
					<p class="sec-deck">
						Detectoren leggen de verbindingen die de bronstructuur niet zelf geeft. Wat een detector
						doet, hoe ze samen werken en welke verbindingen ze opleveren.
					</p>
				</div>
			</div>

			<div class="tot-block">
				<h3 class="block-h">Hoe een detector werkt</h3>
				<p class="block-deck">
					Een tekstdetector leest een tekstveld en markeert verwijzingen in vaste vorm: <em
						>art. 47 Sr</em
					>, <em>ECLI:NL:HR:2023:1234</em>,
					<em>Richtlijn 2010/64</em>. Geen taalmodel, alleen vormherkenning. Andere detectoren lezen
					de verwijzingen in de bron-XML of lopen langs bestaande verbindingen.
				</p>

				<figure class="detector-fig">
					<svg
						viewBox="0 0 720 200"
						preserveAspectRatio="xMidYMid meet"
						role="img"
						aria-label="Eén detector-doorgang: invoer, regel, uitvoer"
					>
						<defs>
							<marker
								id="det-arr"
								viewBox="0 0 10 10"
								refX="8"
								refY="5"
								markerWidth="7"
								markerHeight="7"
								orient="auto"
							>
								<path d="M 0 1 L 9 5 L 0 9 z" fill="#1A1814" />
							</marker>
						</defs>

						<!-- ─── Top: voorbeeld-zin met highlight ─── -->
						<text
							x="0"
							y="22"
							font-family="IBM Plex Sans, sans-serif"
							font-size="9"
							letter-spacing="1.4"
							fill="#9A9485">VOORBEELD</text
						>
						<text
							x="0"
							y="46"
							font-family="EB Garamond, serif"
							font-style="italic"
							font-size="14"
							fill="#6B6558"
							>“… onverminderd
						</text>
						<rect x="146" y="32" width="66" height="20" fill="#E9DEC4" />
						<text x="153" y="46" font-family="EB Garamond, serif" font-size="14" fill="#1A1814"
							>artikel 51</text
						>
						<text
							x="216"
							y="46"
							font-family="EB Garamond, serif"
							font-style="italic"
							font-size="14"
							fill="#6B6558"
						>
							wordt als dader gestraft …”</text
						>

						<!-- separator -->
						<line x1="0" y1="66" x2="720" y2="66" stroke="#E2DBCC" />

						<!-- ─── Drie fasen, gelijke dozen ─── -->
						<rect x="30" y="92" width="180" height="44" fill="#FFFDF4" stroke="#1A1814" />
						<text
							x="40"
							y="108"
							font-family="IBM Plex Sans, sans-serif"
							font-size="9"
							letter-spacing="1.4"
							fill="#9A9485">INVOER</text
						>
						<text x="40" y="126" font-family="EB Garamond, serif" font-size="15" fill="#1A1814"
							>Tekstveld</text
						>

						<line
							x1="210"
							y1="114"
							x2="268"
							y2="114"
							stroke="#1A1814"
							stroke-width="1.2"
							marker-end="url(#det-arr)"
						/>

						<rect x="270" y="92" width="180" height="44" fill="#FFFDF4" stroke="#1A1814" />
						<text
							x="280"
							y="108"
							font-family="IBM Plex Sans, sans-serif"
							font-size="9"
							letter-spacing="1.4"
							fill="#9A9485">REGEL</text
						>
						<text x="280" y="126" font-family="EB Garamond, serif" font-size="15" fill="#1A1814"
							>Patroon</text
						>

						<line
							x1="450"
							y1="114"
							x2="508"
							y2="114"
							stroke="#1A1814"
							stroke-width="1.2"
							marker-end="url(#det-arr)"
						/>

						<rect x="510" y="92" width="180" height="44" fill="#FFFDF4" stroke="#1A1814" />
						<text
							x="520"
							y="108"
							font-family="IBM Plex Sans, sans-serif"
							font-size="9"
							letter-spacing="1.4"
							fill="#9A9485">UITVOER</text
						>
						<text x="520" y="126" font-family="EB Garamond, serif" font-size="15" fill="#1A1814"
							>Verbinding</text
						>

						<!-- ─── Captions onder de dozen ─── -->
						<text
							x="120"
							y="158"
							font-family="iA Writer Mono, monospace"
							font-size="10"
							fill="#9A9485"
							text-anchor="middle">❡ art. 47 Sr · veld:tekst</text
						>
						<text
							x="120"
							y="176"
							font-family="EB Garamond, serif"
							font-style="italic"
							font-size="11"
							fill="#6B6558"
							text-anchor="middle">wettekst die wordt gescand</text
						>

						<text
							x="360"
							y="158"
							font-family="iA Writer Mono, monospace"
							font-size="10"
							fill="#9A9485"
							text-anchor="middle">art. \d+ \w+</text
						>
						<text
							x="360"
							y="176"
							font-family="EB Garamond, serif"
							font-style="italic"
							font-size="11"
							fill="#6B6558"
							text-anchor="middle">binnen-wet verwijzing</text
						>

						<text
							x="600"
							y="158"
							font-family="iA Writer Mono, monospace"
							font-size="10"
							fill="#9A9485"
							text-anchor="middle">❡art.47 → ❡art.51 · 0.95</text
						>
						<text
							x="600"
							y="176"
							font-family="EB Garamond, serif"
							font-style="italic"
							font-size="11"
							fill="#6B6558"
							text-anchor="middle">REFERS_TO</text
						>
					</svg>
				</figure>
			</div>

			<div class="tot-block">
				<h3 class="block-h">Wat de detectoren bestrijken</h3>
				<p class="block-deck">
					Elke detector richt zich op één type verwijzing tussen één paar brontypen. Samen leggen ze
					de verbindingen die uit de brondata zelf niet zijn af te leiden.
				</p>
				<table class="det-overview">
					<thead>
						<tr>
							<th>Detector</th>
							<th>Vindt</th>
							<th>Levert</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td><span class="g-glyph g-wet">❡</span> Artikel → artikel</td>
							<td
								>Verwijzingen in de bron-XML (<span class="mono">extref</span>,
								<span class="mono">intref</span>)</td
							>
							<td><em>REFERS_TO</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-wet">❡</span> Artikel → artikel (type)</td>
							<td
								>Aard van de verwijzing: voorwaarde, uitzondering, definitie, procedure, reikwijdte,
								delegatie</td
							>
							<td><em>REFERS_TO</em> met <span class="mono">semantic_type</span></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-wet">§</span> Instrument → artikel</td>
							<td>Het artikel in de aanhef &ldquo;Gelet op&rdquo;</td>
							<td><em>BASED_ON</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-wet">❡</span> Artikel → bijlage</td>
							<td>Artikelen waarvan een bijlage de reikwijdte bepaalt</td>
							<td><em>SCOPED_BY</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-wet">§</span> Publicatie → artikel</td>
							<td
								>Door een publicatie in het Staatsblad ingevoerde, gewijzigde of vervallen artikelen</td
							>
							<td><em>INTRODUCES</em>, <em>AMENDS</em>, <em>REPEALS</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-wet">§</span> Instrument → dossier</td>
							<td>Het dossier waarin een regeling of publicatie tot stand kwam</td>
							<td><em>LEGISLATED_IN</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-wet">§</span> Instrument → instrument</td>
							<td>Nationale regeling die een EU-richtlijn implementeert</td>
							<td><em>IMPLEMENTS</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-recht">¶</span> Uitspraak → artikel</td>
							<td>Artikelen genoemd in de motivering</td>
							<td><em>REFERS_TO</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-recht">¶</span> Uitspraak → uitspraak</td>
							<td
								>Geciteerde uitspraken (ECLI&rsquo;s); bij hoger beroep of cassatie de bestreden
								uitspraak</td
							>
							<td><em>REFERS_TO</em>, <em>APPEAL_OF</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-tk">▤</span> Document → artikel</td>
							<td>Artikelen en instrumenten die in een Kamerstuk figureren</td>
							<td><em>REFERS_TO</em></td>
						</tr>
						<tr class="is-mut">
							<td><span class="g-glyph g-tk">▤</span> Wetsvoorstel → artikel</td>
							<td>Voorgestelde wijzigingen, uit de titel en de tekst van Kamerstukken</td>
							<td
								><em>AMENDS</em>, <em>INTRODUCES</em>, <em>REPEALS</em> met status
								<em>voorgesteld</em></td
							>
						</tr>
						<tr>
							<td><span class="g-glyph g-tk">▤</span> Toelichting → artikel of instrument</td>
							<td
								>De toelichting bij het artikel dat een wijziging invoerde (langs bestaande
								verbindingen, zonder tekstherkenning)</td
							>
							<td><em>EXPLAINS</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-eu">❡</span> EU-artikel → artikel</td>
							<td>Verwijzingen vanuit EU-instrumenten</td>
							<td><em>REFERS_TO</em></td>
						</tr>
						<tr>
							<td><span class="g-glyph g-tk">▤</span> Eerste Kamer → dossier</td>
							<td>Het dossier van de Tweede Kamer met hetzelfde nummer</td>
							<td><em>PART_OF</em></td>
						</tr>
					</tbody>
				</table>
			</div>

			<div class="tot-block" id="afgeleid">
				<h3 class="block-h">Afgeleide gegevens</h3>
				<p class="block-deck">
					Een klein merkteken bij een gegeven betekent: afgeleid, niet gelezen uit de bron. De
					betrouwbaarheid ligt dan onder 1. Op dit moment zijn afgeleid:
				</p>
				<table class="det-overview">
					<thead>
						<tr>
							<th>Gegeven</th>
							<th>Afgeleid uit</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Het lid van een verwijzing</td>
							<td>De tekst van de verwijzing</td>
						</tr>
						<tr>
							<td>De passage van een memorie van toelichting bij een artikel</td>
							<td>Tekstovereenkomst op &ldquo;Artikel N&rdquo;</td>
						</tr>
						<tr>
							<td>De Kamer van een document</td>
							<td>Het voorvoegsel van de sleutel</td>
						</tr>
						<tr>
							<td>De implementatie van een EU-richtlijn (<em>IMPLEMENTS</em>)</td>
							<td>CELEX-nummers die in de tekst van een regeling staan; betrouwbaarheid 0,75</td>
						</tr>
					</tbody>
				</table>
			</div>

			<details class="appendix-details">
				<summary class="appendix-summary">
					<span class="appendix-kicker">Bijlage</span>
					<span class="appendix-title">Scoring, drempels en provenance</span>
					<span class="appendix-hint">open / sluit</span>
				</summary>
				<div class="appendix-body">
					<p class="method-prose">
						Op elk tekstveld draaien meerdere patronen, in volgorde van specificiteit.
						<em>Art. 47 Sr</em> (artikel mét wetscode) wordt eerder herkend dan een losse
						<em>artikel 47</em>. Een tekstpositie die door een sterker patroon is geclaimd, telt
						voor zwakkere patronen niet meer mee: geen dubbele verbindingen op dezelfde plek, geen
						verwarring over welk patroon de match leverde.
					</p>
					<p class="method-prose">
						Elke match krijgt een score die de specificiteit van het patroon weergeeft. Onder een
						drempel wordt geen verbinding bewaard. Tussen midden en hoog ontstaat een verbinding.
						Pas boven een hoge drempel mag een detector een nieuwe bron aanmaken voor een verwijzing
						waarvan het doel nog niet in het netwerk zit. Een onzekere match kan dus geen
						fantoom-artikel oproepen.
					</p>
					<p class="method-prose">
						Bij elke verbinding worden het tekstfragment, de patroonnaam en de exacte positie
						bewaard. Elke verbinding in het netwerk is herleidbaar tot de zin waaruit ze voortkwam.
					</p>
				</div>
			</details>

			<details class="appendix-details">
				<summary class="appendix-summary">
					<span class="appendix-kicker">Bijlage</span>
					<span class="appendix-title">Het parlementaire deel: OData-fan-out</span>
					<span class="appendix-hint">open / sluit</span>
				</summary>
				<div class="appendix-body">
					<p class="block-deck">
						TK breekt het strip-patroon: één OData-payload produceert meerdere brontypen met
						onderlinge structurele verbindingen. Hieronder de fan-out vanaf een document-record.
					</p>
					<div class="tk-fanout">
						<div class="tk-fanout-source">
							<div class="tk-fanout-h">Payload</div>
							<pre class="tk-fanout-input">&#123;
  "Id": "abc-123",
  "Soort": "Amendement",
  "Volgnummer": 7,
  "Zaak": [&#123;
    "Kamerstukdossier": [&#123;
      "Nummer": 36558
    &#125;]
  &#125;],
  "CommissieZetel": [&#123;
    "Lid": &hellip;,
    "Van": &hellip;,
    "TotEnMet": &hellip;
  &#125;]
&#125;</pre>
						</div>
						<div class="tk-fanout-nodes">
							<div class="tk-fanout-h">Bronnen &amp; structurele verbindingen</div>
							<ul class="tk-fanout-list">
								<li>
									<span class="g-glyph g-tk">&#8750;</span><span class="tk-name">Dossier</span>
									<span class="tk-id">36558</span>
								</li>
								<li>
									<span class="g-glyph g-tk">&#9636;</span><span class="tk-name">Document</span>
									<span class="tk-id">nr. 7</span>
									<em>· PART_OF Zaak en Dossier; AUTHORED door Kamerlid</em>
								</li>
								<li>
									<span class="g-glyph g-tk">&#9633;</span><span class="tk-name">Zaak</span>
									<em>· PART_OF Dossier</em>
								</li>
								<li>
									<span class="g-glyph g-tk">&#9671;</span><span class="tk-name">Activiteit</span>
									<em>· ABOUT Zaak; LED_BY Commissie</em>
								</li>
								<li>
									<span class="g-glyph g-tk">&#8862;</span><span class="tk-name">Stemming</span>
									<em>· ABOUT Zaak; gegroepeerd op Besluit_Id; VOTED per Kamerlid of Fractie</em>
								</li>
								<li>
									<span class="g-glyph g-tk">&#8857;</span><span class="tk-name">Toezegging</span>
									<em>· MADE_IN Activiteit; ABOUT Dossier</em>
								</li>
								<li>
									<span class="g-glyph g-tk">&Dagger;</span><span class="tk-name">Commissie</span>
								</li>
								<li>
									<span class="g-glyph g-tk">&middot;</span><span class="tk-name">Kamerlid</span>
									<em>· MEMBER_OF Commissie en Fractie</em>
								</li>
								<li>
									<span class="g-glyph g-tk">&loz;</span><span class="tk-name">Fractie</span>
									<em
										>· uit het Fractie-endpoint; anders afgeleid uit ActorFractie-namen op
										stemmingen</em
									>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</details>
		</section>

		<section class="method-further">
			<div class="method-further__title">Verder lezen</div>
			<div class="method-further__links">
				<a href="/docs" class="method-further__link">
					<span class="method-further__name">Documentatie</span>
					<span class="method-further__desc">Bronnen, dekking, verbindingen, beperkingen</span>
				</a>
				<a href="/api" class="method-further__link">
					<span class="method-further__name">API-referentie</span>
					<span class="method-further__desc">Alle endpoints uit de OpenAPI-spec</span>
				</a>
			</div>
		</section>
	</div>
</div>

<style>
	/* ── Verder lezen ──────────────────────────────────────────────────── */
	.method-further {
		margin-top: 64px;
		padding-top: 32px;
		border-top: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.method-further__title {
		font-family: var(--font-sans);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-4);
	}
	.method-further__links {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}
	.method-further__link {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		text-decoration: none;
		color: inherit;
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		background: var(--paper);
		transition:
			border-color 80ms,
			background 80ms;
	}
	.method-further__link:hover {
		border-color: var(--rule-strong);
		background: var(--paper-2);
	}
	.method-further__name {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--ink);
	}
	.method-further__desc {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		line-height: 1.5;
	}
	@media (max-width: 720px) {
		.method-further__links {
			grid-template-columns: 1fr;
		}
	}

	/* ── Page frame ─────────────────────────────────────────────────── */
	.page-wrap {
		padding: 48px 0 0;
	}

	.pg {
		max-width: 1080px;
		margin: 0 auto;
		padding: 48px 56px 96px;
		box-sizing: border-box;
	}

	/* ── Intro: title-block + verticale Fig.00 naast elkaar ──────────── */
	.pg-intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		grid-template-rows: auto auto 1fr;
		grid-template-areas:
			'kicker image'
			'title  image'
			'rest   image';
		column-gap: 56px;
		margin: 0 0 64px;
	}
	.pg-title-block {
		display: contents;
	}
	.pg-kicker {
		grid-area: kicker;
	}
	.pg-title {
		grid-area: title;
	}
	.pg-title-rest {
		grid-area: rest;
		max-width: 64ch;
	}
	.pg-overview-v {
		grid-area: image;
		margin: 0;
		align-self: start;
		padding: 18px 20px 20px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-top: 3px solid var(--ink);
		position: relative;
	}
	.pg-overview-v::before {
		content: 'FIG. 00';
		position: absolute;
		top: -3px;
		right: 16px;
		transform: translateY(-50%);
		background: var(--paper);
		padding: 0 6px;
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--fg-3);
	}
	.pg-overview-v svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 540px;
	}
	@media (max-width: 900px) {
		.pg-intro {
			grid-template-columns: 1fr;
			grid-template-areas:
				'kicker'
				'title'
				'image'
				'rest';
			row-gap: 24px;
		}
		.pg-overview-v {
			max-width: 320px;
			align-self: start;
			justify-self: start;
		}
	}

	.pg-kicker {
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin-bottom: 18px;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		background: var(--accent);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.pg-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: clamp(40px, 5.5vw, 64px);
		line-height: 1.04;
		letter-spacing: -0.018em;
		margin: 0 0 22px;
		text-wrap: balance;
		color: var(--ink);
	}

	.pg-lede {
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.55;
		color: var(--ink-2);
		max-width: 56ch;
		margin: 0;
		text-wrap: pretty;
	}
	.pg-lede + .pg-lede {
		margin-top: 14px;
	}
	.pg-lede--sub {
		font-size: 15px;
		color: var(--ink-3);
	}

	.pg-notes {
		margin: 28px 0 0;
		display: flex;
		flex-direction: column;
		gap: 0;
		border-top: 1px solid var(--rule);
	}

	.pg-note {
		display: grid;
		grid-template-columns: 88px 1fr;
		gap: 20px;
		padding: 12px 0;
		border-bottom: 1px dotted var(--rule);
	}

	.pg-note:last-child {
		border-bottom: none;
	}

	.pg-note dt {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		padding-top: 3px;
	}

	.pg-note dd {
		font-family: var(--font-serif);
		font-size: 14px;
		line-height: 1.6;
		color: var(--ink-2);
		margin: 0;
	}

	/* ── TOC ─────────────────────────────────────────────────────────── */
	.pg-toc {
		margin-bottom: 56px;
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: 32px;
	}

	.pg-toc-list {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 6px 32px;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.pg-toc-list li {
		border-bottom: 1px dotted var(--rule);
	}

	.pg-toc-list a {
		display: grid;
		grid-template-columns: 32px 1fr;
		gap: 12px;
		padding: 8px 0;
		align-items: baseline;
		color: inherit;
		text-decoration: none;
		border: none;
		transition: none;
	}

	.pg-toc-list a:hover .pg-toc-name {
		color: var(--accent);
	}
	.pg-toc-list a.active .pg-toc-name {
		color: var(--accent);
		font-weight: 500;
	}

	.pg-toc-num {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-4);
	}

	.pg-toc-name {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--ink-2);
		transition: color 120ms;
	}

	/* ── Sections ─────────────────────────────────────────────────────── */
	section {
		margin-bottom: 64px;
		scroll-margin-top: 64px;
	}

	section:last-of-type {
		margin-bottom: 0;
	}

	.sec-head {
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: 32px;
		align-items: baseline;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--rule);
		margin-bottom: 28px;
	}

	.sec-num {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--fg-3);
		letter-spacing: 0.08em;
	}

	.sec-num strong {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--accent);
		font-size: 18px;
		letter-spacing: 0;
		margin-right: 6px;
	}

	.sec-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 28px;
		letter-spacing: -0.012em;
		line-height: 1.15;
		margin: 0;
		color: var(--ink);
		text-wrap: balance;
	}

	.sec-deck {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 17px;
		line-height: 1.5;
		color: var(--fg-3);
		margin: 6px 0 0;
	}

	/* ── Source cards ─────────────────────────────────────────────────── */
	.sources {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0;
		border-left: 1px solid var(--rule);
	}

	.src {
		border-right: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 22px 22px 26px;
		background: var(--paper);
		display: flex;
		flex-direction: column;
		min-height: 240px;
	}

	.src-num {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		color: var(--fg-4);
		margin-bottom: 14px;
	}

	.src-domain {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin-bottom: 6px;
	}

	.src-name {
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 500;
		color: var(--ink);
		line-height: 1.15;
		margin-bottom: 14px;
		letter-spacing: -0.005em;
	}

	.src-name :global(.url),
	.url {
		color: var(--ink-3);
		font-style: italic;
		font-weight: 400;
		font-size: 14px;
		display: block;
		margin-top: 3px;
	}

	.src-desc {
		font-family: var(--font-serif);
		font-size: 14px;
		line-height: 1.5;
		color: var(--ink-2);
		margin: 0 0 auto;
	}

	.src-id {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-2);
		padding-top: 16px;
		margin-top: 16px;
		border-top: 1px dotted var(--rule);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.src-id-label {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	.src.is-wet {
		border-top: 3px solid var(--ink);
	}
	.src.is-recht {
		border-top: 3px solid var(--indigo);
	}
	.src.is-tk {
		border-top: 3px solid var(--accent);
	}
	.src.is-eu {
		border-top: 3px solid var(--teal, #1f5a56);
	}

	/* ── Edge tables ──────────────────────────────────────────────────── */

	.edge-row {
		display: grid;
		grid-template-columns: 1fr 200px 1fr 70px;
		gap: 18px;
		padding: 14px 0;
		border-bottom: 1px dotted var(--rule);
		align-items: center;
	}

	.edge-from,
	.edge-to {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.edge-noun {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	.edge-rel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-align: center;
	}

	.edge-rel-svg {
		width: 100%;
		height: 14px;
	}

	.edge-rel-name {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-2);
		font-weight: 500;
	}

	/* ── Shared utility ───────────────────────────────────────────────── */
	.mono {
		font-family: var(--font-mono);
		font-size: 0.92em;
		color: var(--ink-2);
	}

	em {
		font-style: italic;
	}

	/* ── Responsive ───────────────────────────────────────────────────── */
	@media (max-width: 1020px) {
		.pg {
			padding: 40px 40px 80px;
		}
		.sources {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 880px) {
		.pg {
			padding: 40px 28px 80px;
		}
		.pg-title {
			font-size: 40px;
		}
		.sec-head,
		.pg-toc {
			grid-template-columns: 1fr;
			gap: 14px;
		}

		.edge-row {
			grid-template-columns: 1fr;
			gap: 8px;
		}

		.pg-toc-list {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.pg {
			padding: 32px 20px 64px;
		}
		.sources {
			grid-template-columns: 1fr;
		}
	}

	/* ── Iconografie · canonieke glyphs ─────────────────────────────────
	   Kleurtaal: wet = ink, rechtspraak = indigo, TK = accent (spine), EU = ink-3.
	   Glyphs zijn supplementair: zelfde grootte als de naam, in lijn met de tekst. */
	.g-glyph {
		display: inline-block;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1em;
		line-height: 1;
		margin-right: 0.35em;
		opacity: 0.85;
	}
	.g-wet {
		color: var(--ink);
	}
	.g-recht {
		color: var(--indigo);
	}
	.g-tk {
		color: var(--accent);
	}
	.g-eu {
		color: var(--teal, #1f5a56);
	}

	/* Edge-table: glyph zit naast noun, niet rechts uitlijnen */
	.edge-from,
	.edge-to {
		display: flex;
		align-items: baseline;
		gap: 0;
		flex-wrap: wrap;
	}
	.edge-from .g-glyph,
	.edge-to .g-glyph {
		flex: 0 0 auto;
	}

	/* §4 totstandkoming ─ tot-card grid */
	.tot-block {
		margin-bottom: 24px;
	}

	/* TOC header (replaces gloss marginalia) */
	.pg-toc-h {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	/* Phases: flat, no marginalia column */
	.phase-fig {
		margin: 4px 0 28px;
		padding: 24px 28px 28px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-top: 3px solid var(--ink);
		position: relative;
	}
	.phase-fig::before {
		content: 'FIG. 01';
		position: absolute;
		top: -3px;
		right: 16px;
		transform: translateY(-50%);
		background: var(--paper);
		padding: 0 6px;
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--fg-3);
	}
	.phase-fig svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 200px;
	}

	/* Detector figure: same wrapper language as .phase-fig, FIG. 02 */
	.detector-fig {
		margin: 8px 0 0;
		padding: 24px 28px 28px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-top: 3px solid var(--ink);
		position: relative;
	}
	.detector-fig::before {
		content: 'FIG. 02';
		position: absolute;
		top: -3px;
		right: 16px;
		transform: translateY(-50%);
		background: var(--paper);
		padding: 0 6px;
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--fg-3);
	}
	.detector-fig svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 240px;
	}
	.phase-link {
		cursor: pointer;
	}
	.phase-link rect {
		transition:
			stroke 120ms,
			fill 120ms;
	}
	.phase-link:hover rect,
	.phase-link:focus-visible rect {
		stroke: var(--accent);
		fill: var(--paper-2, #faf5e5);
	}
	.phase-link:hover .phase-link-cue,
	.phase-link:focus-visible .phase-link-cue {
		fill: var(--accent);
	}
	.phase-link:focus-visible {
		outline: none;
	}

	/* Block heading (replaces subsec-head + subsec-num) */
	.block-h {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 24px;
		letter-spacing: -0.005em;
		line-height: 1.2;
		color: var(--ink);
		margin: 56px 0 14px;
		padding-top: 28px;
		border-top: 1px solid var(--rule);
	}
	.tot-block:first-of-type > .block-h:first-child,
	section > .block-h:first-of-type {
		margin-top: 28px;
		padding-top: 0;
		border-top: 0;
	}

	.block-deck {
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.6;
		color: var(--fg-2);
		margin: 0 0 24px;
	}
	.block-note {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		line-height: 1.6;
		color: var(--fg-3);
		margin: 16px 0 0;
	}

	/* Verbindingen legend (one canonical example per category) */
	.edge-legend {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin: 4px 0 0;
	}
	.edge-legend-row {
		display: grid;
		grid-template-columns: minmax(220px, 1fr) minmax(0, 1.4fr);
		gap: 32px;
		padding: 18px 0;
		align-items: center;
	}
	.edge-legend-row + .edge-legend-row {
		border-top: 1px solid var(--rule);
	}
	.edge-legend-name {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 18px;
		color: var(--ink);
		margin-bottom: 4px;
	}
	.edge-legend-desc {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		line-height: 1.55;
		color: var(--fg-3);
		margin: 0;
	}
	.edge-row--legend {
		display: grid;
		grid-template-columns: 1fr 140px 1fr;
		gap: 14px;
		padding: 0;
		border: 0;
		align-items: center;
	}
	.edge-row--legend .edge-from,
	.edge-row--legend .edge-to {
		display: flex;
		gap: 6px;
		align-items: baseline;
	}

	/* Detector index table (compact alternative to chain rows) */
	.method-prose {
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.65;
		color: var(--ink-2);
		margin: 0;
	}
	.method-prose + .method-prose {
		margin-top: 14px;
	}
	.method-prose em {
		font-style: italic;
		color: var(--ink);
	}

	.det-overview {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-serif);
		font-size: 13px;
		margin: 8px 0 16px;
	}
	.det-overview th {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		text-align: left;
		padding: 8px 12px 8px 0;
		border-bottom: 1px solid var(--rule);
	}

	.det-overview td {
		padding: 10px 12px 10px 0;
		border-bottom: 1px dotted var(--rule);
		color: var(--ink-2);
		vertical-align: baseline;
		line-height: 1.4;
	}

	.det-overview td em {
		font-style: italic;
		color: var(--fg-2);
	}
	.det-overview .g-glyph {
		font-size: 14px;
		margin-right: 2px;
	}

	/* Appendix (collapsed reference) */

	.appendix-details {
		border-top: 1px solid var(--rule);
	}
	.appendix-details:last-of-type {
		border-bottom: 1px solid var(--rule);
	}
	.appendix-summary {
		display: flex;
		align-items: baseline;
		gap: 18px;
		padding: 18px 0;
		cursor: pointer;
		list-style: none;
	}
	.appendix-summary::-webkit-details-marker {
		display: none;
	}
	.appendix-kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-3);
	}
	.appendix-title {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 500;
		color: var(--ink);
		flex: 1;
	}
	.appendix-hint {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}
	.appendix-details[open] .appendix-hint::before {
		content: '−  ';
	}
	.appendix-details:not([open]) .appendix-hint::before {
		content: '+  ';
	}
	.appendix-body {
		padding: 8px 0 28px;
	}

	@media (max-width: 1020px) {
		.edge-legend-row {
			grid-template-columns: 1fr;
			gap: 12px;
		}
	}

	/* ── Bron-compare table ───────────────────────────────────────── */

	.bron-compare {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-serif);
		font-size: 13px;
	}
	.bron-compare th {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		text-align: left;
		padding: 10px 14px 8px 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: bottom;
	}
	.bron-compare td {
		padding: 14px 14px 14px 0;
		border-bottom: 1px dotted var(--rule);
		color: var(--ink-2);
		vertical-align: top;
		line-height: 1.5;
	}
	.bron-compare tr:last-child td {
		border-bottom: 0;
	}
	.bron-compare td.bron {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 14px;
		color: var(--ink);
		white-space: nowrap;
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.bron-stripe {
		display: inline-block;
		width: 3px;
		height: 14px;
		background: var(--ink);
		transform: translateY(2px);
	}
	.bron-stripe.is-recht {
		background: var(--indigo);
	}
	.bron-stripe.is-tk {
		background: var(--accent);
	}
	.bron-stripe.is-eu {
		background: var(--teal, #1f5a56);
	}
	.bron-sep {
		color: var(--fg-3);
		margin: 0 4px;
	}
	.bron-compare--full {
		font-size: 15px;
		margin-top: 8px;
	}
	.bron-compare--full th {
		font-size: 11px;
		padding: 14px 18px 10px 0;
	}
	.bron-compare--full td {
		padding: 18px 18px 18px 0;
		line-height: 1.55;
	}
	.bron-compare--full td.bron {
		font-size: 16px;
	}
	.bron-compare--full .g-glyph {
		font-size: 16px;
		margin-right: 2px;
	}
	.bron-edge {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--fg-3);
		margin-top: 6px;
	}
	.bron-edge em {
		color: var(--ink-2);
	}
	.bron-bijlage {
		font-style: italic;
		color: var(--fg-3);
	}

	/* ── TK fan-out ────────────────────────────────────────────────── */
	.tk-fanout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
		gap: 32px;
		margin: 8px 0 28px;
	}
	.tk-fanout-h {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin-bottom: 10px;
	}
	.tk-fanout-input {
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.55;
		color: var(--ink);
		margin: 0;
		padding: 12px 14px;
		background: var(--paper-2);
		border-left: 3px solid var(--accent);
		white-space: pre;
		overflow-x: auto;
	}
	.tk-fanout-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tk-fanout-list li {
		display: grid;
		grid-template-columns: 22px auto 1fr;
		gap: 8px;
		padding: 7px 0;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1.4;
		border-bottom: 1px dotted var(--rule);
		align-items: baseline;
	}
	.tk-fanout-list li:last-child {
		border-bottom: 0;
	}
	.tk-fanout-list .g-glyph {
		font-size: 16px;
		margin-right: 0;
	}
	.tk-fanout-list .tk-name {
		font-family: var(--font-serif);
		font-weight: 500;
		color: var(--ink);
	}
	.tk-fanout-list .tk-id {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-3);
	}
	.tk-fanout-list em {
		font-style: italic;
		color: var(--fg-3);
		font-size: 12px;
	}

	@media (max-width: 880px) {
		.tk-fanout {
			grid-template-columns: 1fr;
		}
		.bron-compare,
		.bron-compare thead,
		.bron-compare tbody,
		.bron-compare tr,
		.bron-compare td,
		.bron-compare th {
			display: block;
		}
		.bron-compare thead {
			display: none;
		}
		.bron-compare td {
			padding: 6px 0;
			border-bottom: 0;
		}
		.bron-compare tr {
			padding: 14px 0;
			border-bottom: 1px solid var(--rule);
		}
	}

	/* ── Brontype inventory    ──────────────────────────── */
	.brontype-inventory {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0;
		margin: 4px 0 0;
		padding: 0;
	}
	.brontype-domain {
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: 24px;
		align-items: baseline;
		padding: 12px 0;
	}
	.brontype-domain + .brontype-domain {
		border-top: 1px dotted var(--rule);
	}
	.brontype-domain-h {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 14px;
		color: var(--ink);
		margin: 0;
		position: relative;
		padding-left: 14px;
	}
	.brontype-domain-h::before {
		content: '';
		position: absolute;
		left: 0;
		top: 4px;
		bottom: 4px;
		width: 3px;
		background: var(--ink);
	}
	.brontype-domain.is-recht .brontype-domain-h::before {
		background: var(--indigo);
	}
	.brontype-domain.is-tk .brontype-domain-h::before {
		background: var(--accent);
	}
	.brontype-domain-list {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px 20px;
	}
	.brontype-item {
		font-family: var(--font-serif);
		font-size: 14px;
		color: var(--ink-2);
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		white-space: nowrap;
	}
	.brontype-item .g-glyph {
		font-size: 14px;
		margin-right: 0;
	}

	@media (max-width: 720px) {
		.brontype-domain {
			grid-template-columns: 1fr;
			gap: 6px;
		}
	}
</style>
