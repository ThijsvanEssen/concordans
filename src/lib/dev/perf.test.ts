import { afterEach, describe, expect, it, vi } from 'vitest';

/** perfStart from a fresh module, with `dev` from $app/environment as given. */
async function perfStartWith(dev: boolean) {
	vi.resetModules();
	vi.doMock('$app/environment', () => ({ dev }));
	return (await import('./perf')).perfStart;
}

describe('click timings in the console', () => {
	afterEach(() => {
		vi.doUnmock('$app/environment');
		vi.restoreAllMocks();
	});

	it('are not logged outside dev (code-eenvoud F26: every click logged in production)', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const perfStart = await perfStartWith(false);
		perfStart('click judgments/x')();
		expect(log).not.toHaveBeenCalled();
	});

	it('are logged during development', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const perfStart = await perfStartWith(true);
		perfStart('click judgments/x')('extra');
		expect(log).toHaveBeenCalledOnce();
		expect(log.mock.calls[0][0]).toMatch(/^\[perf!?\] click judgments\/x — .+ms \(extra\)$/);
	});
});
