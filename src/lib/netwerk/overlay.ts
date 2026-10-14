// The `?overlay=` parameter of the network: one overlay at a time.
//
//   heat:12       Verwijzingen per maand, the last 12 months
//   open          Open dossiers, every open dossier
//   dossier:36410 Open dossiers, one dossier

export type Overlay =
	| { kind: 'none' }
	| { kind: 'heat'; months: number }
	| { kind: 'open' }
	| { kind: 'dossier'; id: string };

export const DEFAULT_HEAT_MONTHS = 12;
export const HEAT_PERIODS = [3, 6, 12, 24] as const;

/** A period the overlay offers; any other is the default. */
const heatMonths = (months: number) =>
	(HEAT_PERIODS as readonly number[]).includes(months) ? months : DEFAULT_HEAT_MONTHS;

export function parseOverlay(param: string | null): Overlay {
	if (!param) return { kind: 'none' };
	if (param === 'open') return { kind: 'open' };
	if (param.startsWith('heat:'))
		return { kind: 'heat', months: heatMonths(Number(param.slice('heat:'.length))) };
	if (param.startsWith('dossier:')) {
		const id = param.slice('dossier:'.length).trim();
		return id ? { kind: 'dossier', id } : { kind: 'none' };
	}
	return { kind: 'none' };
}

/** The parameter of an overlay, as parseOverlay reads it; null without one. */
export function overlayParam(o: Overlay): string | null {
	if (o.kind === 'heat') return `heat:${heatMonths(o.months)}`;
	if (o.kind === 'dossier') return `dossier:${o.id}`;
	return o.kind === 'open' ? 'open' : null;
}
