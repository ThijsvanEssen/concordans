// A part of the Verkenner whose chunk did not come (a deploy removed it, the network dropped
// it): said in its place with Opnieuw, which asks the chunk again (A121).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import Page from './+page.svelte';

/** A component in the page's place: it says its name. */
const stub = vi.hoisted(() => (name: string, exports: Record<string, () => void> = {}) => ({
	default: (anchor: Comment) => {
		anchor.before(document.createTextNode(`deel:${name}`));
		return exports;
	}
}));
/** How often each failing chunk was asked: the first time it fails. */
const asked = vi.hoisted(() => ({ graph: 0, index: 0 }));
const chunkFails = vi.hoisted(() => () => {
	throw new Error('Failed to fetch dynamically imported module');
});

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);
vi.mock('$lib/components/graph/GraphView.svelte', () =>
	asked.graph++ === 0
		? chunkFails()
		: stub('GraphView', {
				suppressFit() {},
				reseatAround() {},
				fitWhenSettled() {},
				inBeeld() {}
			})
);
vi.mock('$lib/components/explore/IndexView.svelte', () =>
	asked.index++ === 0 ? chunkFails() : stub('IndexView')
);
vi.mock('$lib/components/explore/index/IndexOverzicht.svelte', () => stub('IndexOverzicht'));
vi.mock('$lib/components/explore/KindReader.svelte', () => stub('KindReader'));
vi.mock('$lib/verbonden/Verbonden.svelte', () => stub('Verbonden'));
vi.mock('$lib/verbonden/VerbondenTabel.svelte', () => stub('VerbondenTabel'));
vi.mock('$lib/verbonden/FilterSheet.svelte', () => stub('FilterSheet'));
vi.mock('$lib/selection/NetwerkPanel.svelte', () => stub('NetwerkPanel'));
vi.mock('$lib/util/reload', () => ({ reloadForNewVersion: () => {} }));

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	window.matchMedia = ((query: string) => ({
		matches: !query.includes('max-width'),
		media: query,
		addEventListener() {},
		removeEventListener() {}
	})) as unknown as typeof window.matchMedia;
	fakeApi({
		'/api/nodes/{collection}/{key}': () => new Promise(() => {}),
		'/api/nodes/{collection}/{key}/neighborhood': () => new Promise(() => {}),
		'/api/feed': () => new Promise(() => {})
	});
});
afterEach(() => {
	vi.restoreAllMocks();
});

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('a part of the Verkenner whose chunk did not come', () => {
	it('says De lijst with Opnieuw, which brings it in its place', async () => {
		open('/explore?mode=index&kind=judgments');
		const { container } = render(Page);
		await settle();
		expect(screen.getByRole('alert').textContent).toContain('De lijst kon niet worden geladen.');
		await fireEvent.click(screen.getByRole('button', { name: 'Opnieuw' }));
		await settle();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(container.textContent).toContain('deel:IndexView');
	});

	it('says Het netwerk with Opnieuw', async () => {
		// A chunk that failed is not kept: asked anew, it fails first again.
		asked.graph = 0;
		open('/explore');
		const { container } = render(Page);
		await settle();
		expect(container.textContent).toContain('Het netwerk kon niet worden geladen.');
		await fireEvent.click(screen.getByRole('button', { name: 'Opnieuw' }));
		await settle();
		expect(container.textContent).not.toContain('Het netwerk kon niet worden geladen.');
		expect(container.textContent).toContain('deel:GraphView');
	});
});
