import { describe, expect, it } from 'vitest';
import {
	changeOf,
	continueList,
	toggleLineSign,
	wrapSelection,
	type FieldState
} from './note-edit';

/** A text with its selection between [ and ], or its caret at |. */
function state(s: string): FieldState {
	const caret = s.indexOf('|');
	if (caret >= 0) return { text: s.replace('|', ''), start: caret, end: caret };
	const start = s.indexOf('[');
	const end = s.indexOf(']') - 1;
	return { text: s.replace('[', '').replace(']', ''), start, end };
}
/** A state written back as its text with the selection marked. */
function show({ text, start, end }: FieldState) {
	return start === end
		? text.slice(0, start) + '|' + text.slice(start)
		: text.slice(0, start) + '[' + text.slice(start, end) + ']' + text.slice(end);
}

describe('wrapSelection', () => {
	it('puts vet round the selection, and takes it off again', () => {
		const bold = wrapSelection(state('een [gevaarlijke situatie] hier'), '**');
		expect(show(bold)).toBe('een **[gevaarlijke situatie]** hier');
		expect(show(wrapSelection(bold, '**'))).toBe('een [gevaarlijke situatie] hier');
	});

	it('puts a pair at the caret, the caret between', () => {
		expect(show(wrapSelection(state('een |'), '*'))).toBe('een *|*');
	});

	it('puts cursief inside vet, not off it', () => {
		expect(show(wrapSelection(state('**[vet]**'), '*'))).toBe('***[vet]***');
	});
});

describe('toggleLineSign', () => {
	it('puts the sign before the line, the caret moving with its words', () => {
		expect(show(toggleLineSign(state('Onderzoeks|vraag'), 'heading'))).toBe('# Onderzoeks|vraag');
		expect(show(toggleLineSign(state('# Onderzoeks|vraag'), 'heading'))).toBe('Onderzoeks|vraag');
	});

	it('numbers the lines of a selection, and gives way to another sign', () => {
		expect(show(toggleLineSign(state('[een\n- twee\ndrie]'), 'numbered'))).toBe(
			'[1. een\n2. twee\n3. drie]'
		);
		expect(show(toggleLineSign(state('1. een\n2. tw|ee'), 'quote'))).toBe('1. een\n> tw|ee');
	});
});

describe('continueList', () => {
	it('goes on with the next point of a list', () => {
		expect(show(continueList(state('1. Welke factoren?|'))!)).toBe('1. Welke factoren?\n2. |');
		expect(show(continueList(state('- kans|\n- ernst'))!)).toBe('- kans\n- |\n- ernst');
	});

	it('ends the list on an empty point', () => {
		expect(show(continueList(state('1. een\n2. |'))!)).toBe('1. een\n|');
	});

	it('leaves any other line to the field: a new line', () => {
		expect(continueList(state('Een regel|'))).toBeNull();
		expect(continueList(state('# Kop|'))).toBeNull();
	});
});

describe('changeOf', () => {
	it('names the one range that changed', () => {
		expect(changeOf('een vet woord', 'een **vet** woord')).toEqual({
			from: 4,
			to: 7,
			text: '**vet**'
		});
	});
});
