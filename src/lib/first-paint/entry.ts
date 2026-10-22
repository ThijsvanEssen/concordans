// The script the server inlines after the bron it puts in a reader's page (paint.ts). The build
// gives it the classes and the stylesheets of the app (vite.config.ts).
import type { Build } from './classes';
import { paint } from './paint';

declare const __FIRST_PAINT__: Build;

paint(document, __FIRST_PAINT__);
