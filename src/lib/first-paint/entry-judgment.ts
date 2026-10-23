// The script of the first paint of a judgment (entry.ts): the server inlines it in a
// judgment's page.
import type { Build } from './classes';
import { judgmentColumn } from './judgment';
import { paint } from './paint';

declare const __FIRST_PAINT__: Build;

paint(document, __FIRST_PAINT__, { judgment: judgmentColumn });
