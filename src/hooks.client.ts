// The outer boundary of the app, its one catch-all: a failure nobody handled is reported
// here ($lib/api/errors.ts), an abort says nothing. A page that fails is +error.svelte's; a
// panel that fails to draw is PanelBoundary's.
import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { report } from '$lib/api/errors';
import { movedAddress } from '$lib/map/page';

/** A promise rejected with no one to handle it: reported once, in our words. */
export function onUnhandledRejection(event: PromiseRejectionEvent) {
	event.preventDefault();
	report('Onafgehandeld', event.reason);
}

/**
 * An address of the bundels of before ($lib/map/page.ts) replaced in the bar by the one
 * of now, its fragment (a shared bundel) with it, before the app reads it: as a 301 would.
 */
export function moveAddress(location: Location, history: History) {
	const moved = movedAddress(new URL(location.href));
	if (moved) history.replaceState(history.state, '', moved);
}

export const init: ClientInit = () => {
	window.addEventListener('unhandledrejection', onUnhandledRejection);
	moveAddress(window.location, window.history);
};

/** A page or its load that threw; a path that is no page is +error.svelte's 404. */
export const handleError: HandleClientError = ({ error, status, message }) => {
	if (status !== 404) report('Pagina', error);
	return { message };
};
