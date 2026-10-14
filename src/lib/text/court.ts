// The courts by the code of their ECLI, as the data gives a court where it lacks its name.
// The rechtbanken and gerechtshoven abolished in the reorganisation of 2013 stay: their
// judgments keep their ECLI.

const COURTS: Record<string, string> = {
	HR: 'Hoge Raad',
	PHR: 'Parket bij de Hoge Raad',
	// A judgment of the EHRM has no court name, only its code.
	ECHR: 'Europees Hof voor de Rechten van de Mens',
	RVS: 'Raad van State',
	CRVB: 'Centrale Raad van Beroep',
	CBB: 'College van Beroep voor het bedrijfsleven',
	GHAMS: 'Gerechtshof Amsterdam',
	GHARL: 'Gerechtshof Arnhem-Leeuwarden',
	GHDHA: 'Gerechtshof Den Haag',
	GHSHE: "Gerechtshof 's-Hertogenbosch",
	RBAMS: 'Rechtbank Amsterdam',
	RBDHA: 'Rechtbank Den Haag',
	RBGEL: 'Rechtbank Gelderland',
	RBLIM: 'Rechtbank Limburg',
	RBMNE: 'Rechtbank Midden-Nederland',
	RBNHO: 'Rechtbank Noord-Holland',
	RBNNE: 'Rechtbank Noord-Nederland',
	RBOBR: 'Rechtbank Oost-Brabant',
	RBOVE: 'Rechtbank Overijssel',
	RBROT: 'Rechtbank Rotterdam',
	RBZWB: 'Rechtbank Zeeland-West-Brabant',
	// Abolished.
	GHARN: 'Gerechtshof Arnhem',
	GHLEE: 'Gerechtshof Leeuwarden',
	GHSGR: "Gerechtshof 's-Gravenhage",
	RBALK: 'Rechtbank Alkmaar',
	RBALM: 'Rechtbank Almelo',
	RBARN: 'Rechtbank Arnhem',
	RBASS: 'Rechtbank Assen',
	RBBRE: 'Rechtbank Breda',
	RBDOR: 'Rechtbank Dordrecht',
	RBGRO: 'Rechtbank Groningen',
	RBHAA: 'Rechtbank Haarlem',
	RBLEE: 'Rechtbank Leeuwarden',
	RBMAA: 'Rechtbank Maastricht',
	RBMID: 'Rechtbank Middelburg',
	RBONE: 'Rechtbank Oost-Nederland',
	RBROE: 'Rechtbank Roermond',
	RBSGR: "Rechtbank 's-Gravenhage",
	RBSHE: "Rechtbank 's-Hertogenbosch",
	RBUTR: 'Rechtbank Utrecht',
	RBZLY: 'Rechtbank Zwolle-Lelystad',
	RBZUT: 'Rechtbank Zutphen'
};

/** A court by its name: the name given, or the name of the code given (`RBUTR`). */
export const courtName = (court: string | null | undefined): string | null => {
	const given = court?.trim();
	return given ? (COURTS[given.toUpperCase()] ?? given) : null;
};
