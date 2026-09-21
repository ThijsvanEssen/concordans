import { env } from '$env/dynamic/private';
import { API_BASE_URL } from '$lib/api/base-url';
import { forwardWrite } from '$lib/server/write-proxy';
import type { RequestHandler } from './$types';

// A browser cannot hold the API's write key, so writes pass through here.
const handler: RequestHandler = ({ request, params, fetch }) =>
	forwardWrite(request, params.path, {
		apiBaseUrl: API_BASE_URL,
		writeKey: env.LAWGRAPH_WRITE_API_KEY,
		fetch
	});

export const POST = handler;
export const DELETE = handler;
