import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileDown, Pencil, Check, X, Settings, Lock, Unlock, History } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

type Tab = 'compartidos' | 'luro'

// ── Items fijos — editar aquí para agregar/quitar filas permanentes ──────────
// split: 'half'  → Indep paga el 50%  (se auto-calcula al ingresar Total)
// split: 'full'  → Indep paga el 100% (ítem exclusivo de Independencia)
type SplitType = 'half' | 'full'
const FIXED_ITEMS: { key: string; name: string; category: string; split: SplitType }[] = [
  // Impuestos y cargas sociales
  { key: 'f931',       name: 'Formulario 931',               category: 'Impuestos',       split: 'half' },
  { key: 'iva',        name: 'IVA',                          category: 'Impuestos',       split: 'half' },
  { key: 'autonomo',   name: 'Autónomo',                     category: 'Impuestos',       split: 'half' },
  { key: 'iibb',       name: 'Ingresos Brutos',              category: 'Impuestos',       split: 'half' },
  { key: 'tsh',        name: 'Tasa de Seguridad e Higiene',  category: 'Impuestos',       split: 'half' },
  // Sindicatos y obras sociales
  { key: 'sec',        name: 'SEC',                          category: 'Sindicatos',      split: 'half' },
  { key: 'faecys',     name: 'FAECYS',                       category: 'Sindicatos',      split: 'half' },
  { key: 'osecac',     name: 'OSECAC',                       category: 'Sindicatos',      split: 'half' },
  { key: 'usimra',     name: 'USIMRA',                       category: 'Sindicatos',      split: 'half' },
  // Administración y servicios
  { key: 'inacap',     name: 'INACAP',                       category: 'Administración',  split: 'half' },
  { key: 'contador',   name: 'Contador',                     category: 'Administración',  split: 'half' },
  { key: 'hosting',    name: 'Hosting web',                  category: 'Administración',  split: 'half' },
  { key: 'claro',      name: 'Claro',                        category: 'Servicios',       split: 'half' },
  { key: 'seguro',     name: 'Seguro de comercio integral',  category: 'Servicios',       split: 'half' },
  { key: 'posnet',     name: 'POSNET (2 terminales)',        category: 'Servicios',       split: 'full' },
  // Personal
  { key: 'avila',      name: 'Avila, Alejandro',             category: 'Personal',        split: 'half' },
  { key: 'salinas',    name: 'Salinas, Adrian',              category: 'Personal',        split: 'half' },
  { key: 'ponasso',    name: 'Ponasso, Martin',              category: 'Personal',        split: 'half' },
  { key: 'juana',      name: 'Juana',                        category: 'Personal',        split: 'half' },
]

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Gastos() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const tabParam  = (new URLSearchParams(location.search).get('tab') ?? 'compartidos') as Tab

  const [month, setMonth] = useState('MAYO')
  const year = CURRENT_YEAR

  const setTab = (t: Tab) => navigate(`/gastos?tab=${t}`, { replace: true })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gastos</h1>
          <p className="text-brand-muted text-sm">Compartidos entre sucursales · Gastos Luro</p>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)} className="input w-36 text-sm">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {tabParam === 'compartidos'
        ? <GastosCompartidos month={month} year={year} onMonthChange={setMonth} />
        : <GastosLuro        month={month} year={year} onMonthChange={setMonth} />}
    </div>
  )
}

// ── Historial de meses ────────────────────────────────────────────────────────
function HistorialView({
  section, onNavigate
}: { section: 'luro' | 'compartidos'; onNavigate: (month: string, year: number) => void }) {
  const [rows, setRows]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get<any[]>(`/expenses/history/${section}`)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [section])

  if (loading) return <div className="text-center py-10 text-brand-muted text-sm">Cargando historial...</div>

  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-navy text-white">
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Período</th>
            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest">Total</th>
            <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Estado</th>
            <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Cerrado el</th>
            <th className="px-4 py-3 w-16" />
          </tr>
        </thead>
        <tbody>
          {rows.map(h => (
            <tr key={`${h.year}-${h.month}`} className="table-tr">
              <td className="table-td font-semibold">{h.month} {h.year}</td>
              <td className="table-td text-right font-semibold tabular-nums">{fmt$(h.total)}</td>
              <td className="table-td text-center">
                {h.is_closed
                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                      <Lock size={10}/> Cerrado
                    </span>
                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                      Abierto
                    </span>}
              </td>
              <td className="table-td text-center text-xs text-brand-muted">
                {h.closed_at ? new Date(h.closed_at).toLocaleDateString('es-AR') : '—'}
              </td>
              <td className="table-td text-center">
                <button onClick={() => onNavigate(h.month, h.year)}
                  className="text-xs text-coral hover:text-coral-dark font-semibold transition-colors">
                  Ver →
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="table-td text-center text-brand-muted py-10">
              No hay historial de gastos registrados
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Modal confirmar cierre ────────────────────────────────────────────────────
function CloseMonthModal({ month, year, onConfirm, onClose }: {
  month: string; year: number
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(7,6,20,0.55)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-brand-body">Cerrar {month} {year}</h3>
            <p className="text-xs text-brand-muted">Esta acción requiere clave para revertirse</p>
          </div>
        </div>
        <p className="text-sm text-brand-muted leading-relaxed">
          Una vez cerrado el mes, no podrás agregar, editar ni eliminar gastos
          sin la clave de administrador.
        </p>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={onConfirm} className="btn-primary text-sm bg-amber-600 hover:bg-amber-700">
            <Lock size={14}/> Cerrar mes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal reabrir con clave ───────────────────────────────────────────────────
function ReopenMonthModal({ month, year, section, onSuccess, onClose }: {
  month: string; year: number; section: string
  onSuccess: () => void; onClose: () => void
}) {
  const [pwd, setPwd]       = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!pwd.trim()) return
    setLoading(true); setError('')
    try {
      await api.post(`/expenses/reopen/${section}/${year}/${month}`, { password: pwd })
      onSuccess()
    } catch (err: any) {
      const msg: string = err?.message ?? ''
      setError(msg.includes('403') ? 'Clave incorrecta' : 'Error al reabrir el mes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(7,6,20,0.55)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Unlock size={18} className="text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-brand-body">Reabrir {month} {year}</h3>
            <p className="text-xs text-brand-muted">Ingresá la clave de administrador</p>
          </div>
        </div>
        <input
          type="password"
          placeholder="Clave de administrador"
          className="input w-full text-sm"
          value={pwd}
          autoFocus
          onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={submit} disabled={loading || !pwd.trim()} className="btn-primary text-sm">
            {loading ? 'Verificando...' : 'Reabrir mes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hook: closure status ──────────────────────────────────────────────────────
function useMonthClosure(section: string, month: string, year: number) {
  const [isClosed, setIsClosed]   = useState(false)
  const [closedAt, setClosedAt]   = useState<string | null>(null)
  const [checking, setChecking]   = useState(true)

  const check = useCallback(() => {
    setChecking(true)
    api.get<{ is_closed: boolean; closed_at: string | null }>(
      `/expenses/is-closed/${section}/${year}/${month}`
    ).then(d => {
      setIsClosed(d.is_closed)
      setClosedAt(d.closed_at)
    }).finally(() => setChecking(false))
  }, [section, month, year])

  useEffect(() => { check() }, [check])

  return { isClosed, closedAt, checking, refresh: check }
}

// ── Banner mes cerrado ────────────────────────────────────────────────────────
function ClosedBanner({ closedAt, onReopen }: { closedAt: string | null; onReopen: () => void }) {
  const date = closedAt ? new Date(closedAt).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric'
  }) : ''
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
      <div className="flex items-center gap-2.5">
        <Lock size={15} className="text-amber-600 shrink-0" />
        <div>
          <span className="text-sm font-semibold text-amber-800">Mes cerrado</span>
          {date && <span className="text-xs text-amber-600 ml-2">· Cerrado el {date}</span>}
        </div>
      </div>
      <button onClick={onReopen}
        className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100">
        <Unlock size={12}/> Reabrir
      </button>
    </div>
  )
}

// ── GastosCompartidos ─────────────────────────────────────────────────────────
function GastosCompartidos({ month, year, onMonthChange }: { month: string; year: number; onMonthChange: (m: string) => void }) {
  const [view, setView]         = useState<'tabla' | 'historial'>('tabla')
  const [dbData, setDbData]     = useState<Record<string, any>>({})
  const [edits, setEdits]       = useState<Record<string, any>>({})
  const savingRef               = useRef<Record<string, boolean>>({})
  const [addingCustom, setAddingCustom] = useState(false)
  const [customForm, setCustomForm]     = useState({ name: '', split_type: 'half' as SplitType })
  const [savingCustom, setSavingCustom] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editForm, setEditForm]     = useState({ pct: '50', detail: '', name: '' })
  const [showCloseModal, setShowCloseModal]   = useState(false)
  const [showReopenModal, setShowReopenModal] = useState(false)

  const { isClosed, closedAt, refresh: refreshClosure } = useMonthClosure('compartidos', month, year)

  const customItems = Object.values(dbData).filter((r: any) => r.item_key?.startsWith('custom_'))

  const load = useCallback(() => {
    api.get<Record<string, any>>(`/expenses/compartidos/${year}/${month}`).then(data => {
      setDbData(data)
      setEdits({})
    })
  }, [month, year])

  useEffect(() => { load() }, [load])

  const setField = (key: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const saveField = async (key: string, field: string, value: any) => {
    if (savingRef.current[key]) return
    savingRef.current[key] = true
    try {
      const updated = await api.put<any>(`/expenses/compartidos/${year}/${month}/${key}`, { [field]: value })
      setDbData(prev => ({ ...prev, [key]: updated }))
    } finally {
      savingRef.current[key] = false
    }
  }

  const merged = (key: string) => ({ ...dbData[key], ...edits[key] })

  const autoIndep = (key: string, total: number): number => {
    const fixed = FIXED_ITEMS.find(i => i.key === key)
    if (fixed) return fixed.split === 'full' ? total : total / 2
    const db = dbData[key]
    return db?.split_type === 'full' ? total : total / 2
  }

  const getIndep = (key: string) => {
    const m = merged(key)
    const total = parseFloat(m?.total_amount) || 0
    if (total === 0) return 0
    return m?.indep_amount != null ? parseFloat(m.indep_amount) : autoIndep(key, total)
  }

  const openEdit = (key: string) => {
    if (editingKey === key) { setEditingKey(null); return }
    const m     = merged(key)
    const total = parseFloat(m?.total_amount) || 0
    const indep = getIndep(key)
    const fixedItem = FIXED_ITEMS.find(i => i.key === key)
    const defaultPct = fixedItem?.split === 'full' ? 100 : 50
    const pct = total > 0 ? Math.round((indep / total) * 100) : defaultPct
    setEditForm({ pct: String(pct), detail: m?.detail ?? '', name: m?.custom_name ?? '' })
    setEditingKey(key)
  }

  const applyEdit = async (key: string) => {
    const m     = merged(key)
    const total = parseFloat(m?.total_amount) || 0
    const pct   = Math.min(100, Math.max(0, parseFloat(editForm.pct) || 0))
    await saveField(key, 'indep_amount', total * (pct / 100))
    await saveField(key, 'detail', editForm.detail || null)
    if (key.startsWith('custom_') && editForm.name.trim()) {
      await saveField(key, 'custom_name', editForm.name.trim())
    }
    load()
    setEditingKey(null)
  }

  const addCustomItem = async () => {
    if (!customForm.name.trim()) return
    setSavingCustom(true)
    const row = await api.post<any>(`/expenses/compartidos/${year}/${month}/custom`, {
      name: customForm.name.trim(), split_type: customForm.split_type,
    })
    setDbData(prev => ({ ...prev, [row.item_key]: row }))
    setCustomForm({ name: '', split_type: 'half' })
    setAddingCustom(false)
    setSavingCustom(false)
  }

  const deleteCustomItem = async (key: string) => {
    await api.delete(`/expenses/compartidos/${year}/${month}/${key}`)
    setDbData(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  // ── Render de cada fila (fija o custom) ─────────────────────────────────────
  const renderRow = (
    key: string,
    name: string,
    isCustom: boolean,
  ) => {
    const m         = merged(key)
    const total     = parseFloat(m?.total_amount) || 0
    const indep     = getIndep(key)
    const luro      = total - indep
    const paid      = m?.paid_status ?? 'NO'
    const split     = isCustom ? (m?.split_type ?? 'half') : (FIXED_ITEMS.find(i => i.key === key)?.split ?? 'half')
    const rawPct    = total > 0 ? Math.round((indep / total) * 100) : (split === 'full' ? 100 : 50)
    const isEditing = editingKey === key

    return (
      <>
        <tr key={key} className={['table-tr', isEditing ? 'bg-coral/5' : ''].join(' ')}>
          {/* Concepto */}
          <td className="table-td text-xs font-medium">
            {isCustom ? (
              <div className="flex items-center gap-2">
                <span>{m?.custom_name ?? key}</span>
                <button onClick={() => deleteCustomItem(key)} className="text-red-300 hover:text-red-500">
                  <Trash2 size={11} />
                </button>
              </div>
            ) : name}
          </td>

          {/* % Indep */}
          <td className="table-td text-center">
            <span className={[
              'text-xs font-bold px-2 py-0.5 rounded-full',
              rawPct === 100 ? 'bg-coral/20 text-coral-dark' : 'bg-brand-border text-brand-body',
            ].join(' ')}>
              {rawPct}%
            </span>
          </td>

          {/* Monto total — input editable (bloqueado si cerrado) */}
          <td className="table-td p-1">
            {isClosed
              ? <span className="text-xs text-right block pr-2 font-semibold">{total > 0 ? fmt$(total) : '—'}</span>
              : <input
                  type="number" placeholder="0"
                  className="input py-1 px-2 text-xs text-right w-36"
                  value={edits[key]?.total_amount ?? (m?.total_amount != null ? String(m.total_amount) : '')}
                  onChange={ev => setField(key, 'total_amount', ev.target.value)}
                  onBlur={async ev => {
                    const val = parseFloat(ev.target.value)
                    if (isNaN(val)) return
                    await saveField(key, 'total_amount', val)
                    await saveField(key, 'indep_amount', autoIndep(key, val))
                    setEdits(prev => { const n = { ...prev }; delete n[key]; return n })
                    load()
                  }}
                />}
          </td>

          {/* Independencia paga — read-only */}
          <td className="table-td text-xs text-right font-semibold text-brand-body">
            {total > 0 ? fmt$(indep) : <span className="text-brand-muted">—</span>}
          </td>

          {/* Luro neto — read-only */}
          <td className="table-td text-xs text-right text-brand-muted">
            {total > 0 ? fmt$(luro) : <span className="text-brand-muted">—</span>}
          </td>

          {/* Pagado */}
          <td className="table-td text-center">
            <button
              disabled={isClosed}
              onClick={async () => { if (isClosed) return; await saveField(key, 'paid_status', paid === 'SI' ? 'NO' : 'SI'); load() }}
              className={['badge', isClosed ? 'cursor-default opacity-70' : 'cursor-pointer', paid === 'SI' ? 'badge-green' : 'badge-red'].join(' ')}>
              {paid === 'SI' ? 'SI' : 'NO'}
            </button>
          </td>

          {/* Lápiz editar — oculto si cerrado */}
          <td className="table-td text-center p-1">
            {!isClosed && (
              <button
                onClick={() => openEdit(key)}
                title="Editar porcentaje y detalle"
                className={[
                  'p-1 rounded transition-colors',
                  isEditing ? 'text-coral bg-coral/10' : 'text-brand-muted hover:text-brand-body',
                ].join(' ')}>
                <Pencil size={13} />
              </button>
            )}
          </td>
        </tr>

        {/* Panel de edición inline */}
        {isEditing && (
          <tr key={`${key}-edit`} className="bg-coral/5 border-b border-brand-border">
            <td colSpan={7} className="px-6 py-4">
              <div className="flex flex-wrap items-end gap-4">
                {/* Nombre (solo custom) */}
                {isCustom && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Nombre del item</label>
                    <input type="text"
                      className="input py-1 px-2 text-xs w-44"
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                )}
                {/* % Independencia */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">% que paga Independencia</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100"
                      className="input py-1 px-2 text-xs text-right w-20"
                      value={editForm.pct}
                      onChange={e => setEditForm(f => ({ ...f, pct: e.target.value }))}
                    />
                    <span className="text-xs text-brand-muted">%</span>
                  </div>
                </div>
                {/* Nota */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Nota / Detalle</label>
                  <input type="text" placeholder="Opcional..."
                    className="input py-1 px-2 text-xs w-56"
                    value={editForm.detail}
                    onChange={e => setEditForm(f => ({ ...f, detail: e.target.value }))}
                  />
                </div>
                {/* Acciones */}
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => applyEdit(key)}
                    className="btn-primary text-xs py-1 px-3 flex items-center gap-1">
                    <Check size={13} /> Guardar
                  </button>
                  <button onClick={() => setEditingKey(null)}
                    className="btn-ghost text-xs py-1 px-3 flex items-center gap-1">
                    <X size={13} /> Cancelar
                  </button>
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }

  // ── Totales ──────────────────────────────────────────────────────────────────
  const allKeys      = [...FIXED_ITEMS.map(i => i.key), ...customItems.map((r: any) => r.item_key)]
  const totalGeneral = allKeys.reduce((a, k) => a + (parseFloat(merged(k)?.total_amount) || 0), 0)
  const totalIndep   = allKeys.reduce((a, k) => a + getIndep(k), 0)
  const totalLuro    = totalGeneral - totalIndep

  // ── Categorías únicas para agrupar ───────────────────────────────────────────
  const categories = [...new Set(FIXED_ITEMS.map(i => i.category))]

  // ── PDF ──────────────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const fixedRows = FIXED_ITEMS.map(item => {
      const m = merged(item.key)
      const total = parseFloat(m?.total_amount) || 0
      const indep = getIndep(item.key)
      return { name: item.name, cat: item.category, total, indep, luro: total - indep,
               due: m?.due_date ?? '', detail: m?.detail ?? '', paid: m?.paid_status ?? 'NO' }
    }).filter(r => r.total > 0)
    const customRows = customItems.map((row: any) => {
      const m = merged(row.item_key)
      const total = parseFloat(m?.total_amount) || 0
      const indep = getIndep(row.item_key)
      return { name: m?.custom_name ?? row.item_key, cat: 'Personalizado', total, indep, luro: total - indep,
               due: m?.due_date ?? '', detail: m?.detail ?? '', paid: m?.paid_status ?? 'NO' }
    }).filter((r: any) => r.total > 0)
    const rows = [...fixedRows, ...customRows]

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Gastos Compartidos ${month} ${year}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;margin:32px}
  h2{font-size:16px;margin-bottom:4px}
  .sub{color:#666;font-size:11px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th{background:#f0ede8;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #c8a87a}
  td{padding:5px 8px;border-bottom:1px solid #e8e4df}
  .num{text-align:right}
  .paid-si{color:#16a34a;font-weight:bold}
  .paid-no{color:#dc2626}
  .tfoot td{background:#f0ede8;font-weight:bold;border-top:2px solid #c8a87a}
  .summary{margin-top:24px;display:flex;gap:24px}
  .summary-box{border:1px solid #c8a87a;border-radius:6px;padding:12px 20px;min-width:160px}
  .summary-box .label{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.5px}
  .summary-box .value{font-size:16px;font-weight:bold;margin-top:2px}
</style></head><body>
<h2>Gastos Compartidos</h2>
<div class="sub">${month} ${year} &nbsp;·&nbsp; Distribución Luro / Independencia</div>
<table>
  <thead><tr>
    <th>Item</th><th>Categoria</th><th>Detalle</th>
    <th class="num">Total $</th><th class="num">Indep. $</th><th class="num">Luro $</th><th>Pagado</th>
  </tr></thead>
  <tbody>
    ${rows.map(r => `<tr>
      <td>${r.name}</td><td>${r.cat}</td><td>${r.detail}</td>
      <td class="num">${fmt$(r.total)}</td>
      <td class="num">${fmt$(r.indep)}</td>
      <td class="num">${fmt$(r.luro)}</td>
      <td class="${r.paid === 'SI' ? 'paid-si' : 'paid-no'}">${r.paid}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot><tr>
    <td colspan="3">TOTAL MES</td>
    <td class="num">${fmt$(totalGeneral)}</td>
    <td class="num">${fmt$(totalIndep)}</td>
    <td class="num">${fmt$(totalLuro)}</td>
    <td></td>
  </tr></tfoot>
</table>
<div class="summary">
  <div class="summary-box"><div class="label">Total General</div><div class="value">${fmt$(totalGeneral)}</div></div>
  <div class="summary-box"><div class="label">Independencia debe</div><div class="value">${fmt$(totalIndep)}</div></div>
  <div class="summary-box"><div class="label">Luro neto</div><div class="value">${fmt$(totalLuro)}</div></div>
</div>
</body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
  }

  const doCloseMonth = async () => {
    await api.post(`/expenses/close/compartidos/${year}/${month}`, {})
    setShowCloseModal(false)
    refreshClosure()
  }

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar: tabs historial + botones */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setView('tabla')}
            className={['px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              view === 'tabla' ? 'bg-navy text-white' : 'bg-brand-off-white text-brand-muted hover:text-brand-body border border-brand-border'].join(' ')}>
            Tabla del mes
          </button>
          <button onClick={() => setView('historial')}
            className={['flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              view === 'historial' ? 'bg-navy text-white' : 'bg-brand-off-white text-brand-muted hover:text-brand-body border border-brand-border'].join(' ')}>
            <History size={12}/> Historial
          </button>
        </div>
        {/* Acciones */}
        <div className="flex items-center gap-2">
          <button onClick={exportPDF} className="btn-ghost text-sm">
            <FileDown size={15}/> PDF
          </button>
          {!isClosed
            ? <button onClick={() => setShowCloseModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors">
                <Lock size={12}/> Cerrar mes
              </button>
            : <button onClick={() => setShowReopenModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors">
                <Unlock size={12}/> Reabrir
              </button>}
        </div>
      </div>

      {/* Banner cerrado */}
      {isClosed && view === 'tabla' && (
        <ClosedBanner closedAt={closedAt} onReopen={() => setShowReopenModal(true)} />
      )}

      {/* Historial */}
      {view === 'historial' && (
        <HistorialView section="compartidos" onNavigate={(m, y) => {
          onMonthChange(m)
          setView('tabla')
        }} />
      )}

      {view === 'tabla' && (<>
      {/* KPIs */}
      <div className="flex gap-3 flex-wrap">
        <div className="kpi-card py-2 px-3">
          <span className="kpi-label text-[10px]">Total General</span>
          <span className="kpi-value text-base">{fmt$(totalGeneral)}</span>
        </div>
        <div className="kpi-card py-2 px-3">
          <span className="kpi-label text-[10px]">Independencia debe</span>
          <span className="kpi-value text-base">{fmt$(totalIndep)}</span>
        </div>
        <div className="kpi-card py-2 px-3">
          <span className="kpi-label text-[10px]">Luro neto</span>
          <span className="kpi-value text-base">{fmt$(totalLuro)}</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Concepto</th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest">
                  % Indep.
                  <div className="font-normal text-white/60 text-[10px] normal-case leading-tight tracking-normal">porcentaje a cargo</div>
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest">
                  Monto total $
                  <div className="font-normal text-white/60 text-[10px] normal-case leading-tight tracking-normal">lo que adelanta Luro</div>
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest">
                  Independencia paga $
                  <div className="font-normal text-white/60 text-[10px] normal-case leading-tight tracking-normal">lo que debe reintegrar</div>
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest">
                  Luro neto $
                  <div className="font-normal text-white/60 text-[10px] normal-case leading-tight tracking-normal">queda a cargo de Luro</div>
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Pagado</th>
                <th className="px-4 py-3 w-10 text-center text-[11px] font-normal uppercase tracking-widest opacity-60">Edit.</th>
              </tr>
            </thead>
            <tbody>
              {/* Items fijos agrupados por categoría */}
              {categories.map(cat => (
                <>
                  <tr key={`cat-${cat}`} className="bg-brand-off-white">
                    <td colSpan={7} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted border-t border-brand-border">
                      {cat}
                    </td>
                  </tr>
                  {FIXED_ITEMS.filter(i => i.category === cat).map(item =>
                    renderRow(item.key, item.name, false)
                  )}
                </>
              ))}

              {/* Items personalizados */}
              {customItems.length > 0 && (
                <tr key="cat-custom" className="bg-brand-off-white">
                  <td colSpan={7} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted border-t border-brand-border">
                    Personalizados
                  </td>
                </tr>
              )}
              {customItems.map((row: any) =>
                renderRow(row.item_key, row.custom_name ?? row.item_key, true)
              )}

              {/* Fila de totales */}
              <tr className="bg-brand-off-white border-t-2 border-brand-border font-bold text-xs">
                <td className="table-td" colSpan={2}>TOTAL MES</td>
                <td className="table-td text-right">{fmt$(totalGeneral)}</td>
                <td className="table-td text-right">{fmt$(totalIndep)}</td>
                <td className="table-td text-right">{fmt$(totalLuro)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Agregar item personalizado */}
      {!isClosed && (addingCustom ? (
        <div className="card p-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-brand-muted uppercase tracking-wide">Nombre del item *</label>
            <input type="text" placeholder="ej: Monotributo" autoFocus
              className="input py-1 px-2 text-xs w-48"
              value={customForm.name}
              onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addCustomItem()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-brand-muted uppercase tracking-wide">Reparto</label>
            <select className="input py-1 px-2 text-xs w-36"
              value={customForm.split_type}
              onChange={e => setCustomForm(f => ({ ...f, split_type: e.target.value as SplitType }))}>
              <option value="half">Mitad (50/50)</option>
              <option value="full">Total Independencia</option>
            </select>
          </div>
          <button onClick={addCustomItem} disabled={savingCustom || !customForm.name.trim()}
            className="btn-primary text-xs py-1 px-3">
            {savingCustom ? 'Guardando...' : 'Agregar'}
          </button>
          <button onClick={() => setAddingCustom(false)} className="btn-ghost text-xs py-1 px-3">Cancelar</button>
        </div>
      ) : (
        <button onClick={() => setAddingCustom(true)}
          className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-body transition-colors">
          <Plus size={13} /> Agregar item personalizado
        </button>
      ))}
      </>)}

      {/* Modales */}
      {showCloseModal && (
        <CloseMonthModal month={month} year={year}
          onConfirm={doCloseMonth} onClose={() => setShowCloseModal(false)} />
      )}
      {showReopenModal && (
        <ReopenMonthModal month={month} year={year} section="compartidos"
          onSuccess={() => { setShowReopenModal(false); refreshClosure() }}
          onClose={() => setShowReopenModal(false)} />
      )}
    </div>
  )
}

// ── Categorías de Gastos Luro (fijas en frontend) ────────────────────────────
const LURO_CATS: Record<string, string[]> = {
  'Varios':           ['Almacén', 'Artículos Limpieza', 'S - Otros', 'Adriana'],
  'Gastos_Fijos':     ['Edea', 'Alquiler', 'Obras sanitarias', 'Internet', 'G - Otros', 'FAECYS', 'U.S.I.M.R.A', 'SEGURO COMERCIO INTEGRAL', 'SEC', 'FORMULARIO 931', 'POSNET', 'CLARO', 'INACAP', 'MATAFUEGOS', 'CONTADOR'],
  'Sueldos':          ['Vazquez, Martin', 'Viejo, Marcelo', 'Viejo, Ariel', 'Vila, Cecilia', 'Vila, Juana', 'Vila, Guillermo', 'Lalli, Facundo', 'Rojo, Matias', 'Zicavo, Valentina', 'Scatizzi, Patricia'],
  'Proveedores':      ['Vila, Marcelo', 'Fito', 'Salinas, Ariel', 'Natanael', 'Beto', 'Silvia', 'Gonzalez Tudanca', 'LAR', 'San francisco', 'Decoforma', 'Adagio Sur', 'Solo cuadros'],
  'Transporte':       ['Valentin Flete', 'Gabi Flete', 'Transporte miramar'],
  'Impuestos':        ['I.V.A', 'Ingresos Brutos', 'IIGG', 'Bienes Personales', 'I - Otros', 'Tasa seguridad e higiene', 'Autonomo'],
  'Insumos':          ['Bolsas', 'Film stretch', 'Ferreteria', 'Ropa de trabajo'],
  'Aguinaldo':        ['Martin', 'Marcelo', 'Ariel', 'Cecilia', 'Jua', 'Guille', 'Facu', 'Pato'],
  'Marketing_Digital':['Hosting', 'Sitio WEB', 'Publicidad PAGA', 'Canva'],
  'Comision':         ['Martin Vazquez', 'Marcelo Viejo', 'Ariel Viejo', 'Cecilia Vila', 'Juana Vila', 'Guillermo Vila', 'Facundo Lalli', 'Pato Scatizzi'],
}
const MEDIOS_PAGO = ['Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Débito']

// ── Colores por defecto para cada categoría ──────────────────────────────────
const DEFAULT_CAT_COLORS: Record<string, string> = {
  'Varios':            '#3b82f6',
  'Gastos_Fijos':      '#8b5cf6',
  'Sueldos':           '#22c55e',
  'Proveedores':       '#f97316',
  'Transporte':        '#06b6d4',
  'Impuestos':         '#ef4444',
  'Insumos':           '#eab308',
  'Aguinaldo':         '#ec4899',
  'Marketing_Digital': '#6366f1',
  'Comision':          '#14b8a6',
}

// Paleta de colores disponibles en el selector
const COLOR_PALETTE = [
  '#3b82f6','#8b5cf6','#22c55e','#f97316','#06b6d4',
  '#ef4444','#eab308','#ec4899','#6366f1','#14b8a6',
  '#f59e0b','#84cc16','#0ea5e9','#a855f7','#C4875A','#64748b',
]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#','')
  const r = parseInt(h.slice(0,2), 16)
  const g = parseInt(h.slice(2,4), 16)
  const b = parseInt(h.slice(4,6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function CatBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: hexToRgba(color, 0.13), color, border: `1px solid ${hexToRgba(color, 0.35)}` }}>
      {name}
    </span>
  )
}

// ── GastosLuro ────────────────────────────────────────────────────────────────
type LuroView = 'registro' | 'reporte' | 'historial'

function GastosLuro({ month, year, onMonthChange }: { month: string; year: number; onMonthChange: (m: string) => void }) {
  const [view, setView]             = useState<LuroView>('registro')
  const [showSettings, setShowSettings] = useState(false)
  const [showCloseModal, setShowCloseModal]   = useState(false)
  const [showReopenModal, setShowReopenModal] = useState(false)

  const { isClosed, closedAt, refresh: refreshClosure } = useMonthClosure('luro', month, year)

  // Categorías y colores — persisten en localStorage
  const [cats, setCats] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('luro_cats') ?? 'null') || LURO_CATS }
    catch { return LURO_CATS }
  })
  const [colors, setColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('luro_colors') ?? 'null') || DEFAULT_CAT_COLORS }
    catch { return DEFAULT_CAT_COLORS }
  })

  const saveCats = (next: Record<string, string[]>) => {
    setCats(next)
    localStorage.setItem('luro_cats', JSON.stringify(next))
  }
  const saveColors = (next: Record<string, string>) => {
    setColors(next)
    localStorage.setItem('luro_colors', JSON.stringify(next))
  }

  const doCloseMonth = async () => {
    await api.post(`/expenses/close/luro/${year}/${month}`, {})
    setShowCloseModal(false)
    refreshClosure()
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs + acciones */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(['registro', 'reporte', 'historial'] as LuroView[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                view === v ? 'bg-navy text-white' : 'bg-brand-off-white text-brand-muted hover:text-brand-body border border-brand-border',
              ].join(' ')}>
              {v === 'registro' ? 'Registro mensual' : v === 'reporte' ? 'Reporte anual' : <><History size={12}/>Historial</>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!isClosed
            ? <button onClick={() => setShowCloseModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors">
                <Lock size={12}/> Cerrar mes
              </button>
            : <button onClick={() => setShowReopenModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors">
                <Unlock size={12}/> Reabrir
              </button>}
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-body border border-brand-border rounded-lg px-3 py-1.5 transition-colors">
            <Settings size={13}/> Categorías
          </button>
        </div>
      </div>

      {/* Banner cerrado */}
      {isClosed && view !== 'historial' && (
        <ClosedBanner closedAt={closedAt} onReopen={() => setShowReopenModal(true)} />
      )}

      {/* Contenido según vista */}
      {view === 'historial'
        ? <HistorialView section="luro" onNavigate={(m, _y) => { onMonthChange(m); setView('registro') }} />
        : view === 'registro'
          ? <LuroRegistro month={month} year={year} cats={cats} colors={colors} isClosed={isClosed} />
          : <LuroReporte  year={year} cats={cats} colors={colors} />}

      {/* Modales */}
      {showSettings && (
        <LuroCatSettings cats={cats} colors={colors}
          onSaveCats={saveCats} onSaveColors={saveColors}
          onClose={() => setShowSettings(false)} />
      )}
      {showCloseModal && (
        <CloseMonthModal month={month} year={year}
          onConfirm={doCloseMonth} onClose={() => setShowCloseModal(false)} />
      )}
      {showReopenModal && (
        <ReopenMonthModal month={month} year={year} section="luro"
          onSuccess={() => { setShowReopenModal(false); refreshClosure() }}
          onClose={() => setShowReopenModal(false)} />
      )}
    </div>
  )
}

// ── Modal de configuración de categorías ──────────────────────────────────────
function LuroCatSettings({
  cats, colors, onSaveCats, onSaveColors, onClose
}: {
  cats: Record<string, string[]>
  colors: Record<string, string>
  onSaveCats: (c: Record<string, string[]>) => void
  onSaveColors: (c: Record<string, string>) => void
  onClose: () => void
}) {
  const [localCats, setLocalCats]     = useState<Record<string, string[]>>({ ...cats })
  const [localColors, setLocalColors] = useState<Record<string, string>>({ ...colors })
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [newSub, setNewSub]           = useState('')
  const [newCatName, setNewCatName]   = useState('')
  const [colorPicker, setColorPicker] = useState<string | null>(null) // cat with open picker

  const addSub = (cat: string) => {
    const v = newSub.trim()
    if (!v) return
    const next = { ...localCats, [cat]: [...(localCats[cat] || []), v] }
    setLocalCats(next)
    setNewSub('')
  }
  const removeSub = (cat: string, sub: string) => {
    setLocalCats({ ...localCats, [cat]: localCats[cat].filter(s => s !== sub) })
  }
  const addCat = () => {
    const v = newCatName.trim()
    if (!v || localCats[v]) return
    setLocalCats({ ...localCats, [v]: [] })
    setLocalColors({ ...localColors, [v]: COLOR_PALETTE[Object.keys(localCats).length % COLOR_PALETTE.length] })
    setNewCatName('')
    setExpanded(v)
  }
  const removeCat = (cat: string) => {
    const next = { ...localCats }
    delete next[cat]
    setLocalCats(next)
    if (expanded === cat) setExpanded(null)
  }
  const setColor = (cat: string, color: string) => {
    setLocalColors({ ...localColors, [cat]: color })
    setColorPicker(null)
  }
  const save = () => {
    onSaveCats(localCats)
    onSaveColors(localColors)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(7,6,20,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <div>
            <h3 className="font-bold text-brand-body text-base">Categorías y subcategorías</h3>
            <p className="text-xs text-brand-muted mt-0.5">Los cambios se guardan localmente en este navegador</p>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-body p-1"><X size={18}/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {Object.keys(localCats).map(cat => {
            const color  = localColors[cat] || '#888'
            const isOpen = expanded === cat
            return (
              <div key={cat} className="rounded-xl border border-brand-border overflow-hidden">
                {/* Fila categoría */}
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-brand-off-white/60"
                  onClick={() => setExpanded(isOpen ? null : cat)}>
                  {/* Color swatch + picker */}
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      className="w-5 h-5 rounded-full border-2 border-white shadow-sm shrink-0"
                      style={{ backgroundColor: color }}
                      onClick={() => setColorPicker(colorPicker === cat ? null : cat)}
                    />
                    {colorPicker === cat && (
                      <div className="absolute left-0 top-7 z-10 bg-white rounded-xl shadow-xl border border-brand-border p-2.5 grid grid-cols-8 gap-1.5"
                        style={{ width: 188 }}>
                        {COLOR_PALETTE.map(c => (
                          <button key={c} onClick={() => setColor(cat, c)}
                            className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                            style={{ backgroundColor: c, borderColor: localColors[cat] === c ? '#000' : 'transparent' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-brand-body">{cat}</span>
                  <span className="text-[10px] text-brand-muted">{localCats[cat].length} subcat.</span>
                  <button onClick={e => { e.stopPropagation(); removeCat(cat) }}
                    className="text-red-300 hover:text-red-500 p-0.5 transition-colors ml-1">
                    <Trash2 size={12}/>
                  </button>
                  <span className={['text-brand-muted transition-transform', isOpen ? 'rotate-90' : ''].join(' ')} style={{ fontSize: 12 }}>▶</span>
                </div>

                {/* Subcategorías (expandible) */}
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-brand-border/50 space-y-2">
                    <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                      {localCats[cat].map(sub => (
                        <span key={sub} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{ backgroundColor: hexToRgba(color, 0.12), color, border: `1px solid ${hexToRgba(color, 0.3)}` }}>
                          {sub}
                          <button onClick={() => removeSub(cat, sub)} className="hover:opacity-70 ml-0.5"><X size={10}/></button>
                        </span>
                      ))}
                      {localCats[cat].length === 0 && (
                        <span className="text-xs text-brand-muted italic">Sin subcategorías</span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <input className="input text-xs py-1 px-2 flex-1"
                        placeholder="Nueva subcategoría..."
                        value={newSub}
                        onChange={e => setNewSub(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addSub(cat)}
                      />
                      <button onClick={() => addSub(cat)}
                        className="btn-primary text-xs py-1 px-2">
                        <Plus size={12}/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Agregar categoría */}
          <div className="flex gap-2 pt-1">
            <input className="input text-xs py-1.5 px-2 flex-1" placeholder="Nueva categoría..."
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCat()}
            />
            <button onClick={addCat} disabled={!newCatName.trim()}
              className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1">
              <Plus size={12}/> Agregar
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-brand-border">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={save} className="btn-primary text-sm">Guardar cambios</button>
        </div>
      </div>
    </div>
  )
}

// ── LuroRegistro ──────────────────────────────────────────────────────────────
function LuroRegistro({ month, year, cats, colors, isClosed }: { month: string; year: number; cats: Record<string, string[]>; colors: Record<string, string>; isClosed: boolean }) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const EMPTY_FORM = { expense_date: '', categoria: '', subcategoria: '', detail: '', amount: '', payment_method: '', pagado: 'NO', tipo_costo: 'fijo' }
  const [form, setForm]         = useState(EMPTY_FORM)

  const subCats = form.categoria ? (cats[form.categoria] ?? []) : []

  const load = useCallback(() => {
    api.get<any[]>(`/expenses/luro?month=${month}&year=${year}`).then(setExpenses)
  }, [month, year])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await api.post('/expenses/luro', {
        expense_date:   form.expense_date || null,
        categoria:      form.categoria,
        subcategoria:   form.subcategoria || null,
        detail:         form.detail || null,
        amount:         parseFloat(form.amount),
        payment_method: form.payment_method || null,
        pagado:         form.pagado,
        tipo_costo:     form.tipo_costo,
        month, year,
      })
      setAdding(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Error al guardar el gasto'
      setSaveError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setSaving(false)
    }
  }

  const togglePagado = async (id: number, current: string) => {
    await api.put(`/expenses/luro/${id}`, { pagado: current === 'SI' ? 'NO' : 'SI' })
    load()
  }

  const totalMes = expenses.reduce((a, e) => a + parseFloat(e.amount || 0), 0)

  // Resumen por categoría
  const resumen: Record<string, number> = {}
  for (const e of expenses) {
    const cat = e.categoria || 'Sin categoría'
    resumen[cat] = (resumen[cat] || 0) + parseFloat(e.amount || 0)
  }

  return (
    <div className="flex gap-4 items-start">
      {/* ── Tabla principal ── */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Toolbar */}
        <div className="flex justify-between items-center">
          <div className="kpi-card py-2 px-3 inline-flex flex-col">
            <span className="kpi-label text-[10px]">Total {month}</span>
            <span className="kpi-value text-base">{fmt$(totalMes)}</span>
          </div>
          {!isClosed && (
            <button onClick={() => setAdding(!adding)} className="btn-primary text-sm">
              <Plus size={15}/> Nuevo gasto
            </button>
          )}
        </div>

        {/* Formulario nuevo gasto */}
        {adding && (
          <form onSubmit={handleAdd} className="card grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Fecha</label>
              <input type="date" className="input text-sm" value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Categoría *</label>
              <select className="input text-sm" value={form.categoria} required
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value, subcategoria: '' }))}>
                <option value="">Seleccionar...</option>
                {Object.keys(cats).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Subcategoría</label>
              <select className="input text-sm" value={form.subcategoria}
                onChange={e => setForm(f => ({ ...f, subcategoria: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {subCats.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Detalle</label>
              <input type="text" placeholder="Descripción del gasto..." className="input text-sm" value={form.detail}
                onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Importe $ *</label>
              <input type="number" placeholder="0,00" className="input text-sm text-right" value={form.amount} required
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Medio de pago</label>
              <select className="input text-sm" value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {MEDIOS_PAGO.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Pagado</label>
              <select className="input text-sm" value={form.pagado}
                onChange={e => setForm(f => ({ ...f, pagado: e.target.value }))}>
                <option value="NO">NO</option>
                <option value="SI">SI</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">Tipo costo (PE)</label>
              <div className="flex gap-2 mt-1">
                {['fijo','variable'].map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, tipo_costo: t }))}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border-2 transition-all"
                    style={form.tipo_costo === t
                      ? { background: t === 'fijo' ? '#7c3aed' : '#0891b2', color: '#fff', borderColor: t === 'fijo' ? '#7c3aed' : '#0891b2' }
                      : { background: 'white', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2 md:col-span-3 flex flex-col gap-2 pt-1">
              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                  Error al guardar: {saveError}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setAdding(false); setForm(EMPTY_FORM); setSaveError(null) }} className="btn-ghost text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm">
                  {saving ? 'Guardando...' : 'Guardar gasto'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tabla de gastos */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Fecha</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Categoría</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Subcategoría</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest">Detalle</th>
                  <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-widest">Importe $</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Medio</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Tipo</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-widest">Pagado</th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="table-tr">
                    <td className="table-td text-xs">{e.expense_date ?? '—'}</td>
                    <td className="table-td text-xs">
                      {e.categoria
                        ? <CatBadge name={e.categoria} color={colors[e.categoria] || '#888'} />
                        : <span className="text-brand-muted">—</span>}
                    </td>
                    <td className="table-td text-xs text-brand-muted">{e.subcategoria ?? '—'}</td>
                    <td className="table-td text-xs">{e.detail ?? '—'}</td>
                    <td className="table-td text-xs text-right font-semibold">{fmt$(parseFloat(e.amount))}</td>
                    <td className="table-td text-xs text-center text-brand-muted">{e.payment_method ?? '—'}</td>
                    <td className="table-td text-center">
                      <button
                        onClick={async () => {
                          const next = (e.tipo_costo ?? 'fijo') === 'fijo' ? 'variable' : 'fijo'
                          await api.put(`/expenses/luro/${e.id}`, { tipo_costo: next })
                          load()
                        }}
                        title="Clic para cambiar tipo"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all"
                        style={(e.tipo_costo ?? 'fijo') === 'fijo'
                          ? { background: '#ede9fe', color: '#7c3aed' }
                          : { background: '#cffafe', color: '#0e7490' }}>
                        {(e.tipo_costo ?? 'fijo') === 'fijo' ? 'FIJO' : 'VARIABLE'}
                      </button>
                    </td>
                    <td className="table-td text-center">
                      <button onClick={() => togglePagado(e.id, e.pagado ?? 'NO')}
                        className={['badge cursor-pointer', e.pagado === 'SI' ? 'badge-green' : 'badge-red'].join(' ')}>
                        {e.pagado === 'SI' ? 'SI' : 'NO'}
                      </button>
                    </td>
                    <td className="table-td p-1">
                      {!isClosed && (
                        <button onClick={async () => { await api.delete(`/expenses/luro/${e.id}`); load() }}
                          className="text-red-400 hover:text-red-600 transition-colors p-1">
                          <Trash2 size={13}/>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={8} className="table-td text-center text-brand-muted py-10 text-sm">
                    No hay gastos para {month} {year}
                  </td></tr>
                )}
                <tr className="bg-brand-off-white border-t-2 border-brand-border font-bold text-xs">
                  <td colSpan={4} className="table-td">TOTAL MES</td>
                  <td className="table-td text-right">{fmt$(totalMes)}</td>
                  <td colSpan={4} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Panel resumen categorías ── */}
      <div className="w-56 shrink-0 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted px-1">Resumen {month}</p>
        <div className="card p-3 space-y-1.5">
          {Object.keys(cats).map(cat => {
            const color = colors[cat] || '#888'
            return (
            <div key={cat} className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-brand-muted truncate">{cat}</span>
              </div>
              <span className={['text-xs font-bold tabular-nums', resumen[cat] ? 'text-brand-body' : 'text-brand-muted/40'].join(' ')}>
                {resumen[cat] ? fmt$(resumen[cat]) : '—'}
              </span>
            </div>
            )
          })}
          <div className="border-t border-brand-border pt-1.5 mt-1 flex justify-between">
            <span className="text-xs font-bold text-brand-body">TOTAL</span>
            <span className="text-xs font-bold text-brand-body">{fmt$(totalMes)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LuroReporte (anual) ───────────────────────────────────────────────────────
function LuroReporte({ year, cats: _cats, colors }: { year: number; cats: Record<string, string[]>; colors: Record<string, string> }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

  useEffect(() => {
    setLoading(true)
    api.get<any[]>(`/expenses/luro/reporte/${year}`).then(data => {
      setRows(data)
      setLoading(false)
    })
  }, [year])

  // Agrupa por categoría para mostrar subtotales
  const byCategoria: Record<string, any[]> = {}
  for (const row of rows) {
    byCategoria[row.categoria] = byCategoria[row.categoria] || []
    byCategoria[row.categoria].push(row)
  }

  // Total por mes (columna de pie)
  const totalPorMes: Record<string, number> = {}
  for (const mes of MESES) {
    totalPorMes[mes] = rows.reduce((a, r) => a + (r.months[mes] || 0), 0)
  }
  const totalAnual = rows.reduce((a, r) => a + r.total, 0)

  if (loading) return <div className="text-brand-muted text-sm py-10 text-center">Cargando reporte...</div>

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: '1100px' }}>
          <thead>
            <tr className="bg-navy text-white">
              <th className="px-3 py-3 text-left font-bold uppercase tracking-widest sticky left-0 bg-navy" style={{ minWidth: 180 }}>Categoría / Subcategoría</th>
              {MESES.map(m => (
                <th key={m} className="px-2 py-3 text-right font-bold uppercase tracking-widest" style={{ minWidth: 80 }}>
                  {m.slice(0,3)}
                </th>
              ))}
              <th className="px-3 py-3 text-right font-bold uppercase tracking-widest">TOTAL</th>
              <th className="px-3 py-3 text-right font-bold uppercase tracking-widest">%</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byCategoria).map(([cat, subs]) => {
              const catTotal = subs.reduce((a, r) => a + r.total, 0)
              const catByMes: Record<string, number> = {}
              for (const mes of MESES) catByMes[mes] = subs.reduce((a, r) => a + (r.months[mes] || 0), 0)
              const pct = totalAnual > 0 ? ((catTotal / totalAnual) * 100).toFixed(1) : '0.0'
              return (
                <>
                  {/* Fila categoría (bold) */}
                  <tr key={`cat-${cat}`} className="border-t border-brand-border"
                    style={{ backgroundColor: hexToRgba(colors[cat] || '#888', 0.07) }}>
                    <td className="px-3 py-2 font-bold sticky left-0"
                      style={{ backgroundColor: hexToRgba(colors[cat] || '#888', 0.07) }}>
                      <CatBadge name={cat} color={colors[cat] || '#888'} />
                    </td>
                    {MESES.map(m => (
                      <td key={m} className="px-2 py-2 text-right font-semibold"
                        style={{ color: catByMes[m] > 0 ? (colors[cat] || '#888') : undefined }}>
                        {catByMes[m] > 0 ? fmt$(catByMes[m]) : <span className="text-brand-muted/40">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-bold" style={{ color: colors[cat] || '#888' }}>{catTotal > 0 ? fmt$(catTotal) : '—'}</td>
                    <td className="px-3 py-2 text-right font-bold text-brand-muted">{pct}%</td>
                  </tr>
                  {/* Filas subcategorías */}
                  {subs.map((row: any) => (
                    <tr key={`${cat}-${row.subcategoria}`} className="table-tr">
                      <td className="px-3 py-1.5 text-brand-muted pl-6 sticky left-0 bg-white">{row.subcategoria}</td>
                      {MESES.map(m => (
                        <td key={m} className="px-2 py-1.5 text-right text-brand-muted">
                          {row.months[m] > 0 ? fmt$(row.months[m]) : <span className="text-brand-muted/30">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right text-brand-body font-medium">{row.total > 0 ? fmt$(row.total) : '—'}</td>
                      <td className="px-3 py-1.5 text-right text-brand-muted">
                        {totalAnual > 0 ? ((row.total / totalAnual) * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}

            {/* Fila totales */}
            {rows.length > 0 && (
              <tr className="bg-navy text-white font-bold border-t-2 border-brand-border">
                <td className="px-3 py-3 sticky left-0 bg-navy">TOTAL GENERAL</td>
                {MESES.map(m => (
                  <td key={m} className="px-2 py-3 text-right">
                    {totalPorMes[m] > 0 ? fmt$(totalPorMes[m]) : '—'}
                  </td>
                ))}
                <td className="px-3 py-3 text-right">{fmt$(totalAnual)}</td>
                <td className="px-3 py-3 text-right">100%</td>
              </tr>
            )}

            {rows.length === 0 && (
              <tr><td colSpan={15} className="table-td text-center text-brand-muted py-10">
                No hay datos para {year}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
