import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Check, X, Edit2, Settings, Plus,
  Trash2, MessageCircle, MinusCircle, CheckCircle2, Calendar,
  List, Bell,
} from 'lucide-react'
import { api, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────
type RecurringDue = {
  id: number
  name: string
  amount: number
  day_of_month: number
  category: string
  color: string
  active: boolean
  notes: string | null
  sort_order: number
}

type DueItem = {
  id: number
  is_oneoff: boolean
  name: string
  category: string
  color: string
  day: number
  amount: number
  status: 'pendiente' | 'pagado' | 'omitido'
  paid_at: string | null
  notes: string | null
  estado_id: number | null
  day_original: number
  amount_original: number
}

type ViewMode = 'lista' | 'calendario'

// ── Constants ─────────────────────────────────────────────────────────────────
const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const WEEK_DAYS = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM']
const CATEGORIES = ['Alquiler','Servicios','Impuestos','Financiero','Seguros','Personal','Otros']
const CAT_COLORS: Record<string, string> = {
  Alquiler: '#C4875A', Servicios: '#3b82f6', Impuestos: '#6366f1',
  Financiero: '#ef4444', Seguros: '#8b5cf6', Personal: '#22c55e', Otros: '#64748b',
}
const COLOR_PALETTE = [
  '#C4875A','#3b82f6','#6366f1','#ef4444','#8b5cf6',
  '#22c55e','#f97316','#06b6d4','#eab308','#ec4899','#64748b','#14b8a6',
]
const NAVY  = '#3D6B64'
const CORAL = '#C4875A'

function fmt(n: number) {
  if (n === 0) return '$ 0'
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── CalendarView ──────────────────────────────────────────────────────────────
function CalendarView({
  items, year, monthIdx, todayDay, isCurrentMonth, onMark,
}: {
  items: DueItem[]
  year: number
  monthIdx: number
  todayDay: number
  isCurrentMonth: boolean
  onMark: (item: DueItem, status: DueItem['status']) => void
}) {
  // Build day → items map
  const dayMap: Record<number, DueItem[]> = {}
  items.forEach(item => {
    if (!dayMap[item.day]) dayMap[item.day] = []
    dayMap[item.day].push(item)
  })

  // Calendar grid (Monday-first)
  const firstDayJS  = new Date(year, monthIdx, 1).getDay()          // 0=Sun
  const offset      = firstDayJS === 0 ? 6 : firstDayJS - 1         // Mon=0
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-2.5 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const dayItems  = day ? (dayMap[day] ?? []) : []
          const isToday   = isCurrentMonth && day === todayDay
          const isLastCol = i % 7 === 6

          return (
            <div
              key={i}
              className={`min-h-[76px] p-1.5 border-b border-gray-50 ${!isLastCol ? 'border-r' : ''} border-gray-50 ${!day ? 'bg-gray-50/40' : 'hover:bg-gray-50/60'} transition-colors`}
            >
              {day && (
                <>
                  {/* Day number */}
                  <div className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                    isToday ? 'text-white' : 'text-gray-500'
                  }`} style={isToday ? { background: CORAL } : undefined}>
                    {day}
                  </div>

                  {/* Items */}
                  <div className="space-y-[2px]">
                    {dayItems.slice(0, 3).map(item => {
                      const isPaid    = item.status === 'pagado'
                      const isOmitted = item.status === 'omitido'
                      return (
                        <button
                          key={`${item.is_oneoff ? 'o' : 'r'}-${item.id}`}
                          onClick={() => onMark(item, isPaid ? 'pendiente' : 'pagado')}
                          className={`w-full text-left text-[9px] leading-tight px-1 py-0.5 rounded truncate transition-opacity ${
                            isPaid    ? 'opacity-40 line-through' : ''
                          } ${isOmitted ? 'opacity-20' : ''}`}
                          style={{ background: item.color + '22', color: item.color }}
                          title={`${item.name}${item.amount > 0 ? ' · ' + fmt(item.amount) : ''} — click para ${isPaid ? 'desmarcar' : 'marcar pagado'}`}
                        >
                          {item.is_oneoff && '★ '}{item.name}
                        </button>
                      )
                    })}
                    {dayItems.length > 3 && (
                      <div className="text-[9px] text-gray-400 px-1">+{dayItems.length - 3}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-gray-50 flex items-center gap-3 flex-wrap bg-gray-50/30">
        <span className="text-[10px] text-gray-400">★ = recordatorio único</span>
        <span className="text-[10px] text-gray-400">Click en un ítem para marcar como pagado</span>
      </div>
    </div>
  )
}

// ── OneOffModal — recordatorio único ─────────────────────────────────────────
function OneOffModal({
  defaultYear, defaultMonthIdx, onSave, onClose,
}: {
  defaultYear: number
  defaultMonthIdx: number
  onSave: () => void
  onClose: () => void
}) {
  const [name,       setName]      = useState('')
  const [day,        setDay]       = useState('')
  const [selMonthIdx,setSelMonth]  = useState(defaultMonthIdx)
  const [selYear,    setSelYear]   = useState(defaultYear)
  const [amount,     setAmount]    = useState('')
  const [category,   setCat]       = useState('Otros')
  const [color,      setColor]     = useState('#64748b')
  const [notes,      setNotes]     = useState('')
  const [saving,     setSaving]    = useState(false)
  const [error,      setError]     = useState('')

  async function handleSave() {
    if (!name.trim() || !day) { setError('Completá nombre y día'); return }
    setSaving(true); setError('')
    try {
      await api.post(`/vencimientos/${selYear}/${MONTHS[selMonthIdx]}/oneoff`, {
        name: name.trim(), day: parseInt(day),
        amount: parseFloat(amount || '0'),
        category, color, notes: notes.trim() || null,
      })
      onSave(); onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Bell size={16} className="text-amber-500" /> Recordatorio único
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Aparece solo en el mes elegido
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          {/* Nombre */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Nombre</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="Ej: Pago cuota club"
              autoFocus
            />
          </div>

          {/* Mes y año destino */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">¿Para qué mes?</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selMonthIdx} onChange={e => setSelMonth(parseInt(e.target.value))}
                className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {MESES_ES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <input
                type="number" value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Día */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Día</label>
              <input
                type="number" min={1} max={31}
                value={day} onChange={e => setDay(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            {/* Monto */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">$</span>
                <input
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Categoría */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Categoría</label>
              <select
                value={category} onChange={e => setCat(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {/* Color */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setColor(c)}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: color === c ? '#0f172a' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Notas (opcional)</label>
            <input
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="Ej: Llevar factura"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm text-white font-bold disabled:opacity-60"
            style={{ background: '#d97706' }}
          >
            {saving ? 'Guardando…' : 'Agregar recordatorio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EditItemModal — ajuste mensual ────────────────────────────────────────────
function EditItemModal({
  item, month, year, onSave, onClose,
}: {
  item: DueItem; month: string; year: number; onSave: () => void; onClose: () => void
}) {
  const [day,    setDay]    = useState(item.day.toString())
  const [amount, setAmount] = useState(item.amount > 0 ? item.amount.toString() : '')
  const [notes,  setNotes]  = useState(item.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setSaving(true); setError('')
    try {
      if (item.is_oneoff) {
        await api.put(`/vencimientos/oneoff/${item.id}/full`, {
          name: item.name, day: day ? parseInt(day) : item.day,
          amount: amount ? parseFloat(amount) : item.amount,
          category: item.category, color: item.color,
          notes: notes || null,
        })
      } else {
        await api.put(`/vencimientos/${year}/${month}/${item.id}`, {
          status: item.status,
          day_override:    day ? parseInt(day) : null,
          amount_override: amount ? parseFloat(amount) : null,
          notes: notes || null,
        })
      }
      onSave(); onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {item.is_oneoff ? 'Recordatorio único' : `Ajuste para ${MESES_ES[MONTHS.indexOf(month)]} ${year}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Día</label>
            <div className="flex items-center gap-3">
              <input
                type="number" min={1} max={31} value={day}
                onChange={e => setDay(e.target.value)}
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {!item.is_oneoff && parseInt(day) !== item.day_original && (
                <button onClick={() => setDay(item.day_original.toString())} className="text-[11px] text-blue-500 hover:underline">
                  ← Restaurar ({item.day_original})
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Monto</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
              <input
                type="text" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={item.amount_original > 0 ? item.amount_original.toLocaleString('es-AR') : '0'}
                className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Notas</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl text-sm text-white font-bold disabled:opacity-60" style={{ background: NAVY }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── InlineForm (para SettingsModal) ───────────────────────────────────────────
type FormState = {
  name: string; amount: string; day_of_month: string
  category: string; color: string; active: boolean; notes: string; sort_order: number
}
const EMPTY_FORM: FormState = {
  name: '', amount: '', day_of_month: '', category: 'Servicios',
  color: '#3b82f6', active: true, notes: '', sort_order: 0,
}

function InlineForm({ form, setF }: { form: FormState; setF: (p: Partial<FormState>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="col-span-2">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Nombre</label>
        <input value={form.name} onChange={e => setF({ name: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Ej: Alquiler local" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Día del mes</label>
        <input type="number" min={1} max={31} value={form.day_of_month} onChange={e => setF({ day_of_month: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Monto habitual</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">$</span>
          <input value={form.amount} onChange={e => setF({ amount: e.target.value })}
            className="w-full border border-gray-200 rounded-lg pl-6 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="0" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Categoría</label>
        <select value={form.category} onChange={e => setF({ category: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Color</label>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {COLOR_PALETTE.map(c => (
            <button key={c} type="button" onClick={() => setF({ color: c })}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: c, borderColor: form.color === c ? '#0f172a' : 'transparent' }} />
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Notas (opcional)</label>
        <input value={form.notes} onChange={e => setF({ notes: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Ej: Pagar antes del mediodía" />
      </div>
    </div>
  )
}

// ── SettingsModal ─────────────────────────────────────────────────────────────
function SettingsModal({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [templates, setTemplates] = useState<RecurringDue[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState<number | null>(null)
  const [addMode,   setAddMode]   = useState(false)
  const [deleteId,  setDeleteId]  = useState<number | null>(null)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState('')
  const setF = useCallback((p: Partial<FormState>) => setForm(f => ({ ...f, ...p })), [])

  useEffect(() => {
    api.get<RecurringDue[]>('/vencimientos/recurring')
      .then(data => setTemplates(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleActive(t: RecurringDue) {
    await api.put(`/vencimientos/recurring/${t.id}`, { ...t, active: !t.active })
    setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, active: !x.active } : x))
    onRefresh()
  }

  function startEdit(t: RecurringDue) {
    setEditId(t.id); setAddMode(false); setFormError('')
    setForm({ name: t.name, amount: t.amount > 0 ? t.amount.toString() : '', day_of_month: t.day_of_month.toString(), category: t.category, color: t.color, active: t.active, notes: t.notes ?? '', sort_order: t.sort_order })
  }

  function buildPayload(extraActive?: boolean) {
    return {
      name: form.name.trim(),
      amount: parseFloat(form.amount.replace(/\./g, '').replace(',', '.') || '0'),
      day_of_month: Math.min(31, Math.max(1, parseInt(form.day_of_month || '1'))),
      category: form.category, color: form.color,
      active: extraActive ?? form.active,
      notes: form.notes.trim() || null, sort_order: form.sort_order,
    }
  }

  async function handleSaveEdit() {
    if (!editId) return
    setSaving(true); setFormError('')
    try {
      const payload = buildPayload()
      await api.put(`/vencimientos/recurring/${editId}`, payload)
      setTemplates(ts => ts.map(x => x.id === editId ? { ...x, ...payload, id: editId } as RecurringDue : x))
      setEditId(null); onRefresh()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleAdd() {
    setSaving(true); setFormError('')
    try {
      const payload = buildPayload(true)
      const result = await api.post<RecurringDue>('/vencimientos/recurring', { ...payload, sort_order: templates.length + 1 })
      setTemplates(ts => [...ts, result])
      setAddMode(false); setForm(EMPTY_FORM); onRefresh()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al agregar')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    await api.delete(`/vencimientos/recurring/${id}`)
    setTemplates(ts => ts.filter(x => x.id !== id)); setDeleteId(null); onRefresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Vencimientos recurrentes</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Aparecen automáticamente todos los meses</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-2">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Cargando…</p>
          ) : templates.map(t => (
            <div key={t.id}>
              {editId === t.id ? (
                <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/30">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-bold text-blue-700">Editando: {t.name}</p>
                    <button onClick={() => { setEditId(null); setFormError('') }} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                  </div>
                  <InlineForm form={form} setF={setF} />
                  {formError && <p className="text-red-500 text-[11px] mt-2">{formError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setEditId(null); setFormError('') }} className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-1.5 rounded-lg text-xs text-white font-bold disabled:opacity-50" style={{ background: NAVY }}>
                      {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${t.active ? 'border-gray-100 bg-white hover:bg-gray-50/50' : 'border-gray-100 bg-gray-50 opacity-50'}`}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold text-gray-800 ${!t.active ? 'line-through' : ''}`}>{t.name}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">día {t.day_of_month}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{t.category}</span>
                      {t.amount > 0 && <span className="text-[10px] text-gray-500 font-mono">{fmt(t.amount)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive(t)} className={`p-1.5 rounded-lg transition-colors ${t.active ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'}`} title={t.active ? 'Desactivar' : 'Activar'}>
                      {t.active ? <Check size={12} /> : <X size={12} />}
                    </button>
                    <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={12} /></button>
                    {deleteId === t.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(t.id)} className="px-2 py-1 rounded-lg text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100">Sí</button>
                        <button onClick={() => setDeleteId(null)} className="px-2 py-1 rounded-lg text-[10px] text-gray-400 hover:bg-gray-100">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {addMode ? (
            <div className="border border-green-200 rounded-xl p-3 bg-green-50/30">
              <p className="text-[11px] font-bold text-green-700 mb-1">Nuevo vencimiento recurrente</p>
              <InlineForm form={form} setF={setF} />
              {formError && <p className="text-red-500 text-[11px] mt-2">{formError}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setAddMode(false); setForm(EMPTY_FORM); setFormError('') }} className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleAdd} disabled={saving || !form.name.trim() || !form.day_of_month} className="flex-1 py-1.5 rounded-lg text-xs text-white font-bold disabled:opacity-50" style={{ background: '#16a34a' }}>
                  {saving ? 'Agregando…' : 'Agregar'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setAddMode(true); setEditId(null); setForm(EMPTY_FORM); setFormError('') }}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 mt-2">
              <Plus size={14} /> Agregar vencimiento
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Vencimientos() {
  const today = new Date()
  const [monthIdx,     setMonthIdx]     = useState(CURRENT_MONTH_IDX)
  const [year,         setYear]         = useState(CURRENT_YEAR)
  const [items,        setItems]        = useState<DueItem[]>([])
  const [loading,      setLoading]      = useState(false)
  const [viewMode,     setViewMode]     = useState<ViewMode>('lista')
  const [showSettings, setShowSettings] = useState(false)
  const [showOneOff,   setShowOneOff]   = useState(false)
  const [editItem,     setEditItem]     = useState<DueItem | null>(null)

  const month          = MONTHS[monthIdx]
  const isCurrentMonth = monthIdx === today.getMonth() && year === today.getFullYear()
  const todayDay       = today.getDate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<DueItem[]>(`/vencimientos/${year}/${month}`)
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  // Marcar estado (optimistic)
  async function markStatus(item: DueItem, status: DueItem['status']) {
    setItems(its => its.map(i =>
      i.id === item.id && i.is_oneoff === item.is_oneoff ? { ...i, status } : i
    ))
    try {
      if (item.is_oneoff) {
        await api.put(`/vencimientos/oneoff/${item.id}`, { status })
      } else {
        await api.put(`/vencimientos/${year}/${month}/${item.id}`, {
          status,
          day_override:    item.day !== item.day_original ? item.day : null,
          amount_override: item.amount !== item.amount_original ? item.amount : null,
          notes:           item.notes,
        })
      }
    } catch {
      // Rollback
      setItems(its => its.map(i =>
        i.id === item.id && i.is_oneoff === item.is_oneoff ? { ...i, status: item.status } : i
      ))
    }
  }

  async function deleteOneOff(item: DueItem) {
    setItems(its => its.filter(i => !(i.id === item.id && i.is_oneoff)))
    await api.delete(`/vencimientos/oneoff/${item.id}`)
  }

  function prevMonth() {
    if (monthIdx === 0) { setMonthIdx(11); setYear(y => y - 1) }
    else setMonthIdx(m => m - 1)
  }
  function nextMonth() {
    if (monthIdx === 11) { setMonthIdx(0); setYear(y => y + 1) }
    else setMonthIdx(m => m + 1)
  }

  // Estadísticas
  const stats = useMemo(() => {
    const activos   = items.filter(i => i.status !== 'omitido')
    const total     = activos.reduce((s, i) => s + i.amount, 0)
    const pagado    = items.filter(i => i.status === 'pagado').reduce((s, i) => s + i.amount, 0)
    const pendiente = items.filter(i => i.status === 'pendiente').reduce((s, i) => s + i.amount, 0)
    const vencidos  = isCurrentMonth
      ? items.filter(i => i.status === 'pendiente' && i.day < todayDay).length : 0
    return { total, pagado, pendiente, vencidos }
  }, [items, isCurrentMonth, todayDay])

  // WhatsApp — esta semana
  const waItems = useMemo(() => {
    const pendientes = items.filter(i => i.status === 'pendiente')
    if (!isCurrentMonth) return pendientes
    return pendientes.filter(i => i.day >= todayDay && i.day <= todayDay + 6)
  }, [items, isCurrentMonth, todayDay])

  function sendWhatsApp() {
    const semana = isCurrentMonth
      ? `semana ${todayDay}/${today.getMonth() + 1} – ${Math.min(todayDay + 6, 31)}/${today.getMonth() + 1}`
      : `${MESES_ES[monthIdx]} ${year}`
    const lines = waItems.map(i => `• Día ${i.day} · ${i.name}${i.amount > 0 ? ` · ${fmt(i.amount)}` : ''}`)
    const total = waItems.reduce((s, i) => s + i.amount, 0)
    const text = [
      `🗓️ *Vencimientos ${semana} — JAN Orgánico Natural*`, '',
      waItems.length > 0 ? `⏳ *Pendientes:*\n${lines.join('\n')}` : '✅ Sin vencimientos pendientes.',
      total > 0 ? `\n💰 *Total: ${fmt(total)}*` : '',
      '', `_JAN Orgánico Natural ERP · ${MESES_ES[monthIdx]} ${year}_`,
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // Estado visual del día
  type DayStatus = 'today' | 'overdue' | 'soon' | 'future' | 'paid' | 'omitted'
  function getDayStatus(item: DueItem): DayStatus {
    if (item.status === 'pagado')  return 'paid'
    if (item.status === 'omitido') return 'omitted'
    if (!isCurrentMonth)           return 'future'
    if (item.day === todayDay)     return 'today'
    if (item.day < todayDay)       return 'overdue'
    if (item.day <= todayDay + 6)  return 'soon'
    return 'future'
  }

  const DAY_CHIP: Record<DayStatus, string> = {
    today:   'text-white font-bold',
    overdue: 'bg-red-100 text-red-600 font-bold',
    soon:    'bg-amber-100 text-amber-700 font-bold',
    future:  'bg-gray-100 text-gray-500',
    paid:    'bg-green-100 text-green-500',
    omitted: 'bg-gray-100 text-gray-300',
  }

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-head, sans-serif)' }}>
            Calendario de Vencimientos
          </h1>
          <p className="text-gray-400 text-sm mt-1">Pagos recurrentes y vencimientos del mes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowOneOff(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700 font-medium hover:bg-amber-100 transition-colors">
            <Bell size={13} /> Recordatorio único
          </button>
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Settings size={14} />
            <span className="hidden sm:inline font-medium">Configurar</span>
          </button>
          <button onClick={sendWhatsApp}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white font-bold transition-opacity hover:opacity-90"
            style={{ background: '#25d366' }}>
            <MessageCircle size={14} />
            <span>WhatsApp</span>
            {waItems.length > 0 && (
              <span className="bg-white/25 rounded-full text-[10px] font-bold w-[18px] h-[18px] flex items-center justify-center">
                {waItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Navegador de mes */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">{MESES_ES[monthIdx]}</p>
          <p className="text-sm text-gray-400">{year}</p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Cards de resumen + toggle de vista */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Stats */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
          {[
            { label: 'Total', value: fmt(stats.total), color: 'text-gray-900', bg: 'bg-white border-gray-100' },
            { label: 'Pagado', value: fmt(stats.pagado), color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
            { label: 'Pendiente', value: fmt(stats.pendiente), color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
            { label: stats.vencidos > 0 ? '⚠ Vencidos' : 'Vencidos', value: stats.vencidos.toString(), color: stats.vencidos > 0 ? 'text-red-600' : 'text-gray-400', bg: stats.vencidos > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-3.5 border`}>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">{label}</p>
              <p className={`text-base font-bold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Toggle lista / calendario */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1 flex-shrink-0">
          <button
            onClick={() => setViewMode('lista')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'lista' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List size={13} /> Lista
          </button>
          <button
            onClick={() => setViewMode('calendario')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'calendario' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Calendar size={13} /> Calendario
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      {stats.total > 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
            <span>Progreso de pagos del mes</span>
            <span>{Math.round((stats.pagado / stats.total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (stats.pagado / stats.total) * 100)}%`, background: '#16a34a' }}
            />
          </div>
        </div>
      )}

      {/* ── Vista Calendario ── */}
      {viewMode === 'calendario' && !loading && (
        <CalendarView
          items={items} year={year} monthIdx={monthIdx}
          todayDay={todayDay} isCurrentMonth={isCurrentMonth}
          onMark={markStatus}
        />
      )}

      {/* ── Vista Lista ── */}
      {viewMode === 'lista' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Calendar size={36} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">Sin vencimientos configurados</p>
              <button onClick={() => setShowSettings(true)} className="mt-4 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: CORAL }}>
                Configurar ahora
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(item => {
                const dayStatus = getDayStatus(item)
                const isPaid    = item.status === 'pagado'
                const isOmitted = item.status === 'omitido'

                return (
                  <div
                    key={`${item.is_oneoff ? 'o' : 'r'}-${item.id}`}
                    className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors group ${
                      isPaid ? 'opacity-50' : ''
                    } ${isOmitted ? 'opacity-30' : ''}`}
                  >
                    {/* Chip del día */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ${DAY_CHIP[dayStatus]}`}
                      style={dayStatus === 'today' ? { background: CORAL } : undefined}
                    >
                      {item.day}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-semibold ${isPaid ? 'text-gray-400 line-through' : 'text-gray-800'} ${isOmitted ? 'line-through' : ''}`}>
                          {item.is_oneoff && <span className="text-amber-500 mr-0.5">★</span>}
                          {item.name}
                        </span>
                        {dayStatus === 'today' && <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full uppercase" style={{ background: CORAL }}>HOY</span>}
                        {dayStatus === 'overdue' && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full uppercase">VENCIDO</span>}
                        {dayStatus === 'soon' && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">ESTA SEMANA</span>}
                        {item.is_oneoff && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">Único</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: (CAT_COLORS[item.category] ?? '#64748b') + 'dd' }}>
                          {item.category}
                        </span>
                        <span className={`text-xs font-mono ${isPaid ? 'text-gray-400' : 'text-gray-600'}`}>
                          {item.amount > 0 ? fmt(item.amount) : <span className="text-gray-300">— sin monto —</span>}
                        </span>
                        {isPaid && item.paid_at && (
                          <span className="text-[10px] text-gray-400">
                            Pagado {new Date(item.paid_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                        {item.notes && <span className="text-[10px] text-gray-400 italic truncate max-w-[120px]">{item.notes}</span>}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                      {!isPaid && !isOmitted && (
                        <button onClick={() => markStatus(item, 'pagado')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white hover:opacity-90"
                          style={{ background: '#16a34a' }}>
                          <Check size={11} /><span className="hidden sm:inline">Pagar</span>
                        </button>
                      )}
                      {isPaid && (
                        <button onClick={() => markStatus(item, 'pendiente')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-green-100 text-green-700 hover:bg-green-200">
                          <CheckCircle2 size={11} /><span className="hidden sm:inline">Pagado</span>
                        </button>
                      )}
                      {isOmitted && (
                        <button onClick={() => markStatus(item, 'pendiente')}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 bg-gray-100 hover:bg-gray-200">
                          Reactivar
                        </button>
                      )}
                      <button onClick={() => setEditItem(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        title="Editar">
                        <Edit2 size={13} />
                      </button>
                      {!isOmitted && !item.is_oneoff && (
                        <button onClick={() => markStatus(item, 'omitido')}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                          title="Omitir este mes">
                          <MinusCircle size={13} />
                        </button>
                      )}
                      {item.is_oneoff && (
                        <button onClick={() => deleteOneOff(item)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Eliminar recordatorio">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onRefresh={load} />}
      {showOneOff && (
        <OneOffModal defaultYear={year} defaultMonthIdx={monthIdx}
          onSave={load} onClose={() => setShowOneOff(false)} />
      )}
      {editItem && (
        <EditItemModal item={editItem} month={month} year={year}
          onSave={load} onClose={() => setEditItem(null)} />
      )}
    </div>
  )
}
