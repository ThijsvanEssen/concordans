import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import NietGevonden from './NietGevonden.svelte';

describe('the page of a failure', () => {
	it('is named in the tab as its heading says it, a 404 as Niet gevonden', () => {
		const offline = render(NietGevonden, { props: { status: 500, title: 'Geen verbinding' } });
		expect(offline.head).toContain('<title>Geen verbinding, Concordans</title>');
		const fout = render(NietGevonden, { props: { status: 500, title: 'Er ging iets mis' } });
		expect(fout.head).toContain('<title>Er ging iets mis, Concordans</title>');
		expect(render(NietGevonden).head).toContain('<title>Niet gevonden, Concordans</title>');
	});
});
