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
	wet: token('rubriek-wetten'),
	kst: token('rubriek-kamerstukken'),
	parl: token('rubriek-parlement'),
	recht: token('rubriek-rechtspraak')
};

// De code van het canvas, gebundeld voor Node. nodeSprites leest de tokens met
// getComputedStyle; hier leest die tokens.css.
globalThis.document = { documentElement: {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => waarde(n.slice(2)) ?? '' });
const ingang = `${TMP}/canvas.ts`;
writeFileSync(
	ingang,
	`export { VORMEN } from '${REPO}/src/lib/bron/vormen';
export { LINE_KIND_SAMPLE, hasArrow } from '${REPO}/src/lib/graph/line-kind';
export { EDGE_WEIGHT } from '${REPO}/src/lib/graph/types';
export { edgeColorFor, edgeStyleFor, edgeDashFor, edgeCapFor, edgeToneFor, toneColour, lineThickness, arrowLength, hullColorFor, hullDashFor, towardPaper } from '${REPO}/src/lib/components/graph/nodeSprites';
export { ARROW_WIDTH } from '${REPO}/src/lib/graph/line-shape';
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
@font-face{font-family:Newsreader;src:url(${FONTS}/Newsreader-VariableItalic.woff2) format('woff2');font-weight:200 800;font-style:italic}
@font-face{font-family:Schibsted;src:url(${FONTS}/SchibstedGrotesk-Variable.woff2) format('woff2');font-weight:400 800}
@font-face{font-family:Playfair;src:url(${FONTS}/PlayfairDisplay-Italic-800.woff2) format('woff2');font-style:italic;font-weight:800}`;

// --- De schets, zoals het Design System het canvas tekent --------------------------------
// Netwerkcanvas, Netwerkschets en Keten in het DS zijn leidend; vormen, kleuren, diktes en
// streep komen uit de code van het canvas. Getekend in pixels van het DS en als geheel vergroot
// (SCHAAL): lijnen licht gebogen tot de rand van de knoop, pijlpunten van netwerk-pijl diktes,
// omhullingen als schijf met de naam in een papieren pil erboven.
const SCHAAL = 1.75;
const VAK = { w: 240, h: 266 };
/** Een bron 14 px, een artikel 13 px, de focus 24 px (Netwerkcanvas, Soortteken). */
const MAAT = { bron: 14, artikel: 13, focus: 24 };
/** De papieren rand om een bron, en de halo en inktrand van de focus. */
const RAND_PAPIER = 2;
const HALO = 4.5;
const INKTRAND = 2;
/** Tussen een lijn en de rand van een bron. */
const LUCHT = 3;
/** Hoe ver een lijn buigt: het stuurpunt staat dit deel van de lengte naast het midden. */
const BOCHT = 0.12;

const RAND = 8; // de straal waarop een lijn ophoudt bij een bron van 14
const RAND_FOCUS = MAAT.focus / 2 + HALO;

/** Een bron als zijn soortteken (vormen.ts) in zijn soortkleur, op een rand van papier. */
const teken = (vorm, [x, y], kl, maat = MAAT.bron) => {
	const v = K.VORMEN[vorm];
	const s = maat / 16;
	const at = `d="${v.d}" transform="translate(${x - maat / 2} ${y - maat / 2}) scale(${s})"`;
	const lijn = v.wijze === 'lijn';
	return (
		`<path ${at} fill="${C.paper}" stroke="${C.paper}" stroke-width="${(2 * RAND_PAPIER) / s}" stroke-linejoin="round"/>` +
		(lijn
			? `<path ${at} fill="${C.paper}" stroke="${kl}" stroke-width="${1.7 / s}"/>`
			: `<path ${at} fill="${kl}" fill-rule="${v.wijze === 'gat' ? 'evenodd' : 'nonzero'}"/>`)
	);
};

/** De focus: zijn vorm in inkt met een inktrand op een papieren halo (Netwerkcanvas, Focus). */
const focus = (vorm, [x, y], maat = MAAT.focus) => {
	const v = K.VORMEN[vorm];
	const s = maat / 16;
	const at = `d="${v.d}" transform="translate(${x - maat / 2} ${y - maat / 2}) scale(${s})"`;
	const lijn = v.wijze === 'lijn';
	return (
		`<path ${at} fill="none" stroke="${C.paper}" stroke-width="${(2 * HALO) / s}" stroke-linejoin="round"/>` +
		`<path ${at} fill="${lijn ? C.paper : 'none'}" stroke="${C.ink}" stroke-width="${(2 * INKTRAND) / s}" stroke-linejoin="round"/>` +
		(lijn
			? ''
			: `<path ${at} fill="${C.ink}" fill-rule="${v.wijze === 'gat' ? 'evenodd' : 'nonzero'}"/>`)
	);
};

const eenheid = (dx, dy) => {
	const d = Math.hypot(dx, dy) || 1;
	return [dx / d, dy / d];
};
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Een lijn van a naar b in de stijl van zijn lijnsoort (line-kind.ts, Netwerkcanvas Lijnen):
 * licht gebogen (`buig` 1 of -1 kiest de kant), kleur, streep en dikte van de soort, ophoudend
 * aan de rand van de bron (ra, rb); de pijlpunt (netwerk-pijl diktes lang, 0,8 daarvan breed)
 * bij b, of bij a met `pijl` 'a'. Ingediend door heeft een punt bij de indiener; het patroon begint bij de kop.
 */
const lijn = (a, b, soort, { ra = RAND, rb = RAND, buig = 1, pijl = 'b', kleur } = {}) => {
	const { relation, from } = K.LINE_KIND_SAMPLE[soort];
	const kl =
		kleur ?? K.toneColour(K.edgeColorFor(relation, from), K.edgeToneFor(relation, null, from));
	const stijl = K.edgeStyleFor(relation, null, from);
	const metPijl = K.hasArrow(stijl);
	const dash = K.edgeDashFor(stijl);
	const w = K.lineThickness(K.EDGE_WEIGHT[relation]);
	const len = w * K.arrowLength();
	const lengte = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const [nx, ny] = eenheid(-(b[1] - a[1]), b[0] - a[0]);
	const c = [
		(a[0] + b[0]) / 2 + nx * BOCHT * lengte * buig,
		(a[1] + b[1]) / 2 + ny * BOCHT * lengte * buig
	];
	// De einden aan de rand van de bron, langs de raaklijn van de bocht.
	const [ua, va] = eenheid(c[0] - a[0], c[1] - a[1]);
	const [ub, vb] = eenheid(b[0] - c[0], b[1] - c[1]);
	let p = [a[0] + ua * (ra + LUCHT), a[1] + va * (ra + LUCHT)];
	let q = [b[0] - ub * (rb + LUCHT), b[1] - vb * (rb + LUCHT)];
	const punt = ([tx, ty], [dx, dy]) => {
		const [bx, by] = [tx - dx * len, ty - dy * len];
		const [ox, oy] = [(-dy * len * K.ARROW_WIDTH) / 2, (dx * len * K.ARROW_WIDTH) / 2];
		return `<path d="M${r1(tx)} ${r1(ty)}L${r1(bx + ox)} ${r1(by + oy)}L${r1(bx - ox)} ${r1(by - oy)}z" fill="${kl}"/>`;
	};
	let kop = '';
	if (metPijl && pijl === 'b') {
		kop = punt(q, [ub, vb]);
		q = [q[0] - ub * len, q[1] - vb * len];
	} else if (metPijl && pijl === 'a') {
		kop = punt(p, [-ua, -va]);
		p = [p[0] + ua * len, p[1] + va * len];
	}
	const stip =
		soort === 'submitter'
			? `<circle cx="${r1(pijl === 'b' ? p[0] : q[0])}" cy="${r1(pijl === 'b' ? p[1] : q[1])}" r="3.2" fill="${kl}"/>`
			: '';
	const streep = dash ? ` stroke-dasharray="${dash}"` : '';
	// Het patroon begint bij de kop: het pad loopt vanaf het einde waarheen de lijn wijst.
	const [s0, s1] = pijl === 'a' ? [p, q] : [q, p];
	return (
		`<path d="M${r1(s0[0])} ${r1(s0[1])}Q${r1(c[0])} ${r1(c[1])} ${r1(s1[0])} ${r1(s1[1])}" fill="none" stroke="${kl}" stroke-width="${w}" stroke-linecap="${K.edgeCapFor(stijl)}"${streep}/>` +
		kop +
		stip
	);
};

/**
 * Een omhulling (Netwerkcanvas, Omhulling): een schijf om de leden plus HULL_MARGIN, vlak 5 %
 * en lijn 1,6 px in de soortkleur, met de streep van zijn soort; de naam in een papieren pil
 * met een rand van 1 px in de soortkleur, 6 px boven de schijf. Een lid is [x, y, straal].
 */
const omhulling = (leden, soort, naam) => {
	const cx = leden.reduce((t, p) => t + p[0], 0) / leden.length;
	const cy = leden.reduce((t, p) => t + p[1], 0) / leden.length;
	const r =
		Math.max(...leden.map((p) => Math.hypot(p[0] - cx, p[1] - cy) + (p[2] ?? RAND))) +
		K.HULL_MARGIN;
	const kl = K.hullColorFor(soort);
	const dash = K.hullDashFor(soort);
	const streep = dash ? ` stroke-dasharray="${dash}" stroke-linecap="round"` : '';
	const top = cy - r - 6;
	return {
		cx,
		cy,
		r,
		schijf: `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${K.towardPaper(kl, 0.05)}" stroke="${kl}" stroke-width="1.6"${streep}/>`,
		// De breedte van de pil meet de pagina zodra de letter er is (PIL_MATEN).
		pil: `<g class="pil" data-cx="${r1(cx)}"><rect x="${r1(cx)}" y="${r1(top - 20)}" width="0" height="20" rx="3" fill="${C.paper}" stroke="${kl}" stroke-width="1"/><text x="${r1(cx)}" y="${r1(top - 6)}" text-anchor="middle" class="pl">${naam}</text></g>`
	};
};
/** Een lijn van rand tot rand tussen twee omhullingen (Wijziging van omhulling naar omhulling). */
const tussen = (h1, h2, soort, opties = {}) =>
	lijn([h1.cx, h1.cy], [h2.cx, h2.cy], soort, { ra: h1.r - LUCHT, rb: h2.r - LUCHT, ...opties });

/** Een schets: omhullingen, dan lijnen, dan bronnen; de pillen boven alles. */
const schets = ({ hullen = [], lijnen = [], bronnen = [] }) =>
	`<div class="schets"><svg width="${VAK.w}" height="${VAK.h}" viewBox="0 0 ${VAK.w} ${VAK.h}">` +
	hullen.map((h) => h.schijf).join('') +
	lijnen.join('') +
	bronnen.join('') +
	hullen.map((h) => h.pil).join('') +
	'</svg></div>';

// Het motief: de bron boven, drie verbonden bronnen eronder. Staat de focus in een omhulling
// met een omhulling eronder, dan schuin, zoals op het canvas, en één lijn naar die omhulling:
// herhaalde lijnen naar één omhulling komen pas bij hover.
const MIDDEN = [120, 98];
const RIJ = [
	[44, 222],
	[120, 244],
	[196, 222]
];
const HOEKEN = [
	[-28, -28],
	[28, -28],
	[-28, 28],
	[28, 28]
].map(([dx, dy]) => [MIDDEN[0] + dx, MIDDEN[1] + dy]);
// Schuin: de focus links boven met twee bronnen links ervan, drie bronnen rechts onder.
const F = [96, 90];
const BUREN = [
	[62, 70],
	[66, 114]
];
const ONDER = [
	[160, 212],
	[192, 194],
	[194, 230]
];
// Zonder omhulling: de bron en zijn drie dichter bij elkaar, zoals de Netwerkschets.
const LOS = [120, 112];
const LOS_RIJ = [
	[54, 208],
	[120, 230],
	[186, 208]
];
const metFocus = (leden) => [...leden.map((p) => [...p, RAND]), [...F, RAND_FOCUS]];

const SCHETS = {
	// Een artikel: deel van een wet, aangehaald door een uitspraak, toegelicht in een Kamerstuk.
	concordans: () =>
		schets({
			lijnen: [
				lijn(LOS, LOS_RIJ[0], 'part', { ra: RAND_FOCUS }),
				lijn(LOS_RIJ[1], LOS, 'citation', { rb: RAND_FOCUS }),
				lijn(LOS_RIJ[2], LOS, 'explanation', { rb: RAND_FOCUS })
			],
			bronnen: [
				teken('regel', LOS_RIJ[0], C.wet),
				teken('uitspraak', LOS_RIJ[1], C.recht),
				teken('stuk', LOS_RIJ[2], C.kst),
				focus('regel-o', LOS)
			]
		}),
	// De wet in zijn omhulling met zijn artikelen; drie uitspraken halen hem en zijn artikelen aan.
	wet: () =>
		schets({
			hullen: [
				omhulling(
					[...HOEKEN.map((p) => [...p, RAND]), [...MIDDEN, RAND_FOCUS]],
					'instrument',
					'Wet'
				)
			],
			lijnen: [
				lijn(RIJ[0], HOEKEN[2], 'citation', { buig: -1 }),
				lijn(RIJ[1], MIDDEN, 'citation', { rb: RAND_FOCUS, buig: 1 }),
				lijn(RIJ[2], HOEKEN[3], 'citation', { buig: 1 })
			],
			bronnen: [
				...HOEKEN.map((p) => teken('regel-o', p, C.wet, MAAT.artikel)),
				...RIJ.map((p) => teken('uitspraak', p, C.recht)),
				focus('regel', MIDDEN)
			]
		}),
	// Het artikel in zijn wet; een Kamerstuk uit een dossier licht het toe.
	artikel: () => {
		const boven = omhulling(metFocus(BUREN), 'instrument', 'Wet');
		const onder = omhulling(
			ONDER.map((p) => [...p, RAND]),
			'dossier',
			'Dossier'
		);
		return schets({
			hullen: [boven, onder],
			lijnen: [lijn(ONDER[0], F, 'explanation', { rb: RAND_FOCUS, buig: -1 })],
			bronnen: [
				...BUREN.map((p) => teken('regel-o', p, C.wet, MAAT.artikel)),
				...ONDER.map((p) => teken('stuk', p, C.kst)),
				focus('regel-o', F)
			]
		});
	},
	// Het wetsvoorstel in zijn dossier; het dossier wijzigt een wet (van omhulling naar omhulling).
	dossier: () => {
		const boven = omhulling(metFocus(BUREN), 'dossier', 'Dossier');
		const onder = omhulling(
			ONDER.map((p) => [...p, RAND]),
			'instrument',
			'Wet'
		);
		return schets({
			hullen: [boven, onder],
			lijnen: [tussen(boven, onder, 'change', { buig: -1 })],
			bronnen: [
				...BUREN.map((p) => teken('stuk', p, C.kst)),
				...ONDER.map((p) => teken('regel-o', p, C.wet, MAAT.artikel)),
				focus('voorstel', F)
			]
		});
	},
	// Het stuk in zijn dossier, ingediend door een Kamerlid van een fractie.
	kamerstuk: () => {
		const boven = omhulling(metFocus(BUREN), 'dossier', 'Dossier');
		const onder = omhulling(
			ONDER.map((p) => [...p, RAND]),
			'faction',
			'Fractie'
		);
		return schets({
			hullen: [boven, onder],
			lijnen: [lijn(ONDER[0], F, 'submitter', { rb: RAND_FOCUS, buig: -1 })],
			bronnen: [
				...BUREN.map((p) => teken('stuk', p, C.kst)),
				...ONDER.map((p) => teken('persoon', p, C.parl)),
				focus('stuk', F)
			]
		});
	},
	uitspraak: () => keten()
};

// --- De keten van een uitspraak, zoals Keten in het DS ----------------------------------
// Lagen van 104 met hun naam (sans 11 px 600, spatiëring 0,06 em) en een haarlijn ertussen;
// elke instantie in haar soortteken met naam en datum eronder; de gekozen uitspraak (Hoge Raad)
// in inkt. De lijnen hoger beroep, cassatie en conclusie zijn Aanhaling: gestreept, met een
// pijl naar de vorige instantie; een lijn begint en eindigt onder de naam, zijn label cursief.
const KETEN = { w: 380, h: 424, rij: 104 };
const keten = () => {
	const { w, h, rij } = KETEN;
	const X = 260;
	const lagen = ['Rechtbank', 'Gerechtshof', 'Conclusie P-G', 'Hoge Raad'];
	const y = (i) => 64 + i * rij;
	const bronnen = [
		{ x: X, laag: 0, naam: 'Rb. Gelderland', ru: '7 mrt. 2017' },
		{ x: X, laag: 1, naam: 'Hof Arnhem-Leeuwarden', ru: '27 nov. 2018' },
		{ x: 120, laag: 2, naam: 'Conclusie P-G', ru: '29 okt. 2019' },
		{ x: X, laag: 3, naam: 'HR 18 dec. 2020', ru: 'ECLI:NL:HR:2020:2095', gekozen: true }
	];
	const kl = K.towardPaper(K.edgeColorFor('APPEAL_OF', 'judgment'), 0.7);
	let svg = '';
	lagen.forEach((laag, i) => {
		svg += `<text class="lab" x="16" y="${34 + i * rij}">${laag.toUpperCase()}</text>`;
		if (i < lagen.length - 1)
			svg += `<line x1="16" x2="${w - 16}" y1="${119.5 + i * rij}" y2="${119.5 + i * rij}" stroke="${C.rule}"/>`;
	});
	// Van de latere uitspraak (boven haar teken) naar de vorige (onder haar datum).
	const aanhaling = (van, naar, label, lx, ly, anker, buig) =>
		lijn([van.x, y(van.laag) - 12], [naar.x, y(naar.laag) + 45], 'citation', {
			ra: -LUCHT,
			rb: -LUCHT,
			buig,
			kleur: kl
		}) + `<text class="kn lijnlab" x="${lx}" y="${ly}" text-anchor="${anker}">${label}</text>`;
	const [rb, hof, pg, hr] = bronnen;
	svg += aanhaling(hof, rb, 'hoger beroep', X + 8, 136.5, 'start', 0);
	svg += aanhaling(hr, hof, 'cassatie', X + 8, 292.5, 'start', 0);
	svg += lijn([hr.x - 8.5, y(3) - 8.5], [pg.x + 39, pg.laag * rij + 64 + 22.4], 'citation', {
		ra: -LUCHT,
		rb: -LUCHT,
		buig: 0.45,
		kleur: kl
	});
	svg += `<text class="kn lijnlab" x="190" y="344.5" text-anchor="middle">conclusie</text>`;
	for (const b of bronnen) {
		svg += b.gekozen
			? focus('uitspraak', [b.x, y(b.laag)], 18)
			: teken('uitspraak', [b.x, y(b.laag)], C.recht);
		svg += `<text class="kn${b.gekozen ? ' wet' : ''}" x="${b.x}" y="${y(b.laag) + 24}" text-anchor="middle">${b.naam}</text>`;
		svg += `<text class="ru" x="${b.x}" y="${y(b.laag) + 38}" text-anchor="middle">${b.ru}</text>`;
	}
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
.schets{position:absolute;right:64px;top:62px;width:${VAK.w}px;height:${VAK.h}px;transform:scale(${SCHAAL});transform-origin:top right}
.schets--keten{width:${KETEN.w}px;height:${KETEN.h}px;transform:scale(${(VAK.w * SCHAAL) / KETEN.w})}
svg{display:block;overflow:visible}
.pl{font-size:13px;font-weight:600;fill:${C.ink}}
.lab{font-family:Schibsted;font-size:11px;font-weight:600;letter-spacing:.06em;fill:${C.ink3}}
.kn{font-size:13px;fill:${C.ink2};paint-order:stroke;stroke:${C.paper};stroke-width:4px;stroke-linejoin:round}
.kn.wet{font-weight:600;fill:${C.ink}}
.ru{font-size:12px;fill:${C.ink3}}
.lijnlab{font-size:12px;fill:${C.ink3};font-style:italic}
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
	// PIL_MATEN: een pil zo breed als zijn naam plus 9 px aan elke kant.
	await page.evaluate(() => {
		for (const g of document.querySelectorAll('.pil')) {
			const w = g.querySelector('text').getBBox().width + 18;
			const rect = g.querySelector('rect');
			rect.setAttribute('x', String(Number(g.dataset.cx) - w / 2));
			rect.setAttribute('width', String(w));
		}
	});
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
