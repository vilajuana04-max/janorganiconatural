import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Plus, AlertTriangle, Package, ArrowRight,
  ArrowDownToLine, Sliders, RefreshCw, X, Check, History,
  ChevronDown, ChevronRight, Settings,
} from 'lucide-react'

const API   = import.meta.env.VITE_API_URL ?? 'https://jan-erp.onrender.com'
const NAVY  = '#1E2B1A'
const CORAL = '#C4875A'
const SAGE  = '#3D6B64'
const CREAM = '#F5EFE6'

/* ── Types ─────────────────────────────────────────────────────── */
interface StockEntry {
  id:                 number
  producto_id:        number
  producto_nombre:    string
  producto_categoria: string
  variante:           string
  tipo:               string   // listo | armado | produccion
  cantidad:           number
  stock_minimo:       number
  alerta:             boolean
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

/* ── Helpers ────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  n % 1 === 0 ? String(n) : n.toFixed(1)

const TIPO_LABEL: Record<string, string> = {
  listo:     'Listo para venta',
  armado:    'Para armado',
  produccion:'Para producción',
}

const TIPO_COLOR: Record<string, string> = {
  listo:     SAGE,
  armado:    CORAL,
  produccion:'#7C3AED',
}

const TIPO_BG: Record<string, string> = {
  listo:     `${SAGE}15`,
  armado:    `${CORAL}15`,
  produccion:'#7C3AED18',
}

const MOV_LABEL: Record<string, string> = {
  entrada:      '↑ Entrada',
  salida_venta: '↓ Venta',
  ajuste:       '✎ Ajuste',
  transferencia:'⇄ Transferencia',
}

/* ── Agrupación de entries por producto ─────────────────────────── */
interface GrupoProducto {
  producto_id:   number
  nombre:        string
  categoria:     string
  variantes:     string[]   // lista de variantes únicas ('' = sin variante)
  entries:       StockEntry[]
}

function agrupar(entries: StockEntry[]): GrupoProducto[] {
  const map = new Map<number, GrupoProducto>()
  for (const e of entries) {
    if (!map.has(e.producto_id)) {
      map.set(e.producto_id, {
        producto_id: e.producto_id,
        nombre:      e.producto_nombre,
        categoria:   e.producto_categoria,
        variantes:   [],
        entries:     [],
      })
    }
    const g = map.get(e.producto_id)!
    if (!g.variantes.includes(e.variante)) g.variantes.push(e.variante)
    g.entries.push(e)
  }
  return Array.from(map.values())
}

/* ── Modal de Movimiento ─────────────────────────────────────────── */
function MovimientoModal({
  preProducto,
  onClose,
  onDone,
}: {
  preProducto?: StockEntry
  onClose: () => void
  onDone: () => void
}) {
  const [tipoMov,   setTipoMov]   = useState<'entrada'|'ajuste'|'transferencia'>('entrada')
  const [tipoStock, setTipoStock] = useState('listo')
  const [desdeT,    setDesdeT]    = useState('armado')
  const [haciaT,    setHaciaT]    = useState('listo')
  const [cantidad,  setCantidad]  = useState('')
  const [notas,     setNotas]     = useState('')
  const [fecha,     setFecha]     = useState(new Date().toISOString().split('T')[0])
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  // Producto search
  const [q,        setQ]        = useState(preProducto?.producto_nombre ?? '')
  const [results,  setResults]  = useState<ProductoBusq[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const [producto, setProducto] = useState<{ id: number; nombre: string; variantes: string[] } | null>(
    preProducto
      ? { id: preProducto.producto_id, nombre: preProducto.producto_nombre, variantes: [] }
      : null
  )
  const [variante, setVariante] = useState(preProducto?.variante ?? '')
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchProd = useCallback((val: string) => {
    setQ(val)
    setProducto(null)
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
      if (Array.isArray(vars) && vars[0]?.opciones?.length > 0) {
        opciones = vars[0].opciones.filter((o: string) => o.trim() !== '')
      }
    } catch { /* ignore */ }
    setProducto({ id: p.id, nombre: p.nombre, variantes: opciones })
    setVariante(opciones.length > 0 ? opciones[0] : '')
    setQ(p.nombre)
    setShowDrop(false)
  }

  const handleSave = async () => {
    if (!producto) { setError('Seleccioná un producto'); return }
    if (!cantidad || parseFloat(cantidad) < 0) { setError('Ingresá una cantidad válida'); return }
    if (tipoMov === 'transferencia' && desdeT === haciaT) { setError('El origen y destino deben ser distintos'); return }

    setSaving(true); setError('')
    try {
      const body: Record<string, unknown> = {
        producto_id:     producto.id,
        variante:        variante,
        tipo_movimiento: tipoMov,
        cantidad:        parseFloat(cantidad),
        notas:           notas.trim() || null,
        fecha,
      }
      if (tipoMov === 'transferencia') {
        body.desde_tipo = desdeT
        body.hacia_tipo = haciaT
      } else {
        body.tipo_stock = tipoStock
      }

      const res = await fetch(`${API}/stock-jan/movimiento`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body:        JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al guardar')
      }
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'white' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ background: NAVY }}>
          <p className="text-white font-bold text-base">Registrar movimiento de stock</p>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Tipo de movimiento */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: SAGE }}>
              Tipo de movimiento
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['entrada', 'ajuste', 'transferencia'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipoMov(t)}
                  className="py-2 rounded-xl text-[12px] font-bold transition-all capitalize"
                  style={tipoMov === t
                    ? { background: NAVY, color: 'white' }
                    : { background: '#F3F4F6', color: '#6B7280' }
                  }
                >
                  {t === 'entrada' ? '↑ Entrada' : t === 'ajuste' ? '✎ Ajuste' : '⇄ Transferencia'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              {tipoMov === 'entrada'       && 'Suma unidades al stock del tipo seleccionado.'}
              {tipoMov === 'ajuste'        && 'Establece la cantidad exacta (inventario físico).'}
              {tipoMov === 'transferencia' && 'Mueve unidades de una categoría a otra.'}
            </p>
          </div>

          {/* Producto */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>
              Producto *
            </label>
            {producto ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border-2"
                style={{ borderColor: SAGE, background: `${SAGE}08` }}>
                <span className="text-sm font-semibold" style={{ color: SAGE }}>{producto.nombre}</span>
                <button onClick={() => { setProducto(null); setQ(''); setVariante('') }}
                  className="text-gray-400 hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={q}
                  onChange={e => searchProd(e.target.value)}
                  onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                  placeholder="Buscar producto del catálogo…"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1"
                  style={{ borderColor: '#E5E7EB', '--tw-ring-color': CORAL } as React.CSSProperties}
                  autoFocus
                />
                {showDrop && (
                  <div className="absolute top-full left-0 right-0 z-40 mt-1 rounded-xl shadow-xl border border-black/5 overflow-hidden max-h-48 overflow-y-auto bg-white">
                    {results.map(p => (
                      <button key={p.id} onMouseDown={() => pickProd(p)}
                        className="w-full flex justify-between items-center px-3 py-2 hover:bg-amber-50 text-left">
                        <span className="text-sm font-medium text-gray-700">{p.nombre}</span>
                        <span className="text-[10px] text-gray-400 ml-2">{p.categoria}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Variante (si el producto tiene opciones) */}
          {producto && producto.variantes.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>
                Variante *
              </label>
              <select
                value={variante}
                onChange={e => setVariante(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#E5E7EB' }}
              >
                {producto.variantes.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {/* Categoría de stock */}
          {tipoMov !== 'transferencia' ? (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>
                Categoría de stock *
              </label>
              <select
                value={tipoStock}
                onChange={e => setTipoStock(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#E5E7EB' }}
              >
                <option value="listo">Listo para venta</option>
                <option value="armado">Para armado</option>
                <option value="produccion">Para producción</option>
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: CORAL }}>
                  Desde
                </label>
                <select
                  value={desdeT}
                  onChange={e => setDesdeT(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <option value="produccion">Para producción</option>
                  <option value="armado">Para armado</option>
                  <option value="listo">Listo para venta</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>
                  Hacia
                </label>
                <select
                  value={haciaT}
                  onChange={e => setHaciaT(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <option value="listo">Listo para venta</option>
                  <option value="armado">Para armado</option>
                  <option value="produccion">Para producción</option>
                </select>
              </div>
            </div>
          )}

          {/* Cantidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>
                Cantidad *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                placeholder="0"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none text-center font-bold"
                style={{ borderColor: '#E5E7EB' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#E5E7EB' }}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>
              Notas
            </label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: Producción lote 3, Compra proveedor…"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: '#E5E7EB' }}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: CORAL }}>
            {saving ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal stock mínimo ─────────────────────────────────────────── */
function MinimoModal({ entry, onClose, onDone }: { entry: StockEntry; onClose: () => void; onDone: () => void }) {
  const [val, setVal]     = useState(String(entry.stock_minimo))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/stock-jan/${entry.id}/minimo`, {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body:        JSON.stringify({ stock_minimo: parseFloat(val) || 0 }),
      })
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="px-5 py-4" style={{ background: NAVY }}>
          <p className="text-white font-bold">Configurar stock mínimo</p>
          <p className="text-white/50 text-xs mt-0.5">{entry.producto_nombre}{entry.variante ? ` · ${entry.variante}` : ''}</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500">Se mostrará una alerta cuando la cantidad llegue a este valor o menos.</p>
          <input
            type="number" min="0" step="1"
            value={val}
            onChange={e => setVal(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-center text-xl font-bold focus:outline-none"
            style={{ borderColor: '#E5E7EB' }}
          />
        </div>
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: SAGE }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Historial drawer ────────────────────────────────────────────── */
function HistorialPanel({ productoId, onClose }: { productoId: number; onClose: () => void }) {
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/stock-jan/movimientos?producto_id=${productoId}`, { credentials: 'omit' })
      .then(r => r.json())
      .then(d => setMovs(Array.isArray(d) ? d : []))
      .catch(() => setMovs([]))
      .finally(() => setLoading(false))
  }, [productoId])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-sm h-full flex flex-col bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: NAVY }}>
          <p className="text-white font-bold">Historial de movimientos</p>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {loading ? (
            <p className="text-gray-400 text-sm text-center pt-8">Cargando…</p>
          ) : movs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center pt-8">Sin movimientos registrados</p>
          ) : movs.map(m => (
            <div key={m.id} className="rounded-xl border border-gray-100 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold" style={{ color: m.tipo_movimiento === 'salida_venta' ? '#DC2626' : m.tipo_movimiento === 'entrada' ? SAGE : CORAL }}>
                  {MOV_LABEL[m.tipo_movimiento] ?? m.tipo_movimiento}
                </span>
                <span className="text-[11px] text-gray-400">{m.fecha ? m.fecha.split('T')[0].split('-').reverse().join('/') : ''}</span>
              </div>
              {m.variante && <p className="text-[11px] text-gray-500 mt-0.5">{m.variante}</p>}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-gray-400">
                  {m.tipo_movimiento === 'transferencia'
                    ? `${TIPO_LABEL[m.desde_tipo] ?? m.desde_tipo} → ${TIPO_LABEL[m.hacia_tipo] ?? m.hacia_tipo}`
                    : TIPO_LABEL[m.tipo_stock] ?? m.tipo_stock}
                </span>
                <span className="text-sm font-bold"
                  style={{ color: m.tipo_movimiento === 'salida_venta' ? '#DC2626' : SAGE }}>
                  {m.tipo_movimiento === 'salida_venta' ? '−' : '+'}{fmt(m.cantidad)}
                </span>
              </div>
              {m.notas && <p className="text-[10px] text-gray-400 italic mt-0.5">{m.notas}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Fila de producto en la tabla de stock ──────────────────────── */
function ProductoRow({
  grupo,
  tipoActivo,
  onMovimiento,
  onMinimo,
  onHistorial,
}: {
  grupo:       GrupoProducto
  tipoActivo:  string
  onMovimiento:(entry?: StockEntry) => void
  onMinimo:    (entry: StockEntry) => void
  onHistorial: (productoId: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const entriesFiltradas = grupo.entries.filter(e => e.tipo === tipoActivo)
  const hayAlertas = entriesFiltradas.some(e => e.alerta)
  const totalCantidad = entriesFiltradas.reduce((s, e) => s + e.cantidad, 0)

  if (entriesFiltradas.length === 0) return null

  const tieneVariantes = entriesFiltradas.some(e => e.variante !== '')

  return (
    <div className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm"
      style={{ background: 'white', borderColor: hayAlertas ? '#FCA5A5' : '#E5E7EB' }}>

      {/* Cabecera del producto */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {tieneVariantes && (
            <span className="text-gray-400">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {hayAlertas && <AlertTriangle size={14} className="text-red-400 shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-800 truncate">{grupo.nombre}</p>
            <span className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: TIPO_COLOR[tipoActivo] }}>
              {grupo.categoria}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* Total del tipo activo */}
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums"
              style={{ color: totalCantidad <= 0 ? '#DC2626' : TIPO_COLOR[tipoActivo] }}>
              {fmt(totalCantidad)}
            </p>
            <p className="text-[10px] text-gray-400">{tieneVariantes ? 'total variantes' : 'unidades'}</p>
          </div>
          {/* Acciones */}
          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onMovimiento(entriesFiltradas[0])}
              title="Registrar movimiento"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
              style={{ background: `${CORAL}15`, color: CORAL }}
            >
              <Plus size={13} />
            </button>
            <button
              onClick={() => onHistorial(grupo.producto_id)}
              title="Ver historial"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
              style={{ background: `${NAVY}10`, color: NAVY }}
            >
              <History size={12} />
            </button>
          </div>
        </div>
      </button>

      {/* Variantes expandidas */}
      {(expanded || !tieneVariantes) && (
        <div className="border-t" style={{ borderColor: '#F3F4F6' }}>
          {entriesFiltradas.map(e => (
            <div key={e.id}
              className="flex items-center justify-between px-4 py-2.5 gap-3"
              style={{ background: e.alerta ? '#FEF2F2' : undefined }}>

              <div className="min-w-0 flex-1">
                {e.variante
                  ? <span className="text-[12px] font-semibold text-gray-700">{e.variante}</span>
                  : <span className="text-[11px] text-gray-400 italic">Sin variante</span>
                }
              </div>

              {/* Cantidad pill */}
              <div className="flex items-center gap-2">
                {e.alerta && (
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <AlertTriangle size={9} /> Bajo mínimo ({fmt(e.stock_minimo)})
                  </span>
                )}
                <span className="text-base font-bold tabular-nums w-10 text-right"
                  style={{ color: e.cantidad <= 0 ? '#DC2626' : TIPO_COLOR[tipoActivo] }}>
                  {fmt(e.cantidad)}
                </span>
              </div>

              {/* Mini acciones */}
              <div className="flex gap-1" onClick={e2 => e2.stopPropagation()}>
                <button onClick={() => onMovimiento(e)} title="Movimiento"
                  className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-amber-100 text-gray-400">
                  <Plus size={11} />
                </button>
                <button onClick={() => onMinimo(e)} title="Stock mínimo"
                  className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400">
                  <Settings size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Página principal ───────────────────────────────────────────── */
export default function Stock() {
  const [entries,     setEntries]     = useState<StockEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [tabActivo,   setTabActivo]   = useState<'listo'|'armado'|'produccion'>('listo')
  const [showMov,     setShowMov]     = useState(false)
  const [preEntry,    setPreEntry]    = useState<StockEntry | undefined>()
  const [minimoEntry, setMinimoEntry] = useState<StockEntry | null>(null)
  const [histProdId,  setHistProdId]  = useState<number | null>(null)
  const [busqueda,    setBusqueda]    = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/stock-jan/`, { credentials: 'omit' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const grupos = agrupar(entries)
  const alertas = entries.filter(e => e.alerta)

  const gruposFiltrados = grupos.filter(g =>
    !busqueda || g.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Stats
  const totalEntries  = entries.filter(e => e.tipo === tabActivo).length
  const totalUnidades = entries.filter(e => e.tipo === tabActivo).reduce((s, e) => s + e.cantidad, 0)

  const TABS: { key: 'listo' | 'armado' | 'produccion'; label: string; icon: React.ReactNode }[] = [
    { key: 'listo',     label: 'Listo para venta', icon: <Check size={13} /> },
    { key: 'armado',    label: 'Para armado',       icon: <RefreshCw size={13} /> },
    { key: 'produccion',label: 'Para producción',   icon: <Package size={13} /> },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-head" style={{ color: NAVY }}>Stock</h1>
          <p className="text-sm text-gray-400 mt-0.5">Inventario por categoría · JAN Orgánico Natural</p>
        </div>
        <button
          onClick={() => { setPreEntry(undefined); setShowMov(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: CORAL }}
        >
          <ArrowDownToLine size={15} /> Registrar movimiento
        </button>
      </div>

      {/* Alertas banner */}
      {alertas.length > 0 && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-700">
            {alertas.length} item{alertas.length > 1 ? 's' : ''} por debajo del stock mínimo:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {alertas.map(e => (
              <span key={e.id}
                className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {e.producto_nombre}{e.variante ? ` · ${e.variante}` : ''} ({fmt(e.cantidad)} u.)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border px-4 py-3" style={{ background: 'white', borderColor: '#E5E7EB' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Items registrados</p>
          <p className="text-xl font-bold mt-0.5" style={{ color: TIPO_COLOR[tabActivo] }}>{totalEntries}</p>
        </div>
        <div className="rounded-2xl border px-4 py-3" style={{ background: 'white', borderColor: '#E5E7EB' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Total unidades</p>
          <p className="text-xl font-bold mt-0.5" style={{ color: TIPO_COLOR[tabActivo] }}>{fmt(totalUnidades)}</p>
        </div>
        <div className="rounded-2xl border px-4 py-3" style={{ background: 'white', borderColor: '#E5E7EB' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Alertas activas</p>
          <p className="text-xl font-bold mt-0.5" style={{ color: alertas.length > 0 ? '#DC2626' : '#9CA3AF' }}>
            {alertas.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map(t => {
          const cnt = entries.filter(e => e.tipo === t.key).reduce((s, e) => s + e.cantidad, 0)
          const isActive = tabActivo === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTabActivo(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
              style={isActive
                ? { background: TIPO_COLOR[t.key], color: 'white' }
                : { background: 'white', color: '#9CA3AF', border: '1.5px solid #E5E7EB' }
              }
            >
              {t.icon}
              {t.label}
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                style={isActive ? { background: 'rgba(255,255,255,0.25)' } : { background: '#F3F4F6' }}>
                {fmt(cnt)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Búsqueda */}
      <input
        type="text"
        placeholder="Filtrar por nombre de producto…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
        style={{ borderColor: '#E5E7EB' }}
      />

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando inventario…</div>
      ) : gruposFiltrados.filter(g => g.entries.some(e => e.tipo === tabActivo)).length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3 text-gray-400">
          <Package size={36} strokeWidth={1} />
          <p className="font-semibold">Sin stock registrado en "{TIPO_LABEL[tabActivo]}"</p>
          <p className="text-sm">Registrá el primer movimiento con el botón de arriba.</p>
          <button
            onClick={() => { setPreEntry(undefined); setShowMov(true) }}
            className="text-sm font-bold px-4 py-2 rounded-xl mt-1"
            style={{ background: `${CORAL}15`, color: CORAL }}
          >
            Registrar primer entrada
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {gruposFiltrados.map(g => (
            <ProductoRow
              key={g.producto_id}
              grupo={g}
              tipoActivo={tabActivo}
              onMovimiento={entry => { setPreEntry(entry); setShowMov(true) }}
              onMinimo={entry => setMinimoEntry(entry)}
              onHistorial={pid => setHistProdId(pid)}
            />
          ))}
        </div>
      )}

      {/* Leyenda de categorías */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: CREAM }}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Referencia de categorías</p>
        {Object.entries(TIPO_LABEL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TIPO_COLOR[k] }} />
            <span className="text-[12px] font-semibold" style={{ color: TIPO_COLOR[k] }}>{v}:</span>
            <span className="text-[11px] text-gray-500">
              {k === 'listo'     && 'Productos terminados y empacados, listos para ser vendidos.'}
              {k === 'armado'    && 'Productos semi-terminados que faltan etiquetar, tapar o empacar.'}
              {k === 'produccion'&& 'Materias primas, insumos, packaging y envases vacíos.'}
            </span>
          </div>
        ))}
        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-gray-200">
          <ArrowRight size={12} className="shrink-0 mt-0.5 text-gray-400" />
          <span className="text-[11px] text-gray-400">
            La transferencia mueve unidades entre categorías (ej: producción → armado → listo para venta).
            Las ventas del catálogo descuentan automáticamente de "Listo para venta".
          </span>
        </div>
      </div>

      {/* Modals */}
      {showMov && (
        <MovimientoModal
          preProducto={preEntry}
          onClose={() => { setShowMov(false); setPreEntry(undefined) }}
          onDone={() => { setShowMov(false); setPreEntry(undefined); load() }}
        />
      )}
      {minimoEntry && (
        <MinimoModal
          entry={minimoEntry}
          onClose={() => setMinimoEntry(null)}
          onDone={() => { setMinimoEntry(null); load() }}
        />
      )}
      {histProdId !== null && (
        <HistorialPanel
          productoId={histProdId}
          onClose={() => setHistProdId(null)}
        />
      )}
    </div>
  )
}
