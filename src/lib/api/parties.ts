import { api, unwrap } from './client';

/** The colours of the fracties per Kamer and of the parties themselves (API 0.73). */
export const getPartyColors = () => unwrap(api.GET('/api/parties/colors'));
