import { describe, expect, it } from 'vitest';
import { heeftParameter } from './heeft';

describe('heeftParameter', () => {
	it('knows the parameters of a list route from the schema', () => {
		expect(heeftParameter('/api/documents', 'from', 'to')).toBe(true);
		expect(heeftParameter('/api/dossiers', 'opened_from', 'opened_to')).toBe(true);
		expect(heeftParameter('/api/documents', 'geen_parameter')).toBe(false);
		expect(heeftParameter('/api/bestaat_niet', 'from')).toBe(false);
	});
});
