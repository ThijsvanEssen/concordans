// Fractiekleuren zoals de Kamers ze zelf tekenen, uit de API (0.73, BE-5): de Tweede Kamer
// in de legenda van haar zetelverdeling, de Eerste Kamer in "Wie zit waar". Een fractie
// krijgt overal de kleur van de Tweede Kamer, en waar die er geen heeft (eenmansfracties,
// OPNL) die van de Eerste Kamer (Thijs, 1 en 10 okt); een fractie die geen van beide Kamers
// nog tekent (NSC, een fractie van een eerder kabinet) de kleur die de partij zelf voert. De
// bron per Kamer geeft de API mee (`chambers.TK.source`). Eén bron voor de zaal, de legenda,
// de lijsten, de stippen en de filters, elke fractie op haar afkorting (`fractieNaam`).
//
// Kleuren die op elkaar lijken krijgen een patroon (Thijs, 10 okt: "zelf iets
// onderscheidends toevoegen qua patroon"): in de volgorde van de legenda van de Tweede Kamer
// houdt de eerste fractie van een groep gelijkende kleuren (ΔE onder 23) haar volle kleur,
// de tweede krijgt arcering, de derde stippen, de volgende strepen. Een fractie met twee
// kleuren (GroenLinks-PvdA) is al onderscheiden.
import { api, unwrap } from '$lib/api/client';
import { report } from '$lib/api/errors';
import { onForget } from '$lib/util/forget';

const kamers = $state<{ TK: Record<string, string[]>; EK: Record<string, string[]> }>({
	TK: {},
	EK: {}
});
/** De kleur die een partij zelf voert, en de afkortingen die naar haar sleutel leiden. */
const eigen = $state<{ kleuren: Record<string, string>; aliassen: Record<string, string> }>({
	kleuren: {},
	aliassen: {}
});
let gevraagd = false;
onForget(() => {
	kamers.TK = {};
	kamers.EK = {};
	eigen.kleuren = {};
	eigen.aliassen = {};
	gevraagd = false;
});

function laad() {
	if (gevraagd || typeof window === 'undefined') return;
	gevraagd = true;
	unwrap(api.GET('/api/parties/colors'))
		.then((data) => {
			kamers.TK = data.chambers?.TK?.colors ?? {};
			kamers.EK = data.chambers?.EK?.colors ?? {};
			eigen.kleuren = data.colors ?? {};
			eigen.aliassen = data.aliases ?? {};
		})
		.catch((e) => {
			// De terugvalkleur blijft, de naam van de fractie staat erbij; de volgende keer
			// opnieuw gevraagd.
			gevraagd = false;
			report('Partijkleuren', e);
		});
}

const zoek = <T>(map: Record<string, T>, naam: string): T | undefined => {
	const k = Object.keys(map).find((x) => x.toLowerCase() === naam.trim().toLowerCase());
	return k ? map[k] : undefined;
};

/**
 * De kleuren van een fractie bij een Kamer, op haar naam of de alias daarvan (`CU` naar
 * `ChristenUnie`): die van de Tweede Kamer, anders die van de Eerste Kamer.
 */
const kamerKleuren = (naam: string): string[] | undefined => {
	laad();
	const alias = zoek(eigen.aliassen, naam);
	const k =
		zoek(kamers.TK, naam) ??
		zoek(kamers.EK, naam) ??
		(alias ? (zoek(kamers.TK, alias) ?? zoek(kamers.EK, alias)) : undefined);
	return k?.length ? k : undefined;
};

/**
 * De kleur die een partij zelf voert, op haar afkorting of de alias daarvan, zonder op
 * hoofdletters te letten; undefined voor een partij die de API niet kent, zoals KVP of ARP:
 * een kleur bij de naam verzonnen zei niets.
 */
export function eigenKleur(
	naam: string,
	kleuren: Record<string, string>,
	aliassen: Record<string, string> = {}
): string | undefined {
	if (!naam.trim()) return undefined;
	return zoek(kleuren, zoek(aliassen, naam) ?? naam);
}

/** De kleuren van een fractie: die van een Kamer, anders die van de partij zelf. */
export const fractieKleuren = (naam: string): string[] | undefined => {
	const k = kamerKleuren(naam);
	if (k) return k;
	const e = eigenKleur(naam, eigen.kleuren, eigen.aliassen);
	return e ? [e] : undefined;
};

/** Een stoel of stip zonder kleur in de gegevens. */
const GRIJS = '#a39d90';

type Patroon = 'vol' | 'arcering' | 'stippen' | 'strepen';

/** Een kleur in CIE-Lab, voor de afstand tussen twee kleuren. */
function lab(hex: string): [number, number, number] {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
	const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
	const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
	const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const afstand = (a: string, b: string) => {
	const [p, q] = [lab(a), lab(b)];
	return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};
/** Onder deze afstand lijken twee kleuren op elkaar (gemeten op de legenda van juni 2026). */
const GELIJK = 23;
const PATRONEN: Patroon[] = ['vol', 'arcering', 'stippen', 'strepen'];

/**
 * Het patroon per fractie, uit een legenda in haar eigen volgorde: zoveel eerdere fracties
 * met een gelijkende kleur, zoveel stappen verder in `PATRONEN`.
 */
export function patronen(legenda: Record<string, string[]>): Map<string, Patroon> {
	const uit = new Map<string, Patroon>();
	// Per kleur (of paar kleuren) één patroon: een alias (PRO, GL-PvdA) volgt zijn fractie.
	const perKleur = new Map<string, Patroon>();
	const eerder: string[] = [];
	for (const [naam, kl] of Object.entries(legenda)) {
		const sleutel = kl.join('|');
		let p = perKleur.get(sleutel);
		if (!p) {
			if (kl.length !== 1) p = 'vol';
			else {
				const n = eerder.filter((e) => afstand(e, kl[0]) < GELIJK).length;
				p = PATRONEN[Math.min(n, PATRONEN.length - 1)];
				eerder.push(kl[0]);
			}
			perKleur.set(sleutel, p);
		}
		uit.set(naam.toLowerCase(), p);
	}
	return uit;
}

// Na de legenda van de Kamers de partijen die geen Kamer tekent, in hun eigen kleur: NSC
// naast de PVV in de zaal van kabinet-Schoof krijgt zo zijn patroon.
const allePatronen = $derived(
	patronen({
		...kamers.TK,
		...Object.fromEntries(Object.entries(kamers.EK).filter(([n]) => !zoek(kamers.TK, n))),
		...Object.fromEntries(
			Object.entries(eigen.kleuren)
				.filter(([n]) => !kamerKleuren(n))
				.map(([n, k]) => [n, [k]])
		)
	})
);
/** Het patroon van een fractie: vol, of een patroon tegen een gelijkende kleur. */
export const patroonVan = (naam: string): Patroon => {
	laad();
	return allePatronen.get(naam.toLowerCase()) ?? 'vol';
};

/** Wit over de kleur, als CSS-laag: het patroon van een stip of een balk in de legenda. */
const CSS_PATROON: Record<Patroon, string | null> = {
	vol: null,
	arcering:
		'repeating-linear-gradient(135deg, transparent 0 2px, rgba(255,255,255,0.75) 2px 3.5px)',
	stippen: 'radial-gradient(circle, rgba(255,255,255,0.85) 0 1px, transparent 1.3px) 0 0 / 4px 4px',
	strepen: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.75) 2px 3.5px)'
};
/**
 * De kleuren van een fractie: die van een Kamer, dan de kleur die de zetels zelf meegeven,
 * dan die van de partij zelf, dan grijs.
 */
function kleurenOf(naam: string, fallback: string | null): string[] {
	const k = kamerKleuren(naam);
	if (k) return k;
	if (fallback) return [fallback];
	return fractieKleuren(naam) ?? [GRIJS];
}

/** De achtergrond van een stip of vlak: kleur, twee kleuren naast elkaar, met het patroon. */
export function achtergrondVan(naam: string, fallback: string | null = null): string {
	const k = kleurenOf(naam, fallback);
	const basis = k.length > 1 ? `linear-gradient(90deg, ${k[0]} 50%, ${k[1]} 50%)` : k[0];
	const laag = CSS_PATROON[patroonVan(naam)];
	return laag ? `${laag}, ${basis}` : basis;
}

/** The id of a fractie's pattern in one SVG (FractiePatronen). */
export const patroonId = (prefix: string, naam: string) =>
	`${prefix}-fp-${naam.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** De vulling van een stoel: het patroon waar de fractie er een heeft, anders haar kleur. */
export function vullingVan(
	prefix: string,
	naam: string,
	i: number,
	fallback: string | null
): string {
	return patroonVan(naam) !== 'vol' && fractieKleuren(naam)
		? `url(#${patroonId(prefix, naam)})`
		: kleurVan('', naam, i, fallback);
}

/** De kleur van een stoel; een fractie met twee kleuren wisselt per stoel. */
export function kleurVan(_kamer: string, naam: string, i: number, fallback: string | null): string {
	const k = kleurenOf(naam, fallback);
	return k[i % k.length];
}
