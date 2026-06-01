import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { BookOpen, X, TrendingUp, TrendingDown, DollarSign, Info } from 'lucide-react'
import { api, fmt$, CURRENT_YEAR } from '../api'

// ── Definición de filas ───────────────────────────────────────────────────────
const INGRESO_ROWS = [
  { key: 'ventas_efectivo',    label: 'Ventas en efectivo' },
  { key: 'cobros_credito',     label: 'Cobros de ventas a crédito' },
  { key: 'cobros_activo_fijo', label: 'Cobros por ventas de activo fijo' },
]

const EGRESO_ROWS = [
  { key: 'compra_mercancia',   label: 'Compra de mercancía' },
  { key: 'pago_nomina',        label: 'Pago de nómina' },
  { key: 'pago_seg_social',    label: 'Pago de Seguridad social' },
  { key: 'pago_proveedores',   label: 'Pago proveedores' },
  { key: 'pago_impuestos',     label: 'Pago de impuestos' },
  { key: 'pago_servicios',     label: 'Pago de servicios públicos' },
  { key: 'pago_alquiler',      label: 'Pago de alquiler' },
  { key: 'pago_mantenimiento', label: 'Pago de mantenimiento' },
  { key: 'pago_publicidad',    label: 'Pago de publicidad' },
]

const FINANCIAMIENTO_ROWS = [
  { key: 'prestamo_recibido', label: 'Préstamo recibido' },
  { key: 'pago_prestamos',    label: 'Pago de préstamos' },
]

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
               'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']

// ── Helpers numéricos ─────────────────────────────────────────────────────────
function $n(n: number): string {
  if (n === 0) return '0'
  const abs = Math.abs(n)
  const s = abs >= 1000
    ? abs.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : abs.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return n < 0 ? `(${s})` : s
}

function numColor(n: number): string {
  if (n > 0) return '#15803d'
  if (n < 0) return '#b91c1c'
  return '#9ca3af'
}

// ── Celda editable ────────────────────────────────────────────────────────────
function EditCell({
  value, onSave, readOnly = false, color,
}: { value: number; onSave: (v: number) => void; readOnly?: boolean; color?: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText]       = useState('')
  const ref = useRef<HTMLInputElement>(null)

  const commit = () => {
    const v = parseFloat(text.replace(',', '.')) || 0
    onSave(v)
    setEditing(false)
  }

  if (readOnly) {
    return (
      <span className="block text-right text-xs tabular-nums pr-1 select-none"
        style={{ color: color ?? numColor(value) }}>
        {$n(value)}
      </span>
    )
  }

  if (editing) {
    return (
      <input ref={ref} type="number" step="0.01"
        className="w-full text-right text-xs outline-none bg-blue-50 rounded px-1 tabular-nums"
        style={{ minWidth: 64 }}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        autoFocus
      />
    )
  }

  return (
    <span
      className="block text-right text-xs tabular-nums pr-1 cursor-text rounded hover:bg-blue-50/60 transition-colors"
      style={{ minWidth: 64, color: value !== 0 ? numColor(value) : '#d1d5db' }}
      onClick={() => { setText(value !== 0 ? String(value) : ''); setEditing(true) }}>
      {$n(value)}
    </span>
  )
}

// ── Modal guía devengado/percibido ────────────────────────────────────────────
function GuiaModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(7,6,20,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-coral/10 flex items-center justify-center">
              <BookOpen size={18} className="text-coral" />
            </div>
            <div>
              <h3 className="font-bold text-brand-body text-base">Guía: Flujo de Caja</h3>
              <p className="text-xs text-brand-muted">Devengado · Percibido · Cómo leer esta planilla</p>
            </div>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-body p-1">
            <X size={18}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm text-brand-body leading-relaxed">

          {/* Qué es el flujo de caja */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={15} className="text-coral shrink-0"/>
              <h4 className="font-bold text-brand-body">¿Qué es el flujo de caja?</h4>
            </div>
            <p className="text-brand-muted text-xs leading-relaxed">
              Es un registro mes a mes de <strong>cuándo entra y cuándo sale el efectivo</strong> de la empresa.
              No es lo mismo que las ganancias contables: un mes puede ser muy rentable pero tener poco
              efectivo disponible si los clientes no pagaron aún.
            </p>
          </section>

          <hr className="border-brand-border"/>

          {/* Devengado vs Percibido */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={15} className="text-coral shrink-0"/>
              <h4 className="font-bold text-brand-body">Devengado vs Percibido</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-xs font-bold text-blue-800 mb-1">📋 Devengado</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Se registra <strong>cuando nace la obligación</strong>, aunque el pago
                  sea posterior. Ejemplo: comprás madera en mayo con pago a 60 días →
                  la imputás en <strong>mayo</strong>.
                </p>
                <p className="text-[11px] text-blue-500 mt-2 italic">
                  Usado en contabilidad formal y Ganancias 3ra categoría.
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                <p className="text-xs font-bold text-green-800 mb-1">💵 Percibido</p>
                <p className="text-xs text-green-700 leading-relaxed">
                  Se registra <strong>cuando entra o sale el efectivo</strong>.
                  Ejemplo: comprás madera en mayo pero pagás en junio →
                  la imputás en <strong>junio</strong>.
                </p>
                <p className="text-[11px] text-green-500 mt-2 italic">
                  Usado en el flujo de caja y análisis financiero.
                </p>
              </div>
            </div>
          </section>

          {/* Caso JAN Orgánico Natural */}
          <section className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1">¿Qué usar en JAN Orgánico Natural?</p>
                <ul className="text-xs text-amber-700 space-y-1 leading-relaxed">
                  <li><strong>Contabilidad / libro contable:</strong> criterio devengado (lo exigen las normas NIIF y Ganancias).</li>
                  <li><strong>Este flujo de caja:</strong> criterio percibido — registrá los ingresos cuando el cliente paga y los egresos cuando efectivamente sale el dinero de la caja.</li>
                  <li><strong>Compra en mayo, pago en junio:</strong> en el flujo de caja registrala en junio. En el libro contable, en mayo.</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="border-brand-border"/>

          {/* Cómo leer la planilla */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown size={15} className="text-coral shrink-0"/>
              <h4 className="font-bold text-brand-body">Cómo leer esta planilla</h4>
            </div>
            <div className="space-y-2 text-xs text-brand-muted">
              <div className="flex gap-3 items-start">
                <span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-300 shrink-0 mt-0.5"/>
                <p><strong className="text-brand-body">Saldo inicial:</strong> lo que había en caja al inicio del mes. Para enero lo ingresás vos; los demás meses se calculan solos del flujo del mes anterior.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300 shrink-0 mt-0.5"/>
                <p><strong className="text-brand-body">Ingresos:</strong> ventas cobradas en efectivo, cobros a clientes que pagaron deudas, o venta de un activo fijo.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 shrink-0 mt-0.5"/>
                <p><strong className="text-brand-body">Egresos:</strong> pagos realizados ese mes — proveedores, sueldos, impuestos, alquiler, etc.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-3 h-3 rounded-sm bg-green-200 border border-green-400 shrink-0 mt-0.5"/>
                <p><strong className="text-brand-body">Flujo de caja económico:</strong> Saldo + Ingresos − Egresos. Muestra la liquidez operativa antes de financiamiento.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 shrink-0 mt-0.5"/>
                <p><strong className="text-brand-body">Financiamiento:</strong> préstamos recibidos (entran plata) y cuotas de préstamos pagadas (salen).</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-3 h-3 rounded-sm bg-indigo-200 border border-indigo-400 shrink-0 mt-0.5"/>
                <p><strong className="text-brand-body">Flujo de caja financiero:</strong> resultado final del mes. Este número pasa automáticamente como <em>Saldo inicial</em> del mes siguiente.</p>
              </div>
            </div>
          </section>

          <div className="text-[11px] text-brand-muted/60 pt-1 border-t border-brand-border">
            Hacé clic en cualquier celda blanca para editarla. Los campos sombreados se calculan automáticamente.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FlujoCaja() {
  const [year, setYear]       = useState(CURRENT_YEAR)
  const [data, setData]       = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [showGuia, setShowGuia] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get<Record<string, Record<string, number>>>(`/cashflow/${year}`)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year])

  useEffect(() => { load() }, [load])

  const getRaw = (key: string, mes: string): number => data[key]?.[mes] ?? 0

  // Pre-calcular todos los valores derivados (cascade)
  const calc = useMemo(() => {
    const res: Record<string, Record<string, number>> = {}
    for (let i = 0; i < MESES.length; i++) {
      const mes = MESES[i]
      res[mes] = {}

      // Ingresos
      const totalI = INGRESO_ROWS.reduce((a, r) => a + getRaw(r.key, mes), 0)
      res[mes].total_ingresos = totalI

      // Egresos
      const totalE = EGRESO_ROWS.reduce((a, r) => a + getRaw(r.key, mes), 0)
      res[mes].total_egresos = totalE

      // Saldo inicial
      if (i === 0) {
        res[mes].saldo_inicial = getRaw('saldo_inicial', 'ENERO')
      } else {
        res[mes].saldo_inicial = res[MESES[i - 1]].flujo_financiero
      }

      // Flujo económico
      res[mes].flujo_economico = res[mes].saldo_inicial + totalI - totalE

      // Financiamiento
      const prestamo = getRaw('prestamo_recibido', mes)
      const pagoPrest = getRaw('pago_prestamos', mes)
      res[mes].total_financiamiento = prestamo - pagoPrest

      // Flujo financiero
      res[mes].flujo_financiero = res[mes].flujo_economico + res[mes].total_financiamiento
    }
    return res
  }, [data]) // eslint-disable-line

  // Totales anuales (columna Total)
  const annual = useMemo(() => {
    const a: Record<string, number> = {}
    const allKeys = [...INGRESO_ROWS, ...EGRESO_ROWS, ...FINANCIAMIENTO_ROWS].map(r => r.key)
    allKeys.push('saldo_inicial')
    for (const key of allKeys) {
      a[key] = MESES.reduce((s, m) => s + getRaw(key, m), 0)
    }
    a.total_ingresos       = MESES.reduce((s, m) => s + calc[m].total_ingresos, 0)
    a.total_egresos        = MESES.reduce((s, m) => s + calc[m].total_egresos, 0)
    a.total_financiamiento = MESES.reduce((s, m) => s + calc[m].total_financiamiento, 0)
    return a
  }, [calc]) // eslint-disable-line

  const saveCell = async (key: string, mes: string, value: number) => {
    setData(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [mes]: value },
    }))
    await api.put(`/cashflow/${year}/${key}/${mes}`, { amount: value })
  }

  // ── Builders de filas ────────────────────────────────────────────────────────
  const thMes = 'px-1.5 py-2 text-center text-[10px] font-bold uppercase tracking-widest border-r border-white/20 last:border-0'
  const tdMes = 'px-1 py-1 border-r border-gray-100 last:border-0'

  function RowEditable({ rowKey, label, sign = 1 }: { rowKey: string; label: string; sign?: number }) {
    const total = annual[rowKey] ?? 0
    return (
      <tr className="hover:bg-gray-50/60 border-b border-gray-100 transition-colors">
        <td className="pl-8 pr-2 py-1.5 text-xs text-brand-body">{label}</td>
        {MESES.map(mes => (
          <td key={mes} className={tdMes}>
            <EditCell value={getRaw(rowKey, mes) * sign}
              onSave={v => saveCell(rowKey, mes, v * sign)} />
          </td>
        ))}
        <td className="px-2 py-1 bg-gray-50 border-l border-gray-200">
          <span className="block text-right text-xs tabular-nums font-semibold"
            style={{ color: total !== 0 ? numColor(total) : '#d1d5db' }}>
            {$n(total)}
          </span>
        </td>
      </tr>
    )
  }

  function RowCalc({ label, calcKey, bg, bold }: {
    label: string; calcKey: string; bg?: string; bold?: boolean
  }) {
    const annualVal = MESES.reduce((s, m) => s + (calc[m]?.[calcKey] ?? 0), 0)
    return (
      <tr style={{ backgroundColor: bg ?? '#f9fafb' }}
        className="border-b border-gray-200">
        <td className={['pl-4 pr-2 py-2 text-xs', bold ? 'font-bold text-brand-body' : 'text-brand-muted'].join(' ')}>
          {label}
        </td>
        {MESES.map(mes => {
          const v = calc[mes]?.[calcKey] ?? 0
          return (
            <td key={mes} className={tdMes}>
              <span className="block text-right text-xs tabular-nums font-semibold"
                style={{ color: numColor(v) }}>
                {$n(v)}
              </span>
            </td>
          )
        })}
        <td className="px-2 py-1 border-l border-gray-200" style={{ backgroundColor: bg ?? '#f3f4f6' }}>
          <span className="block text-right text-xs tabular-nums font-bold"
            style={{ color: numColor(annualVal) }}>
            {$n(annualVal)}
          </span>
        </td>
      </tr>
    )
  }

  function SectionHeader({ label }: { label: string }) {
    return (
      <tr>
        <td colSpan={14}
          className="pl-4 pr-2 pt-4 pb-1 text-xs font-bold uppercase tracking-widest text-brand-body border-b-2 border-gray-200">
          {label}
        </td>
      </tr>
    )
  }

  function Spacer() {
    return <tr><td colSpan={14} className="py-1 bg-white border-b border-gray-100"/></tr>
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Flujo de Caja</h1>
          <p className="text-brand-muted text-sm">Estado mensual de entradas y salidas de efectivo</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="input w-28 text-sm">
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <button onClick={() => setShowGuia(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-coral/30 text-coral hover:bg-coral/5 transition-colors">
            <BookOpen size={14}/> Guía
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-brand-muted text-sm">Cargando flujo de caja...</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 1050 }}>
              {/* ── Encabezado de columnas ── */}
              <thead>
                <tr>
                  <th className="pl-4 pr-2 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-brand-body bg-white sticky left-0 z-10 border-b-2 border-gray-200"
                    style={{ minWidth: 200 }}>
                    Concepto
                  </th>
                  {MESES_CORTO.map((m, i) => (
                    <th key={m} className={thMes + ' bg-navy text-white border-b-2 border-gray-200'}
                      style={{ minWidth: 68 }}>
                      {m}
                    </th>
                  ))}
                  <th className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-widest bg-navy text-white/80 border-b-2 border-gray-200"
                    style={{ minWidth: 80 }}>
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* ── Saldo inicial ── */}
                <tr className="border-b border-gray-200" style={{ backgroundColor: '#e0f7f4' }}>
                  <td className="pl-4 pr-2 py-2 text-xs font-bold text-teal-800 sticky left-0 z-10"
                    style={{ backgroundColor: '#e0f7f4' }}>
                    Saldo inicial
                  </td>
                  {MESES.map((mes, i) => (
                    <td key={mes} className={tdMes}>
                      {i === 0
                        ? <EditCell value={getRaw('saldo_inicial', 'ENERO')}
                            onSave={v => saveCell('saldo_inicial', 'ENERO', v)} />
                        : <EditCell value={calc[mes]?.saldo_inicial ?? 0} onSave={() => {}} readOnly
                            color="#0f766e" />}
                    </td>
                  ))}
                  <td className="px-2 py-1 border-l border-teal-200" style={{ backgroundColor: '#ccf2ee' }}>
                    <span className="block text-right tabular-nums font-bold text-teal-700">—</span>
                  </td>
                </tr>

                <Spacer/>

                {/* ── Ingresos ── */}
                <SectionHeader label="Ingresos"/>
                {INGRESO_ROWS.map(r => <RowEditable key={r.key} rowKey={r.key} label={r.label}/>)}
                <RowCalc label="Total Ingresos" calcKey="total_ingresos" bg="#f0fdf4" bold/>

                <Spacer/>

                {/* ── Egresos ── */}
                <SectionHeader label="Egresos"/>
                {EGRESO_ROWS.map(r => <RowEditable key={r.key} rowKey={r.key} label={r.label}/>)}
                <RowCalc label="Total Egresos" calcKey="total_egresos" bg="#fff1f2" bold/>

                <Spacer/>

                {/* ── Flujo económico ── */}
                <tr style={{ backgroundColor: '#dcfce7' }} className="border-b-2 border-green-300">
                  <td className="pl-4 pr-2 py-2.5 text-xs font-bold text-green-800 sticky left-0 z-10"
                    style={{ backgroundColor: '#dcfce7' }}>
                    Flujo de caja económico
                  </td>
                  {MESES.map(mes => {
                    const v = calc[mes]?.flujo_economico ?? 0
                    return (
                      <td key={mes} className={tdMes}>
                        <span className="block text-right tabular-nums font-bold"
                          style={{ color: numColor(v) }}>{$n(v)}</span>
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 border-l border-green-200" style={{ backgroundColor: '#bbf7d0' }}>
                    <span className="block text-right tabular-nums font-bold text-green-800">—</span>
                  </td>
                </tr>

                <Spacer/>

                {/* ── Financiamiento ── */}
                <SectionHeader label="Financiamiento"/>
                <RowEditable rowKey="prestamo_recibido" label="Préstamo recibido"/>
                <RowEditable rowKey="pago_prestamos"    label="Pago de préstamos"/>
                <RowCalc label="Total Financiamiento" calcKey="total_financiamiento" bg="#eff6ff" bold/>

                <Spacer/>

                {/* ── Flujo financiero ── */}
                <tr style={{ backgroundColor: '#dbeafe' }} className="border-b-2 border-blue-300">
                  <td className="pl-4 pr-2 py-2.5 text-xs font-bold text-blue-900 sticky left-0 z-10"
                    style={{ backgroundColor: '#dbeafe' }}>
                    Flujo de caja financiero
                  </td>
                  {MESES.map(mes => {
                    const v = calc[mes]?.flujo_financiero ?? 0
                    return (
                      <td key={mes} className={tdMes}>
                        <span className="block text-right tabular-nums font-bold"
                          style={{ color: numColor(v) }}>{$n(v)}</span>
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 border-l border-blue-200" style={{ backgroundColor: '#bfdbfe' }}>
                    <span className="block text-right tabular-nums font-bold text-blue-900">—</span>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* Leyenda */}
          <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-4 text-[11px] text-brand-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-400 inline-block"/>
              Saldo inicial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-400 inline-block"/>
              Flujo económico
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-400 inline-block"/>
              Flujo financiero
            </span>
            <span className="flex items-center gap-1.5 ml-auto italic">
              Hacé clic en cualquier número blanco para editarlo
            </span>
          </div>
        </div>
      )}

      {/* Modal guía */}
      {showGuia && <GuiaModal onClose={() => setShowGuia(false)}/>}
    </div>
  )
}
