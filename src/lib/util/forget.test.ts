import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { forgetAll, onForget } from './forget';

describe('forgetting module state between tests', () => {
	it('calls every registered forget', () => {
		const a = vi.fn();
		const b = vi.fn();
		onForget(a);
		onForget(b);
		forgetAll();
		expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
	});

	it('starts each test with the records of the last one forgotten', async () => {
		const { once } = await import('$lib/api/records');
		const load = vi.fn(async () => 'stuk');
		await once('documents/forget-test', load);
		forgetAll();
		await once('documents/forget-test', load);
		expect(load).toHaveBeenCalledTimes(2);
	});
});

// Guard: a module that keeps answers or requests at module level (a Map, a Promise held in
// a `let`) registers how it forgets them, so one test cannot see what another one asked.
const KEEPS = /^(?:const|let) \w+(?::[^=]+)? = new (?:Svelte)?Map\b|^let \w+: [^=]*Promise</m;

/** Module state that is no cache of the API, each with its reason. */
const NOT_A_CACHE: Record<string, string> = {
	'src/lib/components/graph/nodeSprites.ts': 'drawings by token values: the same for every test',
	'src/lib/keys/dispatch.svelte.ts': 'the answers of the components that stand now, not data',
	'src/lib/components/explore/readers.ts': 'the chunks of the readers: the same for every test'
};

describe('every module cache can be forgotten', () => {
	const files = Object.keys(
		import.meta.glob(['/src/lib/**/*.ts', '!/src/lib/**/*.test.ts', '!/src/lib/test/**'])
	).map((f) => f.slice(1));

	it('registers a forget where a module keeps state', () => {
		const missing = files.filter((f) => {
			const text = readFileSync(f, 'utf8');
			return KEEPS.test(text) && !text.includes('onForget(') && !(f in NOT_A_CACHE);
		});
		expect(missing).toEqual([]);
	});

	it('names only exceptions that still keep state', () => {
		const stale = Object.keys(NOT_A_CACHE).filter(
			(f) => !files.includes(f) || !KEEPS.test(readFileSync(f, 'utf8'))
		);
		expect(stale).toEqual([]);
	});
});
