import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import FollowDossier from './FollowDossier.svelte';
import { followDossier, followsDossier } from '$lib/onderwerpen/onderwerpen';

vi.mock('$lib/api/feed', () => ({ getFeed: () => Promise.resolve({ items: [] }) }));

const dossier = { number: '36855', title: 'Novelle' };

const memory = () => {
	const data = new Map<string, string>();
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k)
	};
};

beforeEach(() => {
	vi.stubGlobal('localStorage', memory());
	vi.stubGlobal('sessionStorage', memory());
});
afterEach(() => vi.unstubAllGlobals());

describe('FollowDossier', () => {
	it('lets a followed dossier go again from the menu: Niet meer volgen', async () => {
		followDossier(dossier, '2026-10-01');
		render(FollowDossier, { dossier });
		await fireEvent.click(screen.getByRole('button', { name: 'Gevolgd' }));
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Niet meer volgen' }));
		await tick();
		expect(followsDossier('36855')).toBe(false);
		expect(screen.getByRole('button', { name: 'Volg' })).toBeTruthy();
	});
});
