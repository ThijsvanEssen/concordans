// Maakt de favicon, de app-iconen en de deelafbeeldingen (static/og) in de kleuren van
// src/lib/styles/tokens.css (bron: het Design System, tokens.json). De schets op een
// deelafbeelding tekent met de code van het canvas: de soorttekens uit vormen.ts, de lijnen
// uit line-kind.ts en nodeSprites.ts, de omhullingen zoals GraphCanvas, de keten zoals
// ChainView.
// Gebruik: node scripts/deelafbeeldingen.mjs
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
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
const waarde = (naam) => new RegExp(`--${naam}:\\s*([^;]+);`).exec(tokens)?.[1].trim();
const token = (naam) => {
	const w = waarde(naam);
	if (!w || !/^#[0-9a-f]{6}$/i.test(w)) throw new Error(`--${naam} is geen hexkleur in tokens.css`);
	return w;
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

// De code van het canvas, gebundeld voor Node. nodeSprites leest de tokens met
// getComputedStyle; hier leest die tokens.css.
globalThis.document = { documentElement: {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => waarde(n.slice(2)) ?? '' });
const ingang = `${TMP}/canvas.ts`;
writeFileSync(
	ingang,
	`export { VORMEN } from '${REPO}/src/lib/bron/vormen';
export { LINE_KIND_SAMPLE } from '${REPO}/src/lib/graph/line-kind';
export { EDGE_WEIGHT } from '${REPO}/src/lib/graph/types';
export { edgeColorFor, edgeStyleFor, edgeDashFor, lineThickness, arrowLength, ARROW_WIDTH, hullColorFor, hullDashFor, withAlpha } from '${REPO}/src/lib/components/graph/nodeSprites';
export { HULL_MARGIN, LABEL_GAP } from '${REPO}/src/lib/components/graph/hulls';`
);
await build({
	entryPoints: [ingang],
	bundle: true,
	format: 'esm',
	platform: 'node',
	outfile: `${TMP}/canvas.mjs`,
	alias: { $lib: `${REPO}/src/lib` },
	logLevel: 'error'
});
const K = await import(`${TMP}/canvas.mjs`);

// Favicon: het pad van de huidige favicon, met papier en merk uit de tokens.
const favicon = readFileSync(`${STATIC}/favicon.svg`, 'utf8')
	.replace(/(<rect[^>]*fill=")#[0-9a-f]{6}/i, `$1${C.paper}`)
	.replace(/(<path[^>]*fill=")#[0-9a-f]{6}/i, `$1${C.merk}`);
writeFileSync(`${STATIC}/favicon.svg`, favicon);
const sectie = favicon.match(/<path[^>]*\/>/)[0];

const fonts = `
@font-face{font-family:Newsreader;src:url(${FONTS}/Newsreader-Variable.woff2) format('woff2');font-weight:200 800}
@font-face{font-family:Playfair;src:url(${FONTS}/PlayfairDisplay-Italic-800.woff2) format('woff2');font-style:italic;font-weight:800}`;

// --- De schets, in de taal van Netwerkcanvas -------------------------------------------
// Getekend in pixels van het canvas en als geheel vergroot (SCHAAL): een teken van 16, een
// lijn van gewicht × netwerk-lijn, een omhulling met een rand van 1,5 px.
const SCHAAL = 1.9;
const VAK = { w: 220, h: 246 };
const TEKEN = 16;
const FOCUS = 24;
const HALO = 4.5;
/** De inktring om de focus, op de rand van zijn halo; daar houdt een lijn op. */
const RING = 17;
const RAND_FOCUS = RING + 2;
const RAND = TEKEN / 2 + 2;

const pad = (v, x, y, maat) =>
	`d="${v.d}" transform="translate(${x - maat / 2} ${y - maat / 2}) scale(${maat / 16})"`;

/** Een bron als zijn soortteken (vormen.ts) in zijn soortkleur, op een rand van papier. */
const teken = (vorm, x, y, kl) => {
	const v = K.VORMEN[vorm];
	const lijn = v.wijze === 'lijn';
	return (
		`<path ${pad(v, x, y, TEKEN)} fill="${C.paper}" stroke="${C.paper}" stroke-width="4" stroke-linejoin="round"/>` +
		`<path ${pad(v, x, y, TEKEN)} fill="${lijn ? C.paper : kl}" fill-rule="${v.wijze === 'gat' ? 'evenodd' : 'nonzero'}"${lijn ? ` stroke="${kl}" stroke-width="2"` : ''}/>`
	);
};

/** De focus: zijn vorm in inkt op een papieren halo, met een inktring eromheen. */
const focus = (vorm, x, y) => {
	const v = K.VORMEN[vorm];
	const s = FOCUS / 16;
	const lijn = v.wijze === 'lijn';
	return (
		`<circle cx="${x}" cy="${y}" r="${RING}" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>` +
		`<path ${pad(v, x, y, FOCUS)} fill="${C.paper}" stroke="${C.paper}" stroke-width="${(2 * HALO) / s}" stroke-linejoin="round"/>` +
		`<path ${pad(v, x, y, FOCUS)} fill="${lijn ? C.paper : C.ink}" fill-rule="${v.wijze === 'gat' ? 'evenodd' : 'nonzero'}" stroke="${C.ink}" stroke-width="${lijn ? 2 : 1.6 / s}" stroke-linejoin="round"/>`
	);
};

/**
 * Een lijn van a naar b in de stijl van zijn lijnsoort (line-kind.ts): kleur, streep, dikte
 * en pijlpunt zoals de Netwerkschets. `pijl` wijst naar 'a' of 'b'.
 */
const lijn = (a, b, soort, pijl, ra = RAND, rb = RAND) => {
	const { relation, from } = K.LINE_KIND_SAMPLE[soort];
	const kl = K.edgeColorFor(relation, from);
	const stijl = K.edgeStyleFor(relation, null, from);
	const dash = K.edgeDashFor(stijl);
	const w = K.lineThickness(K.EDGE_WEIGHT[relation]);
	const len = Math.max(w * K.arrowLength(), 5.5);
	const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const [ux, uy] = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
	let [x1, y1, x2, y2] = [a[0] + ux * ra, a[1] + uy * ra, b[0] - ux * rb, b[1] - uy * rb];
	const punt = (tx, ty, dx, dy) => {
		const [bx, by] = [tx - dx * len, ty - dy * len];
		const [nx, ny] = [(-dy * len * K.ARROW_WIDTH) / 2, (dx * len * K.ARROW_WIDTH) / 2];
		return `<polygon points="${bx + nx},${by + ny} ${tx},${ty} ${bx - nx},${by - ny}" fill="${kl}"/>`;
	};
	let kop = '';
	if (stijl !== 'lid' && pijl === 'b') {
		kop = punt(x2, y2, ux, uy);
		[x2, y2] = [x2 - ux * len, y2 - uy * len];
	} else if (stijl !== 'lid' && pijl === 'a') {
		kop = punt(x1, y1, -ux, -uy);
		[x1, y1] = [x1 + ux * len, y1 + uy * len];
	}
	const streep = dash ? ` stroke-dasharray="${dash}"` : '';
	return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${kl}" stroke-width="${w}"${streep}/>${kop}`;
};

/**
 * Een omhulling: een schijf om de leden plus HULL_MARGIN, vlak 8 % en rand 1,5 px in de
 * soortkleur, met de streep van zijn soort; de naam in een papieren pil erboven (GraphCanvas).
 * Een lid is [x, y] of [x, y, rand]. `opzij`: de pil linksboven op de rand, waar de lijnen
 * van de focus hem niet kruisen (zoals een naam die botst een vrije plaats zoekt).
 */
const omhulling = (leden, soort, naam, opzij = false) => {
	const cx = leden.reduce((t, p) => t + p[0], 0) / leden.length;
	const cy = leden.reduce((t, p) => t + p[1], 0) / leden.length;
	const ver = (p) => Math.hypot(p[0] - cx, p[1] - cy) + (p[2] ?? RAND) - RAND;
	const r = Math.max(...leden.map(ver)) + K.HULL_MARGIN;
	const kl = K.hullColorFor(soort);
	const dash = K.hullDashFor(soort);
	const streep = dash ? ` stroke-dasharray="${dash}"` : '';
	return {
		schijf: `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${K.withAlpha(kl, 0.08)}" stroke="${kl}" stroke-width="1.5"${streep}/>`,
		pil: opzij
			? `<span class="pil pil--opzij" style="left:${cx - r * 0.72}px;top:${cy - r * 0.72}px;--kl:${kl}">${naam}</span>`
			: `<span class="pil" style="left:${cx}px;top:${cy - r - K.LABEL_GAP}px;--kl:${kl}">${naam}</span>`
	};
};

/** Een schets: omhullingen, dan lijnen, dan bronnen; de pillen boven alles. */
const schets = ({ hullen = [], lijnen = [], bronnen = [] }) =>
	`<div class="schets"><svg width="${VAK.w}" height="${VAK.h}" viewBox="0 0 ${VAK.w} ${VAK.h}">` +
	hullen.map((h) => h.schijf).join('') +
	lijnen.join('') +
	bronnen.join('') +
	`</svg>${hullen.map((h) => h.pil).join('')}</div>`;

// Het motief: de bron boven, in de omhulling waar hij bij hoort; drie bronnen eronder.
const F = [110, 92];
const BOVEN = [
	[84, 66],
	[136, 66]
];
const ONDER_RIJ = [
	[48, 206],
	[110, 218],
	[172, 206]
];
const ONDER_HUL = [
	[86, 188],
	[134, 188],
	[110, 216]
];
/** De leden met de focus, die met zijn ring meetelt. */
const metFocus = (leden) => [...leden, [...F, RING + RAND - 2]];

const SCHETS = {
	// Een artikel: deel van een wet, aangehaald door een uitspraak, toegelicht in een Kamerstuk.
	concordans: () =>
		schets({
			lijnen: [
				lijn(F, ONDER_RIJ[0], 'part', 'b', RAND_FOCUS),
				lijn(F, ONDER_RIJ[1], 'citation', 'a', RAND_FOCUS),
				lijn(F, ONDER_RIJ[2], 'explanation', 'a', RAND_FOCUS)
			],
			bronnen: [
				teken('regel', ...ONDER_RIJ[0], C.wet),
				teken('uitspraak', ...ONDER_RIJ[1], C.recht),
				teken('stuk', ...ONDER_RIJ[2], C.parl),
				focus('regel-o', ...F)
			]
		}),
	// De wet in zijn omhulling met zijn artikelen; drie uitspraken halen hem aan.
	wet: () =>
		schets({
			hullen: [omhulling(metFocus(BOVEN), 'instrument', 'Wet')],
			lijnen: ONDER_RIJ.map((p) => lijn(F, p, 'citation', 'a', RAND_FOCUS)),
			bronnen: [
				...BOVEN.map((p) => teken('regel-o', ...p, C.wet)),
				...ONDER_RIJ.map((p) => teken('uitspraak', ...p, C.recht)),
				focus('regel', ...F)
			]
		}),
	// Het artikel in zijn wet; drie Kamerstukken uit een dossier lichten het toe.
	artikel: () =>
		schets({
			hullen: [
				omhulling(metFocus(BOVEN), 'instrument', 'Wet'),
				omhulling(ONDER_HUL, 'dossier', 'Dossier', true)
			],
			lijnen: ONDER_HUL.map((p) => lijn(F, p, 'explanation', 'a', RAND_FOCUS)),
			bronnen: [
				...BOVEN.map((p) => teken('regel-o', ...p, C.wet)),
				...ONDER_HUL.map((p) => teken('stuk', ...p, C.parl)),
				focus('regel-o', ...F)
			]
		}),
	// Het wetsvoorstel in zijn dossier; het wijzigt drie artikelen van een wet.
	dossier: () =>
		schets({
			hullen: [
				omhulling(metFocus(BOVEN), 'dossier', 'Dossier'),
				omhulling(ONDER_HUL, 'instrument', 'Wet', true)
			],
			lijnen: ONDER_HUL.map((p) => lijn(F, p, 'change', 'b', RAND_FOCUS)),
			bronnen: [
				...BOVEN.map((p) => teken('stuk', ...p, C.parl)),
				...ONDER_HUL.map((p) => teken('regel-o', ...p, C.wet)),
				focus('voorstel', ...F)
			]
		}),
	// Het stuk in zijn dossier, ingediend door drie Kamerleden van een fractie.
	kamerstuk: () =>
		schets({
			hullen: [
				omhulling(metFocus(BOVEN), 'dossier', 'Dossier'),
				omhulling(ONDER_HUL, 'faction', 'Fractie', true)
			],
			lijnen: ONDER_HUL.map((p) => lijn(F, p, 'submitter', 'a', RAND_FOCUS)),
			bronnen: [
				...BOVEN.map((p) => teken('stuk', ...p, C.parl)),
				...ONDER_HUL.map((p) => teken('persoon', ...p, C.pers)),
				focus('stuk', ...F)
			]
		}),
	uitspraak: () => keten()
};

// --- De keten van een uitspraak, zoals ChainView ---------------------------------------
// Lagen van 120 met hun naam en een haarlijn; elke instantie in haar soortteken met haar naam
// eronder; de gekozen uitspraak in inkt in haar kader, de lijnen naar haar vorige en
// volgende instantie (hoger beroep) in hun kleur en 1,6 keer zo dik.
const KETEN = { w: 360, h: 400, top: 48, rij: 120, links: 120 };
const keten = () => {
	const { w, h, top, rij, links } = KETEN;
	const lagen = [
		['Rechtbank', 'Rb. Gelderland'],
		['Gerechtshof', 'Hof Arnhem-Leeuwarden'],
		['Hoge Raad', 'Hoge Raad']
	];
	const GEKOZEN = 1;
	const x = links + (w - 24 - links) / 2;
	const y = (i) => top + i * rij + 30;
	const kl = K.edgeColorFor('APPEAL_OF', 'article');
	const dik = K.lineThickness(K.EDGE_WEIGHT.APPEAL_OF) * 1.6;
	const vorm = K.VORMEN.uitspraak;
	let svg = '';
	// Een haarlijn tussen de lagen; onder de laatste staat de haarlijn van de voet.
	lagen.forEach(([laag], i) => {
		const rail = top + (i + 1) * rij - 8;
		svg += `<text class="laag" x="24" y="${top + i * rij + 4}">${laag.toUpperCase()}</text>`;
		if (i < lagen.length - 1)
			svg += `<line x1="20" x2="${w - 20}" y1="${rail}" y2="${rail}" stroke="${C.rule}"/>`;
	});
	for (let i = 1; i < lagen.length; i++)
		svg += `<line x1="${x}" y1="${y(i - 1) + 8}" x2="${x}" y2="${y(i) - 8}" stroke="${kl}" stroke-width="${dik}"/>`;
	lagen.forEach(([, naam], i) => {
		const gekozen = i === GEKOZEN;
		const at = `d="${vorm.d}" transform="translate(${x - 8} ${y(i) - 8})"`;
		if (gekozen)
			svg += `<rect x="${x - 12}" y="${y(i) - 12}" width="24" height="24" rx="2" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/><path ${at} fill="${C.ink}"/>`;
		else svg += `<path ${at} fill="${C.recht}"/>`;
		svg += `<text class="naam${gekozen ? ' naam--gekozen' : ''}" x="${x}" y="${y(i) + 24}" text-anchor="middle">${naam}</text>`;
	});
	return `<div class="schets schets--keten"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svg}</svg></div>`;
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
.tekst{position:absolute;left:80px;top:${kop ? 230 : 268}px;width:620px}
h1{margin:0 0 18px;font-size:104px;line-height:1;font-weight:600;letter-spacing:-.01em}
p{margin:0;font-size:${kop ? 32 : 44}px;line-height:1.35;color:${C.ink2}}
.voet{position:absolute;left:80px;right:80px;top:540px;border-top:1px solid ${C.rule};padding-top:18px;font-size:24px;color:${C.ink3}}
.schets{position:absolute;right:64px;top:64px;width:${VAK.w}px;height:${VAK.h}px;transform:scale(${SCHAAL});transform-origin:top right}
.schets--keten{top:70px;width:${KETEN.w}px;height:${KETEN.h}px;transform:scale(${(VAK.w * SCHAAL) / KETEN.w})}
svg{display:block;overflow:visible}
.pil{position:absolute;transform:translate(-50%,-100%);padding:2px 8px;border-radius:999px;background:color-mix(in srgb,${C.paper} 88%,var(--kl) 12%);border:1px solid var(--kl);font-size:11px;font-weight:600;color:${C.ink2};white-space:nowrap}
.pil--opzij{transform:translate(-100%,-50%)}
.laag{font-size:13px;font-weight:600;fill:${C.ink3}}
.naam{font-size:13px;fill:${C.ink2};paint-order:stroke;stroke:${C.paper};stroke-width:6px;stroke-linejoin:round}
.naam--gekozen{font-weight:600;fill:${C.ink}}
</style></head><body>
<div class="merk"><b>§</b><span>Concordans</span></div>
<div class="tekst">${kop ? `<h1>${kop}</h1>` : ''}<p>${zin}</p></div>
${SCHETS[naam]()}
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
