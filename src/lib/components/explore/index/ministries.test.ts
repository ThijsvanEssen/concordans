import { describe, expect, it, vi } from 'vitest';

const getMinistries = vi.hoisted(() => vi.fn());
vi.mock('./government', () => ({ getMinistries }));

import { ministryName } from './ministries.svelte';

describe('ministryName: a ministry by its name, from the list asked once', () => {
	it('gives the key until the list is in, then the name; a key not in it stays itself', async () => {
		getMinistries.mockResolvedValue([{ key: 'fin', name: 'Financiën' }]);
		expect(ministryName('fin')).toBe('fin');
		await vi.waitFor(() => expect(ministryName('fin')).toBe('Financiën'));
		expect(ministryName('venw')).toBe('venw');
		expect(ministryName(null)).toBe('');
		expect(getMinistries).toHaveBeenCalledTimes(1);
	});
});
