// The house rules a page can be checked on without a person looking: each returns what
// breaks the rule, as short descriptions, so a failure names the element.
import type { Page } from '@playwright/test';

/** How far the page reaches past the width of the screen, in pixels (0 when it fits). */
export const overflowX = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Visible text with a "·" as separator (house rule: a comma). */
export const middots = (page: Page) =>
	page.evaluate(() =>
		document.body.innerText
			.split('\n')
			.filter((line) => line.includes('·'))
			.map((line) => line.trim().slice(0, 80))
	);

/**
 * Elements in red (--accent) at rest that do not say no or an error: the accent is for an
 * outcome that says no, a failure and the § of the name.
 */
export const strayRed = (page: Page) =>
	page.evaluate(() => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--accent)';
		document.body.append(probe);
		const red = getComputedStyle(probe).color;
		probe.remove();
		const allowed =
			'[class*="nee"], [class*="tegen"], [class*="fout"], [class*="failure"], [class*="error"], ' +
			'[class*="verworpen"], [role="alert"], [aria-invalid="true"], .paragraaf, [class*="logo"], [class*="merk"]';
		const out: string[] = [];
		for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
			const s = getComputedStyle(el);
			const hit =
				(s.color === red && el.innerText?.trim()) ||
				s.backgroundColor === red ||
				(s.borderTopColor === red && s.borderTopWidth !== '0px') ||
				(s.borderLeftColor === red && s.borderLeftWidth !== '0px');
			if (!hit || !el.checkVisibility() || el.closest(allowed)) continue;
			const name =
				el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : '');
			out.push(`${name}: ${(el.innerText || '').trim().slice(0, 40)}`);
		}
		return out;
	});

/**
 * Controls on screen whose place to tap is under 44 by 44 px: the element itself or what
 * widens it (a ::after over the line) must answer a tap 22 px from its centre in each
 * direction. Inline links in running text are text, not controls, and are left out. A row's
 * toggle (a button with aria-expanded in a [data-rij]) is widened by its row: a tap on the
 * row's words opens it too ($lib/actions/klik.ts), so they count as its target.
 */
export const smallTargets = (page: Page) =>
	page.evaluate(() => {
		const H = 22;
		const controls = document.querySelectorAll<HTMLElement>(
			'button, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], select, ' +
				'input:not([type="hidden"]), summary, nav a, a.btn, a[class*="knop"]'
		);
		const out: string[] = [];
		for (const el of controls) {
			if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
			if (el.closest('[inert], [aria-hidden="true"]')) continue;
			const r = el.getBoundingClientRect();
			if (
				r.width === 0 ||
				r.height === 0 ||
				r.bottom < 0 ||
				r.top > innerHeight ||
				r.right < 0 ||
				r.left > innerWidth
			)
				continue;
			const row = el.matches('[aria-expanded]') ? el.closest('[data-rij]') : null;
			const cx = r.left + r.width / 2;
			const cy = r.top + r.height / 2;
			const probes = [
				[cx, cy - H + 1],
				[cx, cy + H - 1],
				[cx - H + 1, cy],
				[cx + H - 1, cy]
			];
			const ok = probes.every(([x, y]) => {
				if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true;
				const hit = document.elementFromPoint(x, y);
				// Nothing there (past the bottom of the screen): nothing takes the tap.
				if (!hit) return true;
				if (el.contains(hit) || hit.contains(el)) return true;
				return (
					!!row &&
					hit.closest('[data-rij]') === row &&
					!hit.closest('button, input, select, summary, [role="button"]')
				);
			});
			if (ok) continue;
			const label = (el.getAttribute('aria-label') || el.innerText || el.tagName)
				.replace(/\s+/g, ' ')
				.trim();
			out.push(`${label.slice(0, 50)} (${Math.round(r.width)}x${Math.round(r.height)})`);
		}
		return out;
	});

/** A breach without its measure, to match it against a list of known ones. */
export const withoutSize = (breach: string) => breach.replace(/ \(\d+x\d+\)$/, '');
