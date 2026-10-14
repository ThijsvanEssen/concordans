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

	it('closes on a click outside through clickOutside only (F63)', () => {
		const own = /document\.addEventListener\(\s*'(?:pointerdown|click)'/;
		expect(overtreders((t) => own.test(t), [plek('lib/actions/top-layer.ts')])).toEqual([]);
	});

	it('moves through a menu with the keys of actions/menu.ts (F63)', () => {
		expect(overtreders((t) => /e\.key === 'ArrowDown'\s*\?/.test(t))).toEqual([]);
	});
});
