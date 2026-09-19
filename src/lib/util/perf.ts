// Lightweight timing helper. Logs to the console with a consistent
// `[perf] label took NNNms` format so it's easy to grep / filter.
//
// Usage:
//   const end = perfStart('whole-law fetch');
//   await fetch(...);
//   end();                 // logs "[perf] whole-law fetch — 124ms"
//
//   await perfRun('label', () => doStuff())
//   await perfAwait('label', somePromise)
//
// Set `PUBLIC_PERF=0` (in Vite env) or call `setPerfEnabled(false)` to
// silence everything for production / clean console.

let enabled =
  typeof import.meta !== 'undefined'
    ? (import.meta.env?.PUBLIC_PERF as string | undefined) !== '0'
    : true;

export function setPerfEnabled(v: boolean) {
  enabled = v;
}

function fmt(ms: number) {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${Math.round(ms)}ms`;
}

export function perfStart(label: string) {
  if (!enabled) return () => {};
  const t0 = performance.now();
  return (extra?: string) => {
    const ms = performance.now() - t0;
    const tag = ms > 200 ? '[perf!]' : '[perf]';
    console.log(`${tag} ${label} — ${fmt(ms)}${extra ? ` (${extra})` : ''}`);
  };
}

export async function perfAwait<T>(label: string, p: Promise<T>): Promise<T> {
  if (!enabled) return p;
  const end = perfStart(label);
  try {
    return await p;
  } finally {
    end();
  }
}

export function perfRun<T>(label: string, fn: () => T): T {
  if (!enabled) return fn();
  const end = perfStart(label);
  try {
    return fn();
  } finally {
    end();
  }
}
