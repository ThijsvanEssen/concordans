// One top layer for menus and cards (code-eenvoud F63): actions/top-layer.ts and actions/menu.ts.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

describe('one top layer (code-eenvoud F63)', () => {
	it('puts a menu or a card in the top layer through actions/top-layer.ts only (F63)', () => {
		const own = /showPopover\(|popover="manual"|setAttribute\('popover'/;
		expect(overtreders((t) => own.test(t), [plek('lib/actions/top-layer.ts')])).toEqual([]);
		// Its margins and the pointer's moments are said once, there.
		expect(
			overtreders(
				(t) => /\b(HOVER_MS|LEAVE_MS|SLUIT_MS|WEG_MS)\s*=/.test(t),
				[plek('lib/actions/top-layer.ts')]
			)
		).toEqual([]);
	});

	it('floats a card through FloatingCard, the box of a menu in basis.css (F75)', () => {
		expect(
			overtreders(
				(t) => /position: fixed;\s*inset: auto;/.test(t),
				[
					plek('lib/components/ui/FloatingCard.svelte', 'the box of every card'),
					plek('lib/styles/basis.css', 'the list of every menu, .tekstmenu__lijst')
				]
			)
		).toEqual([]);
	});

	it('shows the card of a link through HoverCard (F75)', () => {
		expect(
			overtreders(
				(t) => /\bHOVER_MS\b/.test(t),
				[
					plek('lib/actions/top-layer.ts', 'where the moment is said'),
					plek('lib/actions/hover-card.svelte.ts'),
					{
						pad: 'lib/components/articles/GrondslagFormule.svelte',
						reden: 'a card a click holds open'
					}
				]
			)
		).toEqual([]);
	});

	it('closes on a click outside through clickOutside only (F63)', () => {
		const own = /document\.addEventListener\(\s*'(?:pointerdown|click)'/;
		expect(overtreders((t) => own.test(t), [plek('lib/actions/top-layer.ts')])).toEqual([]);
	});

	it('moves through a menu with the keys of actions/menu.ts (F63)', () => {
		expect(overtreders((t) => /e\.key === 'ArrowDown'\s*\?/.test(t))).toEqual([]);
	});
});
