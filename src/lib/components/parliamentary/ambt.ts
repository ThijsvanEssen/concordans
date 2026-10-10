// A lid's posts in a cabinet as running text in the head of their votes in office: each post
// in lower case, the cabinet named once after its posts (UX-toets 0.79.44, #46: "(kabinet-Schoof)"
// three times in one head).

type Post = { function?: string | null; cabinet?: string | null };

const klein = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "a, b en c": the last joined with "en". */
const opsomming = (delen: string[]) =>
	delen.length < 2 ? (delen[0] ?? '') : `${delen.slice(0, -1).join(', ')} en ${delen.at(-1)}`;

/**
 * "viceminister-president, minister van VRO en minister voor Asiel en Migratie (kabinet-Schoof)";
 * posts in more cabinets, each group with its cabinet, joined with "en". Null without posts.
 */
export function ambtZin(posts: readonly Post[] | null | undefined): string | null {
	const perKabinet = new Map<string, string[]>();
	for (const p of posts ?? []) {
		const f = p.function?.trim();
		if (!f) continue;
		const k = p.cabinet?.trim() ?? '';
		const lijst = perKabinet.get(k) ?? [];
		if (!lijst.includes(klein(f))) lijst.push(klein(f));
		perKabinet.set(k, lijst);
	}
	const delen = [...perKabinet].map(([k, fs]) => `${opsomming(fs)}${k ? ` (${k})` : ''}`);
	return delen.length ? delen.join(' en ') : null;
}
