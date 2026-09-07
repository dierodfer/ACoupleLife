import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de extremo a extremo del comportamiento de PWA (`pruebas-e2e/`).
 *
 * No hay `webServer` aquí a propósito: cada prueba levanta su propio servidor
 * estático sobre `dist/`, porque la del aviso de versión nueva necesita cambiar
 * lo que sirve a mitad de la prueba (ver `servidor.ts`).
 *
 * Solo Chromium: lo que se comprueba —instalación, service worker, caché— es
 * justo lo que solo implementa Chromium, que además es el navegador de Android,
 * el objetivo de todo esto.
 */
export default defineConfig({
  testDir: './pruebas-e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // En CI, anotaciones en el propio PR y además el informe HTML, que se sube
  // como artefacto cuando algo falla.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    // El service worker solo existe si el navegador lo deja registrarse.
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'chromium',
      // Ventana de móvil, que es donde se instala la app.
      use: { ...devices['Desktop Chrome'], viewport: { width: 412, height: 892 } },
    },
  ],
})
