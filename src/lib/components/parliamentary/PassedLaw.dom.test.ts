import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import type { Schema } from '$lib/api/types';
import PassedLaw from './PassedLaw.svelte';

type Enacted = Schema<'EnactedPublicationDTO'>;
const pub = (e: Partial<Enacted>): Enacted =>
	({
		key: 'stb_2024_193',
		cite: 'Stb. 2024, 193',
		published_on: '2024-06-26',
		first_effective_date: '2024-07-01',
		instrument: { key: 'bwbr0049889', title: 'Wet betaalbare huur', path: '/wetten/BWBR0049889' },
		path: '/stb/2024/193',
		...e
	}) as Enacted;
const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ').trim();

describe('PassedLaw', () => {
	it('names the law, its Staatsblad and its first day in force from the dossier alone', () => {
		const { container } = render(PassedLaw, {
			dossier: { instruments: [], enacted: [pub({})], outcome: 'aangenomen' }
		});
		const [p] = container.querySelectorAll('p');
		expect(text(p)).toBe(
			'Vastgesteld als Wet betaalbare huur, Stb. 2024, 193; in werking getreden op 1 juli 2024.'
		);
		const links = [...p.querySelectorAll('a')].map((a) => a.getAttribute('href'));
		expect(links).toEqual(['/wetten/BWBR0049889', '/stb/2024/193']);
		expect(p.querySelectorAll('a')[1].getAttribute('title')).toBe('Uitgegeven op 26 juni 2024');
	});

	it('leaves out the day the source does not give, and names a publication without a law of its own', () => {
		const { container } = render(PassedLaw, {
			dossier: {
				instruments: [],
				outcome: 'aangenomen',
				enacted: [
					pub({ first_effective_date: null }),
					pub({ key: 'stb_2025_10', cite: 'Stb. 2025, 10', instrument: null })
				]
			}
		});
		expect([...container.querySelectorAll('p')].map(text)).toEqual([
			'Vastgesteld als Wet betaalbare huur, Stb. 2024, 193.',
			'Bekendgemaakt in Stb. 2025, 10; in werking getreden op 1 juli 2024.'
		]);
	});

	it('says nothing of a dossier without a law', () => {
		const { container } = render(PassedLaw, {
			dossier: { instruments: [], enacted: [], outcome: 'ingetrokken' }
		});
		expect(container.querySelector('p')).toBeNull();
	});
});
