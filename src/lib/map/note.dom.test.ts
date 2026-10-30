// A note in its opmaak (B62): read with its kop, list and links; opened by a click on it, not
// on a link in it; in the field its signs as typed, Enter going on with a list, ⌘B putting
// vet round the selection, ⌘↵ keeping it and Escape leaving it as it was.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Aantekening from './Aantekening.svelte';

const question = '# Vraag\nValt het onder **art. 98 Sr** of art. 6:162 BW?\n1. eerst';

afterEach(() => cleanup());
// Compiled on the first import: under load that takes longer than one test's time.
beforeAll(async () => {
	await import('./Aantekening.svelte');
}, 60_000);

const field = () => screen.getByRole('textbox') as HTMLTextAreaElement;

describe('a note in its opmaak', () => {
	it('reads as kop, words and list, a verwijzing a link to its bron', () => {
		render(Aantekening, {
			tekst: question,
			bij: 'Staat',
			references: { 'artikel 98 sr': '/wetten/BWBR0001854/artikel/98' }
		});
		expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Vraag');
		expect(screen.getByRole('link', { name: 'art. 98 Sr' }).getAttribute('href')).toBe(
			'/wetten/BWBR0001854/artikel/98'
		);
		expect(screen.getByRole('link', { name: 'art. 6:162 BW' }).getAttribute('href')).toBe(
			'/wetten/BWBR0005289/artikel/6:162'
		);
		expect(screen.getByRole('listitem').textContent).toBe('eerst');
		expect(document.querySelector('strong')?.textContent).toBe('art. 98 Sr');
	});

	it('leaves a verwijzing the bundel holds no address for as text', () => {
		render(Aantekening, { tekst: 'Zie art. 98 Sr', bij: 'Gedeeld' });
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('opens on a click on it, not on one on a link, and by its label for the keys', async () => {
		render(Aantekening, { tekst: question, bij: 'Staat', onBewaar: vi.fn() });
		await fireEvent.click(screen.getByRole('link', { name: 'art. 6:162 BW' }));
		expect(screen.queryByRole('textbox')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Aantekening wijzigen' }));
		expect(field().value).toBe(question);
	});

	it('shows its signs in the field, and what it recognized', async () => {
		render(Aantekening, { tekst: question, bij: 'Staat', onBewaar: vi.fn(), open: true });
		await tick();
		const signs = [...document.querySelectorAll('.mirror .sign')].map((t) => t.textContent);
		expect(signs).toEqual(['# ', '**', '**', '1. ']);
		expect(screen.getByText(/^Herkend:/).textContent).toBe(
			'Herkend: artikel 98 Sr, artikel 6:162 BW'
		);
	});

	it('goes on with a list on Enter, puts vet round with ⌘B, keeps on ⌘↵', async () => {
		const onBewaar = vi.fn();
		render(Aantekening, { tekst: '1. eerst', bij: 'Staat', onBewaar, open: true });
		await tick();
		const f = field();
		f.setSelectionRange(8, 8);
		await fireEvent.keyDown(f, { key: 'Enter' });
		expect(f.value).toBe('1. eerst\n2. ');
		await fireEvent.input(f, { target: { value: '1. eerst\n2. tweede' } });
		f.setSelectionRange(12, 18);
		await fireEvent.keyDown(f, { key: 'b', code: 'KeyB', metaKey: true });
		expect(f.value).toBe('1. eerst\n2. **tweede**');
		await fireEvent.keyDown(f, { key: 'Enter', metaKey: true });
		expect(onBewaar).toHaveBeenCalledWith('1. eerst\n2. **tweede**');
	});

	it('keeps the note when the field is left, not when a button of its row is pressed', async () => {
		const onBewaar = vi.fn();
		render(Aantekening, { tekst: 'oud', bij: 'Staat', onBewaar, open: true });
		await tick();
		await fireEvent.focusOut(field(), {
			relatedTarget: screen.getByRole('button', { name: 'Vet' })
		});
		expect(onBewaar).not.toHaveBeenCalled();
		await fireEvent.focusOut(field(), { relatedTarget: document.body });
		expect(onBewaar).toHaveBeenCalledWith('oud');
	});

	it('leaves the note as it was on Escape', async () => {
		const onBewaar = vi.fn();
		render(Aantekening, { tekst: 'oud', bij: 'Staat', onBewaar, open: true });
		await tick();
		await fireEvent.input(field(), { target: { value: 'nieuw' } });
		await fireEvent.keyDown(field(), { key: 'Escape' });
		await tick();
		expect(onBewaar).not.toHaveBeenCalled();
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(screen.getByText('oud')).toBeTruthy();
	});

	it('is one run of words on a card, without links', () => {
		render(Aantekening, { tekst: question, bij: 'Staat', compact: true });
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.queryByRole('heading')).toBeNull();
		expect(document.querySelector('.kort')?.textContent).toBe(
			'Vraag Valt het onder art. 98 Sr of art. 6:162 BW? eerst'
		);
	});
});
