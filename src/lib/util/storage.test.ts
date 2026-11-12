import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { arrayOf, entriesOf, readJson, readStored, writeJson, writeStored } from './storage';

/** A storage as the browser has it, in memory. */
function memory(): Storage {
	const m = new Map<string, string>();
	return {
		get length() {
			return m.size;
		},
		clear: () => m.clear(),
		key: (i) => [...m.keys()][i] ?? null,
		getItem: (k) => m.get(k) ?? null,
		setItem: (k, v) => void m.set(k, String(v)),
		removeItem: (k) => void m.delete(k)
	};
}

beforeEach(() => {
	vi.stubGlobal('localStorage', memory());
	vi.stubGlobal('sessionStorage', memory());
});
afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
	it('keeps JSON per store, and removes it with null', () => {
		expect(writeJson('session', 'k', [1, 2])).toBe(true);
		expect(readJson('session', 'k', arrayOf)).toEqual([1, 2]);
		expect(readJson('local', 'k', arrayOf)).toBeNull();
		writeJson('session', 'k', null);
		expect(readStored('k', 'session')).toBeNull();
	});

	it('reads what it knows from a kept value, and nothing from one it cannot parse', () => {
		writeStored('k', '{"a":true,"b":3}');
		expect(readJson('local', 'k', (r) => entriesOf(r).filter(([, v]) => v === true))).toEqual([
			['a', true]
		]);
		writeStored('k', '{kapot');
		expect(readJson('local', 'k', entriesOf)).toBeNull();
		expect(entriesOf([1])).toEqual([]);
	});

	it('gives null and false where the browser refuses', () => {
		const refuse = () => {
			throw new DOMException('no', 'SecurityError');
		};
		vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse, removeItem: refuse });
		expect(readJson('local', 'k', arrayOf)).toBeNull();
		expect(writeJson('local', 'k', [1])).toBe(false);
	});

	it('gives null where there is no storage at all (the server)', () => {
		vi.stubGlobal('sessionStorage', undefined);
		expect(readStored('k', 'session')).toBeNull();
		expect(writeStored('k', 'v', 'session')).toBe(false);
	});
});
