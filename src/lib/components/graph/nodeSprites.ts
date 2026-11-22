// The colours and shapes of the canvas, read from the design tokens.
//
// The tokens are read once from `getComputedStyle` (`tokens()`) and every colour of the
// lines comes from them: change a token in $lib/styles/tokens.css and the lines follow after a reload.
// This module is the one place that defines the colour and line style per relation and the
// colour of a hull; the legend reads it too.

import type { ContainerKind } from '$lib/graph/container-membership';
import type { DrawClass } from '$lib/graph/types';
import {
	LINE_KIND_STYLE,
	lineKindOf,
	lineStyleOf,
	type Stroke,
	type Tone
} from '$lib/graph/line-kind';
import { lineStrength } from '$lib/graph/line-strength';
import type { Relation } from '$lib/vocabulary';

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
 * The colour of a line by its soort (Netwerkcanvas, Lijnen): the table of line-kind.ts, read from
 * the tokens.
 */
export function edgeColorFor(relation: Relation, sourceClass: DrawClass): string {
	return tokens()[LINE_KIND_STYLE[lineKindOf(relation, sourceClass)].colour];
}

/** The tone of a line by its soort: a change that is only proposed is light. */
export const edgeToneFor = (
	relation: Relation,
	status: string | null | undefined,
	sourceClass: DrawClass = 'article'
): Tone => lineStyleOf(relation, sourceClass, status).tone;

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
 * A line with a low alpha blends toward white rather than toward the paper behind it; an opaque
 * mix keeps its hue.
 */
export function towardPaper(color: string, strength: number): string {
	const c = HEX.exec(color.trim());
	const p = HEX.exec(tokens().paper.trim());
	if (!c || !p) return color;
	const mix = (i: number) =>
		Math.round(parseInt(c[i], 16) * strength + parseInt(p[i], 16) * (1 - strength));
	return `rgb(${mix(1)}, ${mix(2)}, ${mix(3)})`;
}

/** A line in its tone at rest, as the drawings of the Design System show it: the top of its window. */
export function toneColour(color: string, tone: Tone): string {
	return towardPaper(color, lineStrength(color, tokens().paper, tone, 1));
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
 * How a line is stroked (Netwerkcanvas, Lijnen): `solid` the law itself; `kort` and `lang` a bron
 * names the other (an Aanhaling, a Toelichting); `punten` belongs to, without an arrow;
 * `puntenIndiener` the same with a dot at the one who submits.
 */
type EdgeStyle = Stroke;

/** The stroke of a line by its soort, from the table of line-kind.ts. */
export function edgeStyleFor(
	relation: Relation,
	status: string | null | undefined,
	sourceClass: DrawClass = 'article'
): EdgeStyle {
	return lineStyleOf(relation, sourceClass, status).stroke;
}

/** The line of a style as an SVG dash array, from the head: the legend's sample and the key's. */
export function edgeDashFor(style: EdgeStyle): string | undefined {
	switch (style) {
		case 'kort':
			return '4 2.5';
		case 'lang':
			return '8 3';
		case 'punten':
			return '0 4';
		case 'puntenIndiener':
			return '0 4.5';
		case 'solid':
			return undefined;
	}
}

/** The cap of a stroke: round, so a dot is round; flat for a dash, so it keeps its length. */
export const edgeCapFor = (style: EdgeStyle): 'round' | 'butt' =>
	style === 'kort' || style === 'lang' ? 'butt' : 'round';
