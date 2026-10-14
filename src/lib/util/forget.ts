// What a module keeps for the session (records, requests, names), forgotten before every test
// (src/lib/test/setup.ts), so that no test sees what another one asked.

const forgets: (() => void)[] = [];

/** Register how a module forgets what it keeps. */
export const onForget = (forget: () => void) => void forgets.push(forget);

/** Forget everything every loaded module keeps. */
export const forgetAll = () => forgets.forEach((forget) => forget());
