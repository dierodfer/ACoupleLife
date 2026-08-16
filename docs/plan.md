# Plan de la aplicación — Cuentas de pareja

## 1. Objetivo

Crear una aplicación sencilla para que una pareja pueda saber cuánto dinero debe transferir cada persona cada mes para alcanzar su objetivo de aportación.

La aplicación se centra exclusivamente en el seguimiento de las aportaciones y en calcular la transferencia pendiente.

---

## 2. Personas

- Los nombres de los dos miembros de la pareja son **editables** desde la aplicación (no están hardcodeados).
- Cada persona queda identificada internamente por un `id` estable, independiente del nombre visible, para que renombrar no rompa el histórico.
- Cada persona se asocia a una cuenta de Google (email) para la autenticación y el acceso al archivo compartido.
- No existe ninguna categoría de gasto conjunto: **todo gasto pertenece a una de las dos personas**. En el resumen, "Pareja" no es más que el nombre editable de la segunda persona.

---

## 3. Objetivo de aportación

- El objetivo se define **a nivel mensual**, dentro de la configuración de cada año, como una regla única (`importeMensual`) que aplica a los doce meses.
- Se pueden definir **excepciones puntuales** para meses concretos que rompan esa regla (por ejemplo, un mes con objetivo reducido).
- No se guarda ningún indicador de "aplicar todo el año": la regla ya aplica a todo el año por definición, y las excepciones son lo que la rompe. Un interruptor así solo dejaría indefinido el objetivo de los meses restantes cuando estuviera desactivado.
- Al crear el nodo de un año nuevo se arrastra como punto de partida el `importeMensual` del año anterior, sin sus excepciones.
- La aplicación mostrará siempre:
  - Objetivo del año actual (mes a mes).
  - Objetivo del año anterior.
  - Evolución de la aportación respecto al año anterior.

### Cambiar el objetivo de un año en curso

Al guardar un nuevo `importeMensual` de un año en curso, la aplicación **pregunta** qué alcance tiene el cambio:

- **Solo desde este mes:** antes de cambiar la regla, congela el objetivo efectivo de los meses ya pasados como excepciones. El histórico ya vivido no se reescribe solo.
- **Todo el año:** cambia la regla y con ella todos los meses sin excepción, incluidos los ya pasados.

Si el año es pasado, o si estamos en enero, no hay meses vividos que proteger y el cambio se aplica directamente a todo el año sin preguntar.

---

## 4. Gestión mensual

Cada mes se podrá consultar:

- Objetivo mensual.
- Gastos contabilizados (puntuales + recurrentes aplicables ese mes).
- Efectivo aportado.
- Transferencias realizadas.
- Cantidad pendiente de transferencia.

La cantidad pendiente se calcula automáticamente, por persona:

```
Objetivo − gastos − efectivo − transferencias = pendiente
```

**Los meses son independientes.** Si un mes se aporta de más, el pendiente sale negativo y se muestra como excedente de ese mes, pero **no se arrastra** al mes siguiente ni lo compensa. El resumen anual sí muestra el acumulado, como información.

---

## 5. Aportaciones

Las aportaciones podrán realizarse mediante:

- Gastos
- Transferencias
- Efectivo

Cada aportación queda asociada a uno de los miembros de la pareja.

---

## 6. Gastos

### 6.1 Gastos puntuales

Se registran indicando:

- Importe.
- Persona que lo ha realizado.
- Fecha.
- Concepto (opcional).

Se descuentan automáticamente del objetivo del mes correspondiente. El mes y el año se derivan siempre de la **fecha del gasto**, no del año que el usuario tenga abierto en pantalla.

### 6.2 Gastos recurrentes

- Se definen por un **rango de meses** (`desde` – `hasta`, con `hasta: null` para "sin fin definido"), en formato `AAAA-MM`.
- No se materializan como filas mensuales: se calculan al vuelo a partir del rango y los ajustes, manteniendo el archivo de datos ligero.
- Si en un mes concreto el importe real difiere del recurrente, se registra un **override** para ese mes: `overrides: { "2026-08": 45 }`. Un override a `0` excluye el mes por completo.
- El override es **una sola escritura**, así que es imposible contabilizar dos veces el mismo gasto. Sustituye al mecanismo de "registrar un gasto puntual y además añadir el mes a una lista de excluidos", que dependía de que el usuario hiciera dos acciones sin olvidarse de ninguna.

---

## 7. Efectivo

- Cada persona puede configurar una cantidad de efectivo mensual, también por rango de meses en formato `AAAA-MM` (por si deja de aportar en efectivo a mitad de año).
- Esta cantidad se considera automáticamente aportada cada mes dentro de su rango y se descuenta del importe pendiente de transferencia.

---

## 8. Transferencias

- Representan el dinero que todavía falta para alcanzar el objetivo.
- La aplicación calcula automáticamente cuánto debe transferir cada persona.
- Las transferencias realizadas se registran **a mano**: no hay integración bancaria de ningún tipo.
- El dato principal de toda la aplicación es:

  > **Transferencia pendiente**

---

## 9. Resumen mensual

La pantalla principal muestra de forma clara la situación del mes, por persona y en total:

**Diego**
> Objetivo: 1.000 € · Gastos: 400 € · Efectivo: 100 € · Transferir: 500 €

**Pareja**
> Objetivo: 1.000 € · Gastos: 350 € · Efectivo: 0 € · Transferir: 650 €

**Total**
> 1.150 € por transferir

---

## 10. Resumen anual

Se puede consultar el estado global del año:

- Objetivo anual (suma de los objetivos mensuales).
- Total aportado.
- Total pendiente.
- Desglose por meses.
- Comparación directa con el año anterior.

---

## 11. Histórico

- La aplicación conserva los datos de todos los años anteriores, **sin restricciones de edición**: cualquier año pasado puede seguir modificándose (objetivos, gastos, efectivo, transferencias).
- Se puede consultar en cualquier momento:
  - Objetivos, gastos, efectivo, transferencias.
  - Aportaciones totales y cantidades pendientes.
- El año anterior tiene un acceso directo desde la vista del año actual.

---

## 12. Almacenamiento

- La información se almacena en **Google Drive**, en un archivo propio de la aplicación, compartido entre los dos miembros de la pareja.
- No se utiliza base de datos ni backend propio.
- Toda la información vive en un único archivo JSON compartido, permitiendo que ambos usuarios trabajen sobre los mismos datos.
- Los importes se manejan en **euros con dos decimales**, redondeando a la centésima en cada cálculo para no arrastrar errores de coma flotante.
- El guardado es automático, con un retardo de dos segundos tras el último cambio, y la interfaz indica en todo momento si queda algo por subir.

### Control de concurrencia

Drive API v3 **no expone `etag`** (se eliminó del recurso `files`). El equivalente es el campo **`version`**, un entero que incrementa en cada modificación.

Antes de escribir, la aplicación relee la `version` remota y la compara con la que tenía. Si no coincide, avisa en lugar de sobrescribir en silencio, y ofrece recargar (perdiendo los cambios locales) o guardar encima a propósito.

Es importante entender que esto es **detección, no bloqueo**: la API no ofrece escritura condicional atómica, así que existe una ventana mínima entre la comprobación y la escritura. Para dos usuarios es un riesgo asumible.

### Esquema de datos

```json
{
  "version": 1,
  "actualizadoEn": "2026-08-17T10:00:00Z",
  "actualizadoPor": "diego@gmail.com",
  "personas": [
    { "id": "p1", "nombre": "Diego", "email": "diego@gmail.com" },
    { "id": "p2", "nombre": "Ana", "email": "ana@gmail.com" }
  ],
  "recurrentes": [
    { "id": "r1", "personaId": "p1", "importe": 60, "concepto": "Internet",
      "desde": "2026-01", "hasta": null,
      "overrides": { "2026-07": 0, "2026-08": 45 } }
  ],
  "efectivo": [
    { "id": "e1", "personaId": "p1", "importe": 100,
      "desde": "2026-01", "hasta": null }
  ],
  "anios": {
    "2026": {
      "objetivos": {
        "p1": { "importeMensual": 1000, "excepciones": { "8": 500 } }
      },
      "gastos": [
        { "id": "g1", "personaId": "p1", "importe": 400,
          "fecha": "2026-08-03", "concepto": "Compra" }
      ],
      "transferencias": [
        { "id": "t1", "personaId": "p1", "importe": 500,
          "fecha": "2026-08-28" }
      ]
    }
  }
}
```

Decisiones del esquema:

- **`recurrentes` y `efectivo` viven fuera del nodo de año**, con rangos en `AAAA-MM`. Un recurrente sin fin sigue aplicando en 2027 sin tener que duplicarlo ni mantenerlo sincronizado en cada año nuevo.
- **Claves sin `ñ` ni acentos** (`anios`), para que mapeen limpio a tipos de TypeScript.
- **La `fecha` manda sobre la clave del año**: un gasto del 31 de diciembre se guarda en el nodo de ese año, aunque en pantalla se esté mirando el siguiente.
- El archivo es editable a mano, así que al leerlo **todo se valida y se normaliza**: campos que falten, tipos inesperados o importes escritos con coma decimal no rompen la aplicación.

---

## 13. Frontend

La aplicación será una web responsive, pensada principalmente para utilizarse desde móvil, aunque también funcionará en escritorio.

Tecnologías previstas:

- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand

Toda la lógica de cálculo se ejecuta en el propio frontend, en **módulos puros y sin estado** (`src/lib/`), separados de los componentes y cubiertos por tests de Vitest. Es el corazón de la aplicación: si el cálculo está mal, todo lo demás sobra.

---

## 14. Hosting

La aplicación será completamente estática y estará alojada en GitHub Pages.

Flujo de publicación:

```
GitHub → GitHub Actions → Tests → Build → GitHub Pages
```

No hay servidores propios ni backend. El coste de infraestructura se mantiene prácticamente en 0 € para el uso previsto.

---

## 15. Autenticación y permisos de Drive

- La aplicación usa **Google Login** para identificar a los miembros de la pareja.
- Scope de Drive: **`drive.file`** (acceso solo a archivos/carpetas creados por la propia app), no el scope completo `drive`, ya que este último exige pasar el proceso de verificación de Google, innecesario para una app de dos usuarios.
- **Sin backend solo cabe el token flow** de Google Identity Services: devuelve un access token de aproximadamente una hora y **no hay refresh token**. La aplicación lo renueva en silencio cuando le quedan menos de cinco minutos y nunca guarda el token en disco.
- Implicación de `drive.file`: el segundo usuario no ve automáticamente el archivo creado por el primero, aunque esté compartido en Drive. La primera vez debe conectarlo explícitamente mediante el selector de Google (Google Picker); a partir de ahí la app conserva el permiso.
- **La app sí puede gestionar los permisos del archivo que ella misma creó**, así que el primer usuario puede invitar al segundo por email desde la propia aplicación, sin pasar por la web de Drive.
- La UI de onboarding contempla dos flujos: **"Crear archivo nuevo"** (primer usuario) y **"Conectar archivo existente"** (segundo usuario).
- El origen de GitHub Pages debe figurar en los orígenes autorizados de JavaScript del cliente de OAuth.

---

## 16. Principio de la aplicación

La aplicación debe girar alrededor de una única pregunta:

> **¿Cuánto tengo que transferir este mes?**

Todo lo demás —objetivos, gastos, efectivo, histórico y aportaciones— existe únicamente para calcular esa cifra de la forma más sencilla posible.
