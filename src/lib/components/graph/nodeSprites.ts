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
	accent: string;
	accentSoft: string;
	indigo: string;
	moss: string;
	plum: string;
	slate: string;
	fontSerif: string;
	fontSans: string;
};

// The values of AppShell.svelte, for the server and for a page without the tokens.
const FALLBACK: Tokens = {
	paper: '#f8f6f1',
	paper2: '#f1eee7',
	rule: '#e3dfd6',
	ruleStrong: '#c9c4b8',
	ink: '#1c1b19',
	ink2: '#4a4742',
	ink3: '#77736b',
	accent: '#8c2f28',
	accentSoft: '#f3e4e2',
	indigo: '#2f3e5e',
	moss: '#456247',
	plum: '#5e3a55',
	slate: '#4b5563',
	fontSerif: "'Newsreader', Georgia, serif",
	fontSans: "'Schibsted Grotesk', system-ui, sans-serif"
};

const NAMES: Record<keyof Tokens, string> = {
	paper: '--paper',
	paper2: '--paper-2',
	rule: '--rule',
	ruleStrong: '--rule-strong',
	ink: '--ink',
	ink2: '--ink-2',
	ink3: '--ink-3',
	accent: '--accent',
	accentSoft: '--accent-soft',
	indigo: '--indigo',
	moss: '--moss',
	plum: '--plum',
	slate: '--slate',
	fontSerif: '--font-serif',
	fontSans: '--font-sans'
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

// Articles: open ink circle. Judgments: indigo disc. Documents: accent hexagon.
// Instruments: ink diamond. Dossiers: open accent diamond. Committees and
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
			return t.accent;
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
		case 'document':
			return t.accent;
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
 * in plum, changes in the accent, the rest (gaat over, geleid door) in grey.
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
			return t.accent;
		case 'APPEAL_OF':
		case 'MADE_IN':
			return t.slate;
		default:
			return t.ink3;
	}
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** `color` at `alpha` opacity, as `rgba()`; falls back to `color` unchanged if it is not `#rrggbb`. */
export function withAlpha(color: string, alpha: number): string {
	const m = HEX.exec(color.trim());
	if (!m) return color;
	const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The colour of an edge or a node border pushed out of focus (hover, stale context):
 * `--rule-strong` alone is close enough to `--paper` to read as a blank line, so
 * de-emphasis dims `--ink-3` toward the paper instead of picking a paler grey.
 */
export function dimColor(alpha = 0.4): string {
	return withAlpha(tokens().ink3, alpha);
}

/** The hull colour of a container: the same family as its `PART_OF`/`MEMBER_OF` edges would be. */
export function hullColorFor(kind: ContainerKind): string {
	const t = tokens();
	switch (kind) {
		case 'instrument':
			return t.moss;
		case 'faction':
			return t.plum;
		case 'committee':
			return t.ink3;
		case 'dossier':
			return t.accent;
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

// Sprite viewBox is 32×32 with shapes centred at (16,16) and "radius" 14.
const VB = 32;
const C = 16;
const R = 14;

function pathFor(shape: NodeShape): string {
	switch (shape) {
		case 'circle':
			return `<circle cx="${C}" cy="${C}" r="${R}" />`;
		case 'diamond':
			return `<polygon points="${C},${C - R} ${C + R},${C} ${C},${C + R} ${C - R},${C}" />`;
		case 'hexagon': {
			const dx = R;
			const dy = R * 0.866;
			const hx = R * 0.5;
			const pts = [
				[C - dx, C],
				[C - hx, C - dy],
				[C + hx, C - dy],
				[C + dx, C],
				[C + hx, C + dy],
				[C - hx, C + dy]
			];
			return `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" />`;
		}
		case 'roundedRect': {
			const s = R * 1.7;
			const x = C - s / 2;
			const rr = s * 0.22;
			return `<rect x="${x}" y="${x}" width="${s}" height="${s}" rx="${rr}" ry="${rr}" />`;
		}
	}
}

function svgFor(shape: NodeShape, fill: string, stroke: string, strokeWidth: number): string {
	const raw = pathFor(shape);
	const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"`;
	const withAttrs = raw.replace(/^<(\w+)\s/, `<$1 ${attrs} `);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}">${withAttrs}</svg>`;
}

function toDataUrl(svg: string): string {
	if (typeof btoa === 'function') return `data:image/svg+xml;base64,${btoa(svg)}`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type Variant = 'normal' | 'focused' | 'stub';
const cache: Map<string, string> = new Map();

function buildSprite(kind: GraphNodeKind, variant: Variant): string {
	const shape = shapeFor(kind);
	const t = tokens();
	// A stub (referenced, not loaded yet) keeps a paper fill and the stroke of its kind.
	if (variant === 'stub') return svgFor(shape, t.paper, strokeFor(kind), 1.5);
	// The focused bron takes the accent as an outer stroke.
	if (variant === 'focused') return svgFor(shape, fillFor(kind), t.accent, 2.8);
	const isOpen = fillFor(kind) === t.paper;
	return svgFor(shape, fillFor(kind), strokeFor(kind), isOpen ? 2.4 : 1);
}

export function spriteFor(kind: GraphNodeKind, stub: boolean, focused: boolean): string {
	const variant: Variant = stub ? 'stub' : focused ? 'focused' : 'normal';
	const k = `${kind}:${variant}`;
	let url = cache.get(k);
	if (!url) {
		url = toDataUrl(buildSprite(kind, variant));
		cache.set(k, url);
	}
	return url;
}

export const IMAGE_SIZE_BUMP = 1.0;

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
