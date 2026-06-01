import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, X,
  Wallet, ArrowLeftRight, CreditCard, Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────
type Gasto = {
  id:             number
  year:           number
  month:          string
  day:            number
  description:    string
  amount:         number
  category:       string
  payment_method: string
  bank:           string | null
  notes:          string | null
}

type PayMethod = 'efectivo' | 'debito_automatico' | 'tarjeta_credito' | 'tarjeta_debito' | 'transferencia'

// ── Datos ─────────────────────────────────────────────────────────────────────
const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const BANKS = ['Banco Provincia', 'Banco Francés', 'Banco Galicia', 'Banco COMAFI', 'Otro banco']

const CATEGORIES: { label: string; emoji: string; color: string }[] = [
  { label: 'Impuestos',            emoji: '🏛️', color: '#dc2626' },
  { label: 'Servicios',            emoji: '💡', color: '#eab308' },
  { label: 'Entretenimiento',      emoji: '🎬', color: '#6366f1' },
  { label: 'Salud',                emoji: '🏥', color: '#ef4444' },
  { label: 'Seguros',              emoji: '🛡️', color: '#0891b2' },
  { label: 'Transporte',           emoji: '⛽', color: '#06b6d4' },
  { label: 'Deportes',             emoji: '⚽', color: '#16a34a' },
  { label: 'Educación',            emoji: '🎓', color: '#7c3aed' },
  { label: 'Compras para la casa', emoji: '🛒', color: '#22c55e' },
  { label: 'Tarjetas bancarias',   emoji: '💳', color: '#C4875A' },
]

// Subcategorías por categoría
const SUBCATEGORIES: Record<string, string[]> = {
  'Impuestos':            ['ARBA', 'Municipal'],
  'Servicios':            ['Luz', 'Camuzzi', 'Obras Sanitarias', 'Flow', 'Fanti Alarmas'],
  'Entretenimiento':      ['Spotify', 'Netflix', 'Disney+', 'Apple'],
  'Salud':                ['Obra social', 'Médicos'],
  'Seguros':              ['Seguro Vehicular Tucson', 'Seguro Vehicular Peugeot', 'Seguro de la casa'],
  'Transporte':           ['Combustible'],
  'Deportes':             ['Deporte Mariana', 'Deporte Juana', 'Deporte Juan Pedro', 'Deporte Gustavo'],
  'Educación':            ['Colegio Juanpi', 'Inglés TEC Juanpi', 'Facultad Juani'],
  'Compras para la casa': ['Supermercado', 'Verdulería', 'Farmacia', 'Limpieza'],
  'Tarjetas bancarias':   ['Mantenimiento', 'Cuotas por pagar', 'Caja de seguridad'],
}

// Categorías con gastos predeterminados (se pre-cargan cada mes)
const PREDEFINED_CATS = new Set([
  'Impuestos', 'Servicios', 'Entretenimiento', 'Salud',
  'Seguros', 'Deportes', 'Educación', 'Tarjetas bancarias',
])

const PAY_METHODS: { key: PayMethod; label: string; color: string; bg: string }[] = [
  { key: 'efectivo',          label: 'Efectivo',       color: '#16a34a', bg: '#dcfce7' },
  { key: 'debito_automatico', label: 'Débito Aut.',    color: '#0891b2', bg: '#e0f2fe' },
  { key: 'tarjeta_credito',   label: 'T. Crédito',    color: '#dc2626', bg: '#fee2e2' },
  { key: 'tarjeta_debito',    label: 'Débito',        color: '#7c3aed', bg: '#ede9fe' },
  { key: 'transferencia',     label: 'Transferencia', color: '#2563eb', bg: '#dbeafe' },
]

// Métodos disponibles en el panel de predeterminados
const PREDEF_PAY_METHODS: { key: PayMethod; label: string; color: string; bg: string }[] = [
  { key: 'efectivo',          label: 'Efectivo',    color: '#16a34a', bg: '#dcfce7' },
  { key: 'debito_automatico', label: 'Débito Aut.', color: '#0891b2', bg: '#e0f2fe' },
  { key: 'tarjeta_credito',   label: 'T. Crédito', color: '#dc2626', bg: '#fee2e2' },
  { key: 'tarjeta_debito',    label: 'Débito',     color: '#7c3aed', bg: '#ede9fe' },
]

// Métodos que requieren selección de banco
const NEEDS_BANK = new Set<PayMethod>(['debito_automatico', 'tarjeta_credito', 'tarjeta_debito', 'transferencia'])

const CORAL = '#C4875A'
const NAVY  = '#3D6B64'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function payLabel(method: string, bank: string | null) {
  const m = PAY_METHODS.find(p => p.key === method)
  const base = m?.label ?? method
  if (method === 'transferencia' && bank) return `${base} · ${bank}`
  return base
}

function isPredefined(g: Gasto): boolean {
  return PREDEFINED_CATS.has(g.category) &&
    (SUBCATEGORIES[g.category] ?? []).includes(g.description)
}

function PayBadge({ method, bank }: { method: string; bank: string | null }) {
  const m = PAY_METHODS.find(p => p.key === method)
  if (!m) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ color: m.color, background: m.bg }}>
      {method === 'efectivo'           && <Wallet size={9} />}
      {method === 'transferencia'      && <ArrowLeftRight size={9} />}
      {method === 'debito_automatico'  && <ArrowLeftRight size={9} />}
      {(method === 'tarjeta_debito' || method === 'tarjeta_credito') && <CreditCard size={9} />}
      {payLabel(method, bank)}
    </span>
  )
}

function CatBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find(c => c.label === category)
  if (!cat) return <span className="text-[10px] text-gray-400">{category}</span>
  return (
    <span className="text-[10px] font-medium" style={{ color: cat.color }}>
      {cat.emoji} {cat.label}
    </span>
  )
}

// ── Panel de Gastos Fijos predeterminados ─────────────────────────────────────
function GastosFijosPanel({
  gastos, year, monthIdx,
  onRefresh,
}: {
  gastos:    Gasto[]
  year:      number
  monthIdx:  number
  onRefresh: () => void
}) {
  const month = MONTHS[monthIdx]

  // amounts[key] = valor ingresado; methods[key] = método de pago; banks[key] = banco
  const [amounts,  setAmounts]  = useState<Record<string, string>>({})
  const [methods,  setMethods]  = useState<Record<string, PayMethod>>({})
  const [banks,    setBanks]    = useState<Record<string, string>>({})
  const [saving,   setSaving]   = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Cuando cambia el mes, limpiar inputs
  useEffect(() => { setAmounts({}); setMethods({}); setBanks({}) }, [year, monthIdx])

  // Para cada categoría predeterminada, calculá estado de cada subcategoría
  const groups = useMemo(() => {
    return CATEGORIES
      .filter(c => PREDEFINED_CATS.has(c.label))
      .map(cat => {
        const subs = SUBCATEGORIES[cat.label] ?? []
        const items = subs.map(sub => {
          const existing = gastos.find(
            g => g.category === cat.label && g.description === sub
          )
          return { sub, existing }
        })
        const done    = items.filter(i => i.existing).length
        const pending = items.filter(i => !i.existing).length
        return { cat, items, done, pending }
      })
  }, [gastos])

  const totalPendiente = groups.reduce((s, g) => s + g.pending, 0)

  async function saveItem(category: string, subcategory: string) {
    const key    = `${category}::${subcategory}`
    const raw    = amounts[key]?.replace(/\./g, '').replace(',', '.') ?? ''
    const amount = parseFloat(raw)
    if (!amount || isNaN(amount)) return

    const method = methods[key] ?? 'debito_automatico'
    const bank   = NEEDS_BANK.has(method) ? (banks[key] || null) : null

    setSaving(s => ({ ...s, [key]: true }))
    try {
      await api.post('/gastos-personales/', {
        year, month, day: 1,
        description:    subcategory,
        amount,
        category,
        payment_method: method,
        bank,
        notes: null,
      })
      setAmounts(a => { const n = { ...a }; delete n[key]; return n })
      onRefresh()
    } finally {
      setSaving(s => ({ ...s, [key]: false }))
    }
  }

  async function deleteItem(id: number) {
    await api.delete(`/gastos-personales/${id}`)
    onRefresh()
  }

  function toggleCat(label: string) {
    setExpanded(e => ({ ...e, [label]: !e[label] }))
  }

  // Inicialmente, expandir categorías con pendientes
  useEffect(() => {
    const init: Record<string, boolean> = {}
    groups.forEach(g => { init[g.cat.label] = g.pending > 0 })
    setExpanded(init)
  }, [monthIdx, year]) // solo al cambiar mes

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">Gastos fijos del mes</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {totalPendiente === 0
              ? '✅ Todo al día'
              : `${totalPendiente} pendiente${totalPendiente !== 1 ? 's' : ''} de cargar`}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: totalPendiente === 0 ? '#dcfce7' : '#fef3c7', color: totalPendiente === 0 ? '#16a34a' : '#92400e' }}>
          {totalPendiente === 0 ? '✓' : totalPendiente}
        </div>
      </div>

      {/* Grupos por categoría */}
      <div className="divide-y divide-gray-50">
        {groups.map(({ cat, items, done, pending }) => {
          const isOpen = expanded[cat.label] ?? true
          return (
            <div key={cat.label}>
              {/* Header categoría — clickeable para colapsar */}
              <button
                onClick={() => toggleCat(cat.label)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors">
                <span className="text-base">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-700">{cat.label}</p>
                  <p className="text-[10px] text-gray-400">
                    {done}/{items.length} cargados
                  </p>
                </div>
                {/* Barra de progreso mini */}
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(done / items.length) * 100}%`, background: cat.color }} />
                </div>
                {pending > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: cat.color + '18', color: cat.color }}>
                    {pending}
                  </span>
                )}
                {isOpen
                  ? <ChevronUp size={13} className="text-gray-300 shrink-0" />
                  : <ChevronDown size={13} className="text-gray-300 shrink-0" />}
              </button>

              {/* Items de la categoría */}
              {isOpen && (
                <div className="pb-2 space-y-1" style={{ background: '#fafafa' }}>
                  {items.map(({ sub, existing }) => {
                    const key = `${cat.label}::${sub}`
                    const isSaving = saving[key]

                    if (existing) {
                      // Ya cargado — mostrar monto + botón eliminar
                      return (
                        <div key={sub}
                          className="flex items-center gap-3 px-5 py-2">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: cat.color }}>
                            <Check size={9} color="white" strokeWidth={3} />
                          </div>
                          <span className="flex-1 text-xs text-gray-600">{sub}</span>
                          <span className="text-xs font-bold text-gray-900">{fmt(existing.amount)}</span>
                          <button
                            onClick={() => deleteItem(existing.id)}
                            className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    }

                    // Pendiente — input para cargar monto + método de pago
                    const currentMethod = methods[key] ?? 'debito_automatico'
                    const needsBank     = NEEDS_BANK.has(currentMethod)
                    return (
                      <div key={sub} className="px-5 py-2 space-y-1.5" style={{ background: '#fafafa' }}>
                        {/* Fila nombre + monto + guardar */}
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                          <span className="flex-1 text-xs text-gray-500 font-medium">{sub}</span>
                          <span className="text-xs text-gray-300 font-bold">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={amounts[key] ?? ''}
                            onChange={e => setAmounts(a => ({ ...a, [key]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && saveItem(cat.label, sub)}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right font-mono focus:outline-none focus:border-blue-300 bg-white"
                          />
                          <button
                            onClick={() => saveItem(cat.label, sub)}
                            disabled={isSaving || !amounts[key]}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 shrink-0"
                            style={{ background: cat.color }}>
                            {isSaving
                              ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              : <Check size={11} color="white" strokeWidth={3} />}
                          </button>
                        </div>

                        {/* Fila método de pago */}
                        <div className="flex items-center gap-1 pl-6 flex-wrap">
                          {PREDEF_PAY_METHODS.map(pm => (
                            <button key={pm.key} type="button"
                              onClick={() => { setMethods(m => ({ ...m, [key]: pm.key })); setBanks(b => ({ ...b, [key]: '' })) }}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all"
                              style={currentMethod === pm.key
                                ? { background: pm.bg, color: pm.color, borderColor: pm.color }
                                : { borderColor: '#e5e7eb', color: '#9ca3af', background: 'white' }}>
                              {pm.label}
                            </button>
                          ))}

                          {/* Banco (si aplica) */}
                          {needsBank && (
                            <select
                              value={banks[key] ?? ''}
                              onChange={e => setBanks(b => ({ ...b, [key]: e.target.value }))}
                              className="ml-1 text-[10px] border border-gray-200 rounded-full px-2 py-0.5 bg-white focus:outline-none focus:border-blue-300 text-gray-500">
                              <option value="">Banco…</option>
                              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Modal agregar gasto ───────────────────────────────────────────────────────
function AddGastoModal({
  defaultYear, defaultMonthIdx,
  onSave, onClose,
}: {
  defaultYear:      number
  defaultMonthIdx:  number
  onSave:  () => void
  onClose: () => void
}) {
  const today = new Date()

  const [amount,   setAmount]   = useState('')
  const [desc,     setDesc]     = useState('')
  const [day,      setDay]      = useState(today.getDate().toString())
  const [monthIdx, setMonthIdx] = useState(defaultMonthIdx)
  const [year,     setYear]     = useState(defaultYear)
  const [category, setCategory] = useState(CATEGORIES[0].label)
  const [subcat,   setSubcat]   = useState('')
  const [method,   setMethod]   = useState<PayMethod>('efectivo')
  const [bank,     setBank]     = useState('')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  // Cuando cambia categoría, resetear subcategoría
  function selectCategory(label: string) {
    setCategory(label)
    setSubcat('')
    setDesc('')
  }

  // Cuando elige subcategoría, pre-llenar descripción
  function selectSubcat(s: string) {
    setSubcat(s)
    setDesc(s)
  }

  const subs = SUBCATEGORIES[category] ?? []

  async function handleSave() {
    const finalDesc = desc.trim() || subcat
    if (!amount || !finalDesc) { setError('Completá monto y descripción'); return }
    if (method === 'transferencia' && !bank) { setError('Seleccioná el banco'); return }
    setSaving(true); setError('')
    try {
      await api.post('/gastos-personales/', {
        year, month: MONTHS[monthIdx], day: parseInt(day),
        description: finalDesc,
        amount: parseFloat(amount.replace(/\./g, '').replace(',', '.')),
        category, payment_method: method,
        bank: method === 'transferencia' ? bank : null,
        notes: notes.trim() || null,
      })
      onSave(); onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto">

        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg">Nuevo gasto</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* Monto */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              ¿Cuánto gastaste?
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">$</span>
              <input
                type="text" inputMode="decimal"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 focus:outline-none focus:border-blue-400 transition-colors"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Categoría</label>
            <div className="grid grid-cols-5 gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.label} type="button"
                  onClick={() => selectCategory(cat.label)}
                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 transition-all text-center"
                  style={category === cat.label
                    ? { borderColor: cat.color, background: cat.color + '18' }
                    : { borderColor: '#f1f5f9' }}
                >
                  <span className="text-lg leading-none">{cat.emoji}</span>
                  <span className="text-[8px] font-bold leading-tight text-center"
                    style={category === cat.label ? { color: cat.color } : { color: '#94a3b8' }}>
                    {cat.label.split(' ').slice(0, 2).join(' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Subcategoría */}
          {subs.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Subcategoría</label>
              <div className="flex flex-wrap gap-2">
                {subs.map(s => (
                  <button key={s} type="button"
                    onClick={() => selectSubcat(s)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all"
                    style={subcat === s
                      ? { borderColor: CATEGORIES.find(c => c.label === category)?.color ?? CORAL, background: (CATEGORIES.find(c => c.label === category)?.color ?? CORAL) + '18', color: CATEGORIES.find(c => c.label === category)?.color ?? CORAL }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              Descripción <span className="text-gray-300 font-normal normal-case">(opcional si elegiste subcategoría)</span>
            </label>
            <input
              value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-blue-400 transition-colors"
              placeholder="Ej: Factura de luz, cuota del gimnasio…"
            />
          </div>

          {/* Fecha */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Día</label>
              <input type="number" min={1} max={31}
                value={day} onChange={e => setDay(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5 text-sm font-mono text-center focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Mes</label>
              <select value={monthIdx} onChange={e => setMonthIdx(parseInt(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-2xl px-2 py-2.5 text-sm focus:outline-none focus:border-blue-400">
                {MESES_ES.map((m, i) => <option key={i} value={i}>{m.slice(0, 3)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Año</label>
              <input type="number"
                value={year} onChange={e => setYear(parseInt(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5 text-sm font-mono text-center focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Medio de pago */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">¿Cómo pagaste?</label>
            <div className="grid grid-cols-2 gap-2">
              {PAY_METHODS.map(pm => (
                <button key={pm.key} type="button"
                  onClick={() => setMethod(pm.key)}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border-2 font-bold text-sm transition-all"
                  style={method === pm.key
                    ? { borderColor: pm.color, background: pm.bg, color: pm.color }
                    : { borderColor: '#f1f5f9', color: '#9ca3af' }}>
                  {pm.key === 'efectivo'       && <Wallet size={15} />}
                  {pm.key === 'transferencia'  && <ArrowLeftRight size={15} />}
                  {(pm.key === 'tarjeta_debito' || pm.key === 'tarjeta_credito') && <CreditCard size={15} />}
                  {pm.label}
                </button>
              ))}
            </div>

            {method === 'transferencia' && (
              <div className="mt-3">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">¿Desde qué banco?</label>
                <div className="grid grid-cols-2 gap-2">
                  {BANKS.map(b => (
                    <button key={b} type="button"
                      onClick={() => setBank(b)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        bank === b ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      }`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              Notas <span className="text-gray-300 font-normal normal-case">(opcional)</span>
            </label>
            <input
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Algún detalle extra…"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm px-5 pb-2">{error}</p>}

        <div className="px-5 pb-6 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60 transition-opacity hover:opacity-90"
            style={{ background: saving ? '#94a3b8' : CORAL }}>
            {saving ? 'Guardando…' : '✓ Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function GastosPersonales() {
  const today = new Date()
  const [monthIdx, setMonthIdx] = useState(CURRENT_MONTH_IDX)
  const [year,     setYear]     = useState(CURRENT_YEAR)
  const [gastos,   setGastos]   = useState<Gasto[]>([])
  const [loading,  setLoading]  = useState(false)
  const [showAdd,  setShowAdd]  = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const month = MONTHS[monthIdx]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<Gasto[]>(`/gastos-personales/${year}/${month}`)
      setGastos(data)
    } finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (monthIdx === 0) { setMonthIdx(11); setYear(y => y - 1) }
    else setMonthIdx(m => m - 1)
  }
  function nextMonth() {
    if (monthIdx === 11) { setMonthIdx(0); setYear(y => y + 1) }
    else setMonthIdx(m => m + 1)
  }

  async function handleDelete(id: number) {
    setGastos(gs => gs.filter(g => g.id !== id))
    await api.delete(`/gastos-personales/${id}`)
    setDeleteId(null)
  }

  // Gastos que NO son predefinidos (compras espontáneas, transporte, etc.)
  const otrosGastos = useMemo(
    () => gastos.filter(g => !isPredefined(g)),
    [gastos]
  )

  // Totales (de todos los gastos del mes)
  const totals = useMemo(() => {
    const total    = gastos.reduce((s, g) => s + g.amount, 0)
    const efectivo = gastos.filter(g => g.payment_method === 'efectivo').reduce((s, g) => s + g.amount, 0)
    const transf   = gastos.filter(g => g.payment_method === 'transferencia').reduce((s, g) => s + g.amount, 0)
    const tarjeta  = gastos.filter(g => g.payment_method.startsWith('tarjeta')).reduce((s, g) => s + g.amount, 0)
    return { total, efectivo, transf, tarjeta }
  }, [gastos])

  // Por categoría para el resumen
  const porCategoria = useMemo(() => {
    const map: Record<string, number> = {}
    gastos.forEach(g => { map[g.category] = (map[g.category] ?? 0) + g.amount })
    return Object.entries(map).sort(([, a], [, b]) => b - a)
  }, [gastos])

  const isCurrentMonth = monthIdx === today.getMonth() && year === today.getFullYear()

  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gastos Personales</h1>
        <p className="text-gray-400 text-sm mt-1">Control mensual de la familia</p>
      </div>

      {/* Navegador de mes */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-3">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{MESES_ES[monthIdx]}</p>
          <p className="text-xs text-gray-400">{year}</p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Resumen total */}
      {gastos.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wide">Total del mes</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{fmt(totals.total)}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {totals.efectivo > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50">
                  <Wallet size={13} className="text-green-600" />
                  <div>
                    <p className="text-[9px] text-green-600 font-bold uppercase">Efectivo</p>
                    <p className="text-sm font-bold text-green-700">{fmt(totals.efectivo)}</p>
                  </div>
                </div>
              )}
              {totals.transf > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50">
                  <ArrowLeftRight size={13} className="text-blue-600" />
                  <div>
                    <p className="text-[9px] text-blue-600 font-bold uppercase">Transferencia</p>
                    <p className="text-sm font-bold text-blue-700">{fmt(totals.transf)}</p>
                  </div>
                </div>
              )}
              {totals.tarjeta > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50">
                  <CreditCard size={13} className="text-purple-600" />
                  <div>
                    <p className="text-[9px] text-purple-600 font-bold uppercase">Tarjeta</p>
                    <p className="text-sm font-bold text-purple-700">{fmt(totals.tarjeta)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Por categoría */}
          {porCategoria.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wide mb-3">Por categoría</p>
              <div className="space-y-2">
                {porCategoria.map(([cat, total]) => {
                  const catData = CATEGORIES.find(c => c.label === cat)
                  const pct     = totals.total > 0 ? Math.round((total / totals.total) * 100) : 0
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-base w-6 text-center">{catData?.emoji ?? '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-gray-700">{cat}</span>
                          <span className="text-xs font-bold text-gray-900">{fmt(total)}</span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: catData?.color ?? '#64748b' }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Panel de gastos fijos predeterminados */}
      {loading
        ? <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">Cargando…</div>
        : <GastosFijosPanel gastos={gastos} year={year} monthIdx={monthIdx} onRefresh={load} />
      }

      {/* Otros gastos (no predefinidos) */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wide">
            Otros gastos del mes
          </p>
          <span className="text-[10px] text-gray-300">{otrosGastos.length}</span>
        </div>

        {otrosGastos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <span className="text-4xl mb-2">💸</span>
            <p className="text-gray-400 text-sm">
              {isCurrentMonth ? 'Usá el + para agregar gastos adicionales.' : 'Sin otros gastos registrados.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {otrosGastos.map(g => (
              <div key={g.id}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50 group transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-gray-600">{g.day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{g.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <CatBadge category={g.category} />
                    <span className="text-gray-300">·</span>
                    <PayBadge method={g.payment_method} bank={g.bank} />
                  </div>
                  {g.notes && <p className="text-[10px] text-gray-400 italic mt-0.5 truncate">{g.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{fmt(g.amount)}</p>
                </div>
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {deleteId === g.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(g.id)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100">
                        Sí
                      </button>
                      <button onClick={() => setDeleteId(null)}
                        className="px-2 py-1 rounded-lg text-[10px] text-gray-400 hover:bg-gray-100">
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteId(g.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 z-30"
        style={{ background: CORAL, boxShadow: `0 4px 20px ${CORAL}60` }}
        title="Agregar gasto">
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {showAdd && (
        <AddGastoModal
          defaultYear={year} defaultMonthIdx={monthIdx}
          onSave={load} onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
