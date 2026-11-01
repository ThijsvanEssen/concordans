<script lang="ts">
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { CONTACT_EMAIL } from '$lib/site/contact';
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<header class="blad__kop"><h1 class="blad__titel">Over Concordans</h1></header>
		<p class="stub-lede">Zie hoe wetten, rechtspraak en parlement samenhangen.</p>

		<Sectie title="Wat het doet" niveau={2} inklapbaar={false}>
			<p>
				Concordans haalt openbare informatie over wetten, rechtspraak en parlement op en verbindt
				die. Bij een artikel zie je welke uitspraken en Kamerstukken ernaar verwijzen, bij een
				wetsvoorstel hoe het zijn weg door de Kamers vindt en hoe fracties stemden. Het doel is dat
				dit uitgroeit tot één plek voor wetgeving, rechtspraak en parlement. Daar zijn we nog niet.
			</p>
			<p>
				Het netwerk is een selectie. Europese regelgeving staat erin voor zover een Nederlandse
				regeling ernaar verwijst. Van de Kamers staat het oudere archief er niet in: de Tweede Kamer
				is sinds ongeveer 2009 gelijkmatig dekkend, de besluiten van de Eerste Kamer beginnen in
				juni 2015. Ongepubliceerde uitspraken ontbreken omdat ze niet openbaar zijn.
			</p>
			<p>
				Verwijzingen worden herkend op vaste patronen, zonder taalmodel. Een ongebruikelijke
				formulering kan daardoor ontbreken of aan een andere bron gekoppeld zijn. Wat er staat, is
				bruikbaar; ga er alleen niet van uit dat het volledig is en controleer belangrijke punten
				bij de bron. Een gat wordt gemarkeerd, niet aangevuld. Elke bron wordt apart opgehaald; de
				stand per bron staat bij <a href="/bronnen" class="cite">Bronnen en hergebruik</a>.
				Concordans is in ontwikkeling en functies kunnen wijzigen.
			</p>
			<p>
				Bundels en gevolgde onderwerpen blijven in de browser; er zijn geen accounts. Concordans
				geeft geen juridisch advies.
			</p>
		</Sectie>

		<Sectie title="De naam" niveau={2} inklapbaar={false}>
			<p>
				Concordans komt van concordantie: een register van de woorden uit een werk, met de plaatsen
				waar ze voorkomen (<a
					href="https://www.ensie.nl/oosthoek/concordantie-konkordantie"
					target="_blank"
					rel="external noopener"
					class="cite">Oosthoek Encyclopedie</a
				>).
			</p>
		</Sectie>

		<Sectie title="Zelfstandig" niveau={2} inklapbaar={false}>
			<p>
				Concordans is niet gelieerd aan een juridische instelling, rechtbank of overheidsorgaan.
			</p>
		</Sectie>

		<Sectie title="Contact" niveau={2} inklapbaar={false} id="contact">
			<p>
				Vragen, opmerkingen, verzoeken voor grootschalig gebruik van de API en vragen over privacy
				gaan naar <a href="mailto:{CONTACT_EMAIL}" class="cite">{CONTACT_EMAIL}</a>.
			</p>
		</Sectie>

		<div class="meta-row">
			<a href="/bronnen" class="meta-link">Bronnen en hergebruik</a>
			<a href="/voorwaarden" class="meta-link">Voorwaarden</a>
			<a href="/privacy" class="meta-link">Privacy</a>
		</div>
	</div>
</div>

<style>
	p {
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0;
	}
</style>
