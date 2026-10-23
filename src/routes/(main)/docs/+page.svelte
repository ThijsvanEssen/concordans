<script lang="ts">
	import KeyList from '$lib/components/ui/KeyList.svelte';
	import KeyRow from '$lib/components/ui/KeyRow.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { getStats } from '$lib/api/stats';
	import { load } from '$lib/util/load.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { modKey } from '$lib/util/platform';
	import { RELATIONS } from '$lib/vocabulary';
	import { relationLabel } from '$lib/verbonden/relation-words';

	const stats = load(() => 'stats', getStats, 'Documentatie');
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<header class="blad__kop"><h1 class="blad__titel">Documentatie</h1></header>
		<p class="stub-lede">
			Concordans toont wetten, uitspraken en parlementaire stukken uit officiële bronnen, met de
			verbindingen ertussen. Waar de gegevens vandaan komen en wat ermee mag, staat bij
			<a href="/bronnen" class="cite">Bronnen en hergebruik</a>; hoe de verbindingen ontstaan en
			waar de grenzen liggen, in de <a href="/docs/methode" class="cite">Methode</a>; wat geldt voor
			gebruik, in de <a href="/voorwaarden" class="cite">Voorwaarden</a>.
		</p>

		<div class="section" id="onderdelen">
			<h2 class="section-title">Onderdelen</h2>
			<p>
				Zoeken (startpagina, <kbd>{modKey} K</kbd>) gaat naar een bron. De balk bovenaan toont
				lijsten per soort bron: Wetten, Uitspraken, Kamerstukken, Parlement en Regering. Actueel
				toont per dag nieuwe Kamerstukken, stemmingen, toezeggingen, uitspraken en publicaties.
				Netwerk, naast het zoekveld, toont een bron groot met haar verbindingen. Mijn bevat Bundels
				en Gevolgd.
			</p>
			<p>
				Een bron opent als tekst. Een artikel, wet, uitspraak of Kamerstuk staat daar als tekst op
				volle breedte (<strong>Tekst</strong>) of naast het netwerk (<strong>Netwerk</strong>). Elke
				andere bron staat naast het netwerk. Verbonden, rechts, somt de verbindingen van de bron op
				per groep. Elke rij zegt hoe de bron verbonden is: wat ze aanhaalt of wijzigt, in welk lid
				of welke overweging, met de passage. Een verbinding op een herkende naam staat schuin. Hover
				of focus toont waar de verbinding vandaan komt. Een klik op de rij opent de bron in het
				netwerk. Het netwerk tekent dezelfde verbindingen.
			</p>
		</div>

		<div class="section" id="soorten">
			<h2 class="section-title">Soorten bronnen</h2>
			<p>
				Een wet of regeling komt uit het Basiswettenbestand; verdragen en Europese regelingen staan
				ernaast. Een regeling bestaat uit artikelen. Een eerdere tekst van een artikel is een eigen
				bron. Een publicatie in het Staatsblad wijzigt een regeling, voegt eraan toe of trekt haar
				in.
			</p>
			<p>
				Een uitspraak verwijst naar artikelen, instrumenten en andere uitspraken. Een uitspraak in
				hoger beroep of cassatie is verbonden met de bestreden uitspraak.
			</p>
			<p>
				Een dossier bundelt de Kamerstukken, activiteiten, stemmingen en toezeggingen over één
				onderwerp, bij beide Kamers.
			</p>
			<p>
				De herkomst, de dekking en de stand per bron staan bij
				<a href="/bronnen#dekking" class="cite">Bronnen en hergebruik</a>.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Zoeken</h2>
			<p>
				Het zoekveld doorzoekt wetten en regelingen, artikelen, uitspraken, dossiers, Kamerstukken,
				stemmingen, personen, fracties, commissies, kabinetten en toezeggingen. Een treffer op
				nummer staat eerst.
			</p>
			<p>Een nummer, citaat of wetsnaam opent de bron direct:</p>
			<KeyList>
				<KeyRow key="ECLI">ECLI:NL:HR:2019:1278</KeyRow>
				<KeyRow key="artikelcitaat">artikel 287 Sr, art. 7:658 BW</KeyRow>
				<KeyRow key="dossier">36264, 37020-XV</KeyRow>
				<KeyRow key="Kamerstuk">37020-XV-3, Kamerstukken II 2020/21, 36327, nr. 3</KeyRow>
				<KeyRow key="BWB-id of CELEX-nummer">BWBR0001854, 32013L0036</KeyRow>
				<KeyRow key="wetsnaam">Awb, Algemene verordening gegevensbescherming</KeyRow>
			</KeyList>
			<p>
				Een bron heeft een eigen adres: op haar officiële nummer, en voor personen en organen op
				naam.
			</p>
			<KeyList>
				<KeyRow key="uitspraak">/uitspraken/ECLI:NL:HR:2019:2006</KeyRow>
				<KeyRow key="artikel">/wetten/BWBR0005289/artikel/6:162</KeyRow>
				<KeyRow key="dossier">/dossiers/36600-VIII</KeyRow>
				<KeyRow key="Kamerstuk">/kamerstukken/36799/31, /kamerstukken/36600-VIII/AB</KeyRow>
				<KeyRow key="publicatie">/stb/2026/94, /stcrt/…, /trb/…</KeyRow>
				<KeyRow key="lid">/leden/rob-jetten</KeyRow>
				<KeyRow key="kabinet">/kabinetten/rutte_iv</KeyRow>
				<KeyRow key="fractie">/fracties/d66</KeyRow>
				<KeyRow key="commissie">/commissies/szw</KeyRow>
				<KeyRow key="toezegging">/toezeggingen/TZ202609-124</KeyRow>
			</KeyList>
		</div>

		<div class="section" id="terugvinden">
			<h2 class="section-title">Terugvinden</h2>
			<p>
				Elke lezer linkt naar de bron bij de uitgever: wetten.overheid.nl, rechtspraak.nl,
				tweedekamer.nl, eerstekamer.nl, EUR-Lex of HUDOC. Daar staat de officiële tekst. Hoe een
				tekst en de verbindingen worden aangehaald, staat bij
				<a href="/bronnen#hergebruik" class="cite">Bronnen en hergebruik</a>.
			</p>
			<p>
				Een plaats in de tekst staat in het adres na het hekje: <code>#lid-2-onder-a</code> in een
				artikel, <code>#rov-5.3</code> in een uitspraak.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Verbindingen</h2>
			<p>
				Een verbinding legt vast wat de ene bron met de andere doet: een uitspraak verwijst naar een
				artikel, een Kamerstuk wijzigt een artikel, een Kamerlid is lid van een fractie.
			</p>
			<p>
				De kaart van een verbinding noemt haar betrouwbaarheid (hoog, matig of laag) met de
				herkomst: uit de bron, staat letterlijk in de tekst of naam herkend. Ook noemt de kaart de
				status. Een verbinding is vastgesteld, of voorgesteld als een wetsvoorstel haar nog maar
				voorstelt. Wat de woorden betekenen, staat in de <a
					href="/docs/methode#betrouwbaarheid"
					class="cite">methode</a
				>.
			</p>
			<p>De soorten verbindingen:</p>
			<LoadState state={stats.state} what="De soorten verbindingen" plural retry={stats.retry}>
				{#snippet children(s)}
					<KeyList columns={2}>
						{#each RELATIONS.filter((r) => (s.edges.by_relation[r] ?? 0) > 0) as relation (relation)}
							<KeyRow>{relationLabel(relation)}</KeyRow>
						{/each}
					</KeyList>
				{/snippet}
			</LoadState>
		</div>

		<div class="section">
			<h2 class="section-title">Klikken</h2>
			<p>
				Eén klik op een rij, een titel of een verwijzing opent die ter plekke. Een rij klapt uit;
				naast een verwijzing verschijnt een kaart met soort, naam, datum en de eerste regels. Met de
				muis erop of met de toetsenbordfocus verschijnt dezelfde kaart, zonder knoppen.
			</p>
			<p>
				In de kaart opent <strong>Lees</strong> de bron. <strong>In het netwerk</strong> toont haar
				met haar verbindingen. Een zoekresultaat opent de bron direct; zie ook de
				<a href="/docs/sneltoetsen" class="cite">sneltoetsen</a>.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Netwerk</h2>
			<p>
				Een klik op een bron in het netwerk markeert die bron: zij licht op met haar eigen
				verbindingen, en een kaart ernaast toont Tekst lezen, Toon verbonden bronnen en In het
				netwerk. Een tweede klik, Tekst lezen of Enter opent de lezer. Toon verbonden bronnen tekent
				het netwerk opnieuw rond die bron, tot het gekozen aantal stappen. Een klik ernaast of
				Escape heft de markering op. Aantal stappen voegt bronnen rond de gekozen bron toe; die
				staan vaag getekend.
			</p>
			<p>
				Meer dan veertig bronnen van één soort die alleen aan de gekozen bron hangen, staan als één
				groep, zoals ‘250 uitspraken’. Een klik op de groep tekent ze alle of toont ze in Verbonden.
				De artikelen van één wet, de stukken van één dossier en de leden van een fractie of
				commissie staan binnen een omtrek met haar naam. Een open teken, alleen de rand, is een bron
				die alleen genoemd wordt en niet in de gegevens staat.
			</p>
			<p>
				Het paneel Netwerk, rechtsboven, houdt bronnen vast over meerdere keuzes heen. Een klik op
				een naam zet de bron uit of aan; × haalt haar weg. <strong>+ bron</strong> zoekt een bron om toe
				te voegen; in Verbonden heeft elke rij een +. De gekozen bronnen staan in het adres; een gedeelde
				link toont hetzelfde netwerk.
			</p>
			<p>
				Het netwerk toont de gekozen bronnen met hun onderlinge verbindingen en met de bronnen
				ertussen, tot vier stappen. <strong>Bronnen ertussen</strong> zet die aan of uit. Een
				gekozen bron zonder verbinding met de andere staat in het paneel met
				<em>zonder verbinding</em>.
				<strong>Wissen</strong> maakt het netwerk leeg; Terug zet het terug. Zonder wissen opent Netwerk
				op het laatste netwerk.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Dossiers en Parlement</h2>
			<p>
				Een dossier heeft een nummer, soms met toevoeging: 37020-XV is een ander dossier dan 37020.
				Bronnen zet dossiers onder één nummer, zoals de hoofdstukken van een begroting, op één
				regel.
			</p>
			<p>
				De soort van een dossier is die van de Tweede Kamer: Wetgeving, Initiatiefwetgeving,
				Begroting, Verdrag, Initiatiefnota of PKB/Structuurvisie. Een ander dossier staat onder
				Overige dossiers.
			</p>
			<p>
				Een wetsvoorstel en een begroting doorlopen fasen: voorstel van wet, memorie van
				toelichting, advies Raad van State, verslag, nota naar aanleiding van het verslag, nota van
				wijziging of amendement, stemmingen en eindtekst. Een fase is doorlopen als een stuk,
				activiteit of besluit in de gegevens haar markeert.
			</p>
			<p>
				Een wetsvoorstel is aangenomen of verworpen, per Kamer, met datum en wijze van stemmen. Van
				de Eerste Kamer toont het dossier ook de stand en de stukken op eerstekamer.nl.
			</p>
			<p>
				Een stemming van de Tweede Kamer staat per fractie, met zetels, of per lid bij een
				hoofdelijke stemming. Zonder hoofdelijke stemming volgt de stem van een lid uit de fractie
				waartoe het op dat moment behoorde. Van een stemming van de Eerste Kamer staan de wijze van
				stemmen en de fracties voor en tegen, zonder zetels.
			</p>
			<p>
				De wetsgeschiedenis van een artikel is de reeks dossiers die het invoerden, wijzigden of
				introkken, met de dossiers die dat nu voorstellen.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Regering</h2>
			<p>
				Regering toont de kabinetten, de bewindspersonen en de toezeggingen. Een kabinet heeft een
				periode, een minister-president en een coalitie. Per ministerie staat op de tijdlijn van het
				kabinet wie welke post bekleedde. Een opvolger staat op dezelfde regel; een waarnemer staat
				gestippeld, met ‘waarnemend’. De demissionaire periode is een stippellijn op de tijdas.
			</p>
		</div>

		<div class="meta-row">
			<a href="/docs/methode" class="meta-link">Methode</a>
			<a href="/docs/sneltoetsen" class="meta-link">Sneltoetsen</a>
			<a href="/api" class="meta-link">API-referentie</a>
			<a href="/bronnen" class="meta-link">Bronnen en hergebruik</a>
		</div>
	</div>
</div>

<style>
	p {
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0 0 var(--s-3);
	}

	p:last-child {
		margin-bottom: 0;
	}

	code,
	kbd {
		font-family: var(--font-serif);
		font-size: 0.85em;
		color: var(--ink-2);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		padding: 0 var(--s-1);
	}
</style>
