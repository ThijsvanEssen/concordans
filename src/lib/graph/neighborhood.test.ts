import { describe, expect, it } from 'vitest';
import { withoutLawHops } from './neighborhood';

const n = (id: string) => ({ id, collection: id.split('/')[0] });
const e = (source: string, target: string, relation: string) => ({ source, target, relation });

describe('withoutLawHops (art. 126ffa Sv)', () => {
	const focal = 'articles/126ffa';
	const nodes = [
		n(focal),
		n('instruments/sv'),
		n('judgments/rbdha'),
		n('articles/126uba'),
		n('articles/126x'), // only a sibling, through the law
		n('articles/126y') // a sibling the sibling refers to
	];
	const edges = [
		e(focal, 'instruments/sv', 'PART_OF'),
		e('articles/126uba', 'instruments/sv', 'PART_OF'),
		e('articles/126x', 'instruments/sv', 'PART_OF'),
		e('articles/126y', 'instruments/sv', 'PART_OF'),
		e('judgments/rbdha', focal, 'REFERS_TO'),
		e(focal, 'articles/126uba', 'REFERS_TO'),
		e('articles/126x', 'articles/126y', 'REFERS_TO')
	];

	it('keeps what the article reaches along its own verbindingen, and its law', () => {
		const { nodes: kept, edges: kept_e } = withoutLawHops(nodes, edges, focal, 2);
		expect(kept.map((x) => x.id).sort()).toEqual(
			[focal, 'articles/126uba', 'instruments/sv', 'judgments/rbdha'].sort()
		);
		expect(kept_e.some((x) => x.source === 'articles/126x')).toBe(false);
	});

	it('keeps the articles of a law that is itself the focus', () => {
		const { nodes: kept } = withoutLawHops(nodes, edges, 'instruments/sv', 1);
		expect(kept.map((x) => x.id)).toContain('articles/126x');
	});
});
