import { api, unwrap } from './client';
import { onceFn } from './records';

/** The colours of the fracties per Kamer and of the parties themselves (API 0.73), asked once. */
export const getPartyColors = onceFn('parties/colors', () =>
	unwrap(api.GET('/api/parties/colors'))
);
