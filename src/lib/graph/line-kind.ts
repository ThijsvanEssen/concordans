// The lijnsoorten of the canvas (Netwerkcanvas, Lijnen): every relation is one of seven, and a
// kind carries the colour, stroke, arrow and weight of its lines. Relatie lists them, one row
// each, and switches them off; no relation draws a line that is in none of them.
import type { Relation } from '$lib/vocabulary';
import type { DrawClass } from './types';

export const LINE_KINDS = [
	'structural',
	'part',
	'change',
	'citation',
	'explanation',
	'submitter',
	'member'
] as const;

export type LineKind = (typeof LINE_KINDS)[number];

export const LINE_KIND_LABEL: Record<LineKind, string> = {
	structural: 'Structureel',
	part: 'Deel van',
	change: 'Wijziging',
	citation: 'Aanhaling',
	explanation: 'Toelichting',
	submitter: 'Ingediend door',
	member: 'Lid van'
};

/** The kind of each relation; REFERS_TO is Aanhaling, but Structureel from an article. */
const KIND_OF: Record<Relation, LineKind> = {
	BASED_ON: 'structural',
	IMPLEMENTS: 'structural',
	LEGISLATED_IN: 'structural',
	SCOPED_BY: 'structural',
	TRANSPOSED_TO: 'structural',
	SECOND_READING_OF: 'structural',
	PART_OF: 'part',
	VERSION_OF: 'part',
	ABOUT: 'part',
	ACCOMPANIES: 'part',
	ESTABLISHES: 'change',
	AMENDS: 'change',
	INTRODUCES: 'change',
	REPEALS: 'change',
	COMMENCES: 'change',
	REVISES: 'change',
	REFERS_TO: 'citation',
	APPEAL_OF: 'citation',
	ADVISES_ON: 'citation',
	ANSWERS: 'citation',
	CONTINUES: 'citation',
	REFERRED_BY: 'citation',
	SAME_AS: 'citation',
	MADE_IN: 'citation',
	PUBLISHED_IN: 'citation',
	RELATED_TO: 'citation',
	EXPLAINS: 'explanation',
	AUTHORED: 'submitter',
	MEMBER_OF: 'member',
	LED_BY: 'member',
	SERVED_IN: 'member',
	VOTED: 'member'
};

/** The kind of a line: a citation by an article is the text of the law itself (Structureel). */
export function lineKindOf(relation: Relation, from: DrawClass = 'article'): LineKind {
	return relation === 'REFERS_TO' && from === 'article' ? 'structural' : KIND_OF[relation];
}

/** A relation and the kind it comes from that draw a kind, for its sample in Relatie. */
export const LINE_KIND_SAMPLE: Record<LineKind, { relation: Relation; from: DrawClass }> = {
	structural: { relation: 'BASED_ON', from: 'article' },
	part: { relation: 'PART_OF', from: 'article' },
	change: { relation: 'AMENDS', from: 'document' },
	citation: { relation: 'REFERS_TO', from: 'judgment' },
	explanation: { relation: 'EXPLAINS', from: 'document' },
	submitter: { relation: 'AUTHORED', from: 'member' },
	member: { relation: 'MEMBER_OF', from: 'member' }
};

export const isLineKind = (s: string): s is LineKind =>
	(LINE_KINDS as readonly string[]).includes(s);
