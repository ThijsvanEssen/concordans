// The `?overlay=` parameter of the network: one overlay at a time.
//
//   heat:12       Citaties per maand, the last 12 months
//   open          Open dossiers, every open dossier
//   dossier:36410 Open dossiers, one dossier

export type Overlay =
	| { kind: 'none' }
	| { kind: 'heat'; months: number }
	| { kind: 'open' }
	| { kind: 'dossier'; id: string };

export const DEFAULT_HEAT_MONTHS = 12;
export const HEAT_PERIODS = [3, 6, 12, 24] as const;

export function parseOverlay(param: string | null): Overlay {
	if (!param) return { kind: 'none' };
	if (param === 'open') return { kind: 'open' };
	if (param.startsWith('heat:')) {
		const months = parseInt(param.slice('heat:'.length), 10);
		return { kind: 'heat', months: isNaN(months) ? DEFAULT_HEAT_MONTHS : months };
	}
	if (param.startsWith('dossier:')) {
		const id = param.slice('dossier:'.length).trim();
		return id ? { kind: 'dossier', id } : { kind: 'none' };
	}
	return { kind: 'none' };
}

export function serializeOverlay(o: Overlay): string | null {
	switch (o.kind) {
		case 'none':
			return null;
		case 'heat':
			return `heat:${o.months}`;
		case 'open':
			return 'open';
		case 'dossier':
			return `dossier:${o.id}`;
	}
}
