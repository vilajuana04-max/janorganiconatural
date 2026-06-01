import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, FileDown, Search, Lock,
  ChevronDown, ChevronUp, Settings, History, X
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { api, fmt$, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

const NAVY      = '#3D6B64'
const CORAL     = '#C4875A'
const ALL_YEARS = [2024, 2025, 2026, 2027]

/* ── Colores por proveedor (hash determinístico) ─────────────── */
const PROV_PALETTE = [
  '#C4875A', // amber
  '#2563eb', // blue
  '#16a34a', // green
  '#9333ea', // purple
  '#ca8a04', // amber
  '#0891b2', // cyan
  '#dc2626', // red
  '#059669', // emerald
  '#d97706', // orange
  '#7c3aed', // violet
  '#0f766e', // teal
  '#b45309', // brown-amber
]
function providerColor(name: string): string {
  if (!name) return '#888580'
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(31, h) + name.charCodeAt(i) | 0
  }
  return PROV_PALETTE[Math.abs(h) % PROV_PALETTE.length]
}

/* ── Proveedores preset (localStorage) ─────────────────────────────── */
const DEFAULT_PROVIDERS = [
  'DEL CENTRO', 'CLARO', 'DECOFORMA', 'GONZALEZ TUDANCA',
  'HERRAJES VERONA SRL', 'IVAN SA', 'LAR', 'MADERERA JUAN B. JUSTO',
  'MULTIMETROS', 'NAFTA', 'ROMANO ROBERTO', 'SANCHEZ DIEGO',
  'SAN FRANCISCO', 'THARSA', 'VARIOS',
]
const PROV_KEY = 'surm_preset_providers_v2'
const loadPresets = (): string[] => {
  try {
    const s = localStorage.getItem(PROV_KEY)
    return s ? JSON.parse(s) : DEFAULT_PROVIDERS
  } catch { return DEFAULT_PROVIDERS }
}
const savePresets = (list: string[]) =>
  localStorage.setItem(PROV_KEY, JSON.stringify(list))

/* ── Tipos ─────────────────────────────────────────────────────────── */
type Purchase = {
  id: number
  purchase_date: string | null
  invoice_number: string | null
  provider_name: string | null
  total_amount: number
  flag: string | null
  month_label: string
  year: number
  closed: boolean
}
type HistoryRow = { month: string; total: number; count: number }

const emptyForm = {
  purchase_date: '', invoice_number: '',
  provider_name: '', provider_custom: '',
  use_custom: false, total_amount: '',
}

const MONTH_ABBR: Record<string, string> = {
  ENERO:'Ene', FEBRERO:'Feb', MARZO:'Mar', ABRIL:'Abr',
  MAYO:'May', JUNIO:'Jun', JULIO:'Jul', AGOSTO:'Ago',
  SEPTIEMBRE:'Sep', OCTUBRE:'Oct', NOVIEMBRE:'Nov', DICIEMBRE:'Dic',
}

/* ── Componente principal ───────────────────────────────────────────── */
export default function Compras() {
  const [year,  setYear]  = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(MONTHS[CURRENT_MONTH_IDX])

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [summary,   setSummary]   = useState<any[]>([])
  const [history,   setHistory]   = useState<HistoryRow[]>([])

  const [form,    setForm]    = useState(emptyForm)
  const [adding,  setAdding]  = useState(false)
  const [saving,  setSaving]  = useState(false)

  // Preset providers
  const [presets,     setPresets]     = useState<string[]>(loadPresets)
  const [showSettings, setShowSettings] = useState(false)
  const [newPreset,   setNewPreset]   = useState('')

  // Filters
  const [filterProvider, setFilterProvider] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [filterMinAmt,   setFilterMinAmt]   = useState('')
  const [filterMaxAmt,   setFilterMaxAmt]   = useState('')
  const [showFilters,    setShowFilters]    = useState(false)
  const [sortField, setSortField] = useState<'date'|'amount'|'provider'>('date')
  const [sortAsc,   setSortAsc]   = useState(false)

  // ARCA
  const [arcaAmount, setArcaAmount] = useState(0)
  const [arcaInput,  setArcaInput]  = useState('')
  const [arcaSaving, setArcaSaving] = useState(false)

  // Historial
  const [showHistorial,  setShowHistorial]  = useState(false)
  const [histYear,       setHistYear]       = useState(CURRENT_YEAR)
  const [histMonth,      setHistMonth]      = useState(
    MONTHS[CURRENT_MONTH_IDX > 0 ? CURRENT_MONTH_IDX - 1 : 11]
  )
  const [histPurchases, setHistPurchases] = useState<Purchase[]>([])
  const [histLoading,   setHistLoading]   = useState(false)

  /* ── Carga de datos ─────────────────────────────────────────────── */
  const load = useCallback(() => {
    api.get<Purchase[]>(`/purchases/?month=${month}&year=${year}`)
      .then(setPurchases).catch(() => setPurchases([]))
    api.get<any[]>(`/purchases/summary/${year}/${month}`)
      .then(setSummary).catch(() => setSummary([]))
    api.get<{ amount: number }>(`/purchases/arca/${year}/${month}`)
      .then(r => { setArcaAmount(r.amount); setArcaInput(r.amount > 0 ? String(r.amount) : '') })
      .catch(() => setArcaAmount(0))
  }, [month, year])

  const loadHistory = useCallback(() => {
    api.get<HistoryRow[]>(`/purchases/history/${year}`)
      .then(setHistory).catch(() => setHistory([]))
  }, [year])

  useEffect(() => { load() },        [load])
  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    if (!showHistorial) return
    setHistLoading(true)
    api.get<Purchase[]>(`/purchases/?month=${histMonth}&year=${histYear}`)
      .then(setHistPurchases).catch(() => setHistPurchases([]))
      .finally(() => setHistLoading(false))
  }, [showHistorial, histYear, histMonth])

  /* ── Filtrado + orden ───────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = [...purchases]
    if (filterProvider)
      list = list.filter(p => p.provider_name?.toLowerCase().includes(filterProvider.toLowerCase()))
    if (filterDateFrom) list = list.filter(p => p.purchase_date && p.purchase_date >= filterDateFrom)
    if (filterDateTo)   list = list.filter(p => p.purchase_date && p.purchase_date <= filterDateTo)
    if (filterMinAmt)   list = list.filter(p => p.total_amount >= Number(filterMinAmt))
    if (filterMaxAmt)   list = list.filter(p => p.total_amount <= Number(filterMaxAmt))
    list.sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'date')     { va = a.purchase_date ?? ''; vb = b.purchase_date ?? '' }
      if (sortField === 'amount')   { va = a.total_amount;         vb = b.total_amount }
      if (sortField === 'provider') { va = a.provider_name ?? '';  vb = b.provider_name ?? '' }
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
    return list
  }, [purchases, filterProvider, filterDateFrom, filterDateTo, filterMinAmt, filterMaxAmt, sortField, sortAsc])

  const totalMes      = purchases.reduce((a, p) => a + p.total_amount, 0)
  const totalFiltered = filtered.reduce((a, p) => a + p.total_amount, 0)
  const isClosed      = purchases.length > 0 && purchases.every(p => p.closed)
  const hasFilters    = !!(filterProvider || filterDateFrom || filterDateTo || filterMinAmt || filterMaxAmt)

  const arcaBalance = arcaAmount - totalMes
  const arcaPct     = arcaAmount > 0 ? Math.round(totalMes / arcaAmount * 100) : null

  /* ── Acciones ───────────────────────────────────────────────────── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const provName = form.use_custom ? form.provider_custom : form.provider_name
    if (!provName || !form.total_amount) return
    setSaving(true)
    try {
      await api.post('/purchases/', {
        purchase_date:  form.purchase_date  || null,
        invoice_number: form.invoice_number || null,
        provider_name:  provName.toUpperCase(),
        total_amount:   parseFloat(form.total_amount),
        month_label: month, year,
      })
      setForm(emptyForm); setAdding(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta factura?')) return
    await api.delete(`/purchases/${id}`); load()
  }

  const handleCloseMonth = async () => {
    if (!confirm(`¿Cerrar ${month} ${year}? Las facturas quedarán bloqueadas.`)) return
    await api.post(`/purchases/close-month/${year}/${month}`, {}); load()
  }

  const handleSaveArca = async () => {
    const amt = parseFloat(arcaInput)
    if (isNaN(amt)) return
    setArcaSaving(true)
    try {
      await api.post(`/purchases/arca/${year}/${month}`, { amount: amt })
      setArcaAmount(amt)   // update local state immediately
    } catch (err: any) {
      alert(`Error al guardar ARCA: ${err.message}`)
    } finally {
      setArcaSaving(false)
    }
  }

  const handlePdf = async (path: string, filename: string) => {
    try {
      await api.pdf(path, filename)
    } catch (err: any) {
      alert(`Error al generar PDF:\n${err.message}`)
    }
  }

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(s => !s)
    else { setSortField(field); setSortAsc(true) }
  }

  const addPreset = () => {
    const name = newPreset.trim().toUpperCase()
    if (!name || presets.includes(name)) return
    const next = [...presets, name].sort()
    setPresets(next); savePresets(next); setNewPreset('')
  }
  const removePreset = (name: string) => {
    const next = presets.filter(p => p !== name)
    setPresets(next); savePresets(next)
  }

  /* ── Sub-componentes ────────────────────────────────────────────── */
  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
      : null

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="font-bold text-gray-700 mb-0.5">{label}</p>
        <p style={{ color: CORAL }} className="font-semibold">{fmt$(payload[0].value)}</p>
        <p className="text-gray-400">{payload[0].payload.count} facturas</p>
      </div>
    )
  }

  const histTotal = histPurchases.reduce((a, p) => a + p.total_amount, 0)

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1">JAN Orgánico Natural · ERP</p>
          <h1 className="text-2xl font-bold text-white">Compras y Gastos</h1>
          <p className="text-white/50 text-sm">Registro de facturas — una por fila</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {ALL_YEARS.map(y => <option key={y} className="text-black">{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm">
            {MONTHS.map(m => <option key={m} className="text-black">{m}</option>)}
          </select>
          <button
            onClick={() => handlePdf(`/purchases/pdf/${year}/${month}`, `compras_${month}_${year}.pdf`)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-2 rounded-lg text-sm">
            <FileDown size={15} /> PDF
          </button>
          <button onClick={() => setShowHistorial(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-2 rounded-lg text-sm">
            <History size={15} /> Historial
          </button>
          <button onClick={() => setShowSettings(true)}
            title="Configurar proveedores"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-2 rounded-lg text-sm">
            <Settings size={15} />
          </button>
          {!isClosed && (
            <button onClick={handleCloseMonth}
              className="flex items-center gap-2 border border-white/20 text-white/70 hover:text-white px-3 py-2 rounded-lg text-sm">
              <Lock size={14} /> Cerrar Mes
            </button>
          )}
          <button onClick={() => setAdding(!adding)}
            style={{ background: CORAL }}
            className="flex items-center gap-2 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Plus size={15} /> Nueva Factura
          </button>
        </div>
      </div>

      {isClosed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <Lock size={16} className="text-amber-500" />
          <p className="text-amber-800 text-sm font-semibold">Mes cerrado — las facturas están bloqueadas</p>
        </div>
      )}

      {/* ── ARCA BIG CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Ventas del mes (ARCA) */}
        <div style={{ borderTop: `4px solid ${NAVY}` }} className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            Ventas del Mes · ARCA
          </p>
          <p className="text-3xl font-bold mb-4" style={{ color: NAVY }}>
            {arcaAmount > 0 ? fmt$(arcaAmount) : <span className="text-gray-300 text-2xl">Sin datos</span>}
          </p>
          <div className="flex gap-2">
            <input
              type="number" placeholder="Ingresá el monto…" step="0.01"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              value={arcaInput}
              onChange={e => setArcaInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveArca()}
            />
            <button onClick={handleSaveArca} disabled={arcaSaving}
              style={{ background: NAVY }}
              className="text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-80 transition-opacity">
              {arcaSaving ? '…' : 'OK'}
            </button>
          </div>
          <p className="text-[10px] text-gray-300 mt-1.5">Enter o OK para guardar</p>
        </div>

        {/* Total Compras */}
        <div style={{ borderTop: `4px solid ${CORAL}` }} className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            Total Compras · {month}
          </p>
          <p className="text-3xl font-bold mb-1" style={{ color: CORAL }}>
            {fmt$(totalMes)}
          </p>
          <p className="text-sm text-gray-400 mb-3">
            {purchases.length} {purchases.length === 1 ? 'factura' : 'facturas'}
          </p>
          {arcaPct != null && (
            <div className="bg-gray-50 rounded-lg px-3 py-2.5">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-500">% sobre ventas ARCA</span>
                <span className="text-xs font-bold" style={{ color: CORAL }}>{arcaPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all duration-500"
                  style={{ background: CORAL, width: `${Math.min(arcaPct, 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Saldo */}
        <div
          style={{ borderTop: `4px solid ${arcaAmount > 0 ? (arcaBalance >= 0 ? '#16a34a' : '#dc2626') : '#e5e7eb'}` }}
          className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            Saldo · Ventas − Compras
          </p>
          {arcaAmount > 0 ? (
            <>
              <p className={`text-3xl font-bold mb-1 ${arcaBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {arcaBalance >= 0 ? '+' : ''}{fmt$(arcaBalance)}
              </p>
              <p className="text-sm text-gray-400">
                {arcaBalance >= 0 ? '✓ Margen positivo' : '⚠ Compras > Ventas ARCA'}
              </p>
            </>
          ) : (
            <p className="text-gray-300 text-base font-medium mt-3">
              Ingresá las ventas ARCA para ver el saldo
            </p>
          )}
        </div>
      </div>

      {/* ── FORMULARIO NUEVA FACTURA ── */}
      {adding && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Nueva Factura</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Fecha</label>
              <input type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                value={form.purchase_date}
                onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Nro Factura</label>
              <input type="text" placeholder="0001-00012345"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                value={form.invoice_number}
                onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>

            {/* Proveedor: select preset o campo libre */}
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Proveedor *</label>
              {!form.use_custom ? (
                <select required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
                  value={form.provider_name}
                  onChange={e => {
                    if (e.target.value === '__custom__')
                      setForm(f => ({ ...f, use_custom: true, provider_name: '' }))
                    else
                      setForm(f => ({ ...f, provider_name: e.target.value }))
                  }}>
                  <option value="">— Elegir proveedor —</option>
                  {presets.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__custom__">✏️ Otro (escribir)…</option>
                </select>
              ) : (
                <div className="flex gap-1">
                  <input type="text" placeholder="Nombre proveedor *" required autoFocus
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                    value={form.provider_custom}
                    onChange={e => setForm(f => ({ ...f, provider_custom: e.target.value }))} />
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, use_custom: false, provider_custom: '' }))}
                    className="text-gray-400 hover:text-gray-600 px-2 text-lg leading-none">✕</button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Total $ *</label>
              <input type="number" placeholder="0.00" required step="0.01"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                value={form.total_amount}
                onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button"
              onClick={() => { setAdding(false); setForm(emptyForm) }}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ background: CORAL }}
              className="text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
              {saving ? 'Guardando…' : 'Guardar Factura'}
            </button>
          </div>
        </form>
      )}

      {/* ── TOP PROVEEDORES ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <p className="px-5 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: NAVY }}>
          Top Proveedores — {month} {year}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {summary.slice(0, 8).map((s: any) => {
                const pc = providerColor(s.provider_name)
                return (
                  <tr key={s.provider_name}
                    className="border-t border-gray-50 hover:bg-gray-50 transition-colors"
                    style={{ borderLeft: `3px solid ${pc}` }}>
                    <td className="px-5 py-2.5 font-semibold text-gray-700 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: pc }} />
                        {s.provider_name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-sm"
                      style={{ color: pc }}>{fmt$(s.total)}</td>
                    <td className="px-4 py-2.5 w-44">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ background: pc, width: `${Math.min(s.percentage, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-10 text-right">{s.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-400 text-xs">{s.count} fact.</td>
                  </tr>
                )
              })}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-gray-400 text-center text-sm">
                    Sin facturas para {month} {year}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TABLA PRINCIPAL ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Barra de búsqueda y filtros */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              placeholder="Buscar proveedor…"
              value={filterProvider}
              onChange={e => setFilterProvider(e.target.value)} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm transition-colors
              ${showFilters || hasFilters
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Filtros
            {hasFilters && (
              <span className="bg-amber-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">✓</span>
            )}
          </button>
          {hasFilters && (
            <button
              onClick={() => {
                setFilterProvider(''); setFilterDateFrom(''); setFilterDateTo('')
                setFilterMinAmt(''); setFilterMaxAmt('')
              }}
              className="text-xs text-red-500 hover:underline">
              Limpiar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Fecha desde</label>
              <input type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Fecha hasta</label>
              <input type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Monto mínimo $</label>
              <input type="number" placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                value={filterMinAmt} onChange={e => setFilterMinAmt(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Monto máximo $</label>
              <input type="number" placeholder="∞"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                value={filterMaxAmt} onChange={e => setFilterMaxAmt(e.target.value)} />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead style={{ background: NAVY }}>
              <tr>
                <th className="px-4 py-2.5 text-left text-white text-xs font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('date')}>
                  <span className="flex items-center gap-1">Fecha <SortIcon field="date" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-white text-xs font-semibold">Nro Factura</th>
                <th className="px-3 py-2.5 text-left text-white text-xs font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('provider')}>
                  <span className="flex items-center gap-1">Proveedor <SortIcon field="provider" /></span>
                </th>
                <th className="px-3 py-2.5 text-right text-white text-xs font-semibold cursor-pointer select-none"
                  onClick={() => toggleSort('amount')}>
                  <span className="flex items-center gap-1 justify-end">Total $ <SortIcon field="amount" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-white text-xs font-semibold">Estado</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const pc = providerColor(p.provider_name ?? '')
                return (
                <tr key={p.id}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}
                  style={{ borderLeft: `3px solid ${pc}` }}>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {p.purchase_date ?? <span className="text-amber-500">Sin fecha</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{p.invoice_number ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-bold" style={{ color: pc }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: pc }} />
                      {p.provider_name ?? '—'}
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-xs text-right font-bold ${p.total_amount < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {fmt$(p.total_amount)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.flag === 'NC' && (
                      <span className="bg-red-100 text-red-700 rounded px-1.5 py-0.5 text-[10px] font-bold">N/C</span>
                    )}
                    {p.flag === 'SIN_FECHA' && (
                      <span className="bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 text-[10px]">Sin fecha</span>
                    )}
                    {p.closed && (
                      <span className="bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 text-[10px]">Cerrado</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {!p.closed && (
                      <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {hasFilters
                      ? 'No hay facturas que coincidan con los filtros'
                      : `No hay facturas para ${month} ${year}`}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: NAVY }}>
                <td colSpan={3} className="px-4 py-3 text-white text-xs font-bold uppercase tracking-widest">
                  {hasFilters
                    ? `Filtrado (${filtered.length} de ${purchases.length})`
                    : `TOTAL MES · ${purchases.length} facturas`}
                </td>
                <td className="px-3 py-3 text-right font-bold text-xs" style={{ color: CORAL }}>
                  {fmt$(hasFilters ? totalFiltered : totalMes)}
                  {hasFilters && totalFiltered !== totalMes && (
                    <span className="block text-white/50 font-normal">Total mes: {fmt$(totalMes)}</span>
                  )}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── GRÁFICO COMPRAS POR MES ── */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: NAVY }}>
            Evolución de Compras — {year}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={history.map(h => ({
                ...h,
                name: MONTH_ABBR[h.month] ?? h.month,
              }))}
              barCategoryGap="35%"
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {history.map((h, i) => (
                  <Cell
                    key={i}
                    fill={h.month === month ? CORAL : NAVY}
                    fillOpacity={h.month === month ? 1 : 0.45}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            Barra coral = mes seleccionado · Pasá el cursor para ver detalle
          </p>
        </div>
      )}

      {/* ── MODAL: CONFIGURACIÓN PROVEEDORES ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800">Proveedores Predeterminados</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Aparecen en el menú al agregar una factura
                </p>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {presets.map(p => (
                <div key={p}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5 hover:bg-gray-100 transition-colors">
                  <span className="text-sm font-medium text-gray-700">{p}</span>
                  <button onClick={() => removePreset(p)}
                    className="text-red-400 hover:text-red-600 text-xs hover:underline ml-4">
                    Quitar
                  </button>
                </div>
              ))}
              {presets.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-6">
                  No hay proveedores guardados
                </p>
              )}
            </div>

            <div className="px-4 py-4 border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Nombre del nuevo proveedor…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                  value={newPreset}
                  onChange={e => setNewPreset(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPreset()} />
                <button onClick={addPreset}
                  style={{ background: CORAL }}
                  className="text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
                  Agregar
                </button>
              </div>
              <p className="text-[10px] text-gray-300 mt-1.5">
                Se guarda automáticamente en este dispositivo · Enter para agregar rápido
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: HISTORIAL ── */}
      {showHistorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">

            {/* Header del modal */}
            <div style={{ background: NAVY }} className="px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="font-bold text-white text-lg">Historial de Compras</h2>
                <p className="text-white/50 text-xs mt-0.5">Consulta de meses anteriores (solo lectura)</p>
              </div>
              <button onClick={() => setShowHistorial(false)} className="text-white/60 hover:text-white">
                <X size={22} />
              </button>
            </div>

            {/* Controles */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <select value={histYear} onChange={e => setHistYear(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {ALL_YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
              <select value={histMonth} onChange={e => setHistMonth(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
              <button
                onClick={() => handlePdf(`/purchases/pdf/${histYear}/${histMonth}`, `compras_${histMonth}_${histYear}.pdf`)}
                className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm">
                <FileDown size={14} /> PDF
              </button>
              <div className="ml-auto text-sm text-gray-500 font-semibold">
                {histPurchases.length} facturas ·{' '}
                <span style={{ color: CORAL }}>{fmt$(histTotal)}</span>
              </div>
            </div>

            {/* Tabla historial */}
            <div className="flex-1 overflow-y-auto">
              {histLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  Cargando…
                </div>
              ) : (
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="sticky top-0" style={{ background: NAVY }}>
                    <tr>
                      <th className="px-4 py-2.5 text-left text-white text-xs font-semibold">Fecha</th>
                      <th className="px-3 py-2.5 text-left text-white text-xs font-semibold">Nro Factura</th>
                      <th className="px-3 py-2.5 text-left text-white text-xs font-semibold">Proveedor</th>
                      <th className="px-3 py-2.5 text-right text-white text-xs font-semibold">Total $</th>
                      <th className="px-3 py-2.5 text-left text-white text-xs font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histPurchases.map((p, i) => (
                      <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'}>
                        <td className="px-4 py-2 text-xs text-gray-600">{p.purchase_date ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{p.invoice_number ?? '—'}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-700">{p.provider_name ?? '—'}</td>
                        <td className={`px-3 py-2 text-xs text-right font-semibold ${p.total_amount < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {fmt$(p.total_amount)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.flag === 'NC' && (
                            <span className="bg-red-100 text-red-700 rounded px-1.5 py-0.5 text-[10px] font-bold">N/C</span>
                          )}
                          {p.closed && (
                            <span className="bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 text-[10px]">Cerrado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {histPurchases.length === 0 && !histLoading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                          Sin facturas para {histMonth} {histYear}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {histPurchases.length > 0 && (
                    <tfoot>
                      <tr style={{ background: NAVY }}>
                        <td colSpan={3} className="px-4 py-3 text-white text-xs font-bold uppercase tracking-widest">
                          TOTAL · {histPurchases.length} facturas
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-xs" style={{ color: CORAL }}>
                          {fmt$(histTotal)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
