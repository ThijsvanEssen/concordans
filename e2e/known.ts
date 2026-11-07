// Known breaches of a house rule that the suite tolerates until they are fixed. The lists
// only shrink: a breach that is not here fails its test, and so does an entry that is no
// longer seen (take it out). Labels as the accessible name of the control, without its size.

/** Controls under 44 by 44 px on touch (375), per page of the smoke test. */
export const KNOWN_SMALL_TARGETS: Record<string, string[]> = {
	// The year bars of a list's period and the cabinet strip: charts, too small to tap on a
	// phone since the lists are in the smoke test (B128).
	'/uitspraken': [
		'1989: 540 uitspraken',
		'1990: 581 uitspraken',
		'1991: 611 uitspraken',
		'1992: 632 uitspraken',
		'1993: 714 uitspraken',
		'1994: 808 uitspraken',
		'1995: 1.148 uitspraken',
		'1996: 1.251 uitspraken',
		'1997: 1.524 uitspraken',
		'1998: 1.936 uitspraken',
		'1999: 3.034 uitspraken',
		'2000: 6.054 uitspraken',
		'2001: 8.323 uitspraken',
		'2002: 11.783 uitspraken',
		'2003: 13.468 uitspraken',
		'2004: 15.963 uitspraken',
		'2005: 17.997 uitspraken',
		'2006: 21.320 uitspraken',
		'2007: 24.049 uitspraken',
		'2008: 26.835 uitspraken',
		'2009: 29.151 uitspraken',
		'2010: 31.023 uitspraken',
		'2011: 33.862 uitspraken',
		'2012: 33.808 uitspraken',
		'2013: 33.743 uitspraken',
		'2014: 34.319 uitspraken',
		'2015: 36.336 uitspraken',
		'2016: 37.442 uitspraken',
		'2017: 40.550 uitspraken',
		'2018: 42.930 uitspraken',
		'2019: 43.562 uitspraken',
		'2020: 49.915 uitspraken',
		'2021: 56.533 uitspraken',
		'2022: 58.982 uitspraken',
		'2023: 67.763 uitspraken',
		'2024: 74.907 uitspraken',
		'2025: 82.606 uitspraken',
		'2026, t/m 20 okt. 2026: 66.234 uitspraken'
	],
	'/kabinetten': [
		'kabinet-Rutte IV, 10 jan. 2022 tot 2 jul. 2024, mi',
		'kabinet-Schoof, 2 jul. 2024 tot 23 feb. 2026, mini',
		'kabinet-Jetten, sinds 23 feb. 2026, minister-presi'
	]
};

/** Console errors per page of the smoke test. */
export const KNOWN_CONSOLE_ERRORS: Record<string, RegExp[]> = {};
