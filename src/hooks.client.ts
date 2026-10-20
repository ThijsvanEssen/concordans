// The outer boundary of the app, its one catch-all: a failure nobody handled is reported
// here ($lib/api/errors.ts), an abort says nothing. A page that fails is +error.svelte's; a
// panel that fails to draw is PanelBoundary's.
import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { report } from '$lib/api/errors';
import { BUNDLE_PARAM, movedAddress, withoutBundle } from '$lib/map/page';
import { kaart } from '$lib/map/map.svelte';

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

/**
 * A reader opened in a tab of its own to keep in a bundel (`?bundel=`, Andere bron
 * toevoegen): it keeps there, and the address goes on without it, before the app reads it.
 */
export function keepFromAddress(location: Location, history: History) {
	const url = new URL(location.href);
	const id = url.searchParams.get(BUNDLE_PARAM);
	if (!id) return;
	kaart.keepIn(id);
	history.replaceState(history.state, '', withoutBundle(url).href);
}

export const init: ClientInit = () => {
	window.addEventListener('unhandledrejection', onUnhandledRejection);
	moveAddress(window.location, window.history);
	keepFromAddress(window.location, window.history);
};

/** A page or its load that threw; a path that is no page is +error.svelte's 404. */
export const handleError: HandleClientError = ({ error, status, message }) => {
	if (status !== 404) report('Pagina', error);
	return { message };
};
