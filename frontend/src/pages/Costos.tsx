import { useState, useEffect, useRef } from 'react'
import { api, fmt$ } from '../api'
import {
  Plus, Trash2, ChevronDown, ChevronRight, Package,
  FlaskConical, Tag, Edit3, Check, X, RefreshCw,
} from 'lucide-react'

const DARK   = '#1E2B1A'
const ACCENT = '#C4875A'

// ── Types ──────────────────────────────────────────────────────────
type Insumo = { id: number; nombre: string; unidad: string; precio: number }

type IngCalc = {
  insumo_id:   number
  nombre:      string
  cantidad:    number
  precio_unit: number
  subtotal:    number
}

type Receta = {
  id:              number
  nombre:          string
  categoria:       string
  ingredientes:    IngCalc[]
  packaging_costo: number
  costo_total:     number
  mult_mayor:      number
  mult_publico:    number
  precio_mayor:    number
  precio_publico:  number
  margen_pct:      number
  notas:           string
}

const CATEGORIAS = ['Velas', 'Home', 'Jabones', 'Shampoos', 'Cosméticos', 'Otros']
const CAT_COLORS: Record<string, string> = {
  Velas:      '#f59e0b',
  Home:       '#22c55e',
  Jabones:    '#8b5cf6',
  Shampoos:   '#06b6d4',
  Cosméticos: '#ec4899',
  Otros:      '#6b7280',
}

// ── Helpers ────────────────────────────────────────────────────────
function pct(n: number) { return `${n.toFixed(1)}%` }

// ── InsumoRow — edición inline de precio ──────────────────────────
function InsumoRow({ insumo, onSave, onDelete }: {
  insumo: Insumo
  onSave: (id: number, precio: number) => void
  onDelete: (id: number) => void
}) {
  const [val, setVal] = useState(String(insumo.precio))
  const [saving, setSaving] = useState(false)

  async function save() {
    const n = parseFloat(val)
    if (isNaN(n) || n === insumo.precio) return
    setSaving(true)
    await onSave(insumo.id, n)
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{insumo.nombre}</p>
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{insumo.unidad}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-gray-400">$</span>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => e.key === 'Enter' && save()}
          inputMode="decimal"
          className="w-24 text-sm font-bold text-right border-b border-transparent hover:border-gray-200 focus:border-amber-400 outline-none py-0.5 bg-transparent"
        />
        <span className="text-[10px] text-gray-400">/ {insumo.unidad}</span>
        {saving && <RefreshCw size={11} className="text-gray-300 animate-spin ml-1" />}
      </div>
      <button
        onClick={() => onDelete(insumo.id)}
        className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-opacity shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Tarjeta de receta ─────────────────────────────────────────────
function RecetaCard({ receta, insumos, onUpdate, onDelete }: {
  receta: Receta
  insumos: Insumo[]
  onUpdate: (r: Receta) => void
  onDelete: (id: number) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState(false)
  const [mm,      setMm]      = useState(String(receta.mult_mayor))
  const [mp,      setMp]      = useState(String(receta.mult_publico))
  const [pkg,     setPkg]     = useState(String(receta.packaging_costo))
  const [saving,  setSaving]  = useState(false)

  // edit recipe ingredients state
  const [ings, setIngs] = useState(receta.ingredientes.map(i => ({
    insumo_id: i.insumo_id,
    nombre:    i.nombre,
    cantidad:  i.cantidad,
  })))
  const [newIng, setNewIng] = useState({ insumo_id: 0, cantidad: '' })

  const color = CAT_COLORS[receta.categoria] ?? '#6b7280'

  async function saveMultipliers() {
    setSaving(true)
    const body = {
      nombre:          receta.nombre,
      categoria:       receta.categoria,
      ingredientes:    ings,
      packaging_costo: parseFloat(pkg) || 0,
      mult_mayor:      parseFloat(mm)  || 1.8,
      mult_publico:    parseFloat(mp)  || 2.5,
      notas:           receta.notas,
    }
    const updated = await api.put<Receta>(`/costos/recetas/${receta.id}`, body)
    onUpdate(updated)
    setSaving(false)
    setEditing(false)
  }

  function addIng() {
    const insumo = insumos.find(i => i.id === newIng.insumo_id)
    if (!insumo || !newIng.cantidad) return
    setIngs(prev => [...prev, {
      insumo_id: insumo.id,
      nombre:    insumo.nombre,
      cantidad:  parseFloat(newIng.cantidad) || 0,
    }])
    setNewIng({ insumo_id: 0, cantidad: '' })
  }

  function removeIng(idx: number) {
    setIngs(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
        style={{ borderLeftWidth: 4, borderLeftColor: color }}
        onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm text-gray-900">{receta.nombre}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${color}20`, color }}>
              {receta.categoria}
            </span>
          </div>
          <div className="flex gap-4 mt-0.5 text-xs text-gray-400">
            <span>Costo: <b className="text-gray-700">{fmt$(receta.costo_total)}</b></span>
            <span>Mayor: <b style={{ color: DARK }}>{fmt$(receta.precio_mayor)}</b></span>
            <span>Público: <b style={{ color: ACCENT }}>{fmt$(receta.precio_publico)}</b></span>
            <span>Margen: <b className="text-green-600">{pct(receta.margen_pct)}</b></span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setEditing(ed => !ed); setOpen(true) }}
            className="text-gray-300 hover:text-gray-600 transition-colors p-1">
            <Edit3 size={14} />
          </button>
          {open ? <ChevronDown size={16} className="text-gray-400" />
                : <ChevronRight size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Detalle */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">

          {/* Ingredientes */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Ingredientes</p>
            <div className="space-y-0">
              {(editing ? ings : receta.ingredientes).map((ing, idx) => {
                const subtotal = editing
                  ? (insumos.find(i => i.id === ing.insumo_id)?.precio ?? 0) * ing.cantidad
                  : (ing as IngCalc).subtotal
                return (
                  <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 text-sm group/row">
                    {editing && (
                      <button onClick={() => removeIng(idx)} className="text-red-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100">
                        <X size={12} />
                      </button>
                    )}
                    <span className="flex-1 text-gray-700">{ing.nombre}</span>
                    {editing ? (
                      <input
                        value={ing.cantidad}
                        onChange={e => setIngs(prev => prev.map((x, i) => i === idx ? { ...x, cantidad: parseFloat(e.target.value) || 0 } : x))}
                        className="w-20 text-right border-b border-gray-200 outline-none text-xs bg-transparent"
                        inputMode="decimal"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">{ing.cantidad} {insumos.find(i => i.id === ing.insumo_id)?.unidad ?? ''}</span>
                    )}
                    <span className="w-20 text-right text-xs font-semibold text-gray-600">{fmt$(subtotal)}</span>
                  </div>
                )
              })}
            </div>

            {/* Add ingredient (edit mode) */}
            {editing && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-gray-200">
                <select
                  value={newIng.insumo_id}
                  onChange={e => setNewIng(p => ({ ...p, insumo_id: Number(e.target.value) }))}
                  className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 outline-none bg-gray-50">
                  <option value={0}>Seleccionar insumo…</option>
                  {insumos.map(i => (
                    <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                  ))}
                </select>
                <input
                  value={newIng.cantidad}
                  onChange={e => setNewIng(p => ({ ...p, cantidad: e.target.value }))}
                  placeholder="Cant."
                  inputMode="decimal"
                  className="w-20 text-xs border border-gray-200 rounded px-1.5 py-1 outline-none text-right"
                />
                <button onClick={addIng}
                  className="text-green-500 hover:text-green-700 font-bold text-sm px-2">
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Packaging + márgenes */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Packaging $</p>
              {editing
                ? <input value={pkg} onChange={e => setPkg(e.target.value)} inputMode="decimal"
                    className="w-full text-sm font-bold border-b border-gray-200 outline-none text-right bg-transparent" />
                : <p className="text-sm font-bold text-gray-700">{fmt$(receta.packaging_costo)}</p>}
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">× Mayor</p>
              {editing
                ? <input value={mm} onChange={e => setMm(e.target.value)} inputMode="decimal"
                    className="w-full text-sm font-bold border-b border-gray-200 outline-none text-right bg-transparent" />
                : <p className="text-sm font-bold" style={{ color: DARK }}>{receta.mult_mayor}×</p>}
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">× Público</p>
              {editing
                ? <input value={mp} onChange={e => setMp(e.target.value)} inputMode="decimal"
                    className="w-full text-sm font-bold border-b border-gray-200 outline-none text-right bg-transparent" />
                : <p className="text-sm font-bold" style={{ color: ACCENT }}>{receta.mult_publico}×</p>}
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Costo</p>
              <p className="text-base font-bold text-gray-800">{fmt$(receta.costo_total)}</p>
            </div>
            <div className="text-center border-x border-gray-200">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">X Mayor</p>
              <p className="text-base font-bold" style={{ color: DARK }}>{fmt$(receta.precio_mayor)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Público</p>
              <p className="text-base font-bold" style={{ color: ACCENT }}>{fmt$(receta.precio_publico)}</p>
            </div>
          </div>

          {/* Acciones edit */}
          {editing && (
            <div className="flex gap-2 pt-1">
              <button onClick={saveMultipliers} disabled={saving}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white transition-opacity disabled:opacity-60"
                style={{ background: DARK }}>
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                Guardar
              </button>
              <button onClick={() => setEditing(false)}
                className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => onDelete(receta.id)}
                className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors">
                Eliminar receta
              </button>
            </div>
          )}

          {receta.notas && (
            <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-2">{receta.notas}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function Costos() {
  const [tab,     setTab]     = useState<'insumos'|'recetas'|'lista'>('recetas')
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)

  // New insumo form
  const [addingIns, setAddingIns] = useState(false)
  const [newIns, setNewIns] = useState({ nombre: '', unidad: 'kg', precio: '' })

  // New receta form
  const [addingRec, setAddingRec] = useState(false)
  const [newRec, setNewRec] = useState({ nombre: '', categoria: 'Velas' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [ins, rec] = await Promise.all([
      api.get<Insumo[]>('/costos/insumos'),
      api.get<Receta[]>('/costos/recetas'),
    ])
    setInsumos(ins)
    setRecetas(rec)
    setLoading(false)
  }

  async function updatePrecio(id: number, precio: number) {
    await api.put(`/costos/insumos/${id}`, { precio })
    setInsumos(prev => prev.map(i => i.id === id ? { ...i, precio } : i))
    // recalculate recetas
    const rec = await api.get<Receta[]>('/costos/recetas')
    setRecetas(rec)
  }

  async function deleteInsumo(id: number) {
    if (!confirm('¿Eliminar este insumo?')) return
    await api.delete(`/costos/insumos/${id}`)
    setInsumos(prev => prev.filter(i => i.id !== id))
  }

  async function createInsumo() {
    if (!newIns.nombre.trim()) return
    const created = await api.post<Insumo>('/costos/insumos', {
      nombre: newIns.nombre.trim(),
      unidad: newIns.unidad,
      precio: parseFloat(newIns.precio) || 0,
    })
    setInsumos(prev => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNewIns({ nombre: '', unidad: 'kg', precio: '' })
    setAddingIns(false)
  }

  async function createReceta() {
    if (!newRec.nombre.trim()) return
    const created = await api.post<Receta>('/costos/recetas', {
      nombre: newRec.nombre.trim(), categoria: newRec.categoria,
      ingredientes: [], packaging_costo: 0, mult_mayor: 1.8, mult_publico: 2.5, notas: '',
    })
    setRecetas(prev => [...prev, created])
    setNewRec({ nombre: '', categoria: 'Velas' })
    setAddingRec(false)
  }

  function updateReceta(updated: Receta) {
    setRecetas(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  async function deleteReceta(id: number) {
    if (!confirm('¿Eliminar esta receta?')) return
    await api.delete(`/costos/recetas/${id}`)
    setRecetas(prev => prev.filter(r => r.id !== id))
  }

  // Group recetas by categoria
  const byCategoria = CATEGORIAS.map(cat => ({
    cat,
    items: recetas.filter(r => r.categoria === cat),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Costos y Precios</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Actualizá los precios de materias primas → los costos se recalculan solos
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white w-fit">
        {([
          { key: 'recetas',  label: 'Recetas',          icon: <FlaskConical size={13} /> },
          { key: 'insumos',  label: 'Materias Primas',  icon: <Package      size={13} /> },
          { key: 'lista',    label: 'Lista de Precios', icon: <Tag          size={13} /> },
        ] as const).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all"
            style={tab === key ? { background: DARK, color: 'white' } : { color: '#9ca3af' }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-16 text-gray-400">Cargando…</div>}

      {/* ═══ TAB: RECETAS ═══ */}
      {!loading && tab === 'recetas' && (
        <div className="space-y-3">
          {byCategoria.map(({ cat, items }) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] ?? '#6b7280' }} />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{cat}</p>
                <span className="text-xs text-gray-300">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.map(r => (
                  <RecetaCard key={r.id} receta={r} insumos={insumos}
                    onUpdate={updateReceta} onDelete={deleteReceta} />
                ))}
              </div>
            </div>
          ))}

          {/* Add receta */}
          {addingRec ? (
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-40">
                <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Nombre del producto</p>
                <input autoFocus value={newRec.nombre} onChange={e => setNewRec(p => ({ ...p, nombre: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && createReceta()}
                  placeholder="Ej: Vela Poland 500g"
                  className="w-full text-sm border-b border-gray-200 outline-none py-0.5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Categoría</p>
                <select value={newRec.categoria} onChange={e => setNewRec(p => ({ ...p, categoria: e.target.value }))}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white">
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={createReceta}
                  className="text-xs font-bold px-4 py-2 rounded-xl text-white"
                  style={{ background: DARK }}>Crear</button>
                <button onClick={() => setAddingRec(false)}
                  className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 text-gray-500">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingRec(true)}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-all w-full justify-center">
              <Plus size={15} /> Agregar producto
            </button>
          )}
        </div>
      )}

      {/* ═══ TAB: INSUMOS ═══ */}
      {!loading && tab === 'insumos' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between"
               style={{ background: DARK }}>
            <p className="text-white/60 text-[11px] font-bold tracking-[2px] uppercase">
              Materias Primas — {insumos.length} insumos
            </p>
            <p className="text-white/40 text-[10px]">Editá el precio y presioná Enter</p>
          </div>
          <div className="px-5 py-2">
            {insumos.map(i => (
              <InsumoRow key={i.id} insumo={i} onSave={updatePrecio} onDelete={deleteInsumo} />
            ))}

            {/* Add insumo */}
            {addingIns ? (
              <div className="flex flex-wrap gap-2 items-end py-3 border-t border-dashed border-gray-200 mt-2">
                <input autoFocus value={newIns.nombre} onChange={e => setNewIns(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Nombre del insumo"
                  className="flex-1 min-w-40 text-sm border-b border-gray-300 outline-none py-0.5" />
                <select value={newIns.unidad} onChange={e => setNewIns(p => ({ ...p, unidad: e.target.value }))}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white">
                  <option>kg</option><option>litro</option><option>unidad</option>
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">$</span>
                  <input value={newIns.precio} onChange={e => setNewIns(p => ({ ...p, precio: e.target.value }))}
                    inputMode="decimal" placeholder="0"
                    onKeyDown={e => e.key === 'Enter' && createInsumo()}
                    className="w-24 text-sm border-b border-gray-300 outline-none text-right py-0.5" />
                </div>
                <div className="flex gap-2">
                  <button onClick={createInsumo}
                    className="text-xs font-bold px-4 py-2 rounded-xl text-white"
                    style={{ background: DARK }}>Agregar</button>
                  <button onClick={() => setAddingIns(false)}
                    className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 text-gray-500">Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingIns(true)}
                className="flex items-center gap-1.5 text-xs font-semibold py-2 mt-1" style={{ color: ACCENT }}>
                <Plus size={13} /> Agregar insumo
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: LISTA DE PRECIOS ═══ */}
      {!loading && tab === 'lista' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100" style={{ background: DARK }}>
            <p className="text-white/60 text-[11px] font-bold tracking-[2px] uppercase">Lista de Precios — {recetas.length} productos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-widest">
                  <th className="px-5 py-3 text-left font-semibold">Producto</th>
                  <th className="px-3 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-3 py-3 text-right font-semibold">Costo</th>
                  <th className="px-3 py-3 text-right font-semibold">× Mayor</th>
                  <th className="px-5 py-3 text-right font-semibold">Precio Público</th>
                  <th className="px-5 py-3 text-right font-semibold">Margen</th>
                </tr>
              </thead>
              <tbody>
                {byCategoria.map(({ cat, items }) => (
                  <>
                    <tr key={cat} className="bg-gray-50">
                      <td colSpan={6} className="px-5 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] }} />
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{cat}</span>
                        </div>
                      </td>
                    </tr>
                    {items.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-gray-800">{r.nombre}</td>
                        <td className="px-3 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${CAT_COLORS[r.categoria] ?? '#6b7280'}20`, color: CAT_COLORS[r.categoria] ?? '#6b7280' }}>
                            {r.categoria}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-500">{fmt$(r.costo_total)}</td>
                        <td className="px-3 py-3 text-right font-bold" style={{ color: DARK }}>{fmt$(r.precio_mayor)}</td>
                        <td className="px-5 py-3 text-right font-bold text-lg" style={{ color: ACCENT }}>{fmt$(r.precio_publico)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.margen_pct >= 50 ? 'bg-green-100 text-green-700' : r.margen_pct >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                            {pct(r.margen_pct)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
