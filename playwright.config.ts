// The browser suite (e2e/): the production build under `vite preview`, its API answered from
// recorded fixtures (e2e/support/api.ts), at two widths: 1440 with a mouse and 375 with touch.
import { defineConfig, devices } from '@playwright/test';
import { API_ORIGIN } from './e2e/support/api';

// Another port (E2E_PORT) lets two suites run side by side.
const PORT = Number(process.env.E2E_PORT ?? 4317);
const CI = !!process.env.CI;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: CI,
	retries: CI ? 1 : 0,
	workers: CI ? 2 : '50%',
	// A recording waits for the live API and for the pages to fall quiet (e2e/support/test.ts).
	timeout: process.env.E2E_RECORD ? 120_000 : 30_000,
	expect: {
		timeout: 10_000,
		toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' }
	},
	snapshotPathTemplate: '{testDir}/snapshots/{arg}-{projectName}{ext}',
	reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		locale: 'nl-NL',
		timezoneId: 'Europe/Amsterdam',
		trace: 'retain-on-failure'
	},
	projects: [
		{
			name: 'desktop',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		},
		{
			name: 'mobile',
			use: {
				...devices['Pixel 7'],
				viewport: { width: 375, height: 812 },
				deviceScaleFactor: 2,
				isMobile: true,
				hasTouch: true
			}
		}
	],
	webServer: {
		// The API's address is read when the page is served (`$env/dynamic/public`), so the
		// build and the preview both get it.
		command: `vite build && vite preview --strictPort --port ${PORT}`,
		env: { PUBLIC_CONCORDANS_API_BASE_URL: API_ORIGIN },
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !CI && process.env.E2E_REUSE === '1',
		timeout: 120_000,
		stdout: 'ignore'
	}
});
