// The words of ⌘K (register.ts, COMMANDS) as the line typed is read: a word, a short form or a
// prefix of three letters calls a command, anything else is a search (report §4).
import { describe, expect, it } from 'vitest';
import { parseCommand, searchTextOf } from './commands';

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

	it.each(['Cbw', 'omgevingswet', 'k', 'ke', 'awb keten', '6:162 BW', ''])(
		'leaves %s to the search',
		(line) => expect(id(line)).toBeNull()
	);

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
	});
});
