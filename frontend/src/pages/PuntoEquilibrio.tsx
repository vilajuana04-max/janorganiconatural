import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, Info, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { api, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

const NAVY  = '#3D6B64'
const CORAL = '#C4875A'

// ── Tipos ────────────────────────────────────────────────────────
interface CostoExtra {
  id:          string
  categoria:   string
  descripcion: string
  monto:       number
}
interface Config {
  margen_bruto_pct: number
}

// ── localStorage ────────────────────────────────────────────────
const LS_EXTRAS = 'pe_costos_extra'
const LS_CONFIG = 'pe_config'
const LS_MES    = 'pe_mes_idx'

const DEFAULT_CONFIG: Config = { margen_bruto_pct: 35 }
const CATEGORIAS = ['Personal', 'Alquiler', 'Servicios', 'Impuestos', 'Otros']

// ── Helpers ─────────────────────────────────────────────────────
function fmt$(n: number) {
  return `$ ${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function uid() { return Math.random().toString(36).slice(2, 9) }

// ── Gráfico SVG punto de equilibrio ──────────────────────────────
function BreakEvenChart({
  totalFijos, margenPct, ventasMes, peVentas,
}: {
  totalFijos: number; margenPct: number; ventasMes: number; peVentas: number
}) {
  const W = 580; const H = 290
  const PAD = { left: 64, right: 28, top: 28, bottom: 48 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top  - PAD.bottom

  const safe = totalFijos > 0 && margenPct > 0

  const maxX = safe ? Math.max(peVentas * 1.55, ventasMes * 1.2, totalFijos * 3) : 10_000_000
  const maxY = maxX

  const toX = (v: number) => PAD.left + (v / maxX) * cW
  const toY = (v: number) => H - PAD.bottom - (v / maxY) * cH

  // Valores en los extremos derecho del gráfico
  const costosAtMaxX = totalFijos + maxX * (1 - margenPct)

  // Polígono PÉRDIDA: triángulo entre la línea de ventas y la de costos totales, izq. al PE
  const perdidaPts = safe ? [
    [toX(0), toY(0)],
    [toX(peVentas), toY(peVentas)],
    [toX(0), toY(totalFijos)],
  ] : []

  // Polígono GANANCIA: triángulo a la derecha del PE
  const gananciaPts = safe ? [
    [toX(peVentas), toY(peVentas)],
    [toX(maxX),     toY(maxX)],
    [toX(maxX),     toY(costosAtMaxX)],
  ] : []

  // Etiquetas eje X
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0, 1.5].map(f => maxX * f)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: 'inherit' }}>

      {/* Fondo del área del gráfico */}
      <rect x={PAD.left} y={PAD.top} width={cW} height={cH} fill="#f9fafb" rx={4} />

      {/* Grid horizontal */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f}
          x1={PAD.left} y1={toY(maxY * f)}
          x2={W - PAD.right} y2={toY(maxY * f)}
          stroke="#e5e7eb" strokeWidth={0.8} />
      ))}

      {/* ── Zonas sombreadas ── */}
      {perdidaPts.length > 0 && (
        <polygon
          points={perdidaPts.map(p => p.join(',')).join(' ')}
          fill="#14b8a6" fillOpacity={0.18}
        />
      )}
      {gananciaPts.length > 0 && (
        <polygon
          points={gananciaPts.map(p => p.join(',')).join(' ')}
          fill="#3b82f6" fillOpacity={0.18}
        />
      )}

      {/* ── Línea costos fijos (naranja horizontal) ── */}
      {safe && (
        <line
          x1={toX(0)} y1={toY(totalFijos)}
          x2={toX(maxX)} y2={toY(totalFijos)}
          stroke="#f97316" strokeWidth={2} strokeDasharray="6,3"
        />
      )}

      {/* ── Línea costos totales/variables (teal, sube desde CF) ── */}
      {safe && (
        <line
          x1={toX(0)} y1={toY(totalFijos)}
          x2={toX(maxX)} y2={toY(costosAtMaxX)}
          stroke="#14b8a6" strokeWidth={2.5}
        />
      )}

      {/* ── Línea ventas/ingresos (navy, sube desde origen) ── */}
      <line
        x1={toX(0)} y1={toY(0)}
        x2={toX(maxX)} y2={toY(maxX)}
        stroke={NAVY} strokeWidth={2.5}
      />

      {/* ── Posición ventas actuales (barra coral) ── */}
      {ventasMes > 0 && ventasMes <= maxX && (
        <>
          <line
            x1={toX(ventasMes)} y1={toY(ventasMes)}
            x2={toX(ventasMes)} y2={H - PAD.bottom}
            stroke={CORAL} strokeWidth={1.5} strokeDasharray="4,3"
          />
          <circle cx={toX(ventasMes)} cy={toY(ventasMes)} r={5} fill={CORAL} />
          <text x={toX(ventasMes)} y={H - PAD.bottom + 14}
            textAnchor="middle" fontSize={8} fill={CORAL} fontWeight="bold">
            HOY
          </text>
        </>
      )}

      {/* ── Punto de equilibrio ── */}
      {safe && peVentas > 0 && peVentas <= maxX * 1.05 && (
        <>
          {/* Líneas punteadas del PE */}
          <line
            x1={toX(peVentas)} y1={toY(peVentas)}
            x2={toX(peVentas)} y2={H - PAD.bottom}
            stroke="#6366f1" strokeWidth={1.2} strokeDasharray="4,3"
          />
          <line
            x1={PAD.left} y1={toY(peVentas)}
            x2={toX(peVentas)} y2={toY(peVentas)}
            stroke="#6366f1" strokeWidth={1.2} strokeDasharray="4,3"
          />
          {/* Círculo exterior */}
          <circle cx={toX(peVentas)} cy={toY(peVentas)} r={11}
            fill="#3b82f6" fillOpacity={0.2} stroke={NAVY} strokeWidth={2.5} />
          {/* Punto central */}
          <circle cx={toX(peVentas)} cy={toY(peVentas)} r={5} fill={NAVY} />
          {/* Label PE en eje X */}
          <text x={toX(peVentas)} y={H - PAD.bottom + 14}
            textAnchor="middle" fontSize={8} fill="#6366f1" fontWeight="bold">
            PE
          </text>
        </>
      )}

      {/* ── Etiquetas de líneas (extremo derecho) ── */}
      {safe && (
        <>
          <text x={W - PAD.right - 2} y={toY(totalFijos) - 4}
            textAnchor="end" fontSize={8.5} fill="#f97316" fontWeight="bold">
            COSTOS FIJOS
          </text>
          <text x={W - PAD.right - 2} y={toY(costosAtMaxX) + 11}
            textAnchor="end" fontSize={8.5} fill="#14b8a6" fontWeight="bold">
            COSTOS VARIABLES
          </text>
        </>
      )}
      <text x={W - PAD.right - 2} y={toY(maxX) - 4}
        textAnchor="end" fontSize={8.5} fill={NAVY} fontWeight="bold">
        VENTAS
      </text>

      {/* ── Etiquetas de zonas ── */}
      {perdidaPts.length > 0 && peVentas > 0 && (
        <text
          x={toX(peVentas * 0.28)}
          y={toY(totalFijos * 0.45)}
          textAnchor="middle" fontSize={11} fill="#0d9488" fontWeight="bold" opacity={0.85}>
          PÉRDIDA
        </text>
      )}
      {gananciaPts.length > 0 && (
        <text
          x={toX(peVentas + (maxX - peVentas) * 0.6)}
          y={toY(peVentas + (maxX - peVentas) * 0.45)}
          textAnchor="middle" fontSize={11} fill="#2563eb" fontWeight="bold" opacity={0.85}>
          GANANCIA
        </text>
      )}

      {/* ── Ejes ── */}
      {/* Eje X */}
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
        stroke="#d1d5db" strokeWidth={1.5} />
      {/* Eje Y */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
        stroke="#d1d5db" strokeWidth={1.5} />
      {/* Flecha eje X */}
      <polygon points={`${W - PAD.right},${H - PAD.bottom - 4} ${W - PAD.right + 7},${H - PAD.bottom} ${W - PAD.right},${H - PAD.bottom + 4}`}
        fill="#d1d5db" />
      {/* Flecha eje Y */}
      <polygon points={`${PAD.left - 4},${PAD.top} ${PAD.left},${PAD.top - 7} ${PAD.left + 4},${PAD.top}`}
        fill="#d1d5db" />

      {/* Ticks eje X */}
      {xTicks.filter(v => v <= maxX).map(v => (
        <g key={v}>
          <line x1={toX(v)} y1={H - PAD.bottom} x2={toX(v)} y2={H - PAD.bottom + 4}
            stroke="#9ca3af" strokeWidth={1} />
          <text x={toX(v)} y={H - PAD.bottom + 25}
            textAnchor="middle" fontSize={8} fill="#9ca3af">
            {fmtShort(v)}
          </text>
        </g>
      ))}

      {/* Ticks eje Y */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <text x={PAD.left - 5} y={toY(maxY * f) + 3}
            textAnchor="end" fontSize={8} fill="#9ca3af">
            {fmtShort(maxY * f)}
          </text>
        </g>
      ))}

      {/* Leyenda */}
      {[
        { color: NAVY,      label: 'Ventas' },
        { color: '#14b8a6', label: 'Costos totales' },
        { color: '#f97316', label: 'Costos fijos',     dash: true },
      ].map(({ color, label, dash }, i) => (
        <g key={label} transform={`translate(${PAD.left + i * 110}, ${PAD.top - 12})`}>
          <line x1={0} y1={4} x2={18} y2={4}
            stroke={color} strokeWidth={2}
            strokeDasharray={dash ? '5,3' : undefined} />
          <text x={22} y={7} fontSize={8} fill="#6b7280">{label}</text>
        </g>
      ))}
    </svg>
  )
}

// ── Componente principal ─────────────────────────────────────────
type Tab = 'resumen' | 'costos' | 'config'

export default function PuntoEquilibrio() {
  const now = new Date()

  // Mes/año seleccionado
  const [mesIdx, setMesIdx] = useState<number>(() => {
    const saved = localStorage.getItem(LS_MES)
    return saved ? parseInt(saved) : CURRENT_MONTH_IDX
  })
  const [yearSel] = useState(CURRENT_YEAR)
  const mesNombre = MONTHS[mesIdx]

  // Config y costos extras (localStorage)
  const [tab,    setTab]    = useState<Tab>('resumen')
  const [extras, setExtras] = useState<CostoExtra[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_EXTRAS) || '[]') } catch { return [] }
  })
  const [config, setConfig] = useState<Config>(() => {
    try { return JSON.parse(localStorage.getItem(LS_CONFIG) || '') } catch { return DEFAULT_CONFIG }
  })

  // Datos desde API
  const [ventasApi, setVentasApi]         = useState<number>(0)
  const [gastosLuroFijo, setGastosLuroFijo] = useState<number>(0)
  const [loadingVentas, setLoadingVentas] = useState(false)
  const [loadingGastos, setLoadingGastos] = useState(false)

  // Persist
  useEffect(() => { localStorage.setItem(LS_EXTRAS, JSON.stringify(extras)) }, [extras])
  useEffect(() => { localStorage.setItem(LS_CONFIG, JSON.stringify(config)) }, [config])
  useEffect(() => { localStorage.setItem(LS_MES, String(mesIdx)) }, [mesIdx])

  // Carga ventas del mes desde API
  const loadVentas = useCallback(() => {
    setLoadingVentas(true)
    api.get<{ total_amount: number | null; branch_id: number }[]>(
      `/sales/?month=${mesNombre}&year=${yearSel}`
    ).then(sales => {
      const total = sales.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)
      setVentasApi(total)
    }).catch(() => {}).finally(() => setLoadingVentas(false))
  }, [mesNombre, yearSel])

  // Carga gastos fijos Luro desde API
  const loadGastosFijos = useCallback(() => {
    setLoadingGastos(true)
    api.get<{ total_fijo: number; total_variable: number }>(
      `/expenses/luro/totales-pe?month=${mesNombre}&year=${yearSel}`
    ).then(r => {
      setGastosLuroFijo(r.total_fijo || 0)
    }).catch(() => {}).finally(() => setLoadingGastos(false))
  }, [mesNombre, yearSel])

  useEffect(() => { loadVentas();    }, [loadVentas])
  useEffect(() => { loadGastosFijos() }, [loadGastosFijos])

  // ── Cálculos ─────────────────────────────────────────────────
  const totalExtras     = extras.reduce((s, c) => s + c.monto, 0)
  const totalFijos      = gastosLuroFijo + totalExtras
  const margenPct       = config.margen_bruto_pct / 100
  const peVentas        = margenPct > 0 ? totalFijos / margenPct : 0
  const alcanzadoPct    = peVentas > 0 ? (ventasApi / peVentas) * 100 : 0
  const gananciaEst     = ventasApi * margenPct - totalFijos
  const falta           = Math.max(0, peVentas - ventasApi)
  const excedente       = Math.max(0, ventasApi - peVentas)

  const estado =
    alcanzadoPct < 70  ? 'critico'    :
    alcanzadoPct < 95  ? 'alerta'     :
    alcanzadoPct < 105 ? 'equilibrio' : 'ganancia'

  const estadoCfg = {
    critico:    { label: 'Pérdida estimada — por debajo del PE', Icon: XCircle,       color: '#ef4444', bg: '#fef2f2' },
    alerta:     { label: 'Zona de atención — cerca del PE',      Icon: AlertTriangle, color: '#f59e0b', bg: '#fffbeb' },
    equilibrio: { label: 'En punto de equilibrio',               Icon: Info,          color: '#3b82f6', bg: '#eff6ff' },
    ganancia:   { label: 'Ganancia estimada — superaste el PE',  Icon: CheckCircle,   color: '#22c55e', bg: '#f0fdf4' },
  }[estado]
  const { Icon: StatusIcon } = estadoCfg

  // Form nuevo extra
  const [newCat,   setNewCat]   = useState(CATEGORIAS[0])
  const [newDesc,  setNewDesc]  = useState('')
  const [newMonto, setNewMonto] = useState('')

  function addExtra() {
    if (!newDesc.trim() || !newMonto) return
    setExtras(p => [...p, { id: uid(), categoria: newCat, descripcion: newDesc.trim(), monto: parseFloat(newMonto) || 0 }])
    setNewDesc(''); setNewMonto('')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'costos',  label: 'Costos extra' },
    { id: 'config',  label: 'Configuración' },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <p className="text-xs font-bold tracking-[2px] uppercase mb-1" style={{ color: CORAL }}>
            Análisis Financiero
          </p>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Punto de Equilibrio</h1>
        </div>
        {/* Selector de mes */}
        <div className="flex items-center gap-3">
          <select
            value={mesIdx}
            onChange={e => setMesIdx(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none"
            style={{ color: NAVY }}
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m} {yearSel}</option>)}
          </select>
          <button
            onClick={() => { loadVentas(); loadGastosFijos() }}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Recargar datos"
          >
            <RefreshCw size={15} className={loadingVentas || loadingGastos ? 'animate-spin text-gray-400' : 'text-gray-400'} />
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all"
            style={tab === t.id ? { background: NAVY, color: '#fff' } : { color: '#6b7280' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════ RESUMEN ══════════════════════ */}
      {tab === 'resumen' && (
        <div className="space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Costos Fijos Totales', value: fmt$(totalFijos),
                sub: `Luro ${fmt$(gastosLuroFijo)} + Extra ${fmt$(totalExtras)}`, color: '#7c3aed' },
              { label: `Ventas ${mesNombre}`, value: fmt$(ventasApi),
                sub: loadingVentas ? 'cargando...' : 'desde panel Ventas', color: '#2563eb' },
              { label: 'Punto de Equilibrio', value: fmt$(peVentas),
                sub: `margen ${config.margen_bruto_pct}%`, color: '#d97706' },
              { label: gananciaEst >= 0 ? 'Ganancia Estimada' : 'Pérdida Estimada',
                value: fmt$(Math.abs(gananciaEst)),
                sub: gananciaEst >= 0 ? 'por encima del PE' : 'por debajo del PE',
                color: gananciaEst >= 0 ? '#16a34a' : '#dc2626' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
                style={{ borderTop: `3px solid ${k.color}` }}>
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-2">{k.label}</p>
                <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[10px] text-gray-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Banner de estado */}
          <div className="flex items-center gap-3 rounded-xl px-5 py-4 border"
            style={{ background: estadoCfg.bg, borderColor: estadoCfg.color + '33' }}>
            <StatusIcon size={20} style={{ color: estadoCfg.color }} />
            <div>
              <p className="font-bold text-sm" style={{ color: estadoCfg.color }}>{estadoCfg.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {falta > 0
                  ? `Necesitás vender ${fmt$(falta)} más para cubrir todos los costos fijos.`
                  : `Superaste el PE por ${fmt$(excedente)}. Ganancia neta estimada: ${fmt$(gananciaEst)}.`}
              </p>
            </div>
          </div>

          {/* ── GRÁFICO SVG ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>
                Gráfico Punto de Equilibrio — {mesNombre} {yearSel}
              </h3>
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: estadoCfg.bg, color: estadoCfg.color }}>
                {alcanzadoPct.toFixed(1)}% del PE
              </span>
            </div>
            {totalFijos === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                Cargá costos fijos y configurá el margen para ver el gráfico.
              </div>
            ) : (
              <BreakEvenChart
                totalFijos={totalFijos}
                margenPct={margenPct}
                ventasMes={ventasApi}
                peVentas={peVentas}
              />
            )}
          </div>

          {/* Desglose costos fijos */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>Costos Fijos — Desglose</h3>
              <span className="text-xs text-gray-400">{fmt$(totalFijos)}/mes</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                  <th className="text-left px-5 py-2">Origen</th>
                  <th className="text-left px-4 py-2">Descripción</th>
                  <th className="text-right px-5 py-2">Monto</th>
                  <th className="text-right px-5 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {/* Gastos Luro fijos (desde API) */}
                <tr className="bg-white border-b border-gray-50">
                  <td className="px-5 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                      Gastos Luro
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    Gastos marcados como FIJO en {mesNombre}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold" style={{ color: NAVY }}>
                    {fmt$(gastosLuroFijo)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-gray-400 text-xs">
                    {totalFijos > 0 ? ((gastosLuroFijo / totalFijos) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
                {/* Costos extra manuales */}
                {extras.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}>
                    <td className="px-5 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                        {c.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{c.descripcion}</td>
                    <td className="px-5 py-2.5 text-right font-semibold" style={{ color: NAVY }}>
                      {fmt$(c.monto)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-400 text-xs">
                      {totalFijos > 0 ? ((c.monto / totalFijos) * 100).toFixed(1) : '0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={2} className="px-5 py-3 font-bold text-xs uppercase tracking-wide text-gray-500">
                    Total Costos Fijos
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-base" style={{ color: NAVY }}>
                    {fmt$(totalFijos)}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400 text-xs">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      )}

      {/* ══════════════════════ COSTOS EXTRA ═════════════════════ */}
      {tab === 'costos' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
            <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-600 leading-relaxed">
              Los gastos de <strong>Gastos Luro</strong> marcados como <strong>FIJO</strong> se incluyen automáticamente.
              Acá podés agregar costos adicionales que no estén en ese panel
              (ej: alquiler de Independencia, sueldos, impuestos compartidos).
            </p>
          </div>

          {/* Tabla extras */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>Costos Fijos Extra</h3>
              <span className="text-sm font-bold" style={{ color: CORAL }}>{fmt$(totalExtras)}/mes</span>
            </div>
            {extras.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">Sin costos extra. Agregá el primero abajo.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                    <th className="text-left px-5 py-2">Categoría</th>
                    <th className="text-left px-4 py-2">Descripción</th>
                    <th className="text-right px-5 py-2">Monto mensual</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {extras.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="px-5 py-2.5">
                        <select value={c.categoria}
                          onChange={e => setExtras(p => p.map(x => x.id === c.id ? { ...x, categoria: e.target.value } : x))}
                          className="text-xs font-semibold bg-gray-100 rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer">
                          {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input value={c.descripcion}
                          onChange={e => setExtras(p => p.map(x => x.id === c.id ? { ...x, descripcion: e.target.value } : x))}
                          className="w-full outline-none text-gray-700 bg-transparent" />
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <input type="number" value={c.monto || ''}
                          onChange={e => setExtras(p => p.map(x => x.id === c.id ? { ...x, monto: parseFloat(e.target.value) || 0 } : x))}
                          className="w-36 text-right outline-none font-semibold bg-transparent"
                          style={{ color: NAVY }} placeholder="0" />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setExtras(p => p.filter(x => x.id !== c.id))}
                          className="text-red-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={2} className="px-5 py-3 font-bold text-xs uppercase tracking-wide text-gray-500">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-base" style={{ color: NAVY }}>{fmt$(totalExtras)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Form agregar */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">Agregar costo extra</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select value={newCat} onChange={e => setNewCat(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400">
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Descripción (ej: Alquiler Independencia)"
                className="sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none"
                onKeyDown={e => e.key === 'Enter' && addExtra()} />
              <div className="flex gap-2">
                <input type="number" value={newMonto} onChange={e => setNewMonto(e.target.value)}
                  placeholder="$ Monto"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none"
                  onKeyDown={e => e.key === 'Enter' && addExtra()} />
                <button onClick={addExtra} disabled={!newDesc.trim() || !newMonto}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-40"
                  style={{ background: CORAL }}>
                  <Plus size={15} /> Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ CONFIGURACIÓN ════════════════════ */}
      {tab === 'config' && (
        <div className="space-y-5 max-w-lg">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold mb-1" style={{ color: NAVY }}>Margen Bruto Promedio</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                ¿Qué porcentaje queda de cada peso vendido, después de restar el costo de la mercadería?
                Por ejemplo, si vendés algo a $1.000 que te costó $650, tu margen es 35%.
              </p>
              <div className="flex items-center gap-4">
                <input type="range" min={1} max={80} step={0.5}
                  value={config.margen_bruto_pct}
                  onChange={e => setConfig(p => ({ ...p, margen_bruto_pct: parseFloat(e.target.value) }))}
                  className="flex-1 accent-orange-500" />
                <div className="flex items-center border-2 rounded-xl overflow-hidden" style={{ borderColor: CORAL }}>
                  <input type="number" min={1} max={80} step={0.5}
                    value={config.margen_bruto_pct}
                    onChange={e => setConfig(p => ({ ...p, margen_bruto_pct: parseFloat(e.target.value) || 1 }))}
                    className="w-16 text-center text-xl font-bold outline-none py-2"
                    style={{ color: CORAL }} />
                  <span className="pr-3 font-bold text-lg" style={{ color: CORAL }}>%</span>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3">Impacto en {mesNombre}</p>
              {[
                ['Costos fijos (Luro + extra)', fmt$(totalFijos)],
                ['PE necesario',                fmt$(peVentas)],
                ['Ventas del mes (API)',         fmt$(ventasApi)],
                ['$ ganancia por peso vendido', `$ ${(config.margen_bruto_pct / 100).toFixed(2)}`],
                ['Resultado estimado',          (gananciaEst >= 0 ? '+ ' : '- ') + fmt$(Math.abs(gananciaEst))],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-bold" style={{ color: NAVY }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>
                Cuando tengas el costo por producto cargado en el sistema, este margen se
                calculará automáticamente. Por ahora usamos uno promedio configurable.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
