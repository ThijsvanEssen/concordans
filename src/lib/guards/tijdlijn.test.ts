// Every series of dated lines in the one Tijdlijn, every horizontal time figure on the one Tijdas.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, regels } from '$lib/test/bronnen';

describe('the timeline', () => {
	it('marks a line of a timeline with the shape of its kind (vormen.ts), as Verbonden and the network do', () => {
		// The Tijdlijn draws only from VORMEN, no circle or square of its own.
		const tijdlijn = bron('lib/components/tijdlijn/Tijdlijn.svelte');
		expect(tijdlijn).toMatch(/VORMEN\[/);
		expect(tijdlijn).not.toMatch(/class="teken"|border-radius:\s*50%/);
		// Required on Actueel's line, so the compiler holds every builder to it.
		expect(bron('lib/components/actueel/timeline.ts')).toMatch(/\bvorm: Vorm\b/);
	});

	it('shows every series of dated lines in the one Tijdlijn (tijdlijn-voorstel, Thijs 11 Oct: "Ja, beide")', () => {
		// Actueel and a followed topic, the homepage, the procedure of a dossier, a post in
		// Bladeren, the toezeggingen, Loopbaan and Commissies of a lid, and the changes of an
		// article between A and B: one form, gelijke pagina's, gelijke ervaring.
		const tonen = [
			'lib/components/actueel/FeedDay.svelte',
			'lib/components/parliamentary/BewindspersoonOverzicht.svelte',
			'lib/components/explore/readers/MemberReader.svelte',
			'lib/components/articles/VersionCompare.svelte',
			'lib/components/open/OpenRij.svelte',
			'lib/components/explore/readers/DossierReader.svelte',
			'routes/(main)/+page.svelte'
		];
		expect(
			tonen.filter((p) => !bron(p).includes("import Tijdlijn from '$lib/components/tijdlijn/"))
		).toEqual([]);
		// The forms they had of their own are gone.
		expect(
			overtreders((t) => /class="career"|history__table|\.formulation::before|<FeedEntry/.test(t))
		).toEqual([]);
		// No list draws a line with dots of its own beside the Tijdlijn.
		const stippen = (t: string) =>
			regels(t).some(
				(r) =>
					/(li|item|step|regel|formulation)[\w-]*::before/.test(r.selector) &&
					/border-radius:\s*50%/.test(r.body)
			);
		expect(overtreders(stippen)).toEqual([]);
		// Its date column holds a day and month (the year under it) or a term's years, no more.
		const tl = bron('lib/components/tijdlijn/Tijdlijn.svelte');
		expect(tl).toMatch(/dagMaand\(/);
		expect(tl).toMatch(/yearsOf\(/);
		expect(tl).not.toMatch(/korteDatum|langeDatum|longDate|formatDate|formatLongDate|maandJaar/);
	});

	it('draws every horizontal time figure on the one Tijdas, a period in small with Strookje (horizontaal-4, Thijs 12 Oct)', () => {
		// The posts of a cabinet, the cabinets and the seats: one axis, one way of naming phases.
		const figuren = [
			'lib/components/explore/index/CabinetOccupancy.svelte',
			'lib/components/explore/index/KabinettenStrook.svelte',
			'lib/components/explore/readers/KamerZetels.svelte'
		];
		expect(
			figuren.filter((p) => !bron(p).includes("import Tijdas from '$lib/components/tijdlijn/"))
		).toEqual([]);
		expect(
			overtreders((t) => /\b(ticksOf|cabTicks)\(|class="(cab-axis|phase-label)"/.test(t))
		).toEqual([]);
		// A period in small (the posts on a phone, Naast elkaar) is the Strookje, no bar of its own.
		for (const p of [
			'lib/components/explore/index/CabinetOccupancy.svelte',
			'lib/components/explore/index/NaastPosten.svelte'
		])
			expect(bron(p)).toContain("import Strookje from '$lib/components/tijdlijn/Strookje.svelte'");
		// In rest quiet, a stand-in dotted: no fading bar, no italics, no opacity on a line.
		const lijnen = [
			...figuren,
			'lib/components/explore/index/NaastPosten.svelte',
			'lib/components/tijdlijn/Tijdas.svelte',
			'lib/components/tijdlijn/Fasen.svelte',
			'lib/components/tijdlijn/Strookje.svelte'
		];
		expect(
			lijnen.filter((p) =>
				regels(bron(p)).some((r) => /linear-gradient|font-style:\s*italic|opacity:/.test(r.body))
			)
		).toEqual([]);
	});

	it('styles the terms of a Tijdlijn by child combinators, so a Tijdlijn opened in a term keeps its own form', () => {
		const perioden = regels(bron('lib/components/tijdlijn/Tijdlijn.svelte')).filter((r) =>
			r.selector.includes('.perioden ')
		);
		expect(perioden.length).toBeGreaterThan(0);
		expect(
			perioden.filter((r) => !/^\.perioden > \.groep > \.regels > \.regel\b/.test(r.selector))
		).toEqual([]);
	});
});
