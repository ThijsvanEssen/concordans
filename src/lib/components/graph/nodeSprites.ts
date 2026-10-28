// The colours and shapes of the canvas, read from the design tokens.
//
// Sigma draws in WebGL and cannot read CSS variables, so the tokens are read once
// from `getComputedStyle` (`tokens()`) and every colour on the canvas comes from
// them: change a token in $lib/styles/tokens.css and the canvas follows after a reload.
// Each bron is drawn as its vorm (vormen.ts), a sprite for sigma's NodeImageProgram.
// This module is the one place that defines the colour and line style per relation and the
// colour of a hull; the legend reads it too.

import { VORMEN, type Vorm } from '$lib/bron/vormen';
import type { ContainerKind } from '$lib/graph/container-membership';
import type { DrawClass } from '$lib/graph/types';
import { lineKindOf } from '$lib/graph/line-kind';
import { isAmendingRelation, type Relation } from '$lib/vocabulary';

type Tokens = {
	paper: string;
	paper2: string;
	rule: string;
	ruleStrong: string;
	ink: string;
	ink2: string;
	ink3: string;
	focus: string;
	lijn: string;
	pijl: string;
	moss: string;
	plum: string;
	slate: string;
	rubriekWetten: string;
	rubriekRechtspraak: string;
	rubriekKamerstukken: string;
	rubriekParlement: string;
	rubriekRegering: string;
	fontSerif: string;
	fontLabel: string;
};

// The values of $lib/styles/tokens.css, for a page without them and for the tests (tokens.test).
export const FALLBACK: Tokens = {
	paper: '#fdfdfb',
	paper2: '#f0efeb',
	rule: '#c6c4be',
	ruleStrong: '#6a6965',
	ink: '#1f2125',
	ink2: '#3d4045',
	ink3: '#5f6267',
	focus: '#1f2125',
	lijn: '3',
	pijl: '3.2',
	moss: '#456247',
	plum: '#5e3a55',
	slate: '#4b5563',
	rubriekWetten: '#00487c',
	rubriekRechtspraak: '#438365',
	rubriekKamerstukken: '#cd7127',
	rubriekParlement: '#ab618e',
	rubriekRegering: '#523c0b',
	fontSerif:
		"'Newsreader', 'Newsreader Fallback', 'Newsreader Fallback Noto', 'Newsreader Fallback DejaVu', Georgia, serif",
	fontLabel:
		"'Newsreader', 'Newsreader Fallback', 'Newsreader Fallback Noto', 'Newsreader Fallback DejaVu', Georgia, serif"
};

export const TOKEN_NAMES: Record<keyof Tokens, string> = {
	paper: '--paper',
	paper2: '--paper-2',
	rule: '--rule',
	ruleStrong: '--rule-strong',
	ink: '--ink',
	ink2: '--ink-2',
	ink3: '--ink-3',
	focus: '--netwerk-focus',
	lijn: '--netwerk-lijn',
	pijl: '--netwerk-pijl',
	moss: '--moss',
	plum: '--plum',
	slate: '--slate',
	rubriekWetten: '--rubriek-wetten',
	rubriekRechtspraak: '--rubriek-rechtspraak',
	rubriekKamerstukken: '--rubriek-kamerstukken',
	rubriekParlement: '--rubriek-parlement',
	rubriekRegering: '--rubriek-regering',
	fontSerif: '--font-serif',
	// The labels on the canvas are text: the serif, since the sans is for controls only
	// (docs/typografie.md).
	fontLabel: '--font-serif'
};

let cached: Tokens | null = null;

/** The design tokens, read once from the document. */
export function tokens(): Tokens {
	if (cached) return cached;
	if (typeof document === 'undefined') return FALLBACK;
	const style = getComputedStyle(document.documentElement);
	const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
	const t = {} as Tokens;
	for (const key of Object.keys(TOKEN_NAMES) as (keyof Tokens)[])
		t[key] = read(TOKEN_NAMES[key], FALLBACK[key]);
	// A page still without the stylesheet keeps the fallback and reads again later.
	if (!style.getPropertyValue('--paper').trim()) return FALLBACK;
	cached = t;
	return t;
}

/**
 * The colour of a line by its soort (Netwerkcanvas, Lijnen): Structureel and Deel van in moss,
 * Wijziging in the wet's hue, Aanhaling in slate, Toelichting and Ingediend door in plum,
 * Lid van in grey.
 */
export function edgeColorFor(relation: Relation, sourceClass: DrawClass): string {
	const t = tokens();
	switch (lineKindOf(relation, sourceClass)) {
		case 'structural':
		case 'part':
			return t.moss;
		case 'change':
			return t.rubriekWetten;
		case 'citation':
			return t.slate;
		case 'explanation':
		case 'submitter':
			return t.plum;
		case 'member':
			return t.ink3;
	}
}

/** The thickness of a verbinding at rest: its weight (EDGE_WEIGHT) times --netwerk-lijn. */
export const lineThickness = (gewicht: number): number =>
	gewicht * (parseFloat(tokens().lijn) || 3);
/** An arrowhead's length in thicknesses of its line (--netwerk-pijl). */
export const arrowLength = (): number => parseFloat(tokens().pijl) || 3.2;

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** `color` at `alpha` opacity, as `rgba()`; falls back to `color` unchanged if it is not `#rrggbb`. */
export function withAlpha(color: string, alpha: number): string {
	const m = HEX.exec(color.trim());
	if (!m) return color;
	const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * `color` mixed toward `--paper`, opaque: `strength` 1 is the colour itself, 0 the paper.
 * Sigma draws on a transparent WebGL canvas, where a line with a low alpha blends toward
 * white rather than toward the paper behind it; an opaque mix keeps its hue.
 */
export function towardPaper(color: string, strength: number): string {
	const c = HEX.exec(color.trim());
	const p = HEX.exec(tokens().paper.trim());
	if (!c || !p) return color;
	const mix = (i: number) =>
		Math.round(parseInt(c[i], 16) * strength + parseInt(p[i], 16) * (1 - strength));
	return `rgb(${mix(1)}, ${mix(2)}, ${mix(3)})`;
}

/**
 * The colour of an edge or a node border pushed out of focus (hover, stale context):
 * `--rule-strong` alone is close enough to `--paper` to read as a blank line, so
 * de-emphasis mixes `--ink-3` toward the paper instead of picking a paler grey.
 */
export function dimColor(strength = 0.4): string {
	return towardPaper(tokens().ink3, strength);
}

/** The colour of a group's hull (`--rubriek-*`): Wet, Dossier, Fractie, Commissie, Kabinet. */
export function hullColorFor(kind: ContainerKind): string {
	const t = tokens();
	switch (kind) {
		case 'instrument':
			return t.rubriekWetten;
		case 'dossier':
			return t.rubriekKamerstukken;
		case 'faction':
		case 'committee':
			return t.rubriekParlement;
		case 'cabinet':
			return t.rubriekRegering;
	}
}

/**
 * The line of a group's hull, as an SVG dash array: a Wet solid, a Dossier dashed, a
 * Fractie dotted, a Commissie dash and dot, a Kabinet dash, dot and dot. The kind reads
 * without its colour.
 */
export function hullDashFor(kind: ContainerKind): string | undefined {
	switch (kind) {
		case 'instrument':
			return undefined;
		case 'dossier':
			return '6 4';
		case 'faction':
			return '1.5 3';
		case 'committee':
			return '8 3 1.5 3';
		case 'cabinet':
			return '8 3 1.5 3 1.5 3';
	}
}

/**
 * How a line is drawn (Netwerkcanvas, Lijnen): `solid` the band is straight; `dashed` a bron
 * only names the other; `dotted` belongs to; `dashdot` explains; `lid` dotted and without an
 * arrow, as Lid van has no direction; `submitter` solid with a dot at the one who submits.
 */
type EdgeStyle = 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'lid' | 'submitter';

/**
 * The style of a line by its soort: a citation (Aanhaling) is dashed, a part dotted, a
 * toelichting dash-dot, a membership dotted without an arrow; a change that is only proposed
 * is dashed. The rest is solid.
 */
export function edgeStyleFor(
	relation: Relation,
	status: string | null | undefined,
	sourceClass: DrawClass = 'article'
): EdgeStyle {
	switch (lineKindOf(relation, sourceClass)) {
		case 'member':
			return 'lid';
		case 'submitter':
			return 'submitter';
		case 'part':
			return 'dotted';
		case 'explanation':
			return 'dashdot';
		case 'citation':
			return 'dashed';
		case 'change':
			return isAmendingRelation(relation) && status === 'voorgesteld' ? 'dashed' : 'solid';
		default:
			return 'solid';
	}
}

/** The line of a style as an SVG dash array: the legend's sample and the key's. */
export function edgeDashFor(style: EdgeStyle): string | undefined {
	switch (style) {
		case 'dashed':
			return '4 3';
		case 'dotted':
		case 'lid':
			return '1.5 3.5';
		case 'dashdot':
			return '9 3 1.5 3';
		case 'solid':
			return undefined;
	}
}

// A sprite is drawn in a 32×32 box onto a canvas of SPRITE_PX and handed over as a PNG. Not
// as an SVG: sigma's image program draws its atlas once, as soon as an image has loaded, and
// Chrome may not have rasterized an SVG by then, so the atlas holds a blank and the bron never
// shows. The image program fits the box to the node's circle: half the box is its radius.
const VB = 32;
const SPRITE_PX = 128;
/** The 16-box of vormen.ts in the 32-box: moved in by 4 and scaled by 1.5, room for a halo. */
const VORM_INSET = 4;
const VORM_SCALE = 1.5;

// Een sprite per vorm (vormen.ts), in inkt. Een bron buiten de gegevens is de
// omtrek van zijn vorm; de gekozen bron krijgt een rand in inkt en een papieren halo.
const vormCache: Map<string, string> = new Map();
/** A colour token (`var(--rubriek-wetten)`) as the canvas paints it. */
function kleurUit(waarde: string | undefined, fallback: string): string {
	const naam = waarde?.match(/^var\((--[\w-]+)\)$/)?.[1];
	if (!naam) return waarde || fallback;
	if (typeof document === 'undefined') return fallback;
	return getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || fallback;
}

/**
 * The sprite of a vorm in ink, or in the colour of its kind (`colour`, kindColour): the werkplek
 * draws the kinds as the mockups do (A197).
 */
export function spriteForVorm(
	vorm: Vorm,
	stub: boolean,
	focused: boolean,
	colour?: string
): string {
	const k = `${vorm}:${stub}:${focused}:${colour ?? ''}`;
	let url = vormCache.get(k);
	if (url) return url;
	const t = tokens();
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SPRITE_PX;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	ctx.scale(SPRITE_PX / VB, SPRITE_PX / VB);
	ctx.translate(VORM_INSET, VORM_INSET);
	ctx.scale(VORM_SCALE, VORM_SCALE);
	const v = VORMEN[vorm];
	const path = new Path2D(v.d);
	const inkt = kleurUit(colour, t.ink);
	if (focused) {
		ctx.lineJoin = 'round';
		ctx.strokeStyle = t.paper;
		ctx.lineWidth = 4;
		ctx.stroke(path);
		ctx.strokeStyle = t.ink;
		ctx.lineWidth = 1.6;
		ctx.stroke(path);
	}
	if (stub || v.wijze === 'lijn') {
		ctx.fillStyle = t.paper;
		ctx.fill(path, v.wijze === 'gat' ? 'evenodd' : 'nonzero');
		ctx.strokeStyle = stub ? t.ink3 : inkt;
		ctx.lineWidth = v.wijze === 'lijn' ? 2 : 1.3;
		ctx.stroke(path);
	} else {
		ctx.fillStyle = inkt;
		ctx.fill(path, v.wijze === 'gat' ? 'evenodd' : 'nonzero');
	}
	url = canvas.toDataURL('image/png');
	vormCache.set(k, url);
	return url;
}

export const IMAGE_SIZE_BUMP = 1.35;

/**
 * Where a ray from the centre (8, 8) towards the top right leaves each vorm, per axis, in the
 * 16-box of vormen.ts: the edge the badge of Open dossiers and the mark of a note stand on. A
 * vorm drawn as a line counts the outer half of its stroke.
 */
export const EDGE_AT_45: Record<Vorm, number> = {
	regel: 6,
	'regel-int': 6,
	'regel-o': 5.7,
	publicatie: 6,
	uitspraak: 4.6,
	stuk: 4.5,
	voorstel: 4.5,
	dossier: 3,
	besluit: 2.3,
	activiteit: 2.4,
	toezegging: 6,
	persoon: 3.2,
	orgaan: 4.4,
	'orgaan-o': 4.3,
	kabinet: 4.4,
	ministerie: 4.4,
	bewindspersoon: 3.2,
	overig: 3.5
};

/** The per-axis offset of a vorm's edge at 45° (top right), in units of the node's radius. */
export const badgeAxisOffset = (vorm: Vorm): number => (EDGE_AT_45[vorm] * VORM_SCALE) / (VB / 2);

/**
 * The sprite of a cluster (Netwerkcanvas, Cluster): a disc in the colour of its kind on a rim
 * of paper, its count inside in paper, "250".
 */
export function clusterSprite(count: string, colour: string | undefined): string {
	const k = `cluster:${count}:${colour ?? ''}`;
	let url = vormCache.get(k);
	if (url) return url;
	const t = tokens();
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SPRITE_PX;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const c = SPRITE_PX / 2;
	ctx.fillStyle = t.paper;
	ctx.beginPath();
	ctx.arc(c, c, c, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = kleurUit(colour, t.ink);
	ctx.beginPath();
	ctx.arc(c, c, c * (19 / 21.5), 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = t.paper;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const size = count.length > 3 ? 30 : 38;
	ctx.font = `600 ${size}px ${t.fontSerif}`;
	ctx.fillText(count, c, c + 2);
	url = canvas.toDataURL('image/png');
	vormCache.set(k, url);
	return url;
}
