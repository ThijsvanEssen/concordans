import { afterEach, describe, expect, it, vi } from 'vitest';
import { offer, type Target } from '$lib/keys/doen.svelte';
import { PaletteActions } from './doen.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

describe('the actions on a bron', () => {
	let leave = () => {};
	afterEach(() => leave());

	const labelsFor = (target: Target) => {
		leave = offer({
			rows: (p) => [{ id: p.command.id, label: p.command.id, run: () => {} }]
		});
		const doen = new PaletteActions(
			() => true,
			() => target
		);
		return doen.actionsFor(target).map((r) => r.label);
	};
	const of = (name: string) => ({ ref: name, label: name });

	it.each(['instruments/a', 'articles/a', 'judgments/a', 'factions/a', 'members/a'])(
		'offers Keten on %s, which has one',
		(name) => {
			expect(labelsFor(of(name))).toContain('Keten');
		}
	);

	it.each(['dossiers/a', 'documents/a', 'commitments/a'])(
		'leaves Keten out on %s, and the rest stands',
		(name) => {
			const labels = labelsFor(of(name));
			expect(labels).not.toContain('Keten');
			expect(labels).toContain('Netwerk');
		}
	);
});
