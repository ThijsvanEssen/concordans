import { describe, expect, it } from 'vitest';
import { bevindingen, strekking } from './uitkomst';

describe('how a judgment ended', () => {
	it('says what a conclusie proposes', () => {
		expect(strekking('verwerping')).toBe('strekt tot verwerping');
		expect(strekking(null)).toBeNull();
	});

	it('says what the ECHR found per article, in the order of HUDOC', () => {
		expect(
			bevindingen([
				{ article: '8', finding: 'geen schending' },
				{ article: '13', combined_with: '8', finding: 'schending' },
				{ article: '1', protocol: '1', finding: 'schending', aspect: 'procedureel' }
			])
		).toBe(
			'geen schending van art. 8; schending van art. 13 in samenhang met art. 8; schending van art. 1 van Protocol nr. 1 (procedureel)'
		);
		expect(bevindingen([])).toBeNull();
	});
});
