import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BEVESTIG_MS,
	announce,
	confirmation,
	keptIn,
	notice,
	followedAt,
	sign,
	removedFrom
} from './bevestig.svelte';

const storage = new Map<string, string>();
const session = new Map<string, string>();

describe('the ritual of Bewaar, Volg and Kopieer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		storage.clear();
		session.clear();
		vi.stubGlobal('sessionStorage', {
			getItem: (k: string) => session.get(k) ?? null,
			setItem: (k: string, v: string) => void session.set(k, v)
		});
		// The first Bewaar of the session gives the notice; the tests below start after it.
		keptIn('Eerste', '/bundels/eerste');
		notice.close();
		vi.advanceTimersByTime(BEVESTIG_MS);
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => storage.get(k) ?? null,
			setItem: (k: string, v: string) => void storage.set(k, v),
			removeItem: (k: string) => void storage.delete(k)
		});
		vi.stubGlobal('location', { pathname: '/explore' });
		sign.visited('/bundels');
		sign.visited('/onderwerpen');
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('says what was kept and where, with the way there, for two seconds', () => {
		keptIn('Bundel Huurrecht', '/bundels/b1');
		expect(confirmation.now).toEqual({
			text: 'Bewaard in',
			to: { label: 'Bundel Huurrecht', href: '/bundels/b1' }
		});
		vi.advanceTimersByTime(BEVESTIG_MS);
		expect(confirmation.now).toBeNull();
	});

	it('says Bewaard bij Gevolgd for a follow, and Weggehaald uit … without a way', () => {
		followedAt();
		expect(confirmation.now?.to).toEqual({ label: 'Gevolgd', href: '/onderwerpen' });
		removedFrom('Bundel Huurrecht');
		expect(confirmation.now).toEqual({ text: 'Weggehaald uit Bundel Huurrecht' });
	});

	it('leaves out the link to the page the reader is on', () => {
		vi.stubGlobal('location', { pathname: '/onderwerpen' });
		followedAt();
		expect(confirmation.now).toEqual({ text: 'Bewaard bij' });
	});

	it('puts a sign at Bundels or Gevolgd until the reader has been there', () => {
		keptIn('B', '/bundels/b1');
		followedAt();
		expect(sign.has('bundels') && sign.has('gevolgd')).toBe(true);
		sign.visited('/bundels/b1');
		expect(sign.has('bundels')).toBe(false);
		expect(sign.has('gevolgd')).toBe(true);
		sign.visited('/onderwerpen');
		expect(sign.has('gevolgd')).toBe(false);
	});

	it('sets no sign on the page it points to', () => {
		vi.stubGlobal('location', { pathname: '/bundels/b1' });
		keptIn('B', '/bundels/b1');
		expect(sign.has('bundels')).toBe(false);
	});

	it('says a plain word once, the last one standing', () => {
		announce('Gekopieerd');
		announce('Gekopieerd: link');
		expect(confirmation.now?.text).toBe('Gekopieerd: link');
	});

	it('gives the first Bewaar of a session a notice that stays, the next ones the line', () => {
		vi.resetModules();
		return import('./bevestig.svelte').then((m) => {
			session.clear();
			m.keptIn('Mijn markeringen', '/bundels/losse-markeringen');
			expect(m.notice.now).toEqual({
				bundle: 'Mijn markeringen',
				href: '/bundels/losse-markeringen'
			});
			expect(m.confirmation.now).toBeNull();
			vi.advanceTimersByTime(60_000);
			expect(m.notice.now).not.toBeNull();
			m.notice.close();
			m.keptIn('B', '/bundels/b');
			expect(m.notice.now).toBeNull();
			expect(m.confirmation.now?.text).toBe('Bewaard in');
		});
	});

	it('works where the session keeps nothing: once per page load', () => {
		vi.resetModules();
		vi.stubGlobal('sessionStorage', {
			getItem: () => {
				throw new Error('refused');
			},
			setItem: () => {
				throw new Error('refused');
			}
		});
		return import('./bevestig.svelte').then((m) => {
			m.keptIn('A', '/bundels/a');
			expect(m.notice.now?.bundle).toBe('A');
			m.notice.close();
			m.keptIn('B', '/bundels/b');
			expect(m.notice.now).toBeNull();
		});
	});
});
