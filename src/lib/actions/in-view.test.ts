import { afterEach, describe, expect, it, vi } from 'vitest';
import { IN_VIEW_MARGIN, inView } from './in-view';

/** An IntersectionObserver the test drives by hand. */
function observers() {
	const made: { fire: (seen: boolean) => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
	const options: (IntersectionObserverInit | undefined)[] = [];
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			disconnect = vi.fn();
			observe = vi.fn();
			constructor(cb: IntersectionObserverCallback, init?: IntersectionObserverInit) {
				options.push(init);
				made.push({
					fire: (seen) =>
						cb([{ isIntersecting: seen } as IntersectionObserverEntry], this as never),
					disconnect: this.disconnect
				});
			}
		}
	);
	return { made, options };
}

afterEach(() => vi.unstubAllGlobals());

describe('inView', () => {
	it('calls once, when the element comes near, and stops watching', () => {
		const { made, options } = observers();
		const seen = vi.fn();
		inView({} as HTMLElement, seen);
		expect(options[0]?.rootMargin).toBe(IN_VIEW_MARGIN);
		made[0].fire(false);
		expect(seen).not.toHaveBeenCalled();
		made[0].fire(true);
		expect(seen).toHaveBeenCalledOnce();
		expect(made[0].disconnect).toHaveBeenCalled();
	});

	it('stops watching when the element goes', () => {
		const { made } = observers();
		inView({} as HTMLElement, () => {}).destroy();
		expect(made[0].disconnect).toHaveBeenCalled();
	});
});
