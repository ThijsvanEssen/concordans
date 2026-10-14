// Timings in the console during development, never in production:
//
//   const end = perfStart(`click ${id}`);
//   …
//   end();   // "[perf] click judgments/… — 124ms", "[perf!]" above 200 ms
import { dev } from '$app/environment';

function format(ms: number) {
	if (ms < 1) return `${ms.toFixed(2)}ms`;
	if (ms < 100) return `${ms.toFixed(1)}ms`;
	return `${Math.round(ms)}ms`;
}

export function perfStart(label: string): (extra?: string) => void {
	if (!dev) return () => {};
	const t0 = performance.now();
	return (extra) => {
		const ms = performance.now() - t0;
		const tag = ms > 200 ? '[perf!]' : '[perf]';
		console.log(`${tag} ${label} — ${format(ms)}${extra ? ` (${extra})` : ''}`);
	};
}
