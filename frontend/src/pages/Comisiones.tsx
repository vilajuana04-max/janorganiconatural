import { useState } from 'react'
import {
  Calculator, Users, ClipboardList, Settings2,
  TableProperties, ChevronDown, ChevronUp, Plus, Check, X, Trash2,
  Briefcase, History, Save,
} from 'lucide-react'

const NAVY  = '#3D6B64'
const CORAL = '#C4875A'

// ── Types ─────────────────────────────────────────────────────────
type Turno = '6hs' | '8hs'

type Vendedor = {
  id: number
  nombre: string
  sucursal: 'luro' | 'independencia'
  turno: Turno
  activo: boolean
}

type RegistroQ = {
  id: number
  vendedorId: number
  quincena: string   // "Mayo 2026 - 1ra"
  ventas: number
  comision: number
  pct: number
  escala: number
  pagada: boolean
}

type Reunion = {
  id: number
  vendedorId: number
  quincena: string
  checks: boolean[]
  notas: string
  realizada: boolean
}

// Planilla de descripcion de puesto
type Puesto = {
  id:                string
  nombre:            string
  responsabilidades: string
  criterios:         string
  evaluacion:        string
}

const PUESTOS_DEFAULT: Puesto[] = [
  { id: 'vend1',    nombre: 'Ariel Viejo',   responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'vend2',    nombre: 'Pato Scatizzi', responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'vend3',    nombre: 'Valentina',      responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'caja',     nombre: 'Cecilia Vila',   responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'taller1',  nombre: 'Facundo Lalli',  responsabilidades: '', criterios: '', evaluacion: '' },
  { id: 'taller2',  nombre: 'Marcelo Viejo',  responsabilidades: '', criterios: '', evaluacion: '' },
]

type Config = {
  // 6hs
  s6_e1_desde: number; s6_e1_pct: number
  s6_e2_desde: number; s6_e2_pct: number
  s6_e3_desde: number; s6_e3_pct: number
  // 8hs
  s8_e1_desde: number; s8_e1_pct: number
  s8_e2_desde: number; s8_e2_pct: number
  s8_e3_desde: number; s8_e3_pct: number
}

const CHECKLIST_ITEMS = [
  'Revision de ventas de la quincena',
  'Logros destacados del periodo',
  'Puntos a mejorar',
  'Objetivos para la proxima quincena',
  'Consultas del vendedor',
]

const DEFAULT_CONFIG: Config = {
  s6_e1_desde: 4_000_000, s6_e1_pct: 0.5,
  s6_e2_desde: 5_000_000, s6_e2_pct: 1.0,
  s6_e3_desde: 7_000_000, s6_e3_pct: 1.5,
  s8_e1_desde: 6_000_000, s8_e1_pct: 0.5,
  s8_e2_desde: 8_000_000, s8_e2_pct: 1.0,
  s8_e3_desde: 11_000_000, s8_e3_pct: 1.5,
}

const DEFAULT_VENDEDORES: Vendedor[] = [
  { id: 1, nombre: 'Cecilia Vila',    sucursal: 'luro', turno: '6hs', activo: true },
  { id: 2, nombre: 'Ariel Viejo',     sucursal: 'luro', turno: '8hs', activo: true },
  { id: 3, nombre: 'Pato Scatizzi',   sucursal: 'luro', turno: '6hs', activo: true },
  { id: 4, nombre: 'Valentina',       sucursal: 'luro', turno: '6hs', activo: true },
  { id: 5, nombre: 'Facundo Lalli',   sucursal: 'luro', turno: '8hs', activo: true },
  { id: 6, nombre: 'Marcelo Viejo',   sucursal: 'luro', turno: '8hs', activo: true },
]

// ── Helpers ───────────────────────────────────────────────────────
const fmt  = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(1) + 'M'

function getEscalas(turno: Turno, cfg: Config) {
  return turno === '6hs'
    ? [
        { desde: cfg.s6_e1_desde, pct: cfg.s6_e1_pct },
        { desde: cfg.s6_e2_desde, pct: cfg.s6_e2_pct },
        { desde: cfg.s6_e3_desde, pct: cfg.s6_e3_pct },
      ]
    : [
        { desde: cfg.s8_e1_desde, pct: cfg.s8_e1_pct },
        { desde: cfg.s8_e2_desde, pct: cfg.s8_e2_pct },
        { desde: cfg.s8_e3_desde, pct: cfg.s8_e3_pct },
      ]
}

function calcComision(ventas: number, turno: Turno, cfg: Config) {
  const [e1, e2, e3] = getEscalas(turno, cfg)
  if (ventas >= e3.desde) return { comision: ventas * e3.pct / 100, pct: e3.pct, escala: 3 }
  if (ventas >= e2.desde) return { comision: ventas * e2.pct / 100, pct: e2.pct, escala: 2 }
  if (ventas >= e1.desde) return { comision: ventas * e1.pct / 100, pct: e1.pct, escala: 1 }
  return { comision: 0, pct: 0, escala: 0 }
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function quincenaLabel() {
  const now = new Date()
  const q   = now.getDate() <= 15 ? '1ra' : '2da'
  return `${MESES[now.getMonth()]} ${now.getFullYear()} - ${q}`
}

// ── localStorage ──────────────────────────────────────────────────
function useLocalState<T>(key: string, def: T) {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def }
    catch { return def }
  })
  function set(v: T) { setVal(v); localStorage.setItem(key, JSON.stringify(v)) }
  return [val, set] as const
}

// ── Tab nav ───────────────────────────────────────────────────────
type Tab = 'calculadora' | 'registro' | 'vendedores' | 'reuniones' | 'puestos' | 'config'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'calculadora', label: 'Calculadora', icon: <Calculator size={13}/> },
  { id: 'registro',    label: 'Registro',    icon: <TableProperties size={13}/> },
  { id: 'vendedores',  label: 'Vendedores',  icon: <Users size={13}/> },
  { id: 'reuniones',   label: 'Reuniones',   icon: <ClipboardList size={13}/> },
  { id: 'puestos',     label: 'Puestos',     icon: <Briefcase size={13}/> },
  { id: 'config',      label: 'Config',      icon: <Settings2 size={13}/> },
]

// ═══════════════════════════════════════════════════════════════════
// CALCULADORA
// ═══════════════════════════════════════════════════════════════════
function TabCalculadora({ vendedores, cfg }: { vendedores: Vendedor[]; cfg: Config }) {
  const [vendId, setVendId] = useState(vendedores[0]?.id ?? 0)
  const [input,  setInput]  = useState('')

  const vend  = vendedores.find(v => v.id === vendId) ?? vendedores[0]
  const turno = vend?.turno ?? '6hs'
  const ventas = parseFloat(input.replace(/\./g, '').replace(',', '.')) || 0
  const { comision, pct, escala } = calcComision(ventas, turno, cfg)
  const [e1, e2, e3] = getEscalas(turno, cfg)

  const max  = e3.desde * 1.4
  const barBase = Math.min(e1.desde, ventas) / max * 100
  const barE1   = Math.max(0, Math.min(e2.desde - e1.desde, ventas - e1.desde)) / max * 100
  const barE2   = Math.max(0, Math.min(e3.desde - e2.desde, ventas - e2.desde)) / max * 100
  const barE3   = Math.max(0, ventas - e3.desde) / max * 100
  const barRest = Math.max(0, 100 - barBase - barE1 - barE2 - barE3)

  const falta =
    escala === 0 ? null
    : escala === 1 ? fmt(e2.desde - ventas) + ' para Escala 2'
    : escala === 2 ? fmt(e3.desde - ventas) + ' para Escala 3'
    : '¡Maxima escala!'

  return (
    <div className="space-y-4">
      {/* Selector vendedor */}
      <div>
        <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-2">Vendedor</p>
        <div className="flex flex-wrap gap-2">
          {vendedores.filter(v => v.activo).map(v => (
            <button key={v.id} onClick={() => { setVendId(v.id); setInput('') }}
              className="px-3 py-1.5 rounded-full text-sm font-bold transition-all border-2"
              style={vendId === v.id
                ? { background: NAVY, color: 'white', borderColor: NAVY }
                : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}>
              {v.nombre}
              <span className="ml-1.5 text-[10px] opacity-60">{v.turno}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Turno badge */}
      {vend && (
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full font-bold"
            style={{ background: turno === '8hs' ? NAVY + '12' : CORAL + '18',
                     color: turno === '8hs' ? NAVY : CORAL }}>
            Turno {turno} — escala {turno === '6hs' ? 'estandar' : 'extendida'}
          </span>
          <span className="text-xs text-gray-400">
            Piso: {fmtM(e1.desde)}
          </span>
        </div>
      )}

      {/* Input */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-3">
          Ventas cobradas en la quincena
        </p>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: CORAL }}>$</span>
          <input type="text" inputMode="numeric" value={input}
            onChange={e => setInput(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            className="flex-1 text-3xl font-bold text-gray-800 outline-none bg-transparent" />
        </div>

        {/* Barra */}
        <div className="mt-4 h-2.5 rounded-full overflow-hidden flex bg-gray-100">
          {barBase > 0 && <div style={{ flex: barBase, background: '#d1d5db' }} />}
          {barE1   > 0 && <div style={{ flex: barE1,   background: '#f59e0b' }} />}
          {barE2   > 0 && <div style={{ flex: barE2,   background: CORAL }} />}
          {barE3   > 0 && <div style={{ flex: barE3,   background: NAVY }} />}
          {barRest > 0 && <div style={{ flex: barRest, background: '#f3f4f6' }} />}
        </div>

        <div className="flex gap-3 mt-2 flex-wrap">
          {[
            { color: '#d1d5db', label: `Piso ${fmtM(e1.desde)}` },
            { color: '#f59e0b', label: `E1 ${e1.pct}%` },
            { color: CORAL,    label: `E2 ${e2.pct}%` },
            { color: NAVY,     label: `E3 ${e3.pct}%` },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {ventas > 0 && escala === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-red-600">No alcanza el piso minimo</p>
          <p className="text-sm text-red-500 mt-1">
            Faltan <strong>{fmt(e1.desde - ventas)}</strong> para comision (piso: {fmtM(e1.desde)})
          </p>
        </div>
      )}

      {ventas > 0 && escala > 0 && (
        <>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
            style={escala === 3 ? { background: NAVY + '15', color: NAVY }
                 : escala === 2 ? { background: CORAL + '18', color: CORAL }
                 : { background: '#fef3c7', color: '#92400e' }}>
            Escala {escala} — {pct}%{escala === 3 ? ' 🏆' : ''}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">Comision</p>
              <p className="text-2xl font-bold" style={{ color: CORAL }}>{fmt(comision)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">% aplicado</p>
              <p className="text-2xl font-bold" style={{ color: NAVY }}>{pct}%</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">Ventas</p>
              <p className="text-lg font-bold text-gray-700">{fmt(ventas)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400 mb-1">Siguiente escala</p>
              <p className="text-sm font-bold text-gray-700">{falta}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// REGISTRO QUINCENAL
// ═══════════════════════════════════════════════════════════════════
function TabRegistro({
  vendedores, registros, setRegistros, cfg,
}: {
  vendedores: Vendedor[]
  registros: RegistroQ[]
  setRegistros: (r: RegistroQ[]) => void
  cfg: Config
}) {
  const [vendId,     setVendId]     = useState(vendedores[0]?.id ?? 0)
  const [quincena,   setQuincena]   = useState(quincenaLabel())
  const [ventaInput, setVentaInput] = useState('')
  const [adding,     setAdding]     = useState(false)
  const [filtroVend, setFiltroVend] = useState<number | 'todos'>('todos')

  const vend = vendedores.find(v => v.id === vendId)

  function registrar() {
    if (!vend) return
    const ventas = parseFloat(ventaInput.replace(/\./g, '').replace(',', '.')) || 0
    if (!ventas) return
    const { comision, pct, escala } = calcComision(ventas, vend.turno, cfg)
    const nuevo: RegistroQ = {
      id: Date.now(), vendedorId: vendId, quincena,
      ventas, comision, pct, escala, pagada: false,
    }
    setRegistros([nuevo, ...registros])
    setVentaInput(''); setAdding(false)
  }

  function togglePagada(id: number) {
    setRegistros(registros.map(r => r.id === id ? { ...r, pagada: !r.pagada } : r))
  }

  function eliminar(id: number) {
    if (!confirm('Eliminar este registro?')) return
    setRegistros(registros.filter(r => r.id !== id))
  }

  const filtrados = filtroVend === 'todos'
    ? registros
    : registros.filter(r => r.vendedorId === filtroVend)

  const totalPendiente = filtrados
    .filter(r => !r.pagada)
    .reduce((s, r) => s + r.comision, 0)

  return (
    <div className="space-y-4">

      {/* Barra superior */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroVend('todos')}
            className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
            style={filtroVend === 'todos'
              ? { background: NAVY, color: 'white', borderColor: NAVY }
              : { borderColor: '#e5e7eb', color: '#6b7280' }}>
            Todos
          </button>
          {vendedores.filter(v => v.activo).map(v => (
            <button key={v.id}
              onClick={() => setFiltroVend(v.id)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
              style={filtroVend === v.id
                ? { background: NAVY, color: 'white', borderColor: NAVY }
                : { borderColor: '#e5e7eb', color: '#6b7280' }}>
              {v.nombre}
            </button>
          ))}
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
          style={{ background: CORAL }}>
          <Plus size={13}/> Registrar
        </button>
      </div>

      {/* KPI pendiente */}
      {totalPendiente > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">Total pendiente de pago</p>
          <p className="text-xl font-bold" style={{ color: CORAL }}>{fmt(totalPendiente)}</p>
        </div>
      )}

      {/* Formulario */}
      {adding && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="font-bold text-gray-700 text-sm">Nueva quincena</p>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Vendedor</p>
            <div className="flex flex-wrap gap-2">
              {vendedores.filter(v => v.activo).map(v => (
                <button key={v.id} onClick={() => setVendId(v.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
                  style={vendId === v.id
                    ? { background: NAVY, color: 'white', borderColor: NAVY }
                    : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {v.nombre} <span className="opacity-60">({v.turno})</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Quincena</p>
            <input type="text" value={quincena}
              onChange={e => setQuincena(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ventas cobradas</p>
            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2">
              <span className="font-bold" style={{ color: CORAL }}>$</span>
              <input type="text" inputMode="numeric" value={ventaInput}
                onChange={e => setVentaInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                className="flex-1 text-sm outline-none bg-transparent font-bold" />
            </div>
            {/* Preview comision */}
            {ventaInput && vend && (() => {
              const v = parseFloat(ventaInput.replace(/\./g,'').replace(',','.')) || 0
              const { comision, pct, escala } = calcComision(v, vend.turno, cfg)
              return escala > 0 ? (
                <p className="text-xs mt-1.5 font-semibold" style={{ color: CORAL }}>
                  Comision: {fmt(comision)} · Escala {escala} ({pct}%)
                </p>
              ) : (
                <p className="text-xs mt-1.5 text-gray-400">
                  No alcanza el piso ({fmtM(getEscalas(vend.turno, cfg)[0].desde)})
                </p>
              )
            })()}
          </div>

          <div className="flex gap-2">
            <button onClick={registrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: CORAL }}>
              Guardar registro
            </button>
            <button onClick={() => { setAdding(false); setVentaInput('') }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="text-center py-10 text-gray-300">
          <TableProperties size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin registros todavia</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Header tabla */}
          <div className="grid gap-2 px-4 py-2 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400"
            style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 32px' }}>
            <span>Vendedor</span>
            <span>Quincena</span>
            <span>Ventas</span>
            <span className="text-right">Comision</span>
            <span className="text-center">Pagada</span>
            <span></span>
          </div>

          {filtrados.map(r => {
            const v = vendedores.find(v => v.id === r.vendedorId)
            return (
              <div key={r.id}
                className="grid gap-2 px-4 py-3 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50 transition-colors"
                style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 32px' }}>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{v?.nombre ?? '-'}</p>
                  <p className="text-[10px] text-gray-400">{v?.turno}</p>
                </div>
                <p className="text-xs text-gray-500">{r.quincena}</p>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{fmt(r.ventas)}</p>
                  <p className="text-[10px]" style={{ color: CORAL }}>Esc.{r.escala} · {r.pct}%</p>
                </div>
                <p className="text-sm font-bold text-right" style={{ color: r.comision > 0 ? CORAL : '#9ca3af' }}>
                  {fmt(r.comision)}
                </p>
                <div className="flex justify-center">
                  <button onClick={() => togglePagada(r.id)}
                    className="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all"
                    style={r.pagada
                      ? { background: '#16a34a', borderColor: '#16a34a' }
                      : { borderColor: '#d1d5db' }}>
                    {r.pagada && <Check size={11} color="white" strokeWidth={3}/>}
                  </button>
                </div>
                <button onClick={() => eliminar(r.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors flex justify-center">
                  <Trash2 size={14}/>
                </button>
              </div>
            )
          })}

          {/* Total */}
          {filtrados.length > 1 && (
            <div className="grid gap-2 px-4 py-3 border-t-2 border-gray-100 items-center"
              style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 32px', background: '#f8f7f5' }}>
              <p className="text-xs font-bold text-gray-500 col-span-3">
                Total ({filtrados.length} registros)
              </p>
              <p className="text-sm font-bold text-right" style={{ color: NAVY }}>
                {fmt(filtrados.reduce((s, r) => s + r.comision, 0))}
              </p>
              <p className="text-[10px] text-center text-gray-400">
                {filtrados.filter(r => r.pagada).length}/{filtrados.length} pag.
              </p>
              <span/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// VENDEDORES
// ═══════════════════════════════════════════════════════════════════
function TabVendedores({
  vendedores, setVendedores,
}: {
  vendedores: Vendedor[]
  setVendedores: (v: Vendedor[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [nombre, setNombre] = useState('')
  const [suc,    setSuc]    = useState<'luro'|'independencia'>('luro')
  const [turno,  setTurno]  = useState<Turno>('6hs')

  function add() {
    if (!nombre.trim()) return
    setVendedores([...vendedores, {
      id: Date.now(), nombre: nombre.trim(), sucursal: suc, turno, activo: true,
    }])
    setNombre(''); setAdding(false)
  }

  function toggle(id: number) {
    setVendedores(vendedores.map(v => v.id === id ? { ...v, activo: !v.activo } : v))
  }

  return (
    <div className="space-y-3">
      {vendedores.map(v => (
        <div key={v.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: v.activo ? NAVY : '#d1d5db' }}>
            {v.nombre.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800">{v.nombre}</p>
            <div className="flex gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: CORAL + '18', color: CORAL }}>
                {v.sucursal === 'luro' ? 'Luro' : 'Independencia'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: NAVY + '12', color: NAVY }}>
                Turno {v.turno}
              </span>
              {!v.activo && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">
                  Inactivo
                </span>
              )}
            </div>
          </div>
          <button onClick={() => toggle(v.id)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
            style={v.activo
              ? { borderColor: '#e5e7eb', color: '#9ca3af' }
              : { borderColor: CORAL, color: CORAL }}>
            {v.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ))}

      {adding ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="font-bold text-gray-700 text-sm">Nuevo vendedor</p>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
            autoFocus />
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sucursal</p>
            <div className="flex gap-2">
              {(['luro', 'independencia'] as const).map(s => (
                <button key={s} onClick={() => setSuc(s)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={suc === s ? { background: NAVY, color: 'white', borderColor: NAVY } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {s === 'luro' ? 'Luro' : 'Independencia'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Turno</p>
            <div className="flex gap-2">
              {(['6hs', '8hs'] as Turno[]).map(t => (
                <button key={t} onClick={() => setTurno(t)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={turno === t ? { background: CORAL, color: 'white', borderColor: CORAL } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={add}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: CORAL }}>
              <Check size={13} className="inline mr-1"/> Agregar
            </button>
            <button onClick={() => { setAdding(false); setNombre('') }}
              className="px-4 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-500">
              <X size={13} className="inline mr-1"/> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-3 rounded-2xl text-sm font-bold border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all flex items-center justify-center gap-2">
          <Plus size={14}/> Agregar vendedor
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// REUNIONES (quincena actual + historial)
// ═══════════════════════════════════════════════════════════════════
function TabReuniones({
  vendedores, reuniones, setReuniones, registros, cfg,
}: {
  vendedores: Vendedor[]
  reuniones: Reunion[]
  setReuniones: (r: Reunion[]) => void
  registros: RegistroQ[]
  cfg: Config
}) {
  const qActual = quincenaLabel()
  const [vista, setVista] = useState<'actual' | 'historial'>('actual')
  const [filtroVend, setFiltroVend] = useState<number | 'todos'>('todos')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  function getOrCreate(vendId: number): Reunion {
    const ex = reuniones.find(r => r.vendedorId === vendId && r.quincena === qActual)
    if (ex) return ex
    const n: Reunion = {
      id: Date.now() + vendId, vendedorId: vendId, quincena: qActual,
      checks: CHECKLIST_ITEMS.map(() => false), notas: '', realizada: false,
    }
    setReuniones([...reuniones, n])
    return n
  }

  function update(updated: Reunion) {
    setReuniones(reuniones.map(r =>
      r.vendedorId === updated.vendedorId && r.quincena === updated.quincena ? updated : r
    ))
  }

  // Historial: todas las reuniones pasadas (no la actual)
  const historial = reuniones
    .filter(r => r.quincena !== qActual)
    .filter(r => filtroVend === 'todos' || r.vendedorId === filtroVend)
    .sort((a, b) => b.id - a.id)

  // Quincenas unicas en historial
  const quincenasUnicas = [...new Set(historial.map(r => r.quincena))]

  return (
    <div className="space-y-4">

      {/* Selector vista */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVista('actual')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
          style={vista === 'actual' ? { background: NAVY, color: 'white' } : { color: '#6b7280' }}>
          <ClipboardList size={12}/> Quincena Actual
        </button>
        <button onClick={() => setVista('historial')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
          style={vista === 'historial' ? { background: NAVY, color: 'white' } : { color: '#6b7280' }}>
          <History size={12}/> Registro Historial
        </button>
      </div>

      {/* ── VISTA: QUINCENA ACTUAL ── */}
      {vista === 'actual' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-3">
            <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-gray-400">Quincena actual</p>
            <p className="font-bold text-gray-700 mt-0.5">{qActual}</p>
          </div>

          {vendedores.filter(v => v.activo).map(v => {
            const r   = reuniones.find(r => r.vendedorId === v.id && r.quincena === qActual)
            const reg = registros.find(r => r.vendedorId === v.id && r.quincena === qActual)
            const done = r?.checks.filter(Boolean).length ?? 0

            return (
              <div key={v.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-100"
                  style={{ background: r?.realizada ? '#f0fdf4' : 'white' }}>
                  <div>
                    <p className="font-bold text-gray-800">{v.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {reg
                        ? <>Comision: <span className="font-bold" style={{ color: CORAL }}>{fmt(reg.comision)}</span> &middot; {reg.pct}% &middot; {fmt(reg.ventas)} en ventas</>
                        : 'Sin ventas registradas esta quincena'}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0"
                    style={r?.realizada
                      ? { background: '#dcfce7', color: '#16a34a' }
                      : { background: '#fef9c3', color: '#854d0e' }}>
                    {r?.realizada ? 'Realizada' : 'Pendiente'}
                  </span>
                </div>

                <div className="px-5 pb-4 pt-3 space-y-3">
                  <div className="space-y-1.5">
                    {CHECKLIST_ITEMS.map((item, i) => {
                      const checked = r?.checks[i] ?? false
                      return (
                        <button key={i}
                          onClick={() => {
                            const reunion = r ?? getOrCreate(v.id)
                            const nc = [...reunion.checks]; nc[i] = !nc[i]
                            update({ ...reunion, checks: nc })
                          }}
                          className="w-full flex items-center gap-3 text-left py-1.5 border-b border-gray-50 last:border-0">
                          <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                            style={checked ? { background: CORAL, borderColor: CORAL } : { borderColor: '#e5e7eb' }}>
                            {checked && <Check size={11} color="white" strokeWidth={3}/>}
                          </div>
                          <span className={`text-sm ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${done / CHECKLIST_ITEMS.length * 100}%`, background: CORAL }}/>
                    </div>
                    <span className="text-xs text-gray-400">{done}/{CHECKLIST_ITEMS.length}</span>
                  </div>

                  <textarea
                    value={r?.notas ?? ''}
                    onChange={e => { const reunion = r ?? getOrCreate(v.id); update({ ...reunion, notas: e.target.value }) }}
                    placeholder="Notas de la reunion..."
                    rows={2}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none focus:border-gray-400 placeholder:text-gray-300" />

                  <button
                    onClick={() => { const reunion = r ?? getOrCreate(v.id); update({ ...reunion, realizada: !reunion.realizada }) }}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={r?.realizada
                      ? { background: '#f3f4f6', color: '#374151', border: '2px solid #e5e7eb' }
                      : { background: NAVY, color: 'white' }}>
                    {r?.realizada ? 'Reabrir reunion' : 'Marcar como realizada'}
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ── VISTA: HISTORIAL ── */}
      {vista === 'historial' && (
        <div className="space-y-4">
          {/* Filtro vendedor */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFiltroVend('todos')}
              className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
              style={filtroVend === 'todos'
                ? { background: NAVY, color: 'white', borderColor: NAVY }
                : { borderColor: '#e5e7eb', color: '#6b7280' }}>
              Todos
            </button>
            {vendedores.filter(v => v.activo).map(v => (
              <button key={v.id} onClick={() => setFiltroVend(v.id)}
                className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
                style={filtroVend === v.id
                  ? { background: NAVY, color: 'white', borderColor: NAVY }
                  : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                {v.nombre}
              </button>
            ))}
          </div>

          {historial.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <History size={32} className="mx-auto mb-2 opacity-40"/>
              <p className="text-sm">Sin historial de reuniones todavia</p>
            </div>
          ) : (
            quincenasUnicas.map(q => {
              const reusDQ = historial.filter(r => r.quincena === q)
              return (
                <div key={q}>
                  {/* Separador quincena */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-px flex-1 bg-gray-200"/>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400 px-2">{q}</span>
                    <div className="h-px flex-1 bg-gray-200"/>
                  </div>

                  <div className="space-y-2">
                    {reusDQ.map(r => {
                      const v    = vendedores.find(v => v.id === r.vendedorId)
                      const done = r.checks.filter(Boolean).length
                      const isOpen = expandedId === r.id

                      return (
                        <div key={r.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                          {/* Fila clickeable */}
                          <button
                            onClick={() => setExpandedId(isOpen ? null : r.id)}
                            className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: r.realizada ? '#16a34a' : '#f59e0b' }}>
                              {v?.nombre.charAt(0) ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-gray-800">{v?.nombre ?? '-'}</p>
                              <p className="text-[10px] text-gray-400">
                                {done}/{CHECKLIST_ITEMS.length} items &middot;{' '}
                                {r.notas ? `"${r.notas.slice(0, 40)}${r.notas.length > 40 ? '...' : ''}"` : 'Sin notas'}
                              </p>
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                              style={r.realizada
                                ? { background: '#dcfce7', color: '#16a34a' }
                                : { background: '#fef9c3', color: '#854d0e' }}>
                              {r.realizada ? 'Realizada' : 'Pendiente'}
                            </span>
                            {isOpen ? <ChevronUp size={14} className="text-gray-400 shrink-0"/> : <ChevronDown size={14} className="text-gray-400 shrink-0"/>}
                          </button>

                          {/* Detalle expandido */}
                          {isOpen && (
                            <div className="px-5 pb-4 pt-1 space-y-3 border-t border-gray-50">
                              <div className="space-y-1">
                                {CHECKLIST_ITEMS.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 py-1">
                                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                      style={r.checks[i]
                                        ? { background: CORAL }
                                        : { background: '#f3f4f6' }}>
                                      {r.checks[i] && <Check size={9} color="white" strokeWidth={3}/>}
                                    </div>
                                    <span className={`text-xs ${r.checks[i] ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{item}</span>
                                  </div>
                                ))}
                              </div>
                              {r.notas && (
                                <div className="bg-gray-50 rounded-xl px-4 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notas</p>
                                  <p className="text-sm text-gray-700 leading-relaxed">{r.notas}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PLANILLA DE DESCRIPCIÓN DE PUESTO
// ═══════════════════════════════════════════════════════════════════
const PUESTO_COLORS: Record<string, { bg: string; text: string }> = {
  vend1:   { bg: NAVY,      text: '#fff' },
  vend2:   { bg: CORAL,     text: '#fff' },
  vend3:   { bg: '#7c3aed', text: '#fff' },
  caja:    { bg: '#16a34a', text: '#fff' },
  taller1: { bg: '#d97706', text: '#fff' },
  taller2: { bg: '#0891b2', text: '#fff' },
}

function TabPuestos({
  puestos, setPuestos,
}: {
  puestos: Puesto[]
  setPuestos: (p: Puesto[]) => void
}) {
  const [activoId, setActivoId] = useState<string>(puestos[0]?.id ?? 'vend1')
  const [saved,    setSaved]    = useState(false)

  const puesto = puestos.find(p => p.id === activoId) ?? puestos[0]

  function update(field: keyof Puesto, value: string) {
    setPuestos(puestos.map(p => p.id === activoId ? { ...p, [field]: value } : p))
  }

  function handleSave() {
    // ya persiste via useLocalState, solo feedback visual
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sections: { key: keyof Puesto; label: string; placeholder: string; rows: number }[] = [
    {
      key:         'responsabilidades',
      label:       'Responsabilidades',
      placeholder: 'Describí las tareas y responsabilidades principales del puesto...\n\n• Atender clientes\n• Gestionar ventas\n• ...',
      rows:        6,
    },
    {
      key:         'criterios',
      label:       'Criterios de Desempeño',
      placeholder: 'Describí con qué criterios se mide el rendimiento...\n\n• Cumplimiento de metas de venta\n• Puntualidad y presencia\n• ...',
      rows:        5,
    },
    {
      key:         'evaluacion',
      label:       'Evaluación de Desempeño',
      placeholder: 'Historial de evaluaciones, observaciones o calificaciones...\n\nEj: Mayo 2026 — Buen desempeño, superó meta en 15%.',
      rows:        5,
    },
  ]

  const colores = PUESTO_COLORS[activoId] ?? { bg: NAVY, text: '#fff' }

  return (
    <div className="space-y-4">

      {/* Selector de puesto — chips */}
      <div className="flex flex-wrap gap-2">
        {puestos.map(p => {
          const c = PUESTO_COLORS[p.id] ?? { bg: NAVY, text: '#fff' }
          const isActive = activoId === p.id
          return (
            <button key={p.id} onClick={() => setActivoId(p.id)}
              className="px-4 py-2 rounded-full text-sm font-bold transition-all border-2"
              style={isActive
                ? { background: c.bg, color: c.text, borderColor: c.bg }
                : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}>
              {p.nombre}
            </button>
          )
        })}
      </div>

      {/* Encabezado del puesto */}
      <div className="rounded-2xl px-6 py-5 flex items-center justify-between"
        style={{ background: colores.bg }}>
        <div>
          <p className="text-xs font-bold tracking-[2px] uppercase opacity-70" style={{ color: colores.text }}>
            Planilla de Puesto
          </p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: colores.text }}>
            {puesto?.nombre}
          </p>
          <p className="text-xs mt-1 opacity-60" style={{ color: colores.text }}>
            JAN Orgánico Natural · Mar del Plata · {new Date().getFullYear()}
          </p>
        </div>
        <Briefcase size={36} style={{ color: colores.text, opacity: 0.3 }} />
      </div>

      {/* Campos editables */}
      <div className="space-y-4">
        {sections.map(({ key, label, placeholder, rows }) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Header sección */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2"
              style={{ background: colores.bg + '12' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: colores.bg }} />
              <p className="text-xs font-bold uppercase tracking-[1.5px]" style={{ color: colores.bg }}>
                {label}
              </p>
            </div>
            <div className="p-4">
              <textarea
                value={puesto?.[key] as string ?? ''}
                onChange={e => update(key, e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="w-full text-sm text-gray-700 outline-none resize-none leading-relaxed placeholder:text-gray-300 bg-transparent"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Botón guardar */}
      <button onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all"
        style={{ background: saved ? '#16a34a' : colores.bg }}>
        <Save size={14}/>
        {saved ? 'Guardado ✓' : 'Guardar planilla'}
      </button>

      {/* Info */}
      <p className="text-[10px] text-gray-400 text-center">
        Los datos se guardan automáticamente en este dispositivo.
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════
function TabConfig({ cfg, setCfg }: { cfg: Config; setCfg: (c: Config) => void }) {
  const [local, setLocal] = useState(cfg)
  const [saved, setSaved] = useState(false)

  function save() { setCfg(local); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  function EscalaBlock({ turno, prefix }: { turno: string; prefix: 's6' | 's8' }) {
    const rows: { label: string; key: keyof Config }[] = [
      { label: 'Piso minimo (E1 desde)',  key: `${prefix}_e1_desde` },
      { label: '% Escala 1',              key: `${prefix}_e1_pct`   },
      { label: 'Escala 2 desde',          key: `${prefix}_e2_desde` },
      { label: '% Escala 2',              key: `${prefix}_e2_pct`   },
      { label: 'Escala 3 desde',          key: `${prefix}_e3_desde` },
      { label: '% Escala 3',              key: `${prefix}_e3_pct`   },
    ]
    return (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100" style={{ background: prefix === 's6' ? CORAL : NAVY }}>
          <p className="text-white font-bold text-sm">Turno {turno}</p>
          <p className="text-white/60 text-[11px]">
            {prefix === 's6' ? 'Empleados de 6 horas' : 'Empleados de 8 horas'}
          </p>
        </div>
        {rows.map(({ label, key }) => (
          <div key={key as string} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0">
            <p className="text-sm text-gray-600">{label}</p>
            <input type="number" value={local[key]}
              onChange={e => setLocal({ ...local, [key]: parseFloat(e.target.value) || 0 })}
              className="w-32 text-right text-sm font-bold border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-gray-400" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <EscalaBlock turno="6hs" prefix="s6" />
      <EscalaBlock turno="8hs" prefix="s8" />
      <button onClick={save}
        className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all"
        style={{ background: saved ? '#16a34a' : CORAL }}>
        {saved ? 'Guardado' : 'Guardar configuracion'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function Comisiones() {
  const [activeTab, setActiveTab]       = useState<Tab>('calculadora')
  const [cfg,         setCfg]           = useLocalState<Config>('com_cfg', DEFAULT_CONFIG)
  const [vendedores,  setVendedores]    = useLocalState<Vendedor[]>('com_vendedores_v2', DEFAULT_VENDEDORES)
  const [registros,   setRegistros]     = useLocalState<RegistroQ[]>('com_registros', [])
  const [reuniones,   setReuniones]     = useLocalState<Reunion[]>('com_reuniones', [])
  const [puestos,     setPuestos]       = useLocalState<Puesto[]>('com_puestos_v2', PUESTOS_DEFAULT)

  const activos       = vendedores.filter(v => v.activo)
  const totalPendiente = registros.filter(r => !r.pagada).reduce((s, r) => s + r.comision, 0)
  const qActual       = quincenaLabel()
  const reunsPendientes = activos.filter(v =>
    !reuniones.find(r => r.vendedorId === v.id && r.quincena === qActual && r.realizada)
  ).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <p className="text-gray-400 text-sm mt-0.5">Sistema quincenal escalonado | JAN Orgánico Natural</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: NAVY }}>{activos.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Vendedores activos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-sm font-bold" style={{ color: totalPendiente > 0 ? CORAL : '#9ca3af' }}>
            {fmt(totalPendiente)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Pendiente de pago</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: reunsPendientes > 0 ? '#f59e0b' : '#16a34a' }}>
            {reunsPendientes}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Reuniones pendientes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold transition-all"
            style={activeTab === t.id ? { background: NAVY, color: 'white' } : { color: '#9ca3af' }}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'calculadora' && <TabCalculadora vendedores={vendedores} cfg={cfg} />}
      {activeTab === 'registro'    && <TabRegistro    vendedores={vendedores} registros={registros} setRegistros={setRegistros} cfg={cfg} />}
      {activeTab === 'vendedores'  && <TabVendedores  vendedores={vendedores} setVendedores={setVendedores} />}
      {activeTab === 'reuniones'   && <TabReuniones   vendedores={vendedores} reuniones={reuniones} setReuniones={setReuniones} registros={registros} cfg={cfg} />}
      {activeTab === 'puestos'     && <TabPuestos     puestos={puestos} setPuestos={setPuestos} />}
      {activeTab === 'config'      && <TabConfig      cfg={cfg} setCfg={setCfg} />}
    </div>
  )
}
