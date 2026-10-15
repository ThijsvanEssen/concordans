// The Verkenner's address and its state, both ways: what a URL opens (Netwerk, Tekst, the
// table, Bladeren; the focus, the overlay, the depth, the filter, a toelichting beside it),
// what a key or a control writes back, and which writes Back undoes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import {
	address,
	appNavigation,
	back,
	forward,
	history,
	open,
	steps
} from '$lib/test/navigation.svelte';
import Page from './+page.svelte';

const seen = vi.hoisted(() => ({}) as Record<string, Record<string, unknown>>);
/** A component in the page's place: it draws nothing and keeps the props it was given. */
const stub = vi.hoisted(() => (name: string, exports: Record<string, () => void> = {}) => ({
	default: (_anchor: unknown, props: Record<string, unknown>) => {
		seen[name] = props;
		return exports;
	}
}));
const phone = vi.hoisted(() => ({ matches: false }));

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);
vi.mock('$lib/components/graph/GraphView.svelte', () =>
	stub('GraphView', {
		suppressFit() {},
		fitWhenSettled() {},
		reseatAround() {},
		inBeeld() {}
	})
);
vi.mock('$lib/components/explore/IndexView.svelte', () => stub('IndexView'));
vi.mock('$lib/components/explore/index/IndexOverzicht.svelte', () => stub('IndexOverzicht'));
vi.mock('$lib/components/explore/KindReader.svelte', () => stub('KindReader'));
vi.mock('$lib/components/explore/readers/ReaderFrame.svelte', () => stub('ReaderFrame'));
vi.mock('$lib/components/explore/readers/DocumentReader.svelte', () => stub('DocumentReader'));
vi.mock('$lib/components/explore/readers/JudgmentReader.svelte', () => stub('JudgmentReader'));
vi.mock('$lib/components/explore/LezenNav.svelte', () => stub('LezenNav'));
vi.mock('$lib/components/explore/DocumentToc.svelte', () => stub('DocumentToc'));
vi.mock('$lib/components/explore/JudgmentToc.svelte', () => stub('JudgmentToc'));
vi.mock('$lib/verbonden/Verbonden.svelte', () => stub('Verbonden'));
vi.mock('$lib/verbonden/VerbondenTabel.svelte', () => stub('VerbondenTabel'));
vi.mock('$lib/verbonden/FilterSheet.svelte', () => stub('FilterSheet'));
vi.mock('$lib/verbonden/VerbindingCard.svelte', () => stub('VerbindingCard'));
vi.mock('$lib/selection/NetwerkPanel.svelte', () => stub('NetwerkPanel'));
vi.mock('$lib/util/reload', () => ({ reloadForNewVersion: () => {} }));

/** An article of the Awb without an address of its own (no number): it stays at /explore. */
const ARTICLE = 'articles/bwbr0005537_3_4';
/** A lid: no text of its own, so it is never read at full width. */
const MEMBER = 'members/m1';

/** An article with the props of its address: /wetten/BWBR0005537/artikel/3:2. */
const READABLE = 'articles/bwbr0005537_3_2';
/** A fractie: a group, drawn one step around. */
const FACTION = 'factions/vvd';

const TYPE: Record<string, string> = {
	members: 'member',
	factions: 'faction',
	cabinets: 'cabinet'
};
const PROPS: Record<string, Record<string, unknown>> = {
	[READABLE]: { bwb_id: 'BWBR0005537', article_number: '3:2' }
};
const nodeOf = (collection: string, key: string) => ({
	node: {
		id: `${collection}/${key}`,
		key,
		collection,
		type: TYPE[collection] ?? 'article',
		display_name: `Bron ${key}`,
		labels: [],
		props: PROPS[`${collection}/${key}`] ?? {}
	},
	neighbors: { total: 0, buckets: [] },
	title: '',
	description: ''
});

/** The browser's storage, empty for each test (Node's own needs a file). */
function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		key: (i) => [...items.keys()][i] ?? null,
		getItem: (k) => items.get(k) ?? null,
		setItem: (k, v) => void items.set(k, String(v)),
		removeItem: (k) => void items.delete(k),
		clear: () => items.clear()
	};
}

beforeEach(() => {
	vi.stubGlobal('localStorage', memoryStorage());
	for (const name of Object.keys(seen)) delete seen[name];
	phone.matches = false;
	window.matchMedia = ((query: string) => ({
		matches: query.includes('max-width') ? phone.matches : !phone.matches,
		media: query,
		addEventListener() {},
		removeEventListener() {}
	})) as unknown as typeof window.matchMedia;
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	fakeApi({
		'/api/nodes/{collection}/{key}': ({ params }) =>
			nodeOf(String(params.path?.collection), String(params.path?.key)),
		'/api/nodes/{collection}/{key}/neighborhood': ({ params }) => ({
			focal_id: `${params.path?.collection}/${params.path?.key}`,
			nodes: [],
			edges: []
		}),
		'/api/members/{key}': () => new Promise(() => {}),
		'/api/members/{key}/votes': () => new Promise(() => {}),
		'/api/feed': () => new Promise(() => {})
	});
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

/** Let the requests answer and the page settle. */
async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

async function openAt(href: string) {
	open(href);
	const view = render(Page);
	await settle();
	return view;
}

/** Which of its views the Verkenner shows. */
function view(container: HTMLElement) {
	if (seen.IndexOverzicht || seen.IndexView) return 'index';
	if (container.querySelector('.explore-table')) return 'table';
	if (container.querySelector('.explore-read')) return 'read';
	if (container.querySelector('.explore-graph')) return 'graph';
	return null;
}

const key = async (k: string) => {
	await fireEvent.keyDown(window, { key: k });
	await settle();
};

const param = (name: string) => new URL(address(), 'http://localhost').searchParams.get(name);

describe('the Verkenner reads its state from the address', () => {
	it('opens a bron in the network, its text beside it', async () => {
		const { container } = await openAt(`/explore?focus=${ARTICLE}`);
		expect(view(container)).toBe('graph');
		expect(seen.KindReader).toBeDefined();
		expect((seen.KindReader.selection as { id: string }).id).toBe(ARTICLE);
		expect(seen.GraphView.compact).toBe(true);
	});

	it('reads a bron with a text at full width with ?lezen=1, one without stays in the network', async () => {
		const read = await openAt(`/explore?focus=${ARTICLE}&lezen=1`);
		expect(view(read.container)).toBe('read');
		read.unmount();
		const member = await openAt(`/explore?focus=${MEMBER}&lezen=1`);
		expect(view(member.container)).toBe('graph');
	});

	it('shows all verbindingen as a table with ?tabel=1, also for a bron without a text', async () => {
		const { container } = await openAt(`/explore?focus=${MEMBER}&tabel=1`);
		expect(view(container)).toBe('table');
		expect(seen.VerbondenTabel).toBeDefined();
	});

	it('lists bronnen with ?mode=index, whatever else the address holds', async () => {
		const overview = await openAt(`/explore?mode=index&focus=${ARTICLE}`);
		expect(view(overview.container)).toBe('index');
		expect(seen.IndexOverzicht).toBeDefined();
		overview.unmount();
		await openAt('/explore?mode=index&kind=judgments');
		expect(seen.IndexView?.category).toBe('judgments');
	});

	it('draws two steps around an ordinary bron, ?diepte between 1 and 3, ?alles=1 one step', async () => {
		const cases: [string, number][] = [
			['', 2],
			['&diepte=1', 1],
			['&diepte=3', 3],
			['&diepte=9', 3],
			['&diepte=0', 2],
			['&diepte=x', 2],
			['&alles=1&diepte=3', 1]
		];
		for (const [query, depth] of cases) {
			const v = await openAt(`/explore?focus=${ARTICLE}${query}`);
			expect(seen.GraphView.depth, query).toBe(depth);
			v.unmount();
		}
	});

	it('draws one step around a group', async () => {
		await openAt(`/explore?focus=${FACTION}`);
		expect(seen.GraphView.depth).toBe(1);
	});

	it('hands the overlay and the bronfilter of the address to the network', async () => {
		await openAt(`/explore?focus=${ARTICLE}&overlay=open&lid=2`);
		expect(seen.GraphView.overlay).toEqual({ kind: 'open' });
		expect((seen.GraphView.filter as { lid: string | null }).lid).toBe('2');
	});

	it('opens a toelichting beside the article with ?naast', async () => {
		const { container } = await openAt(
			`/explore?focus=${ARTICLE}&lezen=1&naast=documents/kst-36327-3`
		);
		expect(container.querySelector('.reader__beside')).not.toBeNull();
		expect(seen.DocumentReader).toBeDefined();
	});
});

describe('the Verkenner writes its state to the address', () => {
	it('reads with L and goes back to the network with L, each a step Back undoes', async () => {
		const { container } = await openAt(`/explore?focus=${ARTICLE}`);
		await key('l');
		expect(param('lezen')).toBe('1');
		expect(view(container)).toBe('read');
		await key('L');
		expect(param('lezen')).toBeNull();
		expect(view(container)).toBe('graph');
		back();
		await settle();
		expect(view(container)).toBe('read');
		back();
		await settle();
		expect(view(container)).toBe('graph');
		forward();
		await settle();
		expect(view(container)).toBe('read');
	});

	it('takes the layers with 1, 2 and 3: Tekst reads, Netwerk goes back', async () => {
		const { container } = await openAt(`/explore?focus=${ARTICLE}`);
		await key('1');
		expect(view(container)).toBe('read');
		await key('2');
		expect(view(container)).toBe('graph');
		await key('3');
		expect(view(container)).toBe('graph');
		expect(history().entries).toHaveLength(3);
	});

	it('writes the depth, the overlay and the filter in place: no step', async () => {
		await openAt(`/explore?focus=${ARTICLE}`);
		const props = seen.GraphView as {
			onDepth: (d: number) => void;
			onToggleMutatie: () => void;
			onToggleHeat: () => void;
			onHeatPeriodChange: (m: number) => void;
		};
		props.onDepth(3);
		await settle();
		expect(param('diepte')).toBe('3');
		expect(seen.GraphView.depth).toBe(3);
		props.onToggleMutatie();
		await settle();
		expect(param('overlay')).toBe('open');
		(seen.GraphView as typeof props).onToggleHeat();
		await settle();
		expect(param('overlay')).toMatch(/^heat/);
		(seen.GraphView as typeof props).onToggleHeat();
		await settle();
		expect(param('overlay')).toBeNull();
		expect(history().entries).toHaveLength(1);
		expect(steps.every((s) => !s.step)).toBe(true);
	});

	it('loads every neighbour as a step, without a depth', async () => {
		await openAt(`/explore?focus=${ARTICLE}&diepte=3`);
		(seen.GraphView.onAllesLaden as () => void)();
		await settle();
		expect(param('alles')).toBe('1');
		expect(param('diepte')).toBeNull();
		expect(seen.GraphView.depth).toBe(1);
		expect(history().entries).toHaveLength(2);
	});

	it('drops the hint ?paneel once read, in place', async () => {
		phone.matches = true;
		await openAt(`/explore?focus=${ARTICLE}&paneel=netwerk`);
		expect(param('paneel')).toBeNull();
		expect(param('focus')).toBe(ARTICLE);
		expect(history().entries).toHaveLength(1);
	});

	it('keeps the fragment, the place in the text, when it reads at full width', async () => {
		await openAt(`/explore?focus=${ARTICLE}#lid-2`);
		await key('l');
		expect(address()).toMatch(/#lid-2$/);
	});
});

describe('the readable address', () => {
	it('takes the place of ?focus once the bron is known, in place', async () => {
		await openAt(`/explore?focus=${READABLE}&diepte=3`);
		expect(address()).toBe('/wetten/BWBR0005537/artikel/3:2?diepte=3');
		expect(history().entries).toHaveLength(1);
		await key('l');
		expect(address()).toBe('/wetten/BWBR0005537/artikel/3:2?diepte=3&lezen=1');
		back();
		await settle();
		expect(address()).toBe('/wetten/BWBR0005537/artikel/3:2?diepte=3');
	});
});

describe('Back and Forward to a bron', () => {
	it('open the bron again after the list of bronnen (#135)', async () => {
		const { container } = await openAt('/kabinetten/schoof');
		expect(view(container)).not.toBeNull();
		const opened = view(container);
		await appNavigation.goto('/explore?mode=index');
		await settle();
		expect(view(container)).toBe('index');
		delete seen.IndexOverzicht;
		back();
		await settle();
		expect(address()).toBe('/kabinetten/schoof');
		expect(container.querySelector('.explore-empty')?.textContent ?? '').not.toMatch(/Laden/);
		expect(view(container)).toBe(opened);
		forward();
		await settle();
		back();
		await settle();
		expect(container.querySelector('.explore-empty')?.textContent ?? '').not.toMatch(/Laden/);
	});
});

describe('the netwerk of chosen bronnen', () => {
	const graphNode = (id: string) => {
		const [collection, key] = id.split('/');
		return { id, collection, key, kind: 'article', label: key, raw: { props: {} } };
	};

	it('adds a bron in place, removes it as a step, and remembers it', async () => {
		await openAt(`/explore?focus=${ARTICLE}`);
		const toggle = (id: string) =>
			(seen.GraphView.onToggleChosen as (n: ReturnType<typeof graphNode>) => void)(graphNode(id));
		toggle(ARTICLE);
		await settle();
		expect(param('netwerk')).toBe(ARTICLE);
		expect(seen.GraphView.netwerkActive).toBe(true);
		expect(history().entries).toHaveLength(1);
		expect(localStorage.getItem('concordans:netwerk')).toBe(
			`netwerk=${encodeURIComponent(ARTICLE)}`
		);
		toggle(ARTICLE);
		await settle();
		expect(param('netwerk')).toBeNull();
		expect(history().entries).toHaveLength(2);
		expect(localStorage.getItem('concordans:netwerk')).toBeNull();
		back();
		await settle();
		expect(param('netwerk')).toBe(ARTICLE);
	});

	it('opens on the remembered netwerk where nothing is chosen, the bronnen between shown', async () => {
		localStorage.setItem('concordans:netwerk', `netwerk=${ARTICLE}&tussen=0`);
		await openAt('/explore');
		expect(param('netwerk')).toBe(ARTICLE);
		expect(param('tussen')).toBeNull();
		expect(history().entries).toHaveLength(1);
	});
});

describe('the columns', () => {
	it('keep the widths that were dragged', async () => {
		localStorage.setItem('concordans:panel-widths', JSON.stringify({ panelW: 300, graphW: 500 }));
		const { container } = await openAt(`/explore?focus=${ARTICLE}`);
		const grid = container.querySelector<HTMLElement>('.explore-graph')!;
		expect(grid.style.getPropertyValue('--panel-w')).toBe('300px');
		expect(grid.style.getPropertyValue('--graph-w')).toBe('500px');
	});
});

describe('the Verkenner on a phone', () => {
	beforeEach(() => {
		phone.matches = true;
	});

	it('shows one panel at a time; the tabs read the text or go back to the network', async () => {
		const { container } = await openAt(`/explore?focus=${ARTICLE}`);
		const tabs = () =>
			[...container.querySelectorAll<HTMLButtonElement>('.mobile-tab')].map((b) => [
				b.textContent,
				b.getAttribute('aria-pressed')
			]);
		expect(tabs()).toEqual([
			['Tekst', 'true'],
			['Netwerk', 'false'],
			['Verbonden', 'false']
		]);
		const netwerk = [...container.querySelectorAll<HTMLButtonElement>('.mobile-tab')][1];
		await fireEvent.click(netwerk);
		await settle();
		expect(view(container)).toBe('graph');
		expect(tabs()[1]).toEqual(['Netwerk', 'true']);
		const tekst = [...container.querySelectorAll<HTMLButtonElement>('.mobile-tab')][0];
		await fireEvent.click(tekst);
		await settle();
		expect(view(container)).toBe('read');
		expect(param('lezen')).toBe('1');
	});
});
