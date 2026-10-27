// The lijnsoorten of the canvas (Netwerkcanvas, Lijnen): every relation is one of seven, and a
// soort carries the colour, stroke, arrow and weight of its lines. Relatie lists them, one row
// each, and switches them off; no relation draws a line that is in none of them.
import type { Relation } from '$lib/vocabulary';
import type { DrawClass } from './types';

export const LIJNSOORTEN = [
	'structureel',
	'deel',
	'wijziging',
	'aanhaling',
	'toelichting',
	'indiener',
	'lid'
] as const;

export type Lijnsoort = (typeof LIJNSOORTEN)[number];

export const LIJNSOORT_LABEL: Record<Lijnsoort, string> = {
	structureel: 'Structureel',
	deel: 'Deel van',
	wijziging: 'Wijziging',
	aanhaling: 'Aanhaling',
	toelichting: 'Toelichting',
	indiener: 'Ingediend door',
	lid: 'Lid van'
};

/** The soort of each relation; REFERS_TO is Aanhaling, but Structureel from an article. */
const SOORT: Record<Relation, Lijnsoort> = {
	BASED_ON: 'structureel',
	IMPLEMENTS: 'structureel',
	LEGISLATED_IN: 'structureel',
	SCOPED_BY: 'structureel',
	TRANSPOSED_TO: 'structureel',
	SECOND_READING_OF: 'structureel',
	PART_OF: 'deel',
	VERSION_OF: 'deel',
	ABOUT: 'deel',
	ACCOMPANIES: 'deel',
	ESTABLISHES: 'wijziging',
	AMENDS: 'wijziging',
	INTRODUCES: 'wijziging',
	REPEALS: 'wijziging',
	COMMENCES: 'wijziging',
	REVISES: 'wijziging',
	REFERS_TO: 'aanhaling',
	APPEAL_OF: 'aanhaling',
	ADVISES_ON: 'aanhaling',
	ANSWERS: 'aanhaling',
	CONTINUES: 'aanhaling',
	REFERRED_BY: 'aanhaling',
	SAME_AS: 'aanhaling',
	MADE_IN: 'aanhaling',
	PUBLISHED_IN: 'aanhaling',
	RELATED_TO: 'aanhaling',
	EXPLAINS: 'toelichting',
	AUTHORED: 'indiener',
	MEMBER_OF: 'lid',
	LED_BY: 'lid',
	SERVED_IN: 'lid',
	VOTED: 'lid'
};

/** The soort of a line: a citation by an article is the text of the law itself (Structureel). */
export function lijnsoortOf(relation: Relation, from: DrawClass = 'article'): Lijnsoort {
	return relation === 'REFERS_TO' && from === 'article' ? 'structureel' : SOORT[relation];
}

/** A relation and the kind it comes from that draw a soort, for its sample in Relatie. */
export const LIJNSOORT_VOORBEELD: Record<Lijnsoort, { relation: Relation; from: DrawClass }> = {
	structureel: { relation: 'BASED_ON', from: 'article' },
	deel: { relation: 'PART_OF', from: 'article' },
	wijziging: { relation: 'AMENDS', from: 'document' },
	aanhaling: { relation: 'REFERS_TO', from: 'judgment' },
	toelichting: { relation: 'EXPLAINS', from: 'document' },
	indiener: { relation: 'AUTHORED', from: 'member' },
	lid: { relation: 'MEMBER_OF', from: 'member' }
};

export const isLijnsoort = (s: string): s is Lijnsoort =>
	(LIJNSOORTEN as readonly string[]).includes(s);
