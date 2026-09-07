import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de comportamiento de PWA (`pruebas-e2e/`). Sin `webServer`: cada
 * prueba levanta su propio servidor sobre `dist/` (ver `servidor.ts`), porque
 * la del aviso de versión nueva necesita cambiar lo que sirve a mitad de
 * prueba. Solo Chromium: es el motor de Android, y lo único que implementa lo
 * que aquí se comprueba (instalación, service worker, caché).
 */
export default defineConfig({
  testDir: './pruebas-e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 412, height: 892 } },
    },
  ],
})
