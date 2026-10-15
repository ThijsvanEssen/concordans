// Code is English, in the words of the API, with one closed list of Dutch legal terms
// (code-eenvoud F99, decision 3; docs/README.md). The interface, its texts and its URL
// parameters stay Dutch. Not every name follows yet: the count of names with a Dutch word
// outside TERMS only goes down, as code that is touched moves to English.
import { describe, expect, it } from 'vitest';
import { BRONNEN } from '$lib/test/bronnen';

/** The Dutch terms a name may use: legal and parliamentary terms without a good English one. */
const TERMS = new Set(
	`bron bronnen verbinding verbindingen lid leden overweging overwegingen dictum grondslag
	grondslagen peildatum hamerstuk hamerstukken kamerstuk kamerstukken strekking strekkingen
	toezegging toezeggingen`.split(/\s+/)
);

/** The Dutch words names in the code use now; a word that is English as well stays out. */
const DUTCH = new Set(
	`
	aan aangeboden aangehaald aangenomen aangevuld aanhaling aanhef aankondiging aanleg aantal
	aantekening aard achter achtergrond achternaam actie actief acties activiteit actueel adres
	advocaat afgedaan afgekapt afgeleid afkondiging afkorting afsplitsing afstand aliassen
	alinea alle alleen allemaal alles als ambt ambtenarengerecht ambtenarenzaken amendement
	amendementen andere anderen antwoord arbitrage arcering artikel artikelen asc attribuut
	baan bak bakken banen bedrijfsleven beeld begint begrip begrippen behoort behouden bekend
	belanghebbende belastingzaken beleidsregel bepaalregel beperkend bereik beroep besluit
	besluiten bestand bestandsnaam beste bestuursrecht betrouwbaarheid bevat bevinding
	bevindingen bevorderend bewaak bewaar bewaard bewerkt bewindspersoon bezig bezoek bij
	bijlage bijlagen bilateraalverdrag binnen bladzijde bladzijden blijft blok bouwgeschillen
	boven breed breedst breedte brenger brengers brieven buhne buiten buitenlandse bundels
	buren buur circulaire cirkel citaat citaten citeertitel civiel coalitie collectie commissie
	conclusie conclusies considerans constitutioneel daarheen dag dagen datum deel deels
	deelwoord definitie definities delegatie delegaties delen demissionair deze dezelfde dicht
	dienstregeling diepte dik dikte doel doelen doelwit door doorslaggevend doorzocht download
	dubbel een eensgezind eerder eerdere eerst eerste eerstekamer eigen eind einden eindtekst
	enig erbij exporteer exporteren facetten fase fasen feiten formeel fout fractie fracties
	functie gebeurtenis gebouwd gecodeerd gedaan gedeeld gedelegeerd gedimd geen gegeven
	gekopieerd gekozen geladen geldend gelegd gelezen gelijk gelukt gemachtigde gemarkeerd
	gemeenschappelijk gemerkt generiek genoemd genummerd geopend geordend geplaatst gepland
	gerecht gerechtshof geschiedenis geselecteerd gestemd getal getekend geteld getelden
	getoond gevolgd gevolgde gevonden gevouwen gevraagd gewezen gewicht gewijzigd gewijzigde
	gewone gezet gezien gezocht grens grenzen griffie grijs groep groepen grond grootte haal
	heeft herbouw herkomst hernoem hernoeming het hier hierheen hierna hoe hoge hoog hoogte
	houd houdt huidig iets indeling indiener indieners ingediend inhoud inhouden initiatiefnota
	inklapbaar instantie internationaal invoer inwerking inwerkingtreding ja jaar jaren
	jeugdbescherming justitie kaart kaarten kabinet kabinetten kader kaderbesluit kamer kamers
	kandidaat kandidaten kant kantlijn kantongerecht kapitalen keer keuze keuzes keyof kies
	kijk klaar klasse klein kleine kleur kleuren klik knoppen kolom kolommen komend komt kondig
	koninkrijksinstantie kop kopieer kopje kopregel kort korte korter kruiswoord laad laadt
	laag laatst laatste laden lang lange leeg leegte lees lengte lezen licht lidmaatschap
	lidwoord lijn lijnen lijst lijsten logisch lokaal lopend losse maak maand maandag maanden
	mapnaam mappen markeer meerderheid menselijke merken met meubels mijn ministerie minstens
	mislukt missionair mnd mogelijk motie moties multilateraalverdrag mutatie naam naamgeven
	naar naast nagekomen namen namens nee netwerk neutraal niet nieuw niveau nodig nog noot
	normaal nota noten notitie notities nummer nummers omgeving onbekend onder onderdeel
	onderdelen ondervoorzitter onderweg onderwerp onderwerpen onderwijs ongeteld ontbreekt
	onthoud ontmarkeer ontvolg ontvouwd onvolledig onvoorspelbaar onzeker op openstaand opent
	opgehaald opmerkingen opname opnieuw opslag opsomming optie opties opvolging opzij orde
	ordening orgaan origineel oude oudere overig overstap overtreders overzicht  paden
	paneel papieren parket partij partijen patronen peil periode perioden persoon pijl plaats
	plaatsen plek plekke plekken plenair poging pogingen portefeuille positie posten
	prinsjesdag procesgang publicatie punt raadsman randen rang rauw recht rechtbank rechter
	rechters rechts rechtspraak reden reeksen regel regeling regelingen regels relatie
	richtingen richtlijn rij rijen rijksoverheid rijkswet ruim ruimte ruw samengevoegd
	samenhang samenvatting samenvoeging schaal schakel schakelaar schets schik schrijf schuif
	sectie secties selectie sessie sleutel sleutels sluit smal smalst som soort soorten
	soortwoorden sorteer spatie sprongen staart staat staatsblad staatscourant staatssecretaris
	stand standaard standen stap stappen stem stemdagen stemkolommen stemmen stemmingen
	sterkste stijl stil stippel stoel stoelen straf strafrecht strafrechtstoepassing streepje
	streepjes strookje studiefinanciering stuk stukken tabel tariefcommissie te tegen tegenover
	teken tekens tekst tel telbaar telefoon tellen tellend tellingen telwoord termijn termijnen
	terug tijd tijdas tijden tijdlijn titel titels toe toegelicht toegezegd toelichting
	toelichtingen toets tooi toon toont tot totaal tractatenblad treffer tuchtcollege tussen
	tweede uit uitgeklapt uitgewerkt uitkomst uitkomsten uitleg uitslag uitsnede uitspraak
	uitspraken uitzondering uitzonderingen uniek unieke vaak vacature vak vakken van vanaf
	vandaag vanuit vaste vastgesteld vb veld velden venster verandert verband verbanden
	verbonden verborgen verdeeld verdiept verdrag verdragenbank vergelijk verkenner verkiezing
	verordening verschuif versies verslag vertaling vertrek vervallen vervangen vervangers
	vervanging vervangt vervolg verwacht verwijder verwijderen verwijzen verwijzing
	verwijzingen verworpen verzoek vind vinkje voeg voetnoot voetnoten vol volg volgende
	volgorde volgt volledig volledige voluit vondsten voor voorbeeld voorbehouden voorkeuze
	voorkeuzen voorproef voorstel voortgang voorzien voorzitter voorzitters vorige vorm vormen
	vraag vrij vroeger vulling waar waarde waarnemend wacht wachten wachtend wanneer wat
	weekdag weergave weg weken werk werkwoord wet wetsnetwerk wetsvoorstel wetsvoorstellen
	wetten wie wijze wijzigend wijziging wijzigingen wijzigt wil wis wisselmeerderheid woord
	woorden zaak zaal zaken zelf zelfde zelfs zet zetel zetels zicht zichtbaar zijden zijscroll
	zin zinnen zinsdeel zoek zoeken zoekt zonder zussen zwevend`
		.trim()
		.split(/\s+/)
);

// The names that may not grow: identifiers in the code, and the names of files and folders.
const IDENTIFIERS_MAX = 4473;
const PATHS_MAX = 140;

/** The code of a script without its comments, strings and regular expressions. */
function stripped(code: string): string {
	let out = '';
	let i = 0;
	while (i < code.length) {
		const c = code[i];
		const next = code[i + 1];
		if (c === '/' && next === '/') {
			while (i < code.length && code[i] !== '\n') i++;
		} else if (c === '/' && next === '*') {
			const end = code.indexOf('*/', i + 2);
			i = end < 0 ? code.length : end + 2;
		} else if (c === '/' && /(^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof)\s*$/.test(out)) {
			let inClass = false;
			i++;
			while (i < code.length && (inClass || code[i] !== '/') && code[i] !== '\n') {
				if (code[i] === '\\') i++;
				else if (code[i] === '[') inClass = true;
				else if (code[i] === ']') inClass = false;
				i++;
			}
			i++;
			while (/[a-z]/.test(code[i] ?? '')) i++;
			out += ' ';
		} else if (c === "'" || c === '"' || c === '`') {
			i++;
			while (i < code.length && code[i] !== c) {
				if (code[i] === '\\') {
					i += 2;
				} else if (c === '`' && code[i] === '$' && code[i + 1] === '{') {
					let depth = 1;
					const start = (i += 2);
					while (i < code.length && depth) {
						if (code[i] === '{') depth++;
						else if (code[i] === '}') depth--;
						i++;
					}
					out += ` ${stripped(code.slice(start, i - 1))} `;
				} else {
					i++;
				}
			}
			i++;
			out += ' ';
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

/** The code of a file: a component's scripts and the expressions in its markup. */
function codeOf(path: string, text: string): string {
	if (!path.endsWith('.svelte')) return stripped(text);
	const scripts = [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
	const markup = text
		.replace(/<script[^>]*>[\s\S]*?<\/script>|<style[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')
		.matchAll(/\{([^{}]*)\}/g);
	const expressions = [...markup].map((m) => m[1].replace(/^[#:/@]\w+/, ''));
	return [...scripts, ...expressions].map(stripped).join('\n');
}

/** The words of a name: camelCase, PascalCase, snake_case, kebab-case. */
const wordsOf = (name: string) =>
	name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.split(/[^A-Za-z]+/)
		.filter(Boolean)
		.map((w) => w.toLowerCase());

const isDutch = (name: string) => wordsOf(name).some((w) => DUTCH.has(w) && !TERMS.has(w));

// A lower snake_case name is a field or a value of the API, named there.
const API_NAME = /^[a-z0-9]+(_[a-z0-9]+)+$/;

const scripts = BRONNEN.filter(({ path }) => /\.(svelte|ts)$/.test(path));

/** Per file, the identifiers with a Dutch word outside TERMS. */
const dutchIdentifiers = () =>
	scripts.flatMap(({ path, text }) =>
		[...new Set(codeOf(path, text).match(/[A-Za-z_$][\w$]*/g) ?? [])]
			.filter((name) => !API_NAME.test(name) && isDutch(name))
			.map((name) => `${path}: ${name}`)
	);

// A folder under routes is a part of a URL, and a URL is interface.
const ROUTE_FOLDER = /^routes\/(?!.*\.\w+$)/;

/** The files and folders with a Dutch word in their name. */
const dutchPaths = () => {
	const names = new Set(
		scripts.flatMap(({ path }) =>
			path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/'))
		)
	);
	return [...names].filter(
		(p) => !ROUTE_FOLDER.test(p) && isDutch(p.split('/').at(-1)!.replace(/\..*$/, ''))
	);
};

describe('names in the code', () => {
	it('keeps the terms out of the Dutch words', () => {
		expect([...TERMS].filter((t) => DUTCH.has(t))).toEqual([]);
	});

	it('reads the words of a name', () => {
		expect(wordsOf('kopVanLid')).toEqual(['kop', 'van', 'lid']);
		expect(wordsOf('BronKind')).toEqual(['bron', 'kind']);
		expect(wordsOf('law-paging')).toEqual(['law', 'paging']);
		expect(isDutch('headOfMember')).toBe(false);
		expect(isDutch('bronHref')).toBe(false);
		expect(isDutch('isVerkenner')).toBe(true);
	});

	it('reads identifiers, not comments, strings or patterns', () => {
		expect(codeOf('a.ts', "const a = 'tekst'; // naam\nconst b = /wet/;").match(/\w+/g)).toEqual([
			'const',
			'a',
			'const',
			'b'
		]);
		expect(codeOf('A.svelte', '<script>let x;</script>\n<p>Tekst {naam}</p>')).toContain('naam');
	});

	it('does not add identifiers with a Dutch word outside the terms', () => {
		expect(dutchIdentifiers().length).toBeLessThanOrEqual(IDENTIFIERS_MAX);
	});

	it('does not add files or folders with a Dutch word outside the terms', () => {
		expect(dutchPaths().length).toBeLessThanOrEqual(PATHS_MAX);
	});
});
