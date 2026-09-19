import posthog from 'posthog-js';
import { browser } from '$app/environment';

let ready = false;

export function initAnalytics() {
	if (!browser) return;
	const key = import.meta.env.VITE_POSTHOG_KEY;
	if (!key || ready) return;
	posthog.init(key, {
		api_host: 'https://eu.i.posthog.com',
		person_profiles: 'identified_only',
		capture_pageview: true,
		capture_pageleave: true,
	});
	ready = true;
}

export function track(event: string, props?: Record<string, string>) {
	if (!browser || !ready) return;
	posthog.capture(event, props);
}
