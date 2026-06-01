import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Info,
} from 'lucide-react'
import { api, fmt$, CURRENT_YEAR } from '../api'

const NAVY       = '#3D6B64'
const CORAL      = '#C4875A'
const CORAL_DARK = '#8B4C2E'
const CHART_COLORS = [NAVY, CORAL, CORAL_DARK, '#6B5E50', '#a89c90', '#1E2B1A']

const MONTH_ABBR: Record<string, string> = {
  ENERO:'Ene', FEBRERO:'Feb', MARZO:'Mar', ABRIL:'Abr',
  MAYO:'May', JUNIO:'Jun', JULIO:'Jul', AGOSTO:'Ago',
  SEPTIEMBRE:'Sep', OCTUBRE:'Oct', NOVIEMBRE:'Nov', DICIEMBRE:'Dic',
}

// ── Info tooltip ──────────────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ml-1 flex-shrink-0"
        style={{ background: '#dbeafe', color: '#2563eb' }}
        aria-label="Más información"
      >
        <Info size={9} strokeWidth={2.5} />
      </button>
      {open && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 text-white text-[11px] rounded-xl px-3 py-2.5 shadow-2xl leading-relaxed pointer-events-none"
          style={{ background: NAVY }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: NAVY }} />
        </div>
      )}
    </div>
  )
}

// ── Semáforo de estado ────────────────────────────────────────────────────────
type Semaforo = 'green' | 'yellow' | 'red' | 'blue' | 'neutral'

const SEMAFORO_COLORS: Record<Semaforo, { bg: string; text: string; label: string }> = {
  green:   { bg: '#dcfce7', text: '#16a34a', label: 'Excelente' },
  yellow:  { bg: '#fef9c3', text: '#ca8a04', label: 'Aceptable' },
  red:     { bg: '#fee2e2', text: '#dc2626', label: 'Atención'  },
  blue:    { bg: '#dbeafe', text: '#2563eb', label: 'Bueno'     },
  neutral: { bg: '#f1f5f9', text: '#64748b', label: 'Neutro'    },
}

function SemaforoChip({ estado }: { estado: Semaforo }) {
  const s = SEMAFORO_COLORS[estado]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

// ── Tarjeta de indicador financiero ──────────────────────────────────────────
function IndicadorCard({
  title, value, sub, estado, info, extra,
}: {
  title: string
  value: string
  sub?: string
  estado: Semaforo
  info: string
  extra?: React.ReactNode
}) {
  const color = SEMAFORO_COLORS[estado].text

  return (
    <div className="bg-white rounded-2xl p-5 shadow-card border-l-4 transition-shadow hover:shadow-md"
      style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <p className="text-[11px] font-bold uppercase tracking-[1.5px] font-body text-gray-400">{title}</p>
          <InfoTooltip text={info} />
        </div>
        <SemaforoChip estado={estado} />
      </div>
      <p className="text-2xl font-bold font-head" style={{ color }}>{value}</p>
      {sub && <p className="text-xs font-body text-gray-400 mt-1">{sub}</p>}
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  )
}

// ── Barra de split (dos colores) ──────────────────────────────────────────────
function SplitBar({ pct, labelA, labelB }: { pct: number; labelA: string; labelB: string }) {
  return (
    <div className="space-y-1">
      <div className="flex rounded-full overflow-hidden h-2">
        <div style={{ width: `${pct}%`, background: NAVY }} />
        <div style={{ width: `${100 - pct}%`, background: CORAL }} />
      </div>
      <div className="flex justify-between text-[10px] font-body text-gray-400">
        <span style={{ color: NAVY }}>■ {labelA} {pct.toFixed(0)}%</span>
        <span style={{ color: CORAL }}>■ {labelB} {(100 - pct).toFixed(0)}%</span>
      </div>
    </div>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function Dashboard() {
  const [kpis,    setKpis]    = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/dashboard/kpis?year=${CURRENT_YEAR}`)
      .then(d => { setKpis(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />

  const monthly = kpis?.monthly_stats?.filter((m: any) => m.total_sales > 0) ?? []
  const pie     = kpis?.expense_breakdown ?? []
  const monthlyChart = monthly.map((m: any) => ({
    ...m,
    name: MONTH_ABBR[m.month] ?? m.month?.slice(0, 3),
  }))

  // ── Cómputo de indicadores ──────────────────────────────────────────────────
  const ytdRev  = kpis?.ytd_revenue  ?? 0
  const ytdExp  = kpis?.ytd_expenses ?? 0
  const ytdPay  = kpis?.ytd_payroll  ?? 0
  const luroYtd = kpis?.luro_ytd     ?? 0
  const indepYtd = kpis?.indep_ytd   ?? 0

  // 1. Eficiencia operativa
  const eficiencia = ytdRev > 0 ? ((ytdExp + ytdPay) / ytdRev) * 100 : 0
  const eficienciaEstado: Semaforo =
    eficiencia <= 55 ? 'green' : eficiencia <= 75 ? 'yellow' : 'red'

  // 2. Rentabilidad neta estimada
  const rentabilidad = kpis?.gross_margin_pct ?? 0
  const rentEstado: Semaforo =
    rentabilidad >= 25 ? 'green' : rentabilidad >= 15 ? 'blue' : rentabilidad >= 5 ? 'yellow' : 'red'

  // 3. Crecimiento MoM — mes activo vs mes anterior
  const curIdx   = monthly.findIndex((m: any) => m.month === kpis?.current_month)
  const curMonth = monthly[curIdx]      ?? monthly[monthly.length - 1]
  const prevMonth= monthly[curIdx - 1]  ?? null
  const momPct   = (curMonth && prevMonth && prevMonth.total_sales > 0)
    ? ((curMonth.total_sales - prevMonth.total_sales) / prevMonth.total_sales) * 100
    : null
  const momEstado: Semaforo = momPct === null ? 'neutral' : momPct >= 5 ? 'green' : momPct >= -5 ? 'yellow' : 'red'

  // 4. Ticket promedio
  const totalTickets = monthly.reduce(
    (s: number, m: any) => s + (m.luro_tickets || 0) + (m.indep_tickets || 0), 0
  )
  const avgTicket = totalTickets > 0 ? ytdRev / totalTickets : 0
  const prevTickets = prevMonth
    ? (prevMonth.luro_tickets || 0) + (prevMonth.indep_tickets || 0)
    : 0
  const prevAvgTicket = (prevMonth && prevTickets > 0)
    ? prevMonth.total_sales / prevTickets
    : 0
  const ticketDelta = (prevAvgTicket > 0)
    ? ((avgTicket - prevAvgTicket) / prevAvgTicket) * 100
    : null
  const ticketEstado: Semaforo =
    ticketDelta === null ? 'neutral' : ticketDelta >= 0 ? 'green' : 'red'

  // 5. Distribución por sucursal
  const luroShare  = ytdRev > 0 ? (luroYtd  / ytdRev) * 100 : 50
  const luroEstado: Semaforo = 'neutral'

  // 6. Mes pico del año
  const bestMonth = monthly.length > 0
    ? monthly.reduce((b: any, m: any) => m.total_sales > b.total_sales ? m : b, monthly[0])
    : null
  const bestMonthName = bestMonth ? (MONTH_ABBR[bestMonth.month] ?? bestMonth.month) : '—'
  const isBestCurrent = bestMonth?.month === kpis?.current_month
  const bestEstado: Semaforo = isBestCurrent ? 'green' : 'neutral'

  // ── Indicador de costo por venta (Compras/Ventas) — si hay datos ────────────
  const gastosSobreVentas = ytdRev > 0 ? (ytdExp / ytdRev) * 100 : 0
  const gsvEstado: Semaforo =
    gastosSobreVentas <= 30 ? 'green' : gastosSobreVentas <= 50 ? 'yellow' : 'red'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <p className="eyebrow mb-1">JAN Orgánico Natural · ERP</p>
        <h1 className="text-3xl font-bold font-head" style={{ color: NAVY }}>Dashboard</h1>
        <p className="text-brand-muted text-sm font-body mt-0.5">
          {kpis?.current_month} {kpis?.current_year} · Flujo de caja e indicadores
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ingresos YTD"    value={fmt$(ytdRev)}      sub={`Luro: ${fmt$(luroYtd)}`}                                        accent={NAVY}            />
        <KpiCard label="Gastos YTD"      value={fmt$(ytdExp)}      sub="Incl. sueldos"                                                   accent={CORAL} negative   />
        <KpiCard label="Margen Bruto"    value={fmt$(kpis?.gross_margin)} sub={`${rentabilidad.toFixed(1)}% del ingreso`}                 accent={rentabilidad >= 15 ? '#16a34a' : '#dc2626'} />
        <KpiCard label="Sueldos / Ventas" value={`${kpis?.payroll_to_revenue?.toFixed(1) ?? '—'}%`} sub="Ratio RRHH"                    accent={NAVY}            />
      </div>

      {/* ── INDICADORES FINANCIEROS ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="eyebrow">Análisis financiero</p>
        </div>
        <h2 className="font-bold font-head text-lg mb-4" style={{ color: NAVY }}>
          Indicadores para la toma de decisiones
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* 1. Eficiencia operativa */}
          <IndicadorCard
            title="Eficiencia Operativa"
            value={`${eficiencia.toFixed(1)}%`}
            sub={`De cada $100 vendidos, $${eficiencia.toFixed(0)} van a gastos + sueldos`}
            estado={eficienciaEstado}
            info="Mide qué % de las ventas se consume en gastos operativos y sueldos. Cuanto más bajo, mayor margen queda. Referencia: ≤55% excelente · 56-75% aceptable · >75% requiere revisión."
          />

          {/* 2. Rentabilidad neta estimada */}
          <IndicadorCard
            title="Rentabilidad Neta Est."
            value={`${rentabilidad.toFixed(1)}%`}
            sub={`${fmt$(kpis?.gross_margin)} de resultado estimado YTD`}
            estado={rentEstado}
            info="% que queda como resultado luego de descontar gastos y sueldos (sin impuestos ni amortizaciones). Referencia para retail: ≥25% excelente · 15-24% bueno · 5-14% ajustado · <5% crítico."
          />

          {/* 3. Crecimiento MoM */}
          <IndicadorCard
            title={`Variación Mensual (MoM)`}
            value={
              momPct === null
                ? 'Sin datos'
                : `${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%`
            }
            sub={
              curMonth && prevMonth
                ? `${MONTH_ABBR[curMonth.month] ?? '—'} vs ${MONTH_ABBR[prevMonth.month] ?? '—'}: ${fmt$(curMonth.total_sales)} vs ${fmt$(prevMonth.total_sales)}`
                : 'Necesitás al menos 2 meses de datos'
            }
            estado={momEstado}
            info="Compara las ventas del mes activo con el mes anterior. Positivo = crecimiento. Útil para detectar estacionalidad, tendencias y caídas inesperadas. Referencia: ≥+5% crecimiento sano."
            extra={
              momPct !== null ? (
                <div className="flex items-center gap-1.5">
                  {momPct > 0
                    ? <TrendingUp size={16} className="text-green-500" />
                    : momPct < 0
                    ? <TrendingDown size={16} className="text-red-500" />
                    : <Minus size={16} className="text-gray-400" />
                  }
                  <span className="text-xs text-gray-400">
                    {momPct > 0 ? 'Subiendo respecto al mes anterior' : momPct < 0 ? 'Bajando respecto al mes anterior' : 'Sin cambio'}
                  </span>
                </div>
              ) : null
            }
          />

          {/* 4. Ticket promedio */}
          <IndicadorCard
            title="Ticket Promedio"
            value={avgTicket > 0 ? fmt$(avgTicket) : '—'}
            sub={
              ticketDelta !== null
                ? `${ticketDelta >= 0 ? '+' : ''}${ticketDelta.toFixed(1)}% vs mes anterior · ${totalTickets.toLocaleString('es-AR')} ventas YTD`
                : `${totalTickets.toLocaleString('es-AR')} ventas registradas YTD`
            }
            estado={ticketEstado}
            info="Monto promedio de cada transacción (venta total ÷ cantidad de tickets). Un ticket creciente indica que se vende más por visita o que los precios aumentaron. Monitorear que crezca al menos con la inflación."
          />

          {/* 5. Distribución por sucursal */}
          <IndicadorCard
            title="Distribución Sucursales"
            value={`Luro ${luroShare.toFixed(0)}% · Indep ${(100 - luroShare).toFixed(0)}%`}
            sub={`Luro: ${fmt$(luroYtd)} · Independencia: ${fmt$(indepYtd)}`}
            estado={luroEstado}
            info="Muestra cuánto aporta cada sucursal al total de ventas del año. Si una sucursal baja su participación de forma sostenida, puede indicar problemas de gestión, stock o atención comercial."
            extra={
              ytdRev > 0
                ? <SplitBar pct={luroShare} labelA="Luro" labelB="Indep." />
                : null
            }
          />

          {/* 6. Mes pico del año */}
          <IndicadorCard
            title="Mes Pico del Año"
            value={bestMonthName}
            sub={bestMonth ? `${fmt$(bestMonth.total_sales)} en ventas totales` : 'Sin datos'}
            estado={bestEstado}
            info="El mes con mayor facturación del año. Sirve para anticipar picos de demanda, planificar stock y reforzar personal. Si el mes actual es el pico, ¡momento de maximizar operaciones!"
            extra={
              isBestCurrent ? (
                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  🏆 Estás en el mejor mes del año
                </span>
              ) : bestMonth ? (
                <span className="text-[10px] text-gray-400">
                  Referencia para stock y planificación del {bestMonthName} {kpis.current_year + 1}
                </span>
              ) : null
            }
          />

          {/* 7. Gastos sobre ventas */}
          <IndicadorCard
            title="Gastos Operativos / Ventas"
            value={`${gastosSobreVentas.toFixed(1)}%`}
            sub={`${fmt$(ytdExp)} en gastos sobre ${fmt$(ytdRev)} en ventas YTD`}
            estado={gsvEstado}
            info="Ratio gastos operativos (sin sueldos) sobre ventas totales. Indica qué tan eficiente es la estructura de costos fijos. Referencia: ≤30% óptimo · 31-50% moderado · >50% revisar rubros."
          />

          {/* 8. Sueldos sobre ventas */}
          <IndicadorCard
            title="Masa Salarial / Ventas"
            value={`${kpis?.payroll_to_revenue?.toFixed(1) ?? '—'}%`}
            sub={`${fmt$(ytdPay)} en sueldos sobre ${fmt$(ytdRev)} en ventas YTD`}
            estado={
              (kpis?.payroll_to_revenue ?? 0) <= 20 ? 'green'
              : (kpis?.payroll_to_revenue ?? 0) <= 35 ? 'yellow'
              : 'red'
            }
            info="Porcentaje de las ventas que se destina al total de sueldos y cargas sociales. Para comercio minorista, un ratio saludable está entre 15-25%. Por encima del 35% compromete la rentabilidad."
          />

          {/* 9. Promedio de ventas diarias */}
          {curMonth && (
            <IndicadorCard
              title={`Ritmo de Ventas — ${MONTH_ABBR[curMonth.month] ?? ''}`}
              value={(() => {
                const dias = new Date().getDate()
                return fmt$(curMonth.total_sales / Math.max(dias, 1))
              })()}
              sub={`${fmt$(curMonth.total_sales)} acumulado · ${new Date().getDate()} días transcurridos`}
              estado="blue"
              info="Ventas promedio por día en el mes activo (total acumulado ÷ días transcurridos). Útil para proyectar el cierre del mes y comparar contra el objetivo mensual."
              extra={(() => {
                if (!prevMonth || prevMonth.total_sales === 0) return null
                const diasMes     = 30
                const diasActual  = new Date().getDate()
                const diarioPrev  = prevMonth.total_sales / diasMes
                const diarioCur   = curMonth.total_sales  / diasActual
                const proyeccion  = diarioCur * diasMes
                const delta       = proyeccion - prevMonth.total_sales
                return (
                  <div className="text-[11px] text-gray-400 space-y-0.5">
                    <p>Proyección fin de mes: <span className="font-bold text-gray-700">{fmt$(proyeccion)}</span></p>
                    <p style={{ color: delta >= 0 ? '#16a34a' : '#dc2626' }}>
                      {delta >= 0 ? '▲' : '▼'} {fmt$(Math.abs(delta))} vs {MONTH_ABBR[prevMonth.month] ?? ''}
                    </p>
                  </div>
                )
              })()}
            />
          )}

        </div>
      </div>

      {/* Ingresos vs Gastos mensual */}
      {monthlyChart.length > 0 && (
        <div className="card">
          <p className="eyebrow mb-1">Comparativa mensual</p>
          <h2 className="font-bold font-head text-lg mb-4" style={{ color: NAVY }}>
            Ingresos vs Gastos — {CURRENT_YEAR}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChart} barCategoryGap="30%" margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888580', fontFamily: 'Montserrat' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#888580' }} tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number, name: string) => [fmt$(v), name]} contentStyle={{ fontFamily: 'Montserrat', fontSize: 12, borderRadius: 8, border: '1px solid #e8e5e0' }} />
              <Bar dataKey="total_sales"    name="Ventas"  fill={NAVY}  radius={[4,4,0,0]} />
              <Bar dataKey="total_expenses" name="Gastos"  fill={CORAL} radius={[4,4,0,0]} />
              <Legend wrapperStyle={{ fontFamily: 'Montserrat', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {monthlyChart.length > 0 && (
          <div className="card">
            <p className="eyebrow mb-1">Por sucursal</p>
            <h2 className="font-bold font-head text-base mb-4" style={{ color: NAVY }}>Tendencia de Ventas</h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthlyChart}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888580' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#888580' }} tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ fontFamily: 'Montserrat', fontSize: 12, borderRadius: 8, border: '1px solid #e8e5e0' }} />
                <Line dataKey="luro_sales"  name="Luro"         stroke={NAVY}  strokeWidth={2.5} dot={false} />
                <Line dataKey="indep_sales" name="Independencia" stroke={CORAL} strokeWidth={2.5} dot={false} />
                <Legend wrapperStyle={{ fontFamily: 'Montserrat', fontSize: 12 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {pie.length > 0 && (
          <div className="card">
            <p className="eyebrow mb-1">Distribución</p>
            <h2 className="font-bold font-head text-base mb-4" style={{ color: NAVY }}>Gastos por Categoría</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pie} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                  {pie.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ fontFamily: 'Montserrat', fontSize: 12, borderRadius: 8, border: '1px solid #e8e5e0' }} />
                <Legend formatter={(v: string, e: any) => `${v} (${e.payload?.percentage}%)`} wrapperStyle={{ fontFamily: 'Montserrat', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {kpis?.weekday_sales?.length > 0 && (
        <div className="card">
          <p className="eyebrow mb-1">Patrones de venta</p>
          <h2 className="font-bold font-head text-base mb-4" style={{ color: NAVY }}>Ventas por Día — {kpis.current_month}</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={kpis.weekday_sales} barCategoryGap="30%">
              <XAxis dataKey="weekday" tick={{ fontSize: 11, fill: '#888580' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#888580' }} tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ fontFamily: 'Montserrat', fontSize: 12, borderRadius: 8, border: '1px solid #e8e5e0' }} />
              <Bar dataKey="luro_total"  name="Luro"          fill={NAVY}  radius={[4,4,0,0]} />
              <Bar dataKey="indep_total" name="Independencia" fill={CORAL} radius={[4,4,0,0]} />
              <Legend wrapperStyle={{ fontFamily: 'Montserrat', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!kpis && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center" style={{ background: NAVY }}>
            <span style={{ color: CORAL }} className="text-xl font-bold font-head">J</span>
          </div>
          <p className="font-bold font-head text-lg mb-1" style={{ color: NAVY }}>Bienvenido al ERP de JAN Orgánico Natural</p>
          <p className="text-brand-muted text-sm font-body">Comenzá cargando las ventas diarias en el módulo Ventas.</p>
        </div>
      )}
    </div>
  )
}

/* ── KPI Card ───────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, accent, negative = false }: {
  label: string; value: string; sub?: string; accent: string; negative?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card" style={{ borderTop: `3px solid ${accent}` }}>
      <p className="text-[11px] font-bold uppercase tracking-[2px] font-body mb-2" style={{ color: '#888580' }}>{label}</p>
      <p className={`text-xl font-bold font-head mb-1 ${negative ? 'text-coral' : ''}`} style={!negative ? { color: accent } : {}}>
        {value}
      </p>
      {sub && <p className="text-xs font-body" style={{ color: '#888580' }}>{sub}</p>}
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-3 rounded w-32 mb-2" style={{ background: '#e8e5e0' }} />
        <div className="h-8 rounded w-48 mb-1" style={{ background: '#e8e5e0' }} />
        <div className="h-3 rounded w-40" style={{ background: '#e8e5e0' }} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl" style={{ background: '#e8e5e0' }} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-2xl" style={{ background: '#e8e5e0' }} />)}
      </div>
      <div className="h-64 rounded-2xl" style={{ background: '#e8e5e0' }} />
    </div>
  )
}
