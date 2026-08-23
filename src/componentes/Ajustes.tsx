import { useState } from 'react'
import { partesMes } from '../lib/fechas'
import { euros } from '../lib/formato'
import { renombrarPersona } from '../lib/mutaciones'
import type { Datos } from '../lib/tipos'
import { drive } from '../services/backend'
import { useStore } from '../store/useStore'
import { Aviso, Boton, Campo, ControlSegmentado, Entrada, FilaLista, Grupo, TituloGrande } from './ui'

/** `2 meses ajustados`, o `undefined` si no hay ninguno (para no pintar el detalle). */
function pluralMeses(cuantos: number, singular: string, plural: string): string | undefined {
  if (cuantos === 0) return undefined
  return `${cuantos} ${cuantos === 1 ? singular : plural}`
}

export function Ajustes({ datos }: Readonly<{ datos: Datos }>) {
  return (
    <div className="flex flex-col gap-6">
      <TituloGrande>Ajustes</TituloGrande>

      <Personas key={datos.personas.map((p) => p.nombre).join('|')} datos={datos} />
      <AccesoObjetivos datos={datos} />
      <Compartir datos={datos} />
      <Apariencia />
      <Sesion />
    </div>
  )
}

/**
 * El objetivo tiene pantalla propia: es la configuración más densa de la app
 * (regla anual más excepciones de cada mes) y no cabe como una tarjeta más.
 */
function AccesoObjetivos({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const abrirPestana = useStore((s) => s.abrirPestana)
  const { anio } = partesMes(mes)

  return (
    <Grupo titulo="Aportación">
      {datos.personas.map((persona) => {
        const objetivo = datos.anios[String(anio)]?.objetivos[persona.id]
        const excepciones = Object.keys(objetivo?.excepciones ?? {}).length
        return (
          <FilaLista
            key={persona.id}
            titulo={persona.nombre}
            detalle={pluralMeses(excepciones, 'mes con excepción', 'meses con excepción')}
            valor={`${euros(objetivo?.importeMensual ?? 0)} / mes`}
            onClick={() => abrirPestana('objetivos')}
          />
        )
      })}
      <FilaLista
        titulo={<span className="text-acento">Configurar objetivo de {anio}</span>}
        onClick={() => abrirPestana('objetivos')}
      />
    </Grupo>
  )
}

/**
 * Nombre de cada persona, alineado con su cuenta de Google en dos columnas,
 * y un único botón de guardar para todo el grupo: cambiar dos nombres no son
 * dos acciones. El campo de email es de solo lectura a propósito (ver pie).
 */
function Personas({ datos }: Readonly<{ datos: Datos }>) {
  const aplicar = useStore((s) => s.aplicar)
  const [nombres, setNombres] = useState<Record<string, string>>(() =>
    Object.fromEntries(datos.personas.map((p) => [p.id, p.nombre])),
  )

  const limpio = (id: string) => (nombres[id] ?? '').trim()
  const sinCambios = datos.personas.every((p) => limpio(p.id) === p.nombre || limpio(p.id) === '')

  const guardar = () => {
    aplicar((d) =>
      datos.personas.reduce((acc, p) => {
        const nuevo = limpio(p.id)
        return nuevo && nuevo !== p.nombre ? renombrarPersona(acc, p.id, nuevo) : acc
      }, d),
    )
  }

  return (
    <Grupo
      titulo="Personas"
      pie="El nombre puede cambiarse sin afectar al histórico. El email no se escribe a mano: se vincula solo la primera vez que esa persona entra con su cuenta de Google."
    >
      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        {datos.personas.map((persona) => (
          <div key={persona.id} className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Nombre">
              <Entrada
                value={nombres[persona.id] ?? persona.nombre}
                onChange={(e) => setNombres((n) => ({ ...n, [persona.id]: e.target.value }))}
              />
            </Campo>
            <Campo etiqueta="Google">
              <p className="truncate rounded-fila bg-relleno px-3.5 py-2.5 text-[15px] text-tenue">
                {persona.email || 'Sin vincular'}
              </p>
            </Campo>
          </div>
        ))}

        <Boton type="submit" variante="principal" disabled={sinCambios}>
          Guardar
        </Boton>
      </form>
    </Grupo>
  )
}

/**
 * Invitar a la otra persona. La app puede dar permisos sobre el archivo que ella
 * misma creó, así que no hace falta pasar por la web de Drive.
 */
function Compartir({ datos }: Readonly<{ datos: Datos }>) {
  const fileId = useStore((s) => s.fileId)
  const usuario = useStore((s) => s.usuario)
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'hecho' | 'error'>('inicial')
  const [detalle, setDetalle] = useState('')

  // Si ya hay alguien conectado, su email quedó vinculado solo al entrar.
  const otra = datos.personas.find((p) => p.email && p.email !== usuario?.email)

  if (otra) {
    return (
      <Grupo titulo="Compartido con">
        <FilaLista titulo={otra.nombre} detalle={otra.email} />
      </Grupo>
    )
  }

  const invitar = async () => {
    if (!fileId || !email) return
    try {
      setEstado('enviando')
      await drive.compartirCon(fileId, email)
      setEstado('hecho')
    } catch (error) {
      setEstado('error')
      setDetalle(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Grupo
      titulo="Invitar a tu pareja"
      pie="Le da acceso de edición al archivo. En cuanto entre con esta cuenta, el email queda vinculado a la segunda persona automáticamente."
    >
      <div className="flex flex-col gap-3 p-4">
        <Campo etiqueta="Email de Google">
          <Entrada
            type="email"
            value={email}
            placeholder="pareja@gmail.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>

        {estado === 'hecho' && <Aviso>Invitación enviada a {email}.</Aviso>}
        {estado === 'error' && <Aviso tono="error">{detalle}</Aviso>}

        <Boton
          variante="principal"
          disabled={!email || estado === 'enviando'}
          onClick={() => void invitar()}
        >
          {estado === 'enviando' ? 'Enviando…' : 'Invitar'}
        </Boton>
      </div>
    </Grupo>
  )
}

function Apariencia() {
  const tema = useStore((s) => s.tema)
  const setTema = useStore((s) => s.setTema)

  return (
    <Grupo titulo="Apariencia" pie="Se guarda solo en este dispositivo, no en el archivo compartido.">
      <div className="p-4">
        <ControlSegmentado
          valor={tema}
          onCambiar={setTema}
          opciones={[
            { valor: 'claro', etiqueta: 'Claro' },
            { valor: 'oscuro', etiqueta: 'Oscuro' },
          ]}
        />
      </div>
    </Grupo>
  )
}

function Sesion() {
  const salir = useStore((s) => s.salir)
  return (
    <Grupo>
      <FilaLista titulo="Cerrar sesión" destructivo onClick={salir} sinChevron />
    </Grupo>
  )
}
