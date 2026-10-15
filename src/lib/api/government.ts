// The cabinets and the ministries, each asked once while the records keep them.
import { api, unwrap } from './client';
import { onceFn } from './records';

/** Every cabinet, newest first. */
export const getCabinets = onceFn('cabinets', () => unwrap(api.GET('/api/cabinets')));

/** Every ministry, in protocol order, the ones under an earlier name included. */
export const getMinistries = onceFn('ministries', () => unwrap(api.GET('/api/ministries')));
