// Maakt de favicon, de app-iconen en de deelafbeeldingen (static/og) in de kleuren van
// src/lib/styles/tokens.css (bron: het Design System, tokens.json).
// Gebruik: node scripts/deelafbeeldingen.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const STATIC = `${REPO}/static`;
const FONTS = `file://${STATIC}/fonts`;
const TMP = mkdtempSync(join(tmpdir(), 'deelafbeeldingen-'));
mkdirSync(`${STATIC}/og`, { recursive: true });

const tokens = readFileSync(`${REPO}/src/lib/styles/tokens.css`, 'utf8');
const token = (naam) => {
	const m = new RegExp(`--${naam}:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens);
	if (!m) throw new Error(`--${naam} is geen hexkleur in tokens.css`);
	return m[1];
};
const C = {
	paper: token('paper'),
	rule: token('rule'),
	ink: token('ink'),
	ink2: token('ink-2'),
	ink3: token('ink-3'),
	merk: token('merk'),
	wet: token('soort-wet'),
	parl: token('soort-parlement'),
	pers: token('soort-personen'),
	recht: token('soort-rechtspraak')
};

// Favicon: het pad van de huidige favicon, met papier en merk uit de tokens.
const favicon = readFileSync(`${STATIC}/favicon.svg`, 'utf8')
	.replace(/(<rect[^>]*fill=")#[0-9a-f]{6}/i, `$1${C.paper}`)
	.replace(/(<path[^>]*fill=")#[0-9a-f]{6}/i, `$1${C.merk}`);
writeFileSync(`${STATIC}/favicon.svg`, favicon);
const sectie = favicon.match(/<path[^>]*\/>/)[0];

const fonts = `
@font-face{font-family:Newsreader;src:url(${FONTS}/Newsreader-Variable.woff2) format('woff2');font-weight:200 800}
@font-face{font-family:Playfair;src:url(${FONTS}/PlayfairDisplay-Italic-800.woff2) format('woff2');font-style:italic;font-weight:800}`;

// --- Netwerkschetsen, in de taal van Netwerkcanvas -------------------------------------
// Knoop: wit met rand in de soortkleur; focus: inkt met een papieren halo en een inktring.
const knoop = (x, y, kleur, r = 9) =>
	`<circle cx="${x}" cy="${y}" r="${r}" fill="${C.paper}" stroke="${kleur}" stroke-width="3"/>`;
const vol = (x, y, kleur, r = 9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${kleur}"/>`;
const focus = (x, y) =>
	`<circle cx="${x}" cy="${y}" r="20" fill="none" stroke="${C.ink}" stroke-width="2.5"/>` +
	`<circle cx="${x}" cy="${y}" r="12" fill="${C.ink}"/>`;
const lijn = (a, b, kleur = C.rule, w = 2.5, dash = '') =>
	`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${kleur}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
// Omhulling: doorgetrokken (wet), gestreept (parlement), gestippeld (personen).
const hul = (x, y, w, h, kleur, soort, naam) => {
	const dash = { wet: '', parl: '10 7', pers: '2 7' }[soort];
	return (
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="${kleur}" fill-opacity="0.07" stroke="${kleur}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>` +
		(naam
			? `<g><rect x="${x + w / 2 - naam.length * 5.2 - 10}" y="${y - 13}" width="${naam.length * 10.4 + 20}" height="26" rx="13" fill="${C.paper}" stroke="${kleur}" stroke-width="2"/><text x="${x + w / 2}" y="${y + 5}" text-anchor="middle" font-family="Newsreader" font-weight="600" font-size="16" fill="${C.ink}">${naam}</text></g>`
			: '')
	);
};

// Elk bord één motief, zoals Kamerstuk: de bron boven, drie verbonden bronnen eronder.
const LAAG_BOVEN = 150,
	LAAG_ONDER = 365;
const onder = (kleur, soort, naam) => {
	const xs = [130, 210, 290];
	const leden = xs.map((x) =>
		soort === 'recht' ? vol(x, LAAG_ONDER, kleur, 10) : knoop(x, LAAG_ONDER, kleur)
	);
	const lijnen = xs.map((x) => lijn([210, LAAG_BOVEN], [x, LAAG_ONDER], kleur));
	const omhulling =
		soort === 'recht'
			? `<text x="210" y="${LAAG_ONDER + 44}" text-anchor="middle" font-family="Newsreader" font-weight="600" font-size="16" fill="${C.ink3}">${naam}</text>`
			: hul(70, 320, 280, 90, kleur, soort, naam);
	return { lijnen: lijnen.join(''), rest: omhulling + leden.join('') };
};
const boven = (kleur, soort, naam, buren = true) =>
	(naam ? hul(80, 90, 260, 120, kleur, soort, naam) : '') +
	(buren ? knoop(140, LAAG_BOVEN, kleur) + knoop(280, LAAG_BOVEN, kleur) : '');
const bord = (top, bodem) => bodem.lijnen + top + bodem.rest + focus(210, LAAG_BOVEN);
const mix = () => {
	const xs = [
		[130, C.wet, 'k'],
		[210, C.recht, 'v'],
		[290, C.parl, 'k']
	];
	return {
		lijnen: xs.map(([x, k]) => lijn([210, LAAG_BOVEN], [x, LAAG_ONDER], k)).join(''),
		rest: xs
			.map(([x, k, t]) => (t === 'v' ? vol(x, LAAG_ONDER, k, 10) : knoop(x, LAAG_ONDER, k)))
			.join('')
	};
};

const schets = {
	concordans: () => bord('', mix()),
	wet: () => bord(boven(C.wet, 'wet', 'Wet'), onder(C.recht, 'recht', 'Uitspraken')),
	artikel: () => bord(boven(C.wet, 'wet', 'Wet'), onder(C.parl, 'parl', 'Kamerstukken')),
	dossier: () => bord(boven(C.parl, 'parl', 'Dossier'), onder(C.wet, 'wet', 'Wet')),
	kamerstuk: () => bord(boven(C.parl, 'parl', 'Dossier'), onder(C.pers, 'pers', 'Indieners')),
	uitspraak: () =>
		bord(
			lijn([140, LAAG_BOVEN], [280, LAAG_BOVEN], C.recht, 3) +
				vol(140, LAAG_BOVEN, C.recht, 10) +
				vol(280, LAAG_BOVEN, C.recht, 10),
			onder(C.wet, 'wet', 'Wet')
		)
};

const KAART = {
	concordans: ['', 'Wetten, uitspraken en Kamerstukken, met de verbindingen ertussen.'],
	wet: ['Wet', 'De tekst en de artikelen, met de uitspraken en Kamerstukken die ernaar verwijzen.'],
	artikel: [
		'Artikel',
		'Met de uitspraken, Kamerstukken en wetsgeschiedenis die naar het artikel verwijzen.'
	],
	dossier: ['Dossier', 'De stukken, moties, amendementen en stemmingen van een wetsvoorstel.'],
	kamerstuk: ['Kamerstuk', 'Met de indieners, de stemming per fractie en het dossier.'],
	uitspraak: ['Uitspraak', 'Met de wetsartikelen en uitspraken waarnaar de uitspraak verwijst.']
};

const og = (naam) => {
	const [kop, zin] = KAART[naam];
	return `<!doctype html><html><head><style>${fonts}
body{margin:0;width:1200px;height:630px;background:${C.paper};font-family:Newsreader;color:${C.ink};position:relative;overflow:hidden}
.merk{position:absolute;left:80px;top:84px;display:flex;align-items:baseline;gap:.5em;font-size:46px;line-height:1}
.merk b{font-family:Playfair;font-style:italic;font-weight:800;font-size:1.3em;color:${C.merk};position:relative;top:.03em}
.merk span{font-weight:500}
.tekst{position:absolute;left:80px;top:${kop ? 230 : 268}px;width:${kop ? 720 : 680}px}
h1{margin:0 0 18px;font-size:104px;line-height:1;font-weight:600;letter-spacing:-.01em}
p{margin:0;font-size:${kop ? 32 : 44}px;line-height:1.35;color:${C.ink2}}
.voet{position:absolute;left:80px;right:80px;top:540px;border-top:1px solid ${C.rule};padding-top:18px;font-size:24px;color:${C.ink3}}
svg{position:absolute;right:56px;top:70px}
</style></head><body>
<div class="merk"><b>§</b><span>Concordans</span></div>
<div class="tekst">${kop ? `<h1>${kop}</h1>` : ''}<p>${zin}</p></div>
<svg width="420" height="470" viewBox="0 0 420 470">${schets[naam]()}</svg>
<div class="voet">concordans.nl</div></body></html>`;
};

const icoon = (px) => `<!doctype html><html><head><style>body{margin:0}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64"><rect width="64" height="64" fill="${C.paper}"/>${sectie}</svg></body></html>`;

const browser = await chromium.launch();
for (const naam of Object.keys(KAART)) {
	const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
	writeFileSync(`${TMP}/${naam}.html`, og(naam));
	await page.goto(`file://${TMP}/${naam}.html`);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: `${STATIC}/og/${naam}.png` });
	await page.close();
}
for (const [file, px] of [
	['apple-touch-icon.png', 180],
	['icon-192.png', 192],
	['icon-512.png', 512]
]) {
	const page = await browser.newPage({ viewport: { width: px, height: px } });
	writeFileSync(`${TMP}/icoon.html`, icoon(px));
	await page.goto(`file://${TMP}/icoon.html`);
	await page.screenshot({ path: `${STATIC}/${file}` });
	await page.close();
}
await browser.close();

// /favicon.ico: een browser vraagt er ongevraagd om (zonder bestand een 404). Een ICO met het
// 192-pixel-icoon als PNG erin.
const png = readFileSync(`${STATIC}/icon-192.png`);
const kop = Buffer.alloc(22);
kop.writeUInt16LE(1, 2); // type: pictogram
kop.writeUInt16LE(1, 4); // één afbeelding
kop[6] = 192;
kop[7] = 192;
kop.writeUInt16LE(1, 10); // vlakken
kop.writeUInt16LE(32, 12); // bits per pixel
kop.writeUInt32LE(png.length, 14);
kop.writeUInt32LE(22, 18);
writeFileSync(`${STATIC}/favicon.ico`, Buffer.concat([kop, png]));
