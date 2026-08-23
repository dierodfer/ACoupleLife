import { useState } from 'react'
import { objetivoDelMes } from '../lib/calculo'
import { NOMBRES_MES, mesActual, mesKey, partesMes } from '../lib/fechas'
import { euros, importeEditable, leeImporte } from '../lib/formato'
import { cambiarObjetivoMensual, fijarExcepcionObjetivo } from '../lib/mutaciones'
import type { Datos, Persona, PersonaId } from '../lib/tipos'
import { ETIQUETAS_PESTANA, useStore } from '../store/useStore'
import { IconoDeshacer } from './Iconos'
import { NavegadorAnio } from './RejillaMeses'
import {
  Boton,
  CabeceraVolver,
  ControlSegmentado,
  EntradaEuros,
  Grupo,
  Info,
  TituloGrande,
} from './ui'

/**
 * Configuración del objetivo de aportación: una regla general para todo el año
 * y las excepciones que la rompen. El mes a mes se recorre persona a persona
 * porque en un móvil no caben dos columnas de importes editables.
 */
export function PantallaObjetivos({ datos }: Readonly<{ datos: Datos }>) {
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
function ReglaGeneral({ datos, anio }: Readonly<{ datos: Datos; anio: number }>) {
  return (
    <Grupo
      titulo="Regla general"
      pie="«Desde este mes» conserva como estaban los meses ya pasados; «Todo el año» los reescribe también."
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
 * Importe mensual de una persona, con las dos formas de aplicarlo explícitas.
 * Nada se guarda al salir del campo: el cambio necesita que se elija alcance,
 * porque reescribir meses ya vividos no es lo mismo que fijar los que vienen.
 */
function ObjetivoDePersona({
  persona,
  anio,
  mensual,
}: Readonly<{
  persona: Persona
  anio: number
  mensual: number
}>) {
  const aplicar = useStore((s) => s.aplicar)
  const [valor, setValor] = useState(importeEditable(mensual))

  const anioEnCurso = partesMes(mesActual()).anio === anio
  const mesEnCurso = partesMes(mesActual()).mes
  // En un año pasado, o en enero, no hay meses vividos que conservar: los dos
  // caminos harían lo mismo, así que solo se ofrece uno.
  const hayHistoricoQueProteger = anioEnCurso && mesEnCurso > 1
  const sinCambios = leeImporte(valor) === mensual

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
          <EntradaEuros
            aria-label={`Objetivo mensual de ${persona.nombre}`}
            className="w-32 py-2 text-right"
            valor={valor}
            onCambiar={setValor}
          />
          <span className="shrink-0 text-[13px] text-tenue">/ mes</span>
        </span>
      </div>

      {hayHistoricoQueProteger ? (
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="principal" disabled={sinCambios} onClick={() => guardar(false)}>
            Desde este mes
          </Boton>
          <Boton variante="suave" disabled={sinCambios} onClick={() => guardar(true)}>
            Todo el año
          </Boton>
        </div>
      ) : (
        <Boton variante="principal" disabled={sinCambios} onClick={() => guardar(true)}>
          Guardar para todo {anio}
        </Boton>
      )}
    </div>
  )
}

/**
 * Los doce meses de una persona. Cada fila muestra el objetivo efectivo; al
 * cambiarlo se crea una excepción, y el botón de deshacer la retira.
 */
function MesAMes({ datos, anio }: Readonly<{ datos: Datos; anio: number }>) {
  const [personaId, setPersonaId] = useState<PersonaId>(datos.personas[0]?.id ?? '')

  const persona = datos.personas.find((p) => p.id === personaId) ?? datos.personas[0]

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
        {NOMBRES_MES.map((nombre, i) => (
          <MesDelObjetivo
            key={mesKey(anio, i + 1)}
            datos={datos}
            anio={anio}
            personaId={personaId}
            nombrePersona={persona.nombre}
            nombreMes={nombre}
            mesDelAnio={i + 1}
          />
        ))}
      </Grupo>
    </div>
  )
}

/** Una fila del mes a mes: nombre del mes, importe editable y deshacer. */
function MesDelObjetivo({
  datos,
  anio,
  personaId,
  nombrePersona,
  nombreMes,
  mesDelAnio,
}: Readonly<{
  datos: Datos
  anio: number
  personaId: PersonaId
  nombrePersona: string
  nombreMes: string
  mesDelAnio: number
}>) {
  const aplicar = useStore((s) => s.aplicar)
  const verMes = useStore((s) => s.verMes)

  const clave = mesKey(anio, mesDelAnio)
  const efectivo = objetivoDelMes(datos, personaId, clave)
  const esExcepcion =
    (datos.anios[String(anio)]?.objetivos[personaId]?.excepciones ?? {})[String(mesDelAnio)] !==
    undefined

  const [valor, setValor] = useState(importeEditable(efectivo))
  // Si el importe guardado cambia por otra vía (la regla general), se recoloca.
  const [ultimoEfectivo, setUltimoEfectivo] = useState(efectivo)
  if (ultimoEfectivo !== efectivo) {
    setUltimoEfectivo(efectivo)
    setValor(importeEditable(efectivo))
  }

  return (
    <div className="relative flex min-h-[52px] items-center gap-2 px-4 py-2 after:absolute after:left-4 after:right-0 after:top-0 after:h-px after:bg-borde first:after:hidden">
      <button
        type="button"
        title="Abrir este mes"
        onClick={() => verMes(clave)}
        className={`flex-1 text-left active:opacity-50 ${
          clave === mesActual() ? 'font-semibold text-acento' : ''
        }`}
      >
        {nombreMes}
      </button>

      <EntradaEuros
        aria-label={`Objetivo de ${nombrePersona} en ${nombreMes}`}
        valor={valor}
        onCambiar={setValor}
        className={`w-32 py-2 text-right ${esExcepcion ? 'border-acento text-acento' : 'text-tenue'}`}
        onBlur={() => {
          const importe = leeImporte(valor)
          if (importe === efectivo) return
          aplicar((d) => fijarExcepcionObjetivo(d, anio, personaId, mesDelAnio, importe))
        }}
      />

      <button
        type="button"
        title="Volver a la regla general"
        aria-label={`Quitar la excepción de ${nombrePersona} en ${nombreMes}`}
        disabled={!esExcepcion}
        onClick={() => aplicar((d) => fijarExcepcionObjetivo(d, anio, personaId, mesDelAnio, null))}
        className="shrink-0 rounded-full p-1 text-sutil transition active:text-acento disabled:opacity-25"
      >
        <IconoDeshacer className="h-4 w-4" />
      </button>
    </div>
  )
}
