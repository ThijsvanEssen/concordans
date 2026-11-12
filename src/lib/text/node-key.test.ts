import { describe, expect, it } from 'vitest';
import { fold, nodeKey } from './node-key';

describe('nodeKey', () => {
	it('makes the key as the API does (make_node_key)', () => {
		expect(nodeKey('BWBR0005537', '3:2')).toBe('bwbr0005537_3_2');
		expect(nodeKey('BWBR0005537', '3: 2')).toBe('bwbr0005537_3_2');
		expect(nodeKey('BWBR0001854', '287')).toBe('bwbr0001854_287');
		expect(nodeKey('BWBR0005537', '8:1a')).toBe('bwbr0005537_8_1a');
		expect(nodeKey('BWBR0011353', 'bijlage 2 artikel 9')).toBe('bwbr0011353_bijlage_2_artikel_9');
		expect(nodeKey('BWBR0001840', 'enig-artikel')).toBe('bwbr0001840_enig_artikel');
		expect(nodeKey('BWBR0001840', '12°/3')).toBe('bwbr0001840_12_3');
		expect(nodeKey('BWBR0001840', ' 7. ')).toBe('bwbr0001840_7');
	});

	it('leaves out a letter without an accent to take off, as ascii_slug does', () => {
		expect(nodeKey('Straße')).toBe('strae');
		expect(nodeKey('Yeşilgöz')).toBe('yesilgoz');
	});

	it('skips empty parts and keys a dossier number', () => {
		expect(nodeKey('21501-02')).toBe('21501_02');
		expect(nodeKey('36600 VIII')).toBe('36600_viii');
		expect(nodeKey(null, '', '°')).toBe('');
	});
});

describe('fold', () => {
	it('folds case and accents', () => {
		expect(fold('Één België')).toBe('een belgie');
	});
});
