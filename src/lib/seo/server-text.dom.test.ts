import { afterEach, describe, expect, it } from 'vitest';
import { takeServerField, removeServerText } from './server-text';

const serverPage = () => {
	document.body.innerHTML =
		'<main id="seo"><form action="/" class="search"><input type="search" name="q" /></form></main>';
	return document.querySelector<HTMLInputElement>('input[name="q"]')!;
};

describe('the server text giving way to the app', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		takeServerField();
	});

	it('removes it, and hands what was typed and the focus to the app once', () => {
		const field = serverPage();
		field.value = ' 6:162 BW ';
		field.focus();
		removeServerText(document);
		expect(document.getElementById('seo')).toBeNull();
		expect(takeServerField()).toEqual({ query: '6:162 BW', focused: true });
		expect(takeServerField()).toEqual({ query: '', focused: false });
	});

	it('hands nothing over from an untouched field, or where there is no server text', () => {
		serverPage();
		removeServerText(document);
		expect(takeServerField()).toEqual({ query: '', focused: false });
		removeServerText(document);
		expect(takeServerField()).toEqual({ query: '', focused: false });
	});
});
