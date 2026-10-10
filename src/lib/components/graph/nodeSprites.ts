import { VORMEN, type Vorm } from '$lib/bron/vormen';
// The colours and shapes of the canvas, read from the design tokens.
//
// Sigma draws in WebGL and cannot read CSS variables, so the tokens are read once
// from `getComputedStyle` (`tokens()`) and every colour on the canvas comes from
// them: change a token in AppShell.svelte and the canvas follows after a reload.
// Shapes are generated once as SVG sprites (data URLs) for sigma's NodeImageProgram.
// This module is the one place that defines colour and shape per kind and colour
// and line style per relation; the legend and KindGlyph read it too.

import type { ContainerKind } from '$lib/graph/container-membership';
import type { GraphNodeKind } from '$lib/graph/types';
import type { Relation } from '$lib/vocabulary';

export type Tokens = {
	paper: string;
	paper2: string;
	rule: string;
	ruleStrong: string;
	ink: string;
	ink2: string;
	ink3: string;
	stuk: string;
	dossier: string;
	wijziging: string;
	focus: string;
	lijn: string;
	pijl: string;
	indigo: string;
	moss: string;
	plum: string;
	slate: string;
	groepWet: string;
	groepFractie: string;
	groepCommissie: string;
	groepDossier: string;
	fontSerif: string;
	fontSans: string;
};

// The values of AppShell.svelte, for the server and for a page without the tokens.
const FALLBACK: Tokens = {
	paper: '#faf8f3',
	paper2: '#ece7dc',
	rule: '#b9b1a0',
	ruleStrong: '#6f6859',
	ink: '#161513',
	ink2: '#3b3834',
	ink3: '#5d5951',
	stuk: '#d3762d',
	dossier: '#d3762d',
	wijziging: '#00487c',
	focus: '#161513',
	lijn: '3',
	pijl: '3.2',
	indigo: '#2f3e5e',
	moss: '#456247',
	plum: '#5e3a55',
	slate: '#4b5563',
	groepWet: '#00487c',
	groepFractie: '#944078',
	groepCommissie: '#438365',
	groepDossier: '#d3762d',
	fontSerif: "'Newsreader', Georgia, serif",
	fontSans: "'Newsreader', Georgia, serif"
};

const NAMES: Record<keyof Tokens, string> = {
	paper: '--paper',
	paper2: '--paper-2',
	rule: '--rule',
	ruleStrong: '--rule-strong',
	ink: '--ink',
	ink2: '--ink-2',
	ink3: '--ink-3',
	stuk: '--netwerk-stuk',
	dossier: '--netwerk-dossier',
	wijziging: '--netwerk-wijziging',
	focus: '--netwerk-focus',
	lijn: '--netwerk-lijn',
	pijl: '--netwerk-pijl',
	indigo: '--indigo',
	moss: '--moss',
	plum: '--plum',
	slate: '--slate',
	groepWet: '--groep-wet',
	groepFractie: '--groep-fractie',
	groepCommissie: '--groep-commissie',
	groepDossier: '--groep-dossier',
	fontSerif: '--font-serif',
	// The labels on the canvas are text: the serif too, since the sans is for controls only
	// (docs/typografie.md). The key keeps its name for the places that read it.
	fontSans: '--font-serif'
};

let cached: Tokens | null = null;

/** The design tokens, read once from the document. */
export function tokens(): Tokens {
	if (cached) return cached;
	if (typeof document === 'undefined') return FALLBACK;
	const style = getComputedStyle(document.documentElement);
	const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
	const t = {} as Tokens;
	for (const key of Object.keys(NAMES) as (keyof Tokens)[])
		t[key] = read(NAMES[key], FALLBACK[key]);
	// A page still without the stylesheet keeps the fallback and reads again later.
	if (!style.getPropertyValue('--paper').trim()) return FALLBACK;
	cached = t;
	return t;
}

export type NodeShape = 'circle' | 'diamond' | 'roundedRect' | 'hexagon';

// Articles: open ink circle. Judgments: indigo disc. Documents: a hexagon in the dossier hue.
// Instruments: ink diamond. Dossiers: open diamond in the same hue. Committees and
// activities: grey. Factions and members: plum, in a badge shape for members.
export function fillFor(kind: GraphNodeKind): string {
	const t = tokens();
	switch (kind) {
		case 'article':
		case 'dossier':
		case 'other':
			return t.paper;
		case 'instrument':
			return t.ink;
		case 'judgment':
			return t.indigo;
		case 'document':
			return t.stuk;
		case 'committee':
		case 'activity':
			return t.ink3;
		case 'faction':
		case 'member':
			return t.plum;
	}
}

export function strokeFor(kind: GraphNodeKind): string {
	const t = tokens();
	switch (kind) {
		case 'article':
		case 'instrument':
			return t.ink;
		case 'judgment':
			return t.indigo;
		case 'dossier':
			return t.dossier;
		// The dossier hue is 3.1:1 against the paper and 2.9:1 in a dossier's wash: the edge
		// in ink-3 keeps the stuk apart from both (6:1).
		case 'document':
			return t.ink3;
		case 'committee':
		case 'activity':
		case 'other':
			return t.ink3;
		case 'faction':
		case 'member':
			return t.plum;
	}
}

/**
 * Edge colours by relation: references between articles and the structure of the
 * law in moss, appeals and gedaan-in in slate, toelichting and ingediend-door
 * in plum, changes to a wet in the wet's hue, the rest (gaat over, geleid door) in grey.
 */
export function edgeColorFor(relation: Relation, sourceKind: GraphNodeKind): string {
	const t = tokens();
	switch (relation) {
		case 'REFERS_TO':
			return sourceKind === 'article' ? t.moss : t.slate;
		case 'PART_OF':
		case 'BASED_ON':
		case 'IMPLEMENTS':
		case 'LEGISLATED_IN':
		case 'VERSION_OF':
		case 'SCOPED_BY':
			return t.moss;
		case 'EXPLAINS':
		case 'AUTHORED':
			return t.plum;
		case 'AMENDS':
		case 'INTRODUCES':
		case 'REPEALS':
			return t.wijziging;
		case 'APPEAL_OF':
		case 'ADVISES_ON':
		case 'ANSWERS':
		case 'CONTINUES':
		case 'REFERRED_BY':
		case 'SAME_AS':
		case 'MADE_IN':
			return t.slate;
		default:
			return t.ink3;
	}
}

/** The thickness of a verbinding at rest: its weight (EDGE_WEIGHT) times --netwerk-lijn. */
export const lijnDikte = (gewicht: number): number => gewicht * (parseFloat(tokens().lijn) || 3);
/** An arrowhead's length in thicknesses of its line (--netwerk-pijl). */
export const pijlLengte = (): number => parseFloat(tokens().pijl) || 3.2;
/** An arrowhead's width to its length. */
export const PIJL_BREED = 0.8;

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

/** The colour of a group's hull (`--groep-*`): Wet, Fractie, Commissie, Dossier. */
export function hullColorFor(kind: ContainerKind): string {
	const t = tokens();
	switch (kind) {
		case 'instrument':
			return t.groepWet;
		case 'faction':
			return t.groepFractie;
		case 'committee':
			return t.groepCommissie;
		case 'dossier':
			return t.groepDossier;
	}
}

/**
 * The line of a group's hull, as an SVG dash array: a Wet solid, a Dossier dashed, a
 * Fractie dotted, a Commissie dash and dot. The kind reads without its colour.
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
	}
}

export type EdgeStyle = 'solid' | 'dashed' | 'dotted';

/** PART_OF and LED_BY are dotted; a change that is proposed, and a vote, are dashed. */
export function edgeStyleFor(relation: Relation, status: string | null | undefined): EdgeStyle {
	if (relation === 'PART_OF' || relation === 'LED_BY') return 'dotted';
	if (relation === 'VOTED') return 'dashed';
	if (
		(relation === 'AMENDS' || relation === 'INTRODUCES' || relation === 'REPEALS') &&
		status === 'voorgesteld'
	)
		return 'dashed';
	return 'solid';
}

export const KIND_SHAPE: Record<GraphNodeKind, NodeShape> = {
	article: 'circle',
	instrument: 'diamond',
	judgment: 'circle',
	dossier: 'diamond',
	document: 'hexagon',
	committee: 'hexagon',
	activity: 'diamond',
	faction: 'hexagon',
	member: 'roundedRect',
	other: 'circle'
};

export const shapeFor = (kind: GraphNodeKind): NodeShape => KIND_SHAPE[kind];

// A sprite is drawn in a 32×32 box, the shape centred at (16,16) with "radius" 14,
// onto a canvas of SPRITE_PX and handed over as a PNG. Not as an SVG: sigma's image
// program draws its atlas once, as soon as an image has loaded, and Chrome may not
// have rasterized an SVG by then, so the atlas holds a blank and the bron never shows.
const VB = 32;
const C = 16;
const R = 14;
const SPRITE_PX = 128;

function tracePath(ctx: CanvasRenderingContext2D, shape: NodeShape): void {
	ctx.beginPath();
	switch (shape) {
		case 'circle':
			ctx.arc(C, C, R, 0, Math.PI * 2);
			break;
		case 'diamond':
			ctx.moveTo(C, C - R);
			ctx.lineTo(C + R, C);
			ctx.lineTo(C, C + R);
			ctx.lineTo(C - R, C);
			break;
		case 'hexagon': {
			const dy = R * 0.866;
			const hx = R * 0.5;
			ctx.moveTo(C - R, C);
			ctx.lineTo(C - hx, C - dy);
			ctx.lineTo(C + hx, C - dy);
			ctx.lineTo(C + R, C);
			ctx.lineTo(C + hx, C + dy);
			ctx.lineTo(C - hx, C + dy);
			break;
		}
		case 'roundedRect': {
			const size = R * 1.7;
			ctx.roundRect(C - size / 2, C - size / 2, size, size, size * 0.22);
			break;
		}
	}
	ctx.closePath();
}

function drawSprite(shape: NodeShape, fill: string, stroke: string, strokeWidth: number): string {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SPRITE_PX;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	ctx.scale(SPRITE_PX / VB, SPRITE_PX / VB);
	tracePath(ctx, shape);
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.strokeStyle = stroke;
	ctx.lineWidth = strokeWidth;
	ctx.stroke();
	return canvas.toDataURL('image/png');
}

type Variant = 'normal' | 'focused' | 'stub';
const cache: Map<string, string> = new Map();

function buildSprite(kind: GraphNodeKind, variant: Variant): string {
	const shape = shapeFor(kind);
	const t = tokens();
	// A stub (referenced, not loaded yet) keeps a paper fill and the stroke of its kind.
	if (variant === 'stub') return drawSprite(shape, t.paper, strokeFor(kind), 1.5);
	// The focused bron takes an outer stroke in ink.
	if (variant === 'focused') return drawSprite(shape, fillFor(kind), t.focus, 2.8);
	const isOpen = fillFor(kind) === t.paper;
	return drawSprite(shape, fillFor(kind), strokeFor(kind), isOpen ? 2.4 : 1);
}

// Een sprite per vorm (vormen.ts), in inkt. Een bron buiten de gegevens is de
// omtrek van zijn vorm; de gekozen bron krijgt een rand in inkt en een papieren halo.
const vormCache: Map<string, string> = new Map();
export function spriteForVorm(vorm: Vorm, stub: boolean, focused: boolean): string {
	const k = `${vorm}:${stub}:${focused}`;
	let url = vormCache.get(k);
	if (url) return url;
	const t = tokens();
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SPRITE_PX;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	// The 16-box of vormen.ts, centred in the 32-box with room for a halo.
	ctx.scale(SPRITE_PX / VB, SPRITE_PX / VB);
	ctx.translate(4, 4);
	ctx.scale(1.5, 1.5);
	const v = VORMEN[vorm];
	const path = new Path2D(v.d);
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
		ctx.strokeStyle = stub ? t.ink3 : t.ink;
		ctx.lineWidth = v.wijze === 'lijn' ? 2 : 1.3;
		ctx.stroke(path);
	} else {
		ctx.fillStyle = t.ink;
		ctx.fill(path, v.wijze === 'gat' ? 'evenodd' : 'nonzero');
	}
	url = canvas.toDataURL('image/png');
	vormCache.set(k, url);
	return url;
}

export function spriteFor(kind: GraphNodeKind, stub: boolean, focused: boolean): string {
	const variant: Variant = stub ? 'stub' : focused ? 'focused' : 'normal';
	const k = `${kind}:${variant}`;
	let url = cache.get(k);
	if (!url) {
		url = buildSprite(kind, variant);
		cache.set(k, url);
	}
	return url;
}

export const IMAGE_SIZE_BUMP = 1.35;

// Per-axis badge offset at 45° (top-right), in units of node radius.
const BADGE_AXIS_OFFSET: Record<NodeShape, number> = {
	circle: 0.707,
	diamond: 0.44,
	hexagon: 0.55,
	roundedRect: 0.62
};

export function badgeAxisOffset(kind: GraphNodeKind): number {
	return BADGE_AXIS_OFFSET[shapeFor(kind)];
}
