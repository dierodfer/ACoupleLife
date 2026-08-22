import { useState } from 'react'
import { objetivoDelMes } from '../lib/calculo'
import { NOMBRES_MES, mesActual, mesKey, partesMes } from '../lib/fechas'
import { euros, leeImporte } from '../lib/formato'
import { cambiarObjetivoMensual, fijarExcepcionObjetivo } from '../lib/mutaciones'
import type { Datos, Persona, PersonaId } from '../lib/tipos'
import { ETIQUETAS_PESTANA, useStore } from '../store/useStore'
import { IconoDeshacer } from './Iconos'
import { NavegadorAnio } from './RejillaMeses'
import {
  Boton,
  CabeceraVolver,
  ControlSegmentado,
  Entrada,
  Grupo,
  Info,
  TituloGrande,
} from './ui'

/**
 * Configuración del objetivo de aportación: una regla general para todo el año
 * y las excepciones que la rompen. El mes a mes se recorre persona a persona
 * porque en un móvil no caben dos columnas de importes editables.
 */
export function PantallaObjetivos({ datos }: { datos: Datos }) {
  const mes = useStore((s) => s.mes)
  const volver = useStore((s) => s.volver)
  const destino = useStore((s) => s.historial[s.historial.length - 1] ?? 'mes')
  const [anio, setAnio] = useState(partesMes(mes).anio)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <CabeceraVolver destino={ETIQUETAS_PESTANA[destino]} onVolver={volver} />
        <TituloGrande
          accion={
            <Info>
              Cuánto tiene que aportar cada persona. De aquí se descuentan los gastos, el
              efectivo y las transferencias para saber lo que queda por transferir.
            </Info>
          }
        >
          Objetivo
        </TituloGrande>
      </div>

      <div className="rounded-tarjeta bg-superficie px-3 py-2">
        <NavegadorAnio anio={anio} onCambiar={setAnio} />
      </div>

      <ReglaGeneral datos={datos} anio={anio} />
      <MesAMes datos={datos} anio={anio} />
    </div>
  )
}

/** La regla que aplica a los doce meses del año. */
function ReglaGeneral({ datos, anio }: { datos: Datos; anio: number }) {
  return (
    <Grupo
      titulo="Regla general"
      pie={`Se aplica a los doce meses de ${anio}. Al escribir un importe se aplica desde el mes en curso y los meses ya pasados se quedan como estaban; «Aplicar a todo el año» los cambia también.`}
    >
      {datos.personas.map((persona) => {
        const mensual = datos.anios[String(anio)]?.objetivos[persona.id]?.importeMensual ?? 0
        return (
          <ObjetivoDePersona
            // Al cambiar el importe guardado, se rehace el campo con el valor nuevo.
            key={`${persona.id}-${mensual}`}
            persona={persona}
            anio={anio}
            mensual={mensual}
          />
        )
      })}
    </Grupo>
  )
}

/**
 * Importe mensual de una persona. Escribirlo lo aplica respetando los meses ya
 * vividos; el botón lo impone a los doce, incluidos los pasados.
 */
function ObjetivoDePersona({
  persona,
  anio,
  mensual,
}: {
  persona: Persona
  anio: number
  mensual: number
}) {
  const aplicar = useStore((s) => s.aplicar)
  const [valor, setValor] = useState(String(mensual))

  const anioEnCurso = partesMes(mesActual()).anio === anio
  const mesEnCurso = partesMes(mesActual()).mes
  // En un año pasado, o en enero, no hay meses vividos que conservar.
  const hayHistoricoQueProteger = anioEnCurso && mesEnCurso > 1

  const guardar = (todoElAnio: boolean) => {
    aplicar((d) =>
      cambiarObjetivoMensual(
        d,
        anio,
        persona.id,
        leeImporte(valor),
        todoElAnio || !hayHistoricoQueProteger ? 'todoElAnio' : 'desdeEsteMes',
        mesEnCurso,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t border-borde p-4 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{persona.nombre}</span>
        <span className="flex items-center gap-2">
          <Entrada
            type="text"
            inputMode="decimal"
            aria-label={`Objetivo mensual de ${persona.nombre}`}
            className="w-28 py-1.5 text-right"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => {
              if (leeImporte(valor) !== mensual) guardar(false)
            }}
          />
          <span className="text-[13px] text-tenue">/ mes</span>
        </span>
      </div>

      <Boton
        variante="suave"
        disabled={!hayHistoricoQueProteger}
        title={
          hayHistoricoQueProteger
            ? `Aplicar también a los meses ya pasados de ${anio}`
            : `No hay meses pasados en ${anio} que conservar`
        }
        onClick={() => guardar(true)}
      >
        Aplicar a todo el año
      </Boton>
    </div>
  )
}

/**
 * Los doce meses de una persona. Cada fila muestra el objetivo efectivo; al
 * cambiarlo se crea una excepción, y el botón de deshacer la retira.
 */
function MesAMes({ datos, anio }: { datos: Datos; anio: number }) {
  const aplicar = useStore((s) => s.aplicar)
  const verMes = useStore((s) => s.verMes)
  const [personaId, setPersonaId] = useState<PersonaId>(datos.personas[0]?.id ?? '')

  const hoy = mesActual()
  const persona = datos.personas.find((p) => p.id === personaId) ?? datos.personas[0]
  const excepciones = datos.anios[String(anio)]?.objetivos[personaId]?.excepciones ?? {}

  const total = datos.personas.reduce(
    (suma, p) => suma + (datos.anios[String(anio)]?.objetivos[p.id]?.importeMensual ?? 0) * 12,
    0,
  )

  if (!persona) return null

  return (
    <div className="flex flex-col gap-3">
      {datos.personas.length > 1 && (
        <ControlSegmentado
          valor={personaId}
          onCambiar={setPersonaId}
          opciones={datos.personas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
        />
      )}

      <Grupo
        titulo={`Mes a mes · ${persona.nombre}`}
        pie={`Un importe distinto al de la regla queda marcado en azul. El objetivo conjunto de ${anio} según la regla general es ${euros(total)}.`}
      >
        {NOMBRES_MES.map((nombre, i) => {
          const clave = mesKey(anio, i + 1)
          const efectivo = objetivoDelMes(datos, personaId, clave)
          const esExcepcion = excepciones[String(i + 1)] !== undefined

          return (
            <div
              key={clave}
              className="relative flex min-h-[44px] items-center gap-3 px-4 py-2 after:absolute after:left-4 after:right-0 after:top-0 after:h-px after:bg-borde first:after:hidden"
            >
              <button
                type="button"
                title="Abrir este mes"
                onClick={() => verMes(clave)}
                className={`flex-1 text-left active:opacity-50 ${
                  clave === hoy ? 'font-semibold text-acento' : ''
                }`}
              >
                {nombre}
              </button>

              <Entrada
                type="text"
                inputMode="decimal"
                aria-label={`Objetivo de ${persona.nombre} en ${nombre}`}
                defaultValue={efectivo}
                key={`${personaId}-${clave}-${efectivo}`}
                className={`w-28 py-1.5 text-right ${
                  esExcepcion ? 'border-acento text-acento' : 'text-tenue'
                }`}
                onBlur={(e) => {
                  const importe = leeImporte(e.target.value)
                  if (importe === efectivo) return
                  aplicar((d) => fijarExcepcionObjetivo(d, anio, personaId, i + 1, importe))
                }}
              />

              <button
                type="button"
                title="Volver a la regla general"
                aria-label={`Quitar la excepción de ${persona.nombre} en ${nombre}`}
                disabled={!esExcepcion}
                onClick={() => aplicar((d) => fijarExcepcionObjetivo(d, anio, personaId, i + 1, null))}
                className="rounded-full p-1 text-sutil transition active:text-acento disabled:opacity-25"
              >
                <IconoDeshacer className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </Grupo>
    </div>
  )
}
