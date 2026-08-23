/**
 * Tipos mínimos de los scripts de Google que cargamos a mano (Identity Services
 * y Picker). Solo declaramos lo que usamos, no la API entera.
 */

export interface RespuestaToken {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

export interface ClienteToken {
  requestAccessToken(opciones?: { prompt?: '' | 'none' | 'consent' | 'select_account' }): void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (respuesta: RespuestaToken) => void
            error_callback?: (error: { type?: string; message?: string }) => void
          }): ClienteToken
          revoke(token: string, hecho?: () => void): void
        }
      }
      picker?: {
        PickerBuilder: new () => PickerBuilder
        DocsView: new (viewId?: string) => DocsView
        ViewId: { DOCS: string }
        Action: { PICKED: string; CANCEL: string }
        Response: { ACTION: string; DOCUMENTS: string }
        Document: { ID: string; NAME: string }
      }
    }
    gapi?: {
      load(biblioteca: string, callback: () => void): void
    }
  }
}

export interface DocsView {
  setMimeTypes(tipos: string): DocsView
  setOwnedByMe(propio: boolean): DocsView
  /** No está en todas las versiones del Picker: llamar siempre con `?.`. */
  setLabel?(etiqueta: string): DocsView
}

export interface PickerBuilder {
  addView(vista: DocsView): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(clave: string): PickerBuilder
  setTitle(titulo: string): PickerBuilder
  setCallback(callback: (datos: Record<string, unknown>) => void): PickerBuilder
  build(): { setVisible(visible: boolean): void }
}
