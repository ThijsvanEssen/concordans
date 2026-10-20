// Known breaches of a house rule that the suite tolerates until they are fixed. The lists
// only shrink: a breach that is not here fails its test, and so does an entry that is no
// longer seen (take it out). Labels as the accessible name of the control, without its size.

/** Controls under 44 by 44 px on touch (375), per page of the smoke test. */
export const KNOWN_SMALL_TARGETS: Record<string, string[]> = {
	'/activiteiten/2026A01323': [
		'Bewaar Wet weerbaarheid kritieke entiteiten (36765',
		'Netwerk',
		'Tekst',
		'Verbonden',
		'Verslag en stenogram'
	],
	'/actueel': [
		'Alles',
		'Beide',
		'Eerste Kamer',
		'Eigen',
		'Inhoud van 4 toezeggingen over Kamerstuk 25754 Sti',
		'Jaar',
		'Kwartaal',
		'Maand',
		'Tweede Kamer',
		'Tweede nota van wijziging: bewaren in Losse marker',
		'Zoek in Actueel'
	],
	'/bundels': ['Details van Losse markeringen'],
	'/explore': [
		'Alles in beeld',
		'Inzoomen',
		'Legenda',
		'Netwerk 11 bronnen',
		'Uitzoomen',
		'zoekveld'
	],
	'/commissies/szw': ['Bewaar SZW in bundel', 'Netwerk', 'Tekst', 'Verbonden'],
	'/dossiers/36496': [
		'Bewaar Kamerstukken 36496 in bundel',
		'Netwerk',
		'Tekst',
		'Verbonden',
		'Volledige titel'
	],
	'/fracties/ek_democraten_1966': ['Bewaar D66 in bundel', 'Netwerk', 'Tekst', 'Verbonden'],
	'/kabinetten/rutte_iv': ['Bewaar kabinet-Rutte IV in bundel', 'Netwerk', 'Tekst', 'Verbonden'],
	'/kamerstukken/36600-VIII/AB': [
		'Bewaar Kamerstukken I 2025/26, 36600 VIII, AB in b',
		'Netwerk',
		'Tekst',
		'Verbonden',
		'Verslag Verslag van een Kamercommissie Schriftelij'
	],
	'/kamerstukken/36799/31': [
		'Bewaar Kamerstukken II 2025/26, 36799, nr. 31 in b',
		'Motie Motie Uitspraak van een Kamer waarmee zij de',
		'Netwerk',
		'Tekst',
		'Verbonden'
	],
	'/leden/rob-jetten': ['Bewaar Rob Jetten in bundel', 'Netwerk', 'Tekst', 'Verbonden'],
	'/onderwerpen': ['Onderwerp volgen'],
	'/stb/2026/94': ['Bewaar Stb. 2026, 94 in bundel', 'Netwerk', 'Tekst', 'Verbonden'],
	'/stemmingen/decision_154df5db_64e5_414a_9cd1_3967aab7de58': [
		'Bewaar Stemming 22 september 2026: Motie van het l',
		'Netwerk',
		'Stemverdeling per fractie',
		'Tekst',
		'Verbonden'
	],
	'/toezeggingen/TZ202609-124': [
		'Bewaar Toezegging TZ202609-124 in bundel',
		'Netwerk',
		'Tekst',
		'Verbonden'
	],
	'/uitspraken/ECLI:NL:HR:2019:2006': [
		'Bewaar HR 20 december 2019 in bundel',
		'Netwerk',
		'Rb. Den Haag 24 juni 2015',
		'Tekst',
		'Verbonden'
	],
	'/wetten/BWBR0002741/bijlage/II': [
		'Bewaar Bijlage II, Besluit dagboeken voor schepen ',
		'Netwerk',
		'Tekst',
		'Verbonden'
	],
	'/wetten/BWBR0005289': [
		'Bewaar Burgerlijk Wetboek Boek 6 in bundel',
		'Netwerk',
		'Tekst',
		'Tekst geldend op: 20 oktober 2026',
		'Verbonden'
	],
	'/wetten/BWBR0005289/artikel/6:162': [
		'Alle lagen tonen: Titel 3 Onrechtmatige daad',
		'Bewaar art. 6:162 BW in bundel',
		'Netwerk',
		'Tekst',
		'Verbonden',
		'Volgend →',
		'← Vorig'
	],
	'/zaken/2025Z15468': [
		'Bewaar Brief van de tijdelijke commissie Grondrech',
		'Netwerk',
		'Tekst',
		'Verbonden'
	]
};

/** Console errors per page of the smoke test. */
export const KNOWN_CONSOLE_ERRORS: Record<string, RegExp[]> = {
	// A publication asks /api/instruments/STB-2026-94 as if it were a law, and gets a 404.
	'/stb/2026/94': [/status of 404/]
};
