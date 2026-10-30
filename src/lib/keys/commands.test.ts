// The words of ⌘K (register.ts, COMMANDS) as the line typed is read: a word, a short form or a
// prefix of three letters calls a command, anything else is a search (report §4).
import { describe, expect, it } from 'vitest';
import { parseCommand, searchTextOf, soortOf } from './commands';

const id = (line: string) => parseCommand(line)?.command.id ?? null;

describe('parseCommand', () => {
	it.each([
		['kt', 'keten'],
		['keten', 'keten'],
		['ket', 'keten'],
		['Keten awb', 'keten'],
		['om', 'omgeving'],
		['omg', 'omgeving'],
		['vb', 'verband'],
		['verband wwke', 'verband'],
		['>keten', 'keten']
	])('reads %s as %s', (line, command) => expect(id(line)).toBe(command));

	it.each([
		['s2', 'stappen'],
		['stappen 3', 'stappen'],
		['s0', 'gekozen'],
		['+uitspraken', 'tonen'],
		['met wetten', 'tonen'],
		['-stukken', 'zonder'],
		['zonder aanhaling', 'zonder'],
		['alleen wetten', 'alleen'],
		['alles', 'alles']
	])('reads %s as %s', (line, command) => expect(id(line)).toBe(command));

	it('names the soort or relatie by the word of its label, its one, or a prefix', () => {
		expect(parseCommand('+uitspraken')?.soort).toMatchObject({ kind: 'soort', id: 'uitspraken' });
		expect(parseCommand('-wet')?.soort).toMatchObject({ kind: 'soort', id: 'wetten' });
		expect(parseCommand('alleen stu')?.soort).toMatchObject({ id: 'stukken' });
		expect(parseCommand('-aanhaling')?.soort).toMatchObject({ kind: 'relatie', id: 'citation' });
		// "toe" is Toezeggingen and Toelichting: neither.
		expect(soortOf('toe')).toBeNull();
	});

	it('reads the steps from the short form or after the word', () => {
		expect(parseCommand('s2')?.steps).toBe(2);
		expect(parseCommand('stappen 3')?.steps).toBe(3);
		expect(parseCommand('stappen')?.steps).toBeUndefined();
	});

	it.each([
		'Cbw',
		'omgevingswet',
		'k',
		'ke',
		'awb keten',
		'6:162 BW',
		'',
		'met spoed',
		'stappen naar'
	])('leaves %s to the search', (line) => expect(id(line)).toBeNull());

	it('keeps what follows the word as its object', () => {
		expect(parseCommand('keten  awb ')).toMatchObject({ rest: 'awb', only: false });
		expect(parseCommand('> vb')).toMatchObject({ rest: '', only: true });
	});
});

describe('searchTextOf', () => {
	it('searches the object of a word that takes a bron, else the line', () => {
		expect(searchTextOf('keten awb', parseCommand('keten awb'))).toBe('awb');
		expect(searchTextOf('kt', parseCommand('kt'))).toBe('kt');
		expect(searchTextOf('Cbw', null)).toBe('Cbw');
		expect(searchTextOf('>kt', parseCommand('>kt'))).toBe('');
		expect(searchTextOf('s2', parseCommand('s2'))).toBe('');
		expect(searchTextOf('zon', parseCommand('zon'))).toBe('zon');
	});
});
