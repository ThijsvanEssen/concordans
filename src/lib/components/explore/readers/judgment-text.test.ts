import { expect, test } from 'vitest';
import { splitBodyParagraph } from './judgment-text';

const target = {
	id: 'articles/x_1',
	key: 'x_1',
	collection: 'articles',
	bwb_id: 'X',
	article_number: '1',
	display_name: null
};

test('a citation keeps pointing at its words after the paragraph is restructured', () => {
	const text =
		'2.1. \n       Eerste overweging.\n       \n         2.1.1. \n       Zie artikel 8:73 Awb en verder.';
	const start = text.indexOf('artikel 8:73 Awb');
	const citation = {
		start,
		end: start + 'artikel 8:73 Awb'.length,
		text: 'artikel 8:73 Awb',
		kind: 'REFERS_TO',
		aanhef: false,
		target
	};

	const segments = splitBodyParagraph(text, [citation]);

	const cited = segments.flatMap((s) =>
		s.kind === 'body' ? (s.citations ?? []).map((c) => [s, c] as const) : []
	);
	expect(cited).toHaveLength(1);
	const [segment, span] = cited[0];
	expect(segment.kind === 'body' && segment.num).toBe('2.1.1');
	expect(segment.kind === 'body' && segment.body.slice(span.start!, span.end!)).toBe(
		'artikel 8:73 Awb'
	);
});
