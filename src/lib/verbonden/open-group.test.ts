import { describe, expect, it } from 'vitest';
import { groupFor } from './open-group';

const row = (collection: string) => ({ ref: { collection } });

describe('groupFor', () => {
	it('takes the group with most bronnen of the kind', () => {
		const a = { id: 'a', rows: [row('members'), row('articles')] };
		const b = { id: 'b', rows: [row('articles'), row('articles')] };
		expect(groupFor([a, b], 'articles')).toBe(b);
	});
	it('is none where no group lists the kind: the action is not offered', () => {
		expect(groupFor([{ id: 'a', rows: [row('members')] }], 'votes')).toBeNull();
		expect(groupFor([], 'votes')).toBeNull();
	});
});
