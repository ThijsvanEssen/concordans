// The abbreviations of the laws (`/api/aliases`), asked once while kept.
import { api, unwrap } from './client';
import { onceFn } from './records';

export const aliases = onceFn('aliases', () => unwrap(api.GET('/api/aliases')));
