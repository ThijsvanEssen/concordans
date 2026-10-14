import { afterEach, describe, expect, it, vi } from 'vitest';
import { afterTick } from './after-tick';

afterEach(() => vi.restoreAllMocks());

const settle = () => new Promise((r) => setTimeout(r));

describe('afterTick', () => {
	it('runs after the state is written, and reports a throw instead of leaving it floating', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const ran = vi.fn();
		afterTick(ran);
		expect(ran).not.toHaveBeenCalled();
		await settle();
		expect(ran).toHaveBeenCalledOnce();
		const bug = new Error('no element');
		afterTick(() => {
			throw bug;
		});
		await settle();
		expect(warn).toHaveBeenCalledWith('Na het tekenen:', bug);
	});
});
