import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Plus, AlertTriangle, Package, ArrowRight,
  ArrowDownToLine, X, Check, History,
  ChevronDown, ChevronRight, Settings, FlaskConical, Layers,
} from 'lucide-react'

const API   = import.meta.env.VITE_API_URL ?? 'https://jan-erp.onrender.com'
const NAVY  = '#1E2B1A'
const CORAL = '#C4875A'
const SAGE  = '#3D6B64'
const CREAM = '#F5EFE6'
const PURPLE= '#7C3AED'

/* ── Types ─────────────────────────────────────────────────────── */
interface StockEntry {
  id:                 number
  producto_id:        number
  producto_nombre:    string
  producto_categoria: string
  variante:           string
  tipo:               string
  cantidad:           number
  stock_minimo:       number
  alerta:             boolean
}

interface InsumoStock {
  id:               number
  nombre:           string
  unidad:           string
  precio:           number
  stock_disponible: number
  stock_minimo:     number
  alerta:           boolean
}

interface Movimiento {
  id:              number
  producto_id:     number
  variante:        string
  tipo_movimiento: string
  tipo_stock:      string
  desde_tipo:      string
  hacia_tipo:      string
  cantidad:        number
  notas:           string
  fecha:           string
}

interface ProductoBusq {
  id:        number
  nombre:    string
  categoria: string
  variables: string
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmtN = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2)

const TIPO_COLOR: Record<string, string> = {
  listo:     SAGE,
  armado:    CORAL,
  produccion:PURPLE,
}
const TIPO_LABEL: Record<string, string> = {
  listo:     'Listo para venta',
  armado:    'Para armado',
  produccion:'Para producción',
}
const MOV_LABEL: Record<string, { label: string; color: string }> = {
  entrada:            { label: '↑ Entrada',          color: SAGE  },
  salida_venta:       { label: '↓ Venta',             color: '#DC2626' },
  ajuste:             { label: '✎ Ajuste',            color: CORAL },
  transferencia:      { label: '⇄ Transferencia',     color: PURPLE },
  salida_produccion:  { label: '↓ Consumo producción', color: '#DC2626' },
  entrada_produccion: { label: '↑ Producción',         color: SAGE  },
}

interface GrupoProducto {
  producto_id:   number
  nombre:        string
  categoria:     string
  entries:       StockEntry[]
}

function agrupar(entries: StockEntry[]): GrupoProducto[] {
  const map = new Map<number, GrupoProducto>()
  for (const e of entries) {
    if (!map.has(e.producto_id)) {
      map.set(e.producto_id, { producto_id: e.producto_id, nombre: e.producto_nombre, categoria: e.producto_categoria, entries: [] })
    }
    map.get(e.producto_id)!.entries.push(e)
  }
  return Array.from(map.values())
}

/* ════════════════════════════════════════════════════════════════
   MODAL: Movimiento de Producto (Fase 1)
   ════════════════════════════════════════════════════════════════ */
function MovimientoProductoModal({ preEntry, onClose, onDone }: { preEntry?: StockEntry; onClose: () => void; onDone: () => void }) {
  const [tipoMov,   setTipoMov]   = useState<'entrada'|'ajuste'|'transferencia'>('entrada')
  const [tipoStock, setTipoStock] = useState(preEntry?.tipo ?? 'listo')
  const [desdeT,    setDesdeT]    = useState('armado')
  const [haciaT,    setHaciaT]    = useState('listo')
  const [cantidad,  setCantidad]  = useState('')
  const [notas,     setNotas]     = useState('')
  const [fecha,     setFecha]     = useState(new Date().toISOString().split('T')[0])
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [q,         setQ]         = useState(preEntry?.producto_nombre ?? '')
  const [results,   setResults]   = useState<ProductoBusq[]>([])
  const [showDrop,  setShowDrop]  = useState(false)
  const [producto,  setProducto]  = useState<{ id: number; nombre: string; variantes: string[] } | null>(
    preEntry ? { id: preEntry.producto_id, nombre: preEntry.producto_nombre, variantes: [] } : null
  )
  const [variante, setVariante] = useState(preEntry?.variante ?? '')
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchProd = useCallback((val: string) => {
    setQ(val); setProducto(null)
    if (debRef.current) clearTimeout(debRef.current)
    if (val.length < 2) { setResults([]); setShowDrop(false); return }
    debRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/productos-jan/?q=${encodeURIComponent(val)}`, { credentials: 'omit' })
        const data: ProductoBusq[] = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setShowDrop(data.length > 0)
      } catch { setResults([]) }
    }, 250)
  }, [])

  const pickProd = (p: ProductoBusq) => {
    let opciones: string[] = []
    try {
      const vars = JSON.parse(p.variables || '[]')
      if (Array.isArray(vars) && vars[0]?.opciones?.length > 0) opciones = vars[0].opciones.filter((o: string) => o.trim())
    } catch { /* ignore */ }
    setProducto({ id: p.id, nombre: p.nombre, variantes: opciones })
    setVariante(opciones[0] ?? '')
    setQ(p.nombre); setShowDrop(false)
  }

  const save = async () => {
    if (!producto) { setError('Seleccioná un producto'); return }
    if (!cantidad || parseFloat(cantidad) < 0) { setError('Ingresá cantidad válida'); return }
    if (tipoMov === 'transferencia' && desdeT === haciaT) { setError('Origen y destino deben ser distintos'); return }
    setSaving(true); setError('')
    try {
      const body: Record<string, unknown> = { producto_id: producto.id, variante, tipo_movimiento: tipoMov, cantidad: parseFloat(cantidad), notas: notas || null, fecha }
      if (tipoMov === 'transferencia') { body.desde_tipo = desdeT; body.hacia_tipo = haciaT }
      else body.tipo_stock = tipoStock
      const res = await fetch(`${API}/stock-jan/movimiento`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Error') }
      onDone()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-5 py-4" style={{ background: NAVY }}>
          <div>
            <p className="text-white font-bold">Movimiento de producto</p>
            <p className="text-white/40 text-[11px] tracking-wide">Stock listo / armado / producción</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: SAGE }}>Tipo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['entrada','ajuste','transferencia'] as const).map(t => (
                <button key={t} onClick={() => setTipoMov(t)}
                  className="py-2 rounded-xl text-[12px] font-bold transition-all"
                  style={tipoMov===t ? { background: NAVY, color: 'white' } : { background: '#F3F4F6', color: '#6B7280' }}>
                  {t==='entrada' ? '↑ Entrada' : t==='ajuste' ? '✎ Ajuste' : '⇄ Transf.'}
                </button>
              ))}
            </div>
          </div>
          {/* Producto */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Producto *</label>
            {producto ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border-2" style={{ borderColor: SAGE, background: `${SAGE}08` }}>
                <span className="text-sm font-semibold" style={{ color: SAGE }}>{producto.nombre}</span>
                <button onClick={() => { setProducto(null); setQ(''); setVariante('') }} className="text-gray-400 hover:text-red-400"><X size={14} /></button>
              </div>
            ) : (
              <>
                <input type="text" value={q} onChange={e => searchProd(e.target.value)} onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                  placeholder="Buscar producto del catálogo…"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: '#E5E7EB' }} autoFocus />
                {showDrop && (
                  <div className="absolute top-full left-0 right-0 z-40 mt-1 rounded-xl shadow-xl border border-black/5 overflow-hidden max-h-48 overflow-y-auto bg-white">
                    {results.map(p => (
                      <button key={p.id} onMouseDown={() => pickProd(p)} className="w-full flex justify-between items-center px-3 py-2 hover:bg-amber-50 text-left">
                        <span className="text-sm font-medium text-gray-700">{p.nombre}</span>
                        <span className="text-[10px] text-gray-400 ml-2">{p.categoria}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {/* Variante */}
          {producto && producto.variantes.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Variante *</label>
              <select value={variante} onChange={e => setVariante(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }}>
                {producto.variantes.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          {/* Categoría / desde-hacia */}
          {tipoMov !== 'transferencia' ? (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Categoría de stock *</label>
              <select value={tipoStock} onChange={e => setTipoStock(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }}>
                <option value="listo">Listo para venta</option>
                <option value="armado">Para armado</option>
                <option value="produccion">Para producción (producto semi)</option>
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: CORAL }}>Desde</label>
                <select value={desdeT} onChange={e => setDesdeT(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }}>
                  <option value="produccion">Para producción</option>
                  <option value="armado">Para armado</option>
                  <option value="listo">Listo para venta</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Hacia</label>
                <select value={haciaT} onChange={e => setHaciaT(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }}>
                  <option value="listo">Listo para venta</option>
                  <option value="armado">Para armado</option>
                  <option value="produccion">Para producción</option>
                </select>
              </div>
            </div>
          )}
          {/* Cantidad + fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Cantidad *</label>
              <input type="number" min="0" step="0.01" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0"
                className="w-full border rounded-xl px-3 py-2 text-sm text-center font-bold" style={{ borderColor: '#E5E7EB' }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }} />
            </div>
          </div>
          <input type="text" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas (opcional)" className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }} />
          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: CORAL }}>
            {saving ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MODAL: Movimiento de Insumo (Fase 2)
   ════════════════════════════════════════════════════════════════ */
function MovimientoInsumoModal({ preInsumo, onClose, onDone }: { preInsumo?: InsumoStock; onClose: () => void; onDone: () => void }) {
  const [tipoMov,  setTipoMov]  = useState<'entrada'|'ajuste'>('entrada')
  const [cantidad, setCantidad] = useState('')
  const [notas,    setNotas]    = useState('')
  const [fecha,    setFecha]    = useState(new Date().toISOString().split('T')[0])
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [q,        setQ]        = useState(preInsumo?.nombre ?? '')
  const [results,  setResults]  = useState<InsumoStock[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const [insumo,   setInsumo]   = useState<InsumoStock | null>(preInsumo ?? null)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchInsumo = useCallback((val: string) => {
    setQ(val); setInsumo(null)
    if (debRef.current) clearTimeout(debRef.current)
    if (val.length < 2) { setResults([]); setShowDrop(false); return }
    debRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/stock-jan/insumos?q=${encodeURIComponent(val)}`, { credentials: 'omit' })
        const data: InsumoStock[] = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setShowDrop(data.length > 0)
      } catch { setResults([]) }
    }, 250)
  }, [])

  const save = async () => {
    if (!insumo) { setError('Seleccioná una materia prima'); return }
    if (!cantidad || parseFloat(cantidad) < 0) { setError('Ingresá cantidad válida'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`${API}/stock-jan/insumos/${insumo.id}/movimiento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ tipo_movimiento: tipoMov, cantidad: parseFloat(cantidad), notas: notas || null, fecha }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Error') }
      onDone()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-5 py-4" style={{ background: PURPLE }}>
          <div>
            <p className="text-white font-bold">Movimiento de materia prima</p>
            <p className="text-white/60 text-[11px]">Aceites · Ceras · Envases · Packaging</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: PURPLE }}>Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(['entrada','ajuste'] as const).map(t => (
                <button key={t} onClick={() => setTipoMov(t)}
                  className="py-2 rounded-xl text-[12px] font-bold transition-all"
                  style={tipoMov===t ? { background: PURPLE, color: 'white' } : { background: '#F3F4F6', color: '#6B7280' }}>
                  {t === 'entrada' ? '↑ Entrada de stock' : '✎ Ajuste (inventario)'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {tipoMov === 'entrada' ? 'Suma la cantidad al stock actual.' : 'Establece la cantidad exacta según conteo físico.'}
            </p>
          </div>
          {/* Insumo search */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: PURPLE }}>Materia prima *</label>
            {insumo ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border-2" style={{ borderColor: PURPLE, background: `${PURPLE}08` }}>
                <div>
                  <span className="text-sm font-semibold" style={{ color: PURPLE }}>{insumo.nombre}</span>
                  <span className="text-[10px] text-gray-400 ml-2">({insumo.unidad}) · Stock actual: {fmtN(insumo.stock_disponible)}</span>
                </div>
                <button onClick={() => { setInsumo(null); setQ('') }} className="text-gray-400 hover:text-red-400"><X size={14} /></button>
              </div>
            ) : (
              <>
                <input type="text" value={q} onChange={e => searchInsumo(e.target.value)} onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                  placeholder="Buscar materia prima…"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: '#E5E7EB' }} autoFocus />
                {showDrop && (
                  <div className="absolute top-full left-0 right-0 z-40 mt-1 rounded-xl shadow-xl border border-black/5 overflow-hidden max-h-48 overflow-y-auto bg-white">
                    {results.map(i => (
                      <button key={i.id} onMouseDown={() => { setInsumo(i); setQ(i.nombre); setShowDrop(false) }}
                        className="w-full flex justify-between items-center px-3 py-2 hover:bg-purple-50 text-left">
                        <span className="text-sm font-medium text-gray-700">{i.nombre}</span>
                        <span className="text-[10px] text-gray-400 ml-2">{i.unidad} · {fmtN(i.stock_disponible)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: PURPLE }}>
                Cantidad {insumo ? `(${insumo.unidad})` : ''} *
              </label>
              <input type="number" min="0" step="0.001" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0"
                className="w-full border rounded-xl px-3 py-2 text-sm text-center font-bold" style={{ borderColor: '#E5E7EB' }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: PURPLE }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }} />
            </div>
          </div>
          <input type="text" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas (opcional)" className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }} />
          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: PURPLE }}>
            {saving ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MODAL: Registrar Producción (Fase 2)
   ════════════════════════════════════════════════════════════════ */
interface ConsumoRow { _id: string; insumo_id: number | null; insumo_nombre: string; insumo_unidad: string; cantidad: string }

let _cid = 0
const newConsumoRow = (): ConsumoRow => ({ _id: `c${_cid++}`, insumo_id: null, insumo_nombre: '', insumo_unidad: '', cantidad: '' })

function InsumoSearchRow({ row, onChange, onRemove, allInsumos }: {
  row: ConsumoRow
  onChange: (r: ConsumoRow) => void
  onRemove: () => void
  allInsumos: InsumoStock[]
}) {
  const [q, setQ]               = useState(row.insumo_nombre)
  const [showDrop, setShowDrop] = useState(false)
  const filtered = q.length >= 2 ? allInsumos.filter(i => i.nombre.toLowerCase().includes(q.toLowerCase())) : []

  const pick = (i: InsumoStock) => {
    onChange({ ...row, insumo_id: i.id, insumo_nombre: i.nombre, insumo_unidad: i.unidad })
    setQ(i.nombre); setShowDrop(false)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Insumo search */}
      <div className="relative flex-1">
        {row.insumo_id ? (
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: `${PURPLE}40`, background: `${PURPLE}08` }}>
            <span className="font-medium flex-1 text-gray-700 text-[12px]">{row.insumo_nombre}</span>
            <span className="text-[10px] text-gray-400">{row.insumo_unidad}</span>
            <button onClick={() => { onChange({ ...row, insumo_id: null, insumo_nombre: '', insumo_unidad: '' }); setQ('') }} className="text-gray-300 hover:text-red-400 ml-1"><X size={11} /></button>
          </div>
        ) : (
          <>
            <input type="text" value={q} onChange={e => { setQ(e.target.value); setShowDrop(true) }}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="Materia prima…"
              className="w-full border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none"
              style={{ borderColor: '#E5E7EB' }} />
            {showDrop && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-0.5 rounded-xl shadow-xl border border-black/5 overflow-hidden max-h-40 overflow-y-auto bg-white">
                {filtered.slice(0, 10).map(i => (
                  <button key={i.id} onMouseDown={() => pick(i)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-purple-50 text-left">
                    <span className="text-[12px] text-gray-700">{i.nombre}</span>
                    <span className="text-[10px] text-gray-400">{i.unidad}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {/* Cantidad */}
      <input type="number" min="0" step="0.001"
        value={row.cantidad}
        onChange={e => onChange({ ...row, cantidad: e.target.value })}
        placeholder="Cant."
        className="w-20 border rounded-lg px-2 py-1.5 text-[12px] text-center font-bold focus:outline-none"
        style={{ borderColor: '#E5E7EB' }}
      />
      {row.insumo_unidad && <span className="text-[10px] text-gray-400 w-8 shrink-0">{row.insumo_unidad}</span>}
      <button onClick={onRemove} className="text-gray-300 hover:text-red-400"><X size={13} /></button>
    </div>
  )
}

function ProduccionModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [q,          setQ]          = useState('')
  const [results,    setResults]    = useState<ProductoBusq[]>([])
  const [showDrop,   setShowDrop]   = useState(false)
  const [producto,   setProducto]   = useState<{ id: number; nombre: string; variantes: string[] } | null>(null)
  const [variante,   setVariante]   = useState('')
  const [cantProd,   setCantProd]   = useState('')
  const [destino,    setDestino]    = useState<'armado'|'listo'>('armado')
  const [consumo,    setConsumo]    = useState<ConsumoRow[]>([newConsumoRow()])
  const [notas,      setNotas]      = useState('')
  const [fecha,      setFecha]      = useState(new Date().toISOString().split('T')[0])
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [allInsumos, setAllInsumos] = useState<InsumoStock[]>([])
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load all insumos for the search rows
  useEffect(() => {
    fetch(`${API}/stock-jan/insumos`, { credentials: 'omit' })
      .then(r => r.json())
      .then(d => setAllInsumos(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const searchProd = (val: string) => {
    setQ(val); setProducto(null)
    if (debRef.current) clearTimeout(debRef.current)
    if (val.length < 2) { setResults([]); setShowDrop(false); return }
    debRef.current = setTimeout(async () => {
      const res = await fetch(`${API}/productos-jan/?q=${encodeURIComponent(val)}`, { credentials: 'omit' })
      const data: ProductoBusq[] = await res.json()
      setResults(Array.isArray(data) ? data : [])
      setShowDrop(data.length > 0)
    }, 250)
  }

  const pickProd = (p: ProductoBusq) => {
    let opciones: string[] = []
    try { const vars = JSON.parse(p.variables || '[]'); if (vars[0]?.opciones?.length) opciones = vars[0].opciones.filter((o: string) => o.trim()) } catch {}
    setProducto({ id: p.id, nombre: p.nombre, variantes: opciones })
    setVariante(opciones[0] ?? '')
    setQ(p.nombre); setShowDrop(false)
  }

  const updateConsumo = (id: string, r: ConsumoRow) => setConsumo(p => p.map(x => x._id === id ? r : x))
  const removeConsumo = (id: string) => setConsumo(p => p.filter(x => x._id !== id))

  const save = async () => {
    if (!producto) { setError('Seleccioná el producto que vas a producir'); return }
    if (!cantProd || parseFloat(cantProd) <= 0) { setError('Ingresá la cantidad producida'); return }
    const consumoValido = consumo.filter(r => r.insumo_id && parseFloat(r.cantidad) > 0)
    setSaving(true); setError('')
    try {
      const body = {
        producto_id:        producto.id,
        variante:           variante,
        cantidad_producida: parseFloat(cantProd),
        destino,
        consumo: consumoValido.map(r => ({ insumo_id: r.insumo_id, cantidad: parseFloat(r.cantidad) })),
        notas:   notas || null,
        fecha,
      }
      const res = await fetch(`${API}/stock-jan/produccion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Error') }
      onDone()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  const costoTotal = consumo.reduce((s, r) => {
    const ins = allInsumos.find(i => i.id === r.insumo_id)
    return s + (ins ? ins.precio * (parseFloat(r.cantidad) || 0) : 0)
  }, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ background: SAGE }}>
          <div>
            <p className="text-white font-bold text-base">Registrar producción</p>
            <p className="text-white/60 text-[11px]">Descontá insumos → sumá stock producido</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Qué producís */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: SAGE }}>¿Qué producís?</p>
            <div className="relative">
              {producto ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border-2" style={{ borderColor: SAGE, background: `${SAGE}08` }}>
                  <span className="text-sm font-semibold" style={{ color: SAGE }}>{producto.nombre}</span>
                  <button onClick={() => { setProducto(null); setQ(''); setVariante('') }} className="text-gray-400 hover:text-red-400"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <input type="text" value={q} onChange={e => searchProd(e.target.value)} onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                    placeholder="Buscar producto del catálogo…"
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: '#E5E7EB' }} />
                  {showDrop && (
                    <div className="absolute top-full left-0 right-0 z-40 mt-1 rounded-xl shadow-xl border border-black/5 overflow-hidden max-h-40 overflow-y-auto bg-white">
                      {results.map(p => (
                        <button key={p.id} onMouseDown={() => pickProd(p)} className="w-full flex justify-between items-center px-3 py-2 hover:bg-emerald-50 text-left">
                          <span className="text-sm font-medium text-gray-700">{p.nombre}</span>
                          <span className="text-[10px] text-gray-400">{p.categoria}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {producto && producto.variantes.length > 0 && (
              <select value={variante} onChange={e => setVariante(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }}>
                {producto.variantes.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Unidades producidas</label>
                <input type="number" min="1" step="1" value={cantProd} onChange={e => setCantProd(e.target.value)} placeholder="0"
                  className="w-full border rounded-xl px-3 py-2 text-sm text-center font-bold" style={{ borderColor: '#E5E7EB' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Destino del stock</label>
                <select value={destino} onChange={e => setDestino(e.target.value as 'armado'|'listo')} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }}>
                  <option value="armado">Para armado (falta etiquetar/empacar)</option>
                  <option value="listo">Listo para venta (ya terminado)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Notas</label>
                <input type="text" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Lote 3, obs…" className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: '#E5E7EB' }} />
              </div>
            </div>
          </div>

          {/* Insumos consumidos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>Materias primas consumidas</p>
              <span className="text-[10px] text-gray-400">Se descontarán de su stock</span>
            </div>
            <div className="space-y-2">
              {consumo.map(r => (
                <InsumoSearchRow key={r._id} row={r} onChange={upd => updateConsumo(r._id, upd)} onRemove={() => removeConsumo(r._id)} allInsumos={allInsumos} />
              ))}
            </div>
            <button onClick={() => setConsumo(p => [...p, newConsumoRow()])}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-dashed"
              style={{ color: PURPLE, borderColor: `${PURPLE}50` }}>
              <Plus size={12} /> Agregar materia prima
            </button>

            {/* Costo estimado */}
            {costoTotal > 0 && (
              <div className="rounded-xl px-3 py-2 flex justify-between items-center" style={{ background: `${PURPLE}08` }}>
                <span className="text-[11px] text-gray-500">Costo estimado de insumos</span>
                <span className="text-sm font-bold" style={{ color: PURPLE }}>
                  {costoTotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })}
                </span>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t flex gap-2 justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: SAGE }}>
            {saving ? 'Registrando…' : `Confirmar producción${cantProd ? ` (${cantProd} u.)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MODAL: Stock mínimo
   ════════════════════════════════════════════════════════════════ */
function MinimoProductoModal({ entry, onClose, onDone }: { entry: StockEntry; onClose: () => void; onDone: () => void }) {
  const [val, setVal] = useState(String(entry.stock_minimo))
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    await fetch(`${API}/stock-jan/${entry.id}/minimo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ stock_minimo: parseFloat(val) || 0 }) })
    setSaving(false); onDone()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="px-5 py-4" style={{ background: NAVY }}>
          <p className="text-white font-bold">Stock mínimo</p>
          <p className="text-white/50 text-xs">{entry.producto_nombre}{entry.variante ? ` · ${entry.variante}` : ''}</p>
        </div>
        <div className="px-5 py-4">
          <input type="number" min="0" step="1" value={val} onChange={e => setVal(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xl text-center font-bold" style={{ borderColor: '#E5E7EB' }} />
        </div>
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: SAGE }}>{saving ? '…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function MinimoInsumoModal({ insumo, onClose, onDone }: { insumo: InsumoStock; onClose: () => void; onDone: () => void }) {
  const [val, setVal] = useState(String(insumo.stock_minimo))
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    await fetch(`${API}/stock-jan/insumos/${insumo.id}/minimo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ stock_minimo: parseFloat(val) || 0 }) })
    setSaving(false); onDone()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="px-5 py-4" style={{ background: PURPLE }}>
          <p className="text-white font-bold">Stock mínimo</p>
          <p className="text-white/60 text-xs">{insumo.nombre} · {insumo.unidad}</p>
        </div>
        <div className="px-5 py-4">
          <input type="number" min="0" step="0.1" value={val} onChange={e => setVal(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xl text-center font-bold" style={{ borderColor: '#E5E7EB' }} />
        </div>
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: PURPLE }}>{saving ? '…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Filas de la tabla
   ════════════════════════════════════════════════════════════════ */
function ProductoRow({ grupo, onMovimiento, onMinimo }: {
  grupo: GrupoProducto
  onMovimiento: (e: StockEntry) => void
  onMinimo: (e: StockEntry) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const tieneVariantes = grupo.entries.some(e => e.variante !== '')
  const hayAlertas = grupo.entries.some(e => e.alerta)
  const total = grupo.entries.reduce((s, e) => s + e.cantidad, 0)

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'white', borderColor: hayAlertas ? '#FCA5A5' : '#E5E7EB' }}>
      <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => tieneVariantes && setExpanded(e => !e)}>
        <div className="flex items-center gap-2 min-w-0">
          {tieneVariantes && <span className="text-gray-400">{expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}</span>}
          {hayAlertas && <AlertTriangle size={13} className="text-red-400 shrink-0"/>}
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-800 truncate">{grupo.nombre}</p>
            <p className="text-[10px] text-gray-400">{grupo.categoria}{tieneVariantes ? ` · ${grupo.entries.length} variantes` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-base font-bold tabular-nums" style={{ color: total <= 0 ? '#DC2626' : SAGE }}>{fmtN(total)}</p>
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => onMovimiento(grupo.entries[0])} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${CORAL}15`, color: CORAL }}><Plus size={13}/></button>
          </div>
        </div>
      </button>
      {(expanded || !tieneVariantes) && (
        <div className="border-t" style={{ borderColor: '#F3F4F6' }}>
          {grupo.entries.map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-2 gap-2" style={{ background: e.alerta ? '#FEF2F2' : undefined }}>
              <span className="text-[12px] text-gray-700 flex-1 truncate">{e.variante || <span className="italic text-gray-400">Sin variante</span>}</span>
              {e.alerta && <span className="text-[10px] font-bold text-red-400 shrink-0">↓ mín {fmtN(e.stock_minimo)}</span>}
              <span className="text-sm font-bold w-10 text-right" style={{ color: e.cantidad <= 0 ? '#DC2626' : SAGE }}>{fmtN(e.cantidad)}</span>
              <div className="flex gap-1">
                <button onClick={() => onMovimiento(e)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-100 text-gray-400"><Plus size={11}/></button>
                <button onClick={() => onMinimo(e)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 text-gray-400"><Settings size={11}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InsumoRow({ insumo, onMovimiento, onMinimo }: {
  insumo: InsumoStock
  onMovimiento: (i: InsumoStock) => void
  onMinimo: (i: InsumoStock) => void
}) {
  return (
    <div className="rounded-xl border flex items-center justify-between px-4 py-2.5 gap-3" style={{ background: 'white', borderColor: insumo.alerta ? '#FCA5A5' : '#E5E7EB' }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 truncate">{insumo.nombre}</p>
        <p className="text-[10px] text-gray-400">${insumo.precio.toLocaleString('es-AR')} / {insumo.unidad}</p>
      </div>
      {insumo.alerta && <AlertTriangle size={13} className="text-red-400 shrink-0"/>}
      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: insumo.stock_disponible <= 0 ? '#DC2626' : PURPLE }}>
        {fmtN(insumo.stock_disponible)} <span className="text-[10px] font-normal text-gray-400">{insumo.unidad}</span>
      </span>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onMovimiento(insumo)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${PURPLE}15`, color: PURPLE }}><Plus size={13}/></button>
        <button onClick={() => onMinimo(insumo)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400"><Settings size={12}/></button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ════════════════════════════════════════════════════════════════ */
type Tab = 'listo' | 'armado' | 'produccion' | 'insumos'

export default function Stock() {
  const [entries,   setEntries]   = useState<StockEntry[]>([])
  const [insumos,   setInsumos]   = useState<InsumoStock[]>([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<Tab>('listo')
  const [busqueda,  setBusqueda]  = useState('')

  // Modals
  const [movProd,    setMovProd]    = useState<StockEntry | null | 'new'>(null)
  const [movIns,     setMovIns]     = useState<InsumoStock | null | 'new'>(null)
  const [showProd,   setShowProd]   = useState(false)
  const [minProd,    setMinProd]    = useState<StockEntry | null>(null)
  const [minIns,     setMinIns]     = useState<InsumoStock | null>(null)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [rEntries, rInsumos] = await Promise.all([
        fetch(`${API}/stock-jan/`, { credentials: 'omit' }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/stock-jan/insumos`, { credentials: 'omit' }).then(r => r.ok ? r.json() : []),
      ])
      setEntries(Array.isArray(rEntries) ? rEntries : [])
      setInsumos(Array.isArray(rInsumos) ? rInsumos : [])
    } catch { setEntries([]); setInsumos([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, [])

  const grupos = agrupar(entries.filter(e => e.tipo === tab && (tab !== 'produccion')))
  const alertasProductos = entries.filter(e => e.alerta)
  const alertasInsumos   = insumos.filter(i => i.alerta)
  const totalAlertas     = alertasProductos.length + alertasInsumos.length

  const gruposFiltrados = grupos.filter(g => !busqueda || g.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const insumosFiltrados = insumos.filter(i => !busqueda || i.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count: string }[] = [
    { key: 'listo',     label: 'Listo para venta', icon: <Check size={12}/>,        count: fmtN(entries.filter(e=>e.tipo==='listo').reduce((s,e)=>s+e.cantidad,0)) },
    { key: 'armado',    label: 'Para armado',       icon: <Layers size={12}/>,       count: fmtN(entries.filter(e=>e.tipo==='armado').reduce((s,e)=>s+e.cantidad,0)) },
    { key: 'produccion',label: 'Semi terminados',   icon: <Package size={12}/>,      count: fmtN(entries.filter(e=>e.tipo==='produccion').reduce((s,e)=>s+e.cantidad,0)) },
    { key: 'insumos',   label: 'Materias primas',   icon: <FlaskConical size={12}/>, count: String(insumos.length) },
  ]

  const tabColor: Record<Tab, string> = { listo: SAGE, armado: CORAL, produccion: NAVY, insumos: PURPLE }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-head" style={{ color: NAVY }}>Stock</h1>
          <p className="text-sm text-gray-400 mt-0.5">Inventario completo · JAN Orgánico Natural</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowProd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90"
            style={{ background: SAGE }}>
            <FlaskConical size={15}/> Registrar producción
          </button>
          <button onClick={() => tab === 'insumos' ? setMovIns('new') : setMovProd('new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90"
            style={{ background: CORAL }}>
            <ArrowDownToLine size={15}/> {tab === 'insumos' ? 'Entrada de insumo' : 'Movimiento'}
          </button>
        </div>
      </div>

      {/* Alertas */}
      {totalAlertas > 0 && (
        <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5"/>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-sm font-semibold text-red-700 w-full">
              {totalAlertas} alerta{totalAlertas>1?'s':''} de stock bajo:
            </span>
            {alertasProductos.map(e => (
              <span key={e.id} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {e.producto_nombre}{e.variante?` · ${e.variante}`:''} ({fmtN(e.cantidad)})
              </span>
            ))}
            {alertasInsumos.map(i => (
              <span key={i.id} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {i.nombre} ({fmtN(i.stock_disponible)} {i.unidad})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => {
          const isActive = tab === t.key
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setBusqueda('') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all"
              style={isActive ? { background: tabColor[t.key], color: 'white' } : { background: 'white', color: '#9CA3AF', border: '1.5px solid #E5E7EB' }}>
              {t.icon} {t.label}
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]"
                style={isActive ? { background: 'rgba(255,255,255,0.25)' } : { background: '#F3F4F6' }}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Búsqueda */}
      <input type="text" placeholder={tab === 'insumos' ? 'Filtrar materias primas…' : 'Filtrar productos…'}
        value={busqueda} onChange={e => setBusqueda(e.target.value)}
        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
        style={{ borderColor: '#E5E7EB' }} />

      {/* Contenido */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando inventario…</div>
      ) : tab === 'insumos' ? (
        insumosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FlaskConical size={32} strokeWidth={1} className="mx-auto mb-3"/>
            <p className="font-semibold">Sin materias primas para mostrar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {insumosFiltrados.map(i => (
              <InsumoRow key={i.id} insumo={i}
                onMovimiento={ins => setMovIns(ins)}
                onMinimo={ins => setMinIns(ins)} />
            ))}
          </div>
        )
      ) : (
        gruposFiltrados.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-3 text-gray-400">
            <Package size={36} strokeWidth={1}/>
            <p className="font-semibold">Sin stock en "{TIPO_LABEL[tab]}"</p>
            <button onClick={() => setMovProd('new')}
              className="text-sm font-bold px-4 py-2 rounded-xl"
              style={{ background: `${CORAL}15`, color: CORAL }}>
              Registrar primer entrada
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {gruposFiltrados.map(g => (
              <ProductoRow key={g.producto_id} grupo={g}
                onMovimiento={e => setMovProd(e)}
                onMinimo={e => setMinProd(e)} />
            ))}
          </div>
        )
      )}

      {/* Leyenda */}
      <div className="rounded-2xl p-4 space-y-1.5" style={{ background: CREAM }}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">Categorías de stock</p>
        {([['listo', 'Productos terminados y empacados, listos para vender.'],
           ['armado', 'Semi-terminados: falta etiquetar, tapar o empacar.'],
           ['produccion', 'Productos en proceso o componentes semi-armados.'],
           ['insumos', 'Materias primas, aceites, ceras, packaging — se descuentan al registrar producción.']] as const).map(([k, desc]) => (
          <div key={k} className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ background: tabColor[k as Tab] }}/>
            <span className="text-[11px] text-gray-500"><strong style={{ color: tabColor[k as Tab] }}>{TIPO_LABEL[k] ?? 'Materias primas'}:</strong> {desc}</span>
          </div>
        ))}
        <div className="flex items-start gap-2 pt-1.5 border-t border-gray-200 mt-2">
          <ArrowRight size={11} className="shrink-0 mt-0.5 text-gray-400"/>
          <span className="text-[11px] text-gray-400">
            Al registrar producción, los insumos se descuentan automáticamente y las unidades producidas se suman a "Para armado" o "Listo para venta".
            Las ventas desde el catálogo descuentan automáticamente de "Listo para venta".
          </span>
        </div>
      </div>

      {/* ── Modals ── */}
      {movProd && (
        <MovimientoProductoModal
          preEntry={movProd === 'new' ? undefined : movProd}
          onClose={() => setMovProd(null)}
          onDone={() => { setMovProd(null); loadAll() }}
        />
      )}
      {movIns && (
        <MovimientoInsumoModal
          preInsumo={movIns === 'new' ? undefined : movIns}
          onClose={() => setMovIns(null)}
          onDone={() => { setMovIns(null); loadAll() }}
        />
      )}
      {showProd && (
        <ProduccionModal
          onClose={() => setShowProd(false)}
          onDone={() => { setShowProd(false); loadAll() }}
        />
      )}
      {minProd && (
        <MinimoProductoModal entry={minProd} onClose={() => setMinProd(null)} onDone={() => { setMinProd(null); loadAll() }} />
      )}
      {minIns && (
        <MinimoInsumoModal insumo={minIns} onClose={() => setMinIns(null)} onDone={() => { setMinIns(null); loadAll() }} />
      )}
    </div>
  )
}
