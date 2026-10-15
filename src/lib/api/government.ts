// The cabinets and the ministries, each asked once per page load.
import { api, unwrap } from './client';
import { onForget } from '$lib/util/forget';

function once<T>(load: () => Promise<T>): () => Promise<T> {
	let request: Promise<T> | null = null;
	onForget(() => (request = null));
	return () =>
		(request ??= load().catch((err) => {
			request = null;
			throw err;
		}));
}

/** Every cabinet, newest first. */
export const getCabinets = once(() => unwrap(api.GET('/api/cabinets')));

/** Every ministry, in protocol order, the ones under an earlier name included. */
export const getMinistries = once(() => unwrap(api.GET('/api/ministries')));
