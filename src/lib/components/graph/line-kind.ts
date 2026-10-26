// The seven kinds of line of the canvas (Netwerkcanvas, Lijnen) and which of them are drawn: the
// key of Netwerkkeuze. Colour, stroke and arrow of a kind are the canvas's (nodeSprites).
import type { DrawClass } from '$lib/graph/types';
import type { Collection, Relation } from '$lib/vocabulary';

type LineKind = {
	id: string;
	/** What the legend calls it. */
	label: string;
	/** A relation of the kind, and the kind of bron it comes from, to draw its sample with. */
	sample: { relation: Relation; from: DrawClass };
	/** The relations that are of this kind. A citation by an article is Structureel, otherwise Aanhaling. */
	relations: readonly Relation[];
};

const LINE_KINDS: readonly LineKind[] = [
	{
		id: 'structureel',
		label: 'Structureel',
		sample: { relation: 'BASED_ON', from: 'article' },
		relations: ['BASED_ON', 'IMPLEMENTS', 'LEGISLATED_IN', 'SCOPED_BY']
	},
	{
		id: 'deel-van',
		label: 'Deel van',
		sample: { relation: 'PART_OF', from: 'article' },
		relations: ['PART_OF', 'VERSION_OF']
	},
	{
		id: 'wijziging',
		label: 'Wijziging',
		sample: { relation: 'AMENDS', from: 'document' },
		relations: ['AMENDS', 'ESTABLISHES', 'INTRODUCES', 'REPEALS']
	},
	{
		id: 'aanhaling',
		label: 'Aanhaling',
		sample: { relation: 'REFERS_TO', from: 'judgment' },
		relations: [
			'APPEAL_OF',
			'ADVISES_ON',
			'ANSWERS',
			'CONTINUES',
			'REFERRED_BY',
			'SAME_AS',
			'MADE_IN'
		]
	},
	{
		id: 'toelichting',
		label: 'Toelichting',
		sample: { relation: 'EXPLAINS', from: 'document' },
		relations: ['EXPLAINS']
	},
	{
		id: 'ingediend-door',
		label: 'Ingediend door',
		sample: { relation: 'AUTHORED', from: 'member' },
		relations: ['AUTHORED']
	},
	{
		id: 'lid-van',
		label: 'Lid van',
		sample: { relation: 'MEMBER_OF', from: 'member' },
		relations: ['MEMBER_OF', 'LED_BY', 'SERVED_IN']
	}
];

/**
 * The kinds of line on the canvas, in the order of the table. REFERS_TO is Structureel where an
 * article cites and Aanhaling where anything else does (`refersFrom`: the kinds it starts at).
 */
export function drawnLineKinds(
	relations: Partial<Record<Relation, number>>,
	refersFrom: readonly Collection[] = []
): LineKind[] {
	const refers = (relations.REFERS_TO ?? 0) > 0;
	const byArticle = refers && refersFrom.includes('articles');
	const byOther = refers && (refersFrom.length === 0 || refersFrom.some((c) => c !== 'articles'));
	return LINE_KINDS.filter((k) => {
		if (k.relations.some((r) => (relations[r] ?? 0) > 0)) return true;
		if (k.id === 'structureel') return byArticle;
		if (k.id === 'aanhaling') return byOther;
		return false;
	});
}
