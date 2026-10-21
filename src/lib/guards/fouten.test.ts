// A failure is handled where its cause is known, or passed on ($lib/api/errors.ts,
// $lib/util/load.svelte.ts, LoadState). Code-eenvoud F01, F05, F06.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, plek, regelOvertreders } from '$lib/test/bronnen';

/** A failure in words of its own: "kon niet", "mislukt", "lukte niet", "Probeer opnieuw". */
const EIGEN_FOUT =
	/\b(?:[Kk]on(?:den)?\s+niet|lukte\s+niet|[Pp]robeer\s+opnieuw|ging\s+(?:iets\s+)?mis)\b|\p{Lu}\p{L}*\s+mislukt\b/u;
const COMMENTAAR = /^\s*(?:\/\/|\/?\*|<!--)/;

describe('errors that are not swallowed', () => {
	it('has one catch-all, at the outer boundary, and one boundary per panel of the Verkenner', () => {
		// hooks.client.ts reports what nobody handled; a panel that fails to draw says so in its
		// place (PanelBoundary), the other panels stay. Code-eenvoud F06.
		expect(overtreders((t) => /addEventListener\(\s*'unhandledrejection'/.test(t))).toEqual([
			'hooks.client.ts'
		]);
		expect(overtreders((t) => /<svelte:boundary\b/.test(t))).toEqual([
			'lib/components/ui/PanelBoundary.svelte'
		]);
		const panels = [
			...bron('routes/explore/+page.svelte').matchAll(/<PanelBoundary what="([^"]+)"/g)
		].map((m) => m[1]);
		expect(new Set(panels)).toEqual(new Set(['De tekst', 'Verbonden', 'Het netwerk']));
	});

	it('reads every answer of the API through unwrap, so a failure is an ApiError', () => {
		// `data ?? null` or `response.ok` made a 500 into "geen" (F05); a 404 that means "geen"
		// goes through ifExists ($lib/api/errors.ts).
		const raw = (text: string) =>
			(text.match(/\.GET\(/g) ?? []).length -
			(text.match(/\bunwrap\(\s*[\w.()]+\.GET\(/g) ?? []).length;
		expect(BRONNEN.filter(({ text }) => raw(text) > 0).map((s) => s.path)).toEqual([]);
	});

	it('says a failure through LoadState or failureText, with one word to ask again', () => {
		// One sentence per failure, slow told from broken, Opnieuw where it can ask again and
		// the kenmerk of a 500 (audit2 foutmeldingen, S1-S6). What is no load says its own.
		for (const eigen of [
			'<p class="stil">Kon niet worden geladen.</p>',
			"error = 'De inhoudsopgave kon niet worden geladen.';",
			"{search.failure.slow ? 'Zoeken duurt lang.' : 'Zoeken mislukt.'}",
			'<TekstLink onclick={retry}>Probeer opnieuw</TekstLink>',
			"error = 'Verder terug zoeken lukte niet.';"
		])
			expect(EIGEN_FOUT.test(eigen), eigen).toBe(true);
		expect(EIGEN_FOUT.test('const mislukt = $derived(rijen.filter(isFout));')).toBe(false);
		expect(
			regelOvertreders(
				(l) => EIGEN_FOUT.test(l) && !COMMENTAAR.test(l),
				[
					plek('lib/components/ui/copy.svelte.ts', 'a clipboard that refuses, on its button'),
					plek(
						'routes/(main)/onderwerpen/overzicht/+page.svelte',
						'a CSV made here, not loaded; its button asks again'
					),
					plek('routes/+error.svelte', 'the title of the page that failed, with Opnieuw laden'),
					{
						pad: 'routes/explore/+page.svelte',
						reden: 'the tab of a bron that could not be loaded, as the failure page calls it',
						regel: /siteTitle\('Er ging iets mis'\)/
					}
				]
			)
		).toEqual([]);
	});

	it('says a failure only through LoadState, so it never stands without Opnieuw and kenmerk', () => {
		// failureText as a string of its own (state as text, a toast) lost Opnieuw and the
		// kenmerk (Actueel, the Verkenner's address and focus, the network; F6-rest). A failure
		// kept beside a list is a LoadFailure, shown by LoadState.
		expect(
			overtreders(
				(t) => /\bfailureText\(/.test(t),
				[
					plek('lib/components/ui/LoadState.svelte'),
					plek(
						'lib/components/explore/IndexView.svelte',
						'Volgende becomes Opnieuw in its own place under the rows loaded'
					)
				]
			)
		).toEqual([]);
	});

	it('asks again with one Opnieuw, the one of LoadState, alike in reader, Verbonden and search', () => {
		// One look and one finger's target (.raakvlak) for every Opnieuw (UX-toets A32 #5).
		expect(
			overtreders(
				(t) => /[>'"]Opnieuw[<'"]/.test(t),
				[
					plek('lib/components/ui/LoadState.svelte'),
					plek(
						'lib/components/explore/IndexView.svelte',
						'Volgende becomes Opnieuw in its own place under the rows loaded'
					)
				]
			)
		).toEqual([]);
	});
});
