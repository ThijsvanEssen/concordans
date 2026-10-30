// The lijnsoorten of the canvas (Netwerkcanvas, Lijnen): every relation is one of eight, and a
// kind carries the colour, stroke, arrow and weight of its lines. Relatie lists them, one row
// each, and switches them off; no relation draws a line that is in none of them.
// The stroke gives the family (solid: the law itself; dashed: names it; round dots: belongs to,
// without an arrow), the tone the kind within it (dark, middle, light), the table below both.
import { isAmendingRelation, RELATIONS, type Relation } from '$lib/vocabulary';
import type { DrawClass } from './types';

export const LINE_KINDS = [
	'structural',
	'part',
	'change',
	'citation',
	'explanation',
	'submitter',
	'member',
	'led'
] as const;

export type LineKind = (typeof LINE_KINDS)[number];

export const LINE_KIND_LABEL: Record<LineKind, string> = {
	structural: 'Structureel',
	part: 'Deel van',
	change: 'Wijziging',
	citation: 'Aanhaling',
	explanation: 'Toelichting',
	submitter: 'Ingediend door',
	member: 'Lid van',
	led: 'Onder leiding van'
};

/**
 * The kind of a line, from RELATIONS: REFERS_TO is Aanhaling, but a citation by an article is the
 * text of the law itself (Structureel). A name the API does not have draws no kind.
 */
export function lineKindOf(relation: Relation, from: DrawClass = 'article'): LineKind {
	return relation === 'REFERS_TO' && from === 'article'
		? 'structural'
		: RELATIONS[relation]?.lineKind;
}

/** A relation and the kind it comes from that draw a kind, for its sample in Relatie. */
export const LINE_KIND_SAMPLE: Record<LineKind, { relation: Relation; from: DrawClass }> = {
	structural: { relation: 'BASED_ON', from: 'article' },
	part: { relation: 'PART_OF', from: 'article' },
	change: { relation: 'AMENDS', from: 'document' },
	citation: { relation: 'REFERS_TO', from: 'judgment' },
	explanation: { relation: 'EXPLAINS', from: 'document' },
	submitter: { relation: 'AUTHORED', from: 'member' },
	member: { relation: 'MEMBER_OF', from: 'member' },
	led: { relation: 'LED_BY', from: 'dossier' }
};

export const isLineKind = (s: string): s is LineKind =>
	(LINE_KINDS as readonly string[]).includes(s);

/** How strongly a kind is drawn: dark, middle or light, a window of the strength (line-strength). */
export type Tone = 'donker' | 'middel' | 'licht';

/** The stroke of a line: a program of the canvas and a dash array in SVG (nodeSprites). */
export type Stroke = 'solid' | 'kort' | 'lang' | 'punten' | 'puntenIndiener';

/** A colour token of the canvas (nodeSprites, Tokens). */
type LineColour = 'moss' | 'rubriekWetten' | 'slate' | 'plum' | 'ink3';

type KindStyle = { colour: LineColour; tone: Tone; stroke: Stroke };

/** The one table: colour, tone and stroke of each kind. Nothing else decides how a kind is drawn. */
export const LINE_KIND_STYLE: Record<LineKind, KindStyle> = {
	change: { colour: 'rubriekWetten', tone: 'donker', stroke: 'solid' },
	structural: { colour: 'moss', tone: 'middel', stroke: 'solid' },
	explanation: { colour: 'plum', tone: 'donker', stroke: 'lang' },
	citation: { colour: 'slate', tone: 'licht', stroke: 'kort' },
	part: { colour: 'moss', tone: 'middel', stroke: 'punten' },
	submitter: { colour: 'plum', tone: 'donker', stroke: 'puntenIndiener' },
	member: { colour: 'ink3', tone: 'licht', stroke: 'punten' },
	// A commissie's voortouw: the dots of belongs to, in the colour of the parlement (B41).
	led: { colour: 'plum', tone: 'donker', stroke: 'punten' }
};

/** A line of the family hoort bij has no arrowhead: the omhulling or the nodes say the direction. */
export const hasArrow = (stroke: Stroke): boolean =>
	stroke !== 'punten' && stroke !== 'puntenIndiener';

/**
 * The style of a line: that of its kind, but a change that is only proposed is drawn light, in
 * the stroke of its family.
 */
export function lineStyleOf(
	relation: Relation,
	from: DrawClass = 'article',
	status?: string | null
): KindStyle {
	const kind = lineKindOf(relation, from);
	const style = LINE_KIND_STYLE[kind];
	return kind === 'change' && isAmendingRelation(relation) && status === 'voorgesteld'
		? { ...style, tone: 'licht' }
		: style;
}
