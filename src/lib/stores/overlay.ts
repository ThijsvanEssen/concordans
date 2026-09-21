// Graph overlay URL contract. A single `?overlay=` query param drives both
// Activiteit (heat) and Mutatie (in-flux) overlays — they are mutually
// exclusive so only one can be active at a time.
//
// Shapes:
//   heat:12       → Activiteit, last 12 months
//   open          → Mutatie, all open dossiers
//   dossier:36410 → Mutatie, scoped to a single dossier

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
