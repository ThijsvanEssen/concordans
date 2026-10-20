import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fakeApi } from '$lib/test/fakeApi';
import DossierLink from './DossierLink.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

describe('DossierLink', () => {
	it('names a dossier the data lacks without a link and without asking for it', () => {
		const api = fakeApi({});
		render(DossierLink, {
			dossier: { key: '17050', number: '17050', title: null, short_title: null, exists: false }
		});
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.getByTitle('Dit dossier staat niet in de gegevens').textContent).toContain(
			'17050'
		);
		expect(api.asked('/api/dossiers/{number}')).toEqual([]);
	});
});
