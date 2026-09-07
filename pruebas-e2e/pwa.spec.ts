import { expect, test } from '@playwright/test'
import { levantarServidor, type ServidorPruebas } from './servidor'

/**
 * Comportamiento de la app instalada, que es lo único que no se puede probar
 * con Vitest: hace falta un navegador de verdad, un origen seguro y un service
 * worker vivo.
 *
 * Cubre las tres cosas que se rompen en silencio y no se notan hasta que
 * alguien abre la app en el móvil:
 *   1. que siga cumpliendo los criterios de instalación (y que los iconos y
 *      capturas declarados en el manifiesto sean los que hay en disco),
 *   2. que arranque sin conexión,
 *   3. que no se quede cacheado nada que no sea del propio origen,
 *   4. que un despliegue nuevo se avise en vez de colarse por debajo.
 */

let servidor: ServidorPruebas

test.beforeAll(async () => {
  servidor = await levantarServidor()
})

test.afterAll(async () => {
  await servidor.cerrar()
})

interface Imagen {
  src: string
  sizes?: string
  type?: string
  purpose?: string
  form_factor?: string
}

interface Manifiesto {
  name?: string
  short_name?: string
  description?: string
  start_url?: string
  scope?: string
  display?: string
  prefer_related_applications?: boolean
  icons?: Imagen[]
  screenshots?: Imagen[]
}

/** Ancho y alto reales del PNG, leídos de su cabecera IHDR. */
function dimensionesPng(bytes: Uint8Array): { ancho: number; alto: number } {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { ancho: vista.getUint32(16), alto: vista.getUint32(20) }
}

async function leerManifiesto(): Promise<{ manifiesto: Manifiesto; url: string }> {
  const url = new URL('manifest.webmanifest', servidor.url).href
  const respuesta = await fetch(url)
  expect(respuesta.status).toBe(200)
  return { manifiesto: (await respuesta.json()) as Manifiesto, url }
}

test.describe('criterios de instalación', () => {
  test('el manifiesto tiene lo que Chrome exige para poder instalar', async () => {
    const { manifiesto, url } = await leerManifiesto()

    expect(manifiesto.name || manifiesto.short_name).toBeTruthy()
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifiesto.display)
    expect(manifiesto.prefer_related_applications).toBeFalsy()

    // `start_url` y `scope` son relativos: tienen que resolver dentro de la
    // carpeta donde se publica la app, o la app instalada abriría fuera.
    const base = new URL('./', url).href
    expect(new URL(manifiesto.start_url ?? '', url).href).toBe(base)
    expect(new URL(manifiesto.scope ?? '', url).href).toBe(base)

    // Iconos: 192 y 512, y al menos uno `maskable` para la máscara de Android.
    const tamanos = (manifiesto.icons ?? []).map((i) => i.sizes)
    expect(tamanos).toContain('192x192')
    expect(tamanos).toContain('512x512')
    expect((manifiesto.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true)
  })

  test('los iconos y capturas del manifiesto son los que hay en disco', async () => {
    const { manifiesto, url } = await leerManifiesto()

    for (const imagen of [...(manifiesto.icons ?? []), ...(manifiesto.screenshots ?? [])]) {
      const respuesta = await fetch(new URL(imagen.src, url))
      expect(respuesta.status, `falta ${imagen.src}`).toBe(200)

      const { ancho, alto } = dimensionesPng(new Uint8Array(await respuesta.arrayBuffer()))
      expect(`${String(ancho)}x${String(alto)}`, `${imagen.src} no mide lo que declara`).toBe(
        imagen.sizes,
      )
    }
  })

  test('las capturas cumplen lo que pide el diálogo de instalación de Android', async () => {
    const { manifiesto } = await leerManifiesto()
    const estrechas = (manifiesto.screenshots ?? []).filter((c) => c.form_factor === 'narrow')

    // Sin al menos una captura «narrow», Android enseña el diálogo pobre.
    expect(estrechas.length).toBeGreaterThan(0)
    expect(manifiesto.description?.length ?? 0).toBeLessThanOrEqual(324)

    const proporciones = new Set<string>()
    for (const captura of estrechas) {
      expect(captura.type).toMatch(/^image\/(png|jpeg)$/)

      const [ancho = 0, alto = 0] = (captura.sizes ?? '').split('x').map(Number)
      expect(Math.min(ancho, alto)).toBeGreaterThanOrEqual(320)
      expect(Math.max(ancho, alto)).toBeLessThanOrEqual(3840)
      // Chrome rechaza las capturas muy alargadas.
      expect(Math.max(ancho, alto) / Math.min(ancho, alto)).toBeLessThanOrEqual(2.3)
      proporciones.add((ancho / alto).toFixed(3))
    }

    // Todas las del mismo formato tienen que compartir proporción.
    expect(proporciones.size).toBe(1)
  })
})

test.describe('service worker', () => {
  test('toma el control y la app arranca sin conexión', async ({ page, context }) => {
    await page.goto(servidor.url)
    await page.evaluate(() => navigator.serviceWorker.ready)

    await page.reload()
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

    await context.setOffline(true)
    await page.reload()

    // Sin red y aun así la app entera, servida de la caché: título de la app
    // (no el del error del navegador) y React montado con algo pintado.
    await expect(page).toHaveTitle('Cuentas de pareja')
    await expect(page.locator('#root')).not.toBeEmpty()

    await context.setOffline(false)
  })

  test('en la caché solo entra el armazón del propio origen', async ({ page }) => {
    await page.goto(servidor.url)
    await page.evaluate(() => navigator.serviceWorker.ready)

    const guardado = await page.evaluate(async () => {
      const nombres = await caches.keys()
      const listas = await Promise.all(
        nombres.map(async (nombre) => {
          const cache = await caches.open(nombre)
          return (await cache.keys()).map((peticion) => peticion.url)
        }),
      )
      return listas.flat()
    })

    expect(guardado.length).toBeGreaterThan(0)
    for (const url of guardado) {
      expect(new URL(url).origin, `${url} no es del propio origen`).toBe(
        new URL(servidor.url).origin,
      )
    }
    expect(guardado.some((url) => url.endsWith('index.html'))).toBe(true)
  })

  test('un despliegue nuevo se avisa y se aplica al aceptar', async ({ page }) => {
    await page.goto(servidor.url)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()

    // Marca para comprobar luego que la página se ha recargado de verdad.
    await page.evaluate(() => {
      ;(window as unknown as { marca?: boolean }).marca = true
    })

    // Un despliegue: el `sw.js` que sirve el servidor ya no es el mismo.
    servidor.parcheSw = `// versión nueva ${String(Date.now())}`
    await page.evaluate(async () => {
      const registro = await navigator.serviceWorker.getRegistration()
      await registro?.update()
    })

    const aviso = page.getByText('Hay una versión nueva.')
    await expect(aviso).toBeVisible()

    await page.getByRole('button', { name: 'Recargar' }).click()

    await expect(aviso).toBeHidden()
    expect(
      await page.evaluate(() => (window as unknown as { marca?: boolean }).marca),
    ).toBeUndefined()
  })
})
