import { beforeEach } from 'vitest';
import { forgetAll } from '$lib/util/forget';

// Every test starts without the module state of the one before it: kept records, shared
// requests, a fake API (./fakeApi).
beforeEach(forgetAll);
