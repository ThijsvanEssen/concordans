// What a row of Verband says under its kenmerk: one fixed, natural phrase per relation, for two
// chosen bronnen and for three (`noemt beide`, `beide lid van`, `ingediend door beiden`). One
// table for the rows of every pair; with four to six bronnen the phrase of three takes the
// word of the number (`alle vier lid van`).
import type { Collection, Relation } from '$lib/vocabulary';

type Phrase = readonly [two: string, three: string];
/** A phrase that depends on what the kenmerk is (a kabinet or a commissie). */
type Entry = Phrase | ((row: Collection) => Phrase);

const BODY = (row: Collection) => row === 'cabinets' || row === 'ministries';
const MEMBER: Entry = (row) =>
	BODY(row)
		? ['beide bewindspersoon in', 'alle drie bewindspersoon in']
		: ['beide lid van', 'alle drie lid van'];

/** The kenmerk is named by the chosen bronnen: they are the subject (a person, in a kabinet). */
const FROM_BRON: Record<Relation, Entry> = {
	PART_OF: ['beide deel van', 'alle drie deel van'],
	VERSION_OF: ['beide versie van', 'alle drie versie van'],
	ESTABLISHES: ['beide vastgesteld bij', 'alle drie vastgesteld bij'],
	AMENDS: ['beide wijzigen', 'alle drie wijzigen'],
	INTRODUCES: ['beide voegen in', 'alle drie voegen in'],
	REPEALS: ['beide trekken in', 'alle drie trekken in'],
	COMMENCES: ['beide in werking getreden bij', 'alle drie in werking getreden bij'],
	TRANSPOSED_TO: ['beide overgebracht naar', 'alle drie overgebracht naar'],
	BASED_ON: ['beide gebaseerd op', 'alle drie gebaseerd op'],
	IMPLEMENTS: ['beide implementeren', 'alle drie implementeren'],
	LEGISLATED_IN: ['beide tot stand gekomen in', 'alle drie tot stand gekomen in'],
	PUBLISHED_IN: ['beide gepubliceerd in', 'alle drie gepubliceerd in'],
	REFERS_TO: ['beide verwijzen naar', 'alle drie verwijzen naar'],
	EXPLAINS: ['beide lichten toe', 'alle drie lichten toe'],
	APPEAL_OF: ['beide in beroep van', 'alle drie in beroep van'],
	CONTINUES: ['beide vervolg op', 'alle drie vervolg op'],
	REFERRED_BY: ['beide verwezen door', 'alle drie verwezen door'],
	ADVISES_ON: ['beide adviseren over', 'alle drie adviseren over'],
	ANSWERS: ['beide beantwoorden', 'alle drie beantwoorden'],
	SAME_AS: ['beide gelijk aan', 'alle drie gelijk aan'],
	SCOPED_BY: ['beide begrensd door', 'alle drie begrensd door'],
	ABOUT: ['beide over', 'alle drie over'],
	LED_BY: ['beide geleid door', 'alle drie geleid door'],
	MADE_IN: ['beide opgemaakt in', 'alle drie opgemaakt in'],
	MEMBER_OF: MEMBER,
	SERVED_IN: MEMBER,
	AUTHORED: ['ingediend door beiden', 'ingediend door alle drie'],
	RELATED_TO: ['beide verbonden met', 'alle drie verbonden met'],
	REVISES: ['beide herzien', 'alle drie herzien'],
	ACCOMPANIES: ['beide vergezeld door', 'alle drie vergezeld door'],
	SECOND_READING_OF: ['beide tweede lezing van', 'alle drie tweede lezing van'],
	VOTED: ['beide stemden in', 'alle drie stemden in']
};

/** The kenmerk names the chosen bronnen: it is the subject (a stuk that names them). */
const FROM_ROW: Record<Relation, Entry> = {
	PART_OF: ['deel van beide', 'deel van alle drie'],
	VERSION_OF: ['versie van beide', 'versie van alle drie'],
	ESTABLISHES: ['stelt beide vast', 'stelt alle drie vast'],
	AMENDS: ['wijzigt beide', 'wijzigt alle drie'],
	INTRODUCES: ['voegt beide in', 'voegt alle drie in'],
	REPEALS: ['trekt beide in', 'trekt alle drie in'],
	COMMENCES: ['doet beide in werking treden', 'doet alle drie in werking treden'],
	TRANSPOSED_TO: ['brengt beide over', 'brengt alle drie over'],
	BASED_ON: ['grondslag van beide', 'grondslag van alle drie'],
	IMPLEMENTS: ['implementeert beide', 'implementeert alle drie'],
	LEGISLATED_IN: ['totstandkoming van beide', 'totstandkoming van alle drie'],
	PUBLISHED_IN: ['publicatie van beide', 'publicatie van alle drie'],
	REFERS_TO: ['noemt beide', 'noemt alle drie'],
	EXPLAINS: ['licht beide toe', 'licht alle drie toe'],
	APPEAL_OF: ['beroep tegen beide', 'beroep tegen alle drie'],
	CONTINUES: ['vervolg op beide', 'vervolg op alle drie'],
	REFERRED_BY: ['noemt beide', 'noemt alle drie'],
	ADVISES_ON: ['adviseert over beide', 'adviseert over alle drie'],
	ANSWERS: ['beantwoordt beide', 'beantwoordt alle drie'],
	SAME_AS: ['gelijk aan beide', 'gelijk aan alle drie'],
	SCOPED_BY: ['begrenst beide', 'begrenst alle drie'],
	ABOUT: ['gaat over beide', 'gaat over alle drie'],
	LED_BY: ['leidt beide', 'leidt alle drie'],
	MADE_IN: ['opgemaakt in beide', 'opgemaakt in alle drie'],
	MEMBER_OF: ['heeft beide als lid', 'heeft alle drie als lid'],
	SERVED_IN: ['heeft beide als bewindspersoon', 'heeft alle drie als bewindspersoon'],
	AUTHORED: ['ingediend door beiden', 'ingediend door alle drie'],
	RELATED_TO: ['verbonden met beide', 'verbonden met alle drie'],
	REVISES: ['herziet beide', 'herziet alle drie'],
	ACCOMPANIES: ['vergezelt beide', 'vergezelt alle drie'],
	SECOND_READING_OF: ['tweede lezing van beide', 'tweede lezing van alle drie'],
	VOTED: ['stemde over beide', 'stemde over alle drie']
};

const NUMBER_WORD = ['', '', '', 'alle drie', 'alle vier', 'alle vijf', 'alle zes'];

/**
 * The phrase under a kenmerk that joins `n` chosen bronnen by `relation`: `fromBron` where the
 * chosen bronnen are its subject (`beide lid van`), else the kenmerk is (`noemt beide`).
 */
export function bothPhrase(
	relation: Relation,
	row: Collection,
	fromBron: boolean,
	n: number
): string {
	const entry = (fromBron ? FROM_BRON : FROM_ROW)[relation];
	const [two, three] = typeof entry === 'function' ? entry(row) : entry;
	return n <= 2 ? two : three.replace('alle drie', NUMBER_WORD[n] ?? 'alle drie');
}

/** Where the chosen bronnen are joined each in its own way: only that the kenmerk joins them. */
export const joinsAll = (n: number): string =>
	`verbindt ${n <= 2 ? 'beide' : (NUMBER_WORD[n] ?? 'alle drie')}`;
