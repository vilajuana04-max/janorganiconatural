import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Check, ShoppingBag, TrendingUp, UserCheck, User, Package, Type } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

const SAGE  = '#3D6B64'
const AMBER = '#C4875A'

const CATEGORIAS    = ['Velas', 'Home', 'Jabones', 'Shampoos', 'Cosméticos', 'Textil', 'Otros']
const CANALES       = ['Instagram', 'WhatsApp', 'Feria', 'Mercado Libre', 'Otro']
const METODOS_PAGO  = ['Efectivo', 'Transferencia', 'Link de Pago', 'Tarjeta', 'Cuenta Corriente']

const CAT_COLORS: Record<string, string> = {
  Velas:      '#C4875A',
  Home:       '#3D6B64',
  Jabones:    '#8b5cf6',
  Shampoos:   '#0ea5e9',
  Cosméticos: '#ec4899',
  Textil:     '#84cc16',
  Otros:      '#6B5E50',
}

const METODO_ICONS: Record<string, string> = {
  'Efectivo':         '💵',
  'Transferencia':    '🏦',
  'Link de Pago':     '🔗',
  'Tarjeta':          '💳',
  'Cuenta Corriente': '📒',
  'Cta. DNI':         '🏦',
  'Mercado Pago':     '💙',
  'Naranja':          '🟠',
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ClienteOption  = { id: number; nombre_completo: string }
type ProductoOption = { id: number; nombre: string; categoria: string; precio: number }

type LineItem = {
  localId:         string
  tipo:            'catalogo' | 'custom'
  nombre:          string
  categoria:       string
  cantidad:        string
  precio_unitario: string
}

type GlobalForm = {
  fecha:        string
  canal:        string
  metodo_pago:  string
  cliente_tipo: 'cliente_final' | 'cliente_registrado'
  cliente_id:   number | null
  notas:        string
}

type Venta = {
  id: number
  fecha: string
  year: number
  month: string
  producto: string
  categoria: string
  cantidad: number
  precio_unitario: number
  total: number
  canal: string
  medio_pago: string
  metodo_pago: string
  estado_pago: string
  cliente_tipo: string
  cliente_id: number | null
  notas: string
}

type Summary = {
  ventas:        Venta[]
  total_mes:     number
  cantidad_ops:  number
  por_medio:     Record<string, number>
  por_canal:     Record<string, number>
  por_categoria: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────
let _localIdCounter = 0
function newLocalId() { return `li_${Date.now()}_${_localIdCounter++}` }

function newCatalogItem(): LineItem {
  return { localId: newLocalId(), tipo: 'catalogo', nombre: '', categoria: CATEGORIAS[0], cantidad: '1', precio_unitario: '' }
}
function newCustomItem(): LineItem {
  return { localId: newLocalId(), tipo: 'custom',   nombre: '', categoria: CATEGORIAS[0], cantidad: '1', precio_unitario: '' }
}

// ── Fila de ítem (con buscador propio) ────────────────────────────────────────
function LineItemRow({
  item,
  onUpdate,
  onRemove,
  isOnly,
}: {
  item:     LineItem
  onUpdate: (item: LineItem) => void
  onRemove: () => void
  isOnly:   boolean
}) {
  const [busqueda, setBusqueda]   = useState(item.nombre)
  const [suggestions, setSugg]    = useState<ProductoOption[]>([])
  const [showDrop, setShowDrop]   = useState(false)
  const [confirmed, setConfirmed] = useState(item.nombre !== '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const subtotal = (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0)

  function search(val: string) {
    setBusqueda(val)
    setConfirmed(false)
    onUpdate({ ...item, nombre: val })
    if (timer.current) clearTimeout(timer.current)
    if (val.trim().length < 2) { setSugg([]); setShowDrop(false); return }
    timer.current = setTimeout(() => {
      api.get<ProductoOption[]>(`/productos-jan/?q=${encodeURIComponent(val)}`)
        .then(res => {
          const arr = Array.isArray(res) ? res : []
          setSugg(arr)
          setShowDrop(arr.length > 0)
        })
        .catch(() => { setSugg([]); setShowDrop(false) })
    }, 280)
  }

  function pick(p: ProductoOption) {
    setBusqueda(p.nombre)
    setConfirmed(true)
    setShowDrop(false)
    setSugg([])
    onUpdate({ ...item, nombre: p.nombre, categoria: p.categoria, precio_unitario: String(p.precio) })
  }

  function clearConfirmed() {
    setBusqueda('')
    setConfirmed(false)
    onUpdate({ ...item, nombre: '', categoria: CATEGORIAS[0], precio_unitario: '' })
  }

  return (
    <div className="rounded-xl border border-brand-border bg-white overflow-visible">
      {/* Top bar: tipo badge + remove */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-[1.5px] flex items-center gap-1"
          style={{ color: item.tipo === 'catalogo' ? SAGE : AMBER }}>
          {item.tipo === 'catalogo'
            ? <><Package size={10} /> Del catálogo</>
            : <><Type size={10} /> Ítem personalizado</>}
        </span>
        {!isOnly && (
          <button type="button" onClick={onRemove}
            className="text-brand-muted hover:text-red-500 transition-colors p-0.5 rounded">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="px-3 pb-3 space-y-2.5">

        {/* Producto / Descripción */}
        {item.tipo === 'catalogo' ? (
          <div className="relative">
            {confirmed ? (
              /* Producto confirmado */
              <div className="flex items-center justify-between rounded-xl px-3 py-2 border-2"
                style={{ borderColor: SAGE, background: `${SAGE}0D` }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Package size={13} style={{ color: SAGE }} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate" style={{ color: SAGE }}>
                      {item.nombre}
                    </p>
                    <p className="text-[10px] text-brand-muted">{item.categoria}</p>
                  </div>
                </div>
                <button type="button" onClick={clearConfirmed}
                  className="text-brand-muted hover:text-brand-body ml-2 flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            ) : (
              /* Búsqueda */
              <>
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => search(e.target.value)}
                  onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                  onFocus={() => suggestions.length > 0 && setShowDrop(true)}
                  placeholder="Buscar producto por nombre o código…"
                  className="input w-full text-sm"
                  autoFocus={item.nombre === ''}
                />
                {showDrop && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-brand-border overflow-hidden max-h-48 overflow-y-auto">
                    {suggestions.map(p => (
                      <button key={p.id} type="button"
                        onMouseDown={() => pick(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-cream transition-colors flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-brand-body truncate">{p.nombre}</p>
                          <p className="text-[10px] text-brand-muted">{p.categoria}</p>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: SAGE }}>
                          {fmt$(p.precio)}
                        </span>
                      </button>
                    ))}
                    {busqueda.length >= 2 && suggestions.length === 0 && (
                      <div className="px-4 py-3 text-xs text-brand-muted">Sin resultados</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Ítem personalizado: texto libre + categoría */
          <div className="space-y-2">
            <input
              type="text"
              value={item.nombre}
              onChange={e => onUpdate({ ...item, nombre: e.target.value })}
              placeholder="Descripción del ítem…"
              className="input w-full text-sm"
            />
            <select
              value={item.categoria}
              onChange={e => onUpdate({ ...item, categoria: e.target.value })}
              className="input w-full text-sm">
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Cantidad · Precio · Subtotal */}
        <div className="grid grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-[10px] font-bold tracking-[1.2px] uppercase text-brand-muted mb-1">
              Cant.
            </label>
            <input
              type="number" min="1" step="1"
              value={item.cantidad}
              onChange={e => onUpdate({ ...item, cantidad: e.target.value })}
              className="input w-full text-sm text-center"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-[1.2px] uppercase text-brand-muted mb-1">
              Precio unit.
            </label>
            <input
              type="number" min="0" step="1"
              value={item.precio_unitario}
              onChange={e => onUpdate({ ...item, precio_unitario: e.target.value })}
              placeholder="$ 0"
              className="input w-full text-sm text-right"
            />
          </div>
          <div className="rounded-xl px-3 py-2.5 text-right" style={{ background: `${SAGE}10` }}>
            <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wide mb-0.5">Subtotal</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: SAGE }}>
              {subtotal > 0 ? fmt$(subtotal) : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de carga / edición ──────────────────────────────────────────────────
function VentaModal({
  editVenta,
  onSave,
  onClose,
}: {
  editVenta?: Venta
  onSave: (items: LineItem[], global: GlobalForm) => Promise<void>
  onClose: () => void
}) {
  const isEdit = !!editVenta

  // ── Estado global (compartido para todos los ítems) ──
  const [global, setGlobal] = useState<GlobalForm>({
    fecha:        editVenta?.fecha       ?? new Date().toISOString().slice(0, 10),
    canal:        editVenta?.canal       ?? CANALES[0],
    metodo_pago:  editVenta?.metodo_pago ?? METODOS_PAGO[0],
    cliente_tipo: (editVenta?.cliente_tipo as GlobalForm['cliente_tipo']) ?? 'cliente_final',
    cliente_id:   editVenta?.cliente_id  ?? null,
    notas:        editVenta?.notas       ?? '',
  })

  // ── Ítems (solo para nueva venta; en edición = 1 ítem fijo) ──
  const [items, setItems] = useState<LineItem[]>(() => {
    if (isEdit) {
      return [{
        localId:         newLocalId(),
        tipo:            'catalogo',
        nombre:          editVenta!.producto,
        categoria:       editVenta!.categoria,
        cantidad:        String(editVenta!.cantidad),
        precio_unitario: String(editVenta!.precio_unitario),
      }]
    }
    return [newCatalogItem()]
  })

  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [busqCli, setBusqCli]   = useState('')

  const setG = (k: keyof GlobalForm, v: unknown) =>
    setGlobal(g => ({ ...g, [k]: v }))

  const isCCDisabled = global.cliente_tipo === 'cliente_final'

  // Cargar clientes cuando se elige cliente registrado
  useEffect(() => {
    if (global.cliente_tipo === 'cliente_registrado' && clientes.length === 0) {
      api.get<ClienteOption[]>('/clientes-jan/')
        .then(res => setClientes(Array.isArray(res) ? res : []))
        .catch(() => {})
    }
  }, [global.cliente_tipo])

  // ── Item handlers ──
  function updateItem(localId: string, updated: LineItem) {
    setItems(prev => prev.map(it => it.localId === localId ? updated : it))
  }
  function removeItem(localId: string) {
    setItems(prev => prev.filter(it => it.localId !== localId))
  }
  function addCatalog() { setItems(prev => [...prev, newCatalogItem()]) }
  function addCustom()  { setItems(prev => [...prev, newCustomItem()]) }

  // ── Totales ──
  const grandTotal = items.reduce((s, it) => {
    return s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0)
  }, 0)

  const clienteSeleccionado = clientes.find(c => c.id === global.cliente_id)
  const clientesFiltrados   = clientes.filter(c =>
    c.nombre_completo.toLowerCase().includes(busqCli.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Validaciones
    for (const it of items) {
      if (!it.nombre.trim()) { setError('Completá el nombre de todos los ítems.'); return }
      if (!it.precio_unitario || parseFloat(it.precio_unitario) <= 0) {
        setError('Todos los ítems deben tener precio mayor a 0.'); return
      }
    }
    if (global.cliente_tipo === 'cliente_registrado' && !global.cliente_id) {
      setError('Seleccioná un cliente registrado.'); return
    }
    if (global.metodo_pago === 'Cuenta Corriente' && global.cliente_tipo !== 'cliente_registrado') {
      setError('Cuenta Corriente solo está disponible para clientes registrados.'); return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(items, global)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(30,43,26,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} style={{ color: SAGE }} />
            <h2 className="font-bold font-head text-base" style={{ color: SAGE }}>
              {isEdit ? 'Editar venta' : 'Nueva venta'}
            </h2>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-body transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">

            {/* Fecha + Canal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">Fecha</label>
                <input type="date" value={global.fecha}
                  onChange={e => setG('fecha', e.target.value)}
                  className="input w-full text-sm" required />
              </div>
              <div>
                <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">Canal de venta</label>
                <select value={global.canal} onChange={e => setG('canal', e.target.value)}
                  className="input w-full text-sm">
                  {CANALES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* ── Ítems ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted">
                  Productos / Ítems
                </label>
                {!isEdit && (
                  <span className="text-[10px] text-brand-muted">
                    {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {items.map(it => (
                  <LineItemRow
                    key={it.localId}
                    item={it}
                    onUpdate={updated => updateItem(it.localId, updated)}
                    onRemove={() => removeItem(it.localId)}
                    isOnly={items.length === 1}
                  />
                ))}
              </div>

              {/* Botones agregar (solo en modo nuevo) */}
              {!isEdit && (
                <div className="flex gap-2 mt-2.5">
                  <button type="button" onClick={addCatalog}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed text-xs font-bold transition-all hover:bg-cream/50"
                    style={{ borderColor: `${SAGE}60`, color: SAGE }}>
                    <Package size={12} /> Del catálogo
                  </button>
                  <button type="button" onClick={addCustom}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed text-xs font-bold transition-all hover:bg-cream/50"
                    style={{ borderColor: `${AMBER}60`, color: AMBER }}>
                    <Type size={12} /> Ítem libre
                  </button>
                </div>
              )}
            </div>

            {/* Grand total */}
            {grandTotal > 0 && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: `${SAGE}12` }}>
                <span className="text-sm font-semibold text-brand-muted">
                  Total{items.length > 1 ? ` (${items.length} ítems)` : ''}
                </span>
                <span className="text-xl font-bold tabular-nums" style={{ color: SAGE }}>
                  {fmt$(grandTotal)}
                </span>
              </div>
            )}

            {/* Separador */}
            <div className="border-t border-brand-border/50" />

            {/* Tipo de cliente */}
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-2">
                Tipo de cliente
              </label>
              <div className="flex gap-3">
                {[
                  { val: 'cliente_final',      label: 'Cliente Final',      Icon: User },
                  { val: 'cliente_registrado', label: 'Cliente Registrado', Icon: UserCheck },
                ].map(({ val, label, Icon }) => (
                  <button key={val} type="button"
                    onClick={() => {
                      setG('cliente_tipo', val)
                      if (val === 'cliente_final') {
                        setG('cliente_id', null)
                        if (global.metodo_pago === 'Cuenta Corriente') setG('metodo_pago', 'Efectivo')
                      }
                    }}
                    className={[
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-bold transition-all',
                      global.cliente_tipo === val
                        ? 'border-current text-white'
                        : 'border-brand-border text-brand-muted hover:border-sage/40',
                    ].join(' ')}
                    style={global.cliente_tipo === val ? { background: SAGE, borderColor: SAGE } : {}}>
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de cliente registrado */}
            {global.cliente_tipo === 'cliente_registrado' && (
              <div>
                <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                  Buscar cliente
                </label>
                {clienteSeleccionado ? (
                  <div className="flex items-center justify-between rounded-xl px-3 py-2.5 border-2"
                    style={{ borderColor: SAGE, background: `${SAGE}0D` }}>
                    <div className="flex items-center gap-2">
                      <UserCheck size={14} style={{ color: SAGE }} />
                      <span className="text-sm font-semibold" style={{ color: SAGE }}>
                        {clienteSeleccionado.nombre_completo}
                      </span>
                    </div>
                    <button type="button"
                      onClick={() => { setG('cliente_id', null); setBusqCli('') }}
                      className="text-brand-muted hover:text-brand-body">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={busqCli}
                      onChange={e => setBusqCli(e.target.value)}
                      placeholder="Escribí el nombre del cliente…"
                      className="input w-full text-sm"
                    />
                    {busqCli && clientesFiltrados.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-brand-border overflow-hidden max-h-40 overflow-y-auto">
                        {clientesFiltrados.map(c => (
                          <button key={c.id} type="button"
                            onClick={() => { setG('cliente_id', c.id); setBusqCli('') }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors font-medium text-brand-body">
                            {c.nombre_completo}
                          </button>
                        ))}
                      </div>
                    )}
                    {busqCli && clientesFiltrados.length === 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-brand-border px-4 py-3">
                        <p className="text-xs text-brand-muted">No se encontraron clientes</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Método de pago */}
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-2">
                Método de pago
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {METODOS_PAGO.map(m => {
                  const disabled = m === 'Cuenta Corriente' && isCCDisabled
                  const selected = global.metodo_pago === m
                  return (
                    <button key={m} type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setG('metodo_pago', m)}
                      title={disabled ? 'Solo para clientes registrados' : ''}
                      className={[
                        'flex items-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all',
                        selected && !disabled
                          ? 'border-current text-white'
                          : disabled
                          ? 'border-brand-border/30 text-brand-muted/30 cursor-not-allowed'
                          : 'border-brand-border text-brand-muted hover:border-sage/40 hover:text-brand-body',
                      ].join(' ')}
                      style={selected && !disabled ? { background: AMBER, borderColor: AMBER } : {}}>
                      <span className="text-sm">{METODO_ICONS[m] ?? '💰'}</span>
                      <span className="truncate">{m}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                Notas <span className="font-normal normal-case">(opcional)</span>
              </label>
              <input type="text" value={global.notas}
                onChange={e => setG('notas', e.target.value)}
                placeholder="Color, tamaño, cliente frecuente..."
                className="input w-full text-sm" />
            </div>

            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          </div>

          {/* Footer pegado */}
          <div className="flex gap-2 px-5 py-4 border-t border-brand-border/50 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 border border-brand-border rounded-xl py-2.5 text-sm font-semibold text-brand-muted hover:text-brand-body transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: SAGE }}>
              <Check size={15} />
              {saving
                ? 'Guardando…'
                : isEdit
                ? 'Guardar cambios'
                : items.length > 1
                ? `Guardar ${items.length} ítems`
                : 'Guardar venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Badge estado de pago ──────────────────────────────────────────────────────
function EstadoPago({ estado }: { estado: string }) {
  if (estado === 'pagado') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: '#dcfce7', color: '#16a34a' }}>
      ✓ Pagado
    </span>
  )
  if (estado === 'pendiente') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: '#fef9c3', color: '#ca8a04' }}>
      ⏳ CC Pendiente
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: '#fee2e2', color: '#dc2626' }}>
      {estado}
    </span>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Ventas() {
  const [month, setMonth]       = useState(MONTHS[CURRENT_MONTH_IDX] ?? 'MAYO')
  const [year,  setYear]        = useState(CURRENT_YEAR)
  const [data,  setData]        = useState<Summary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<{ open: boolean; venta?: Venta }>({ open: false })
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get<Summary>(`/ventas-jan/${year}/${month}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [month, year])

  useEffect(() => { load() }, [load])

  async function handleSave(items: LineItem[], global: GlobalForm) {
    if (modal.venta) {
      // Edición: actualizar ítem único
      const it = items[0]
      await api.put(`/ventas-jan/${modal.venta.id}`, {
        fecha:           global.fecha,
        producto:        it.nombre,
        categoria:       it.categoria,
        cantidad:        parseFloat(it.cantidad),
        precio_unitario: parseFloat(it.precio_unitario),
        canal:           global.canal,
        metodo_pago:     global.metodo_pago,
        cliente_tipo:    global.cliente_tipo,
        cliente_id:      global.cliente_id,
        notas:           global.notas,
      })
    } else {
      // Creación: una venta por ítem, en secuencia
      for (const it of items) {
        await api.post('/ventas-jan/', {
          fecha:           global.fecha,
          producto:        it.nombre,
          categoria:       it.categoria,
          cantidad:        parseFloat(it.cantidad),
          precio_unitario: parseFloat(it.precio_unitario),
          canal:           global.canal,
          metodo_pago:     global.metodo_pago,
          cliente_tipo:    global.cliente_tipo,
          cliente_id:      global.cliente_id,
          notas:           global.notas,
        })
      }
    }
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminás esta venta?')) return
    setDeleting(id)
    try {
      await api.delete(`/ventas-jan/${id}`)
      load()
    } finally {
      setDeleting(null)
    }
  }

  const ventas    = data?.ventas ?? []
  const porMetodo = data?.por_medio ?? {}

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-head" style={{ color: SAGE }}>Ventas</h1>
          <p className="text-brand-muted text-sm mt-0.5">Registro acumulado del mes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(e.target.value)} className="input text-sm w-36">
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input text-sm w-24">
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ background: SAGE }}>
            <Plus size={16} />
            Nueva venta
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card py-16 text-center text-brand-muted text-sm animate-pulse">Cargando ventas…</div>
      ) : (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="card p-5 col-span-2 md:col-span-1 border-l-4" style={{ borderLeftColor: SAGE }}>
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1">Total {month}</p>
              <p className="text-2xl font-bold font-head" style={{ color: SAGE }}>{fmt$(data?.total_mes ?? 0)}</p>
              <p className="text-xs text-brand-muted mt-1">{data?.cantidad_ops ?? 0} ventas cargadas</p>
            </div>
            <div className="card p-4 border-l-4" style={{ borderLeftColor: '#ca8a04' }}>
              <p className="text-[11px] font-bold tracking-[1.2px] uppercase text-brand-muted mb-1.5 flex items-center gap-1">
                <span>📒</span><span>Cta. Corriente</span>
              </p>
              <p className="text-lg font-bold font-head tabular-nums" style={{ color: '#ca8a04' }}>
                {fmt$(ventas.filter(v => v.estado_pago === 'pendiente').reduce((s, v) => s + v.total, 0))}
              </p>
              <p className="text-xs text-brand-muted mt-0.5">
                {ventas.filter(v => v.estado_pago === 'pendiente').length} pendientes
              </p>
            </div>
            <div className="card p-4 border-l-4" style={{ borderLeftColor: AMBER }}>
              <p className="text-[11px] font-bold tracking-[1.2px] uppercase text-brand-muted mb-1.5 flex items-center gap-1">
                <span>✓</span><span>Cobrado</span>
              </p>
              <p className="text-lg font-bold font-head tabular-nums" style={{ color: AMBER }}>
                {fmt$(ventas.filter(v => v.estado_pago === 'pagado').reduce((s, v) => s + v.total, 0))}
              </p>
              <p className="text-xs text-brand-muted mt-0.5">efectivo + transferencias</p>
            </div>
          </div>

          {/* ── Por método de pago ── */}
          {Object.keys(porMetodo).length > 0 && (
            <div className="card p-4">
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-3">
                Por método de pago
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(porMetodo)
                  .sort(([, a], [, b]) => b - a)
                  .map(([metodo, tot]) => (
                    <div key={metodo} className="flex items-center gap-2 rounded-xl px-3 py-1.5 bg-cream/60">
                      <span className="text-sm">{METODO_ICONS[metodo] ?? '💰'}</span>
                      <span className="text-xs font-semibold text-brand-body">{metodo}</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: SAGE }}>{fmt$(tot)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Por línea de producto ── */}
          {Object.keys(data?.por_categoria ?? {}).length > 0 && (
            <div className="card p-4">
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-3 flex items-center gap-1.5">
                <TrendingUp size={13} style={{ color: SAGE }} />
                Por línea de producto
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data!.por_categoria)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, tot]) => (
                    <div key={cat} className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                      style={{ background: `${CAT_COLORS[cat] ?? '#6B5E50'}18` }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: CAT_COLORS[cat] ?? '#6B5E50' }} />
                      <span className="text-xs font-semibold" style={{ color: CAT_COLORS[cat] ?? '#6B5E50' }}>
                        {cat}
                      </span>
                      <span className="text-xs font-bold text-brand-body">{fmt$(tot)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Tabla de ventas ── */}
          <div className="card p-0 overflow-hidden">
            {ventas.length === 0 ? (
              <div className="py-16 text-center">
                <ShoppingBag size={36} className="mx-auto mb-3 opacity-20" style={{ color: SAGE }} />
                <p className="text-brand-muted text-sm font-medium">Sin ventas en {month} {year}</p>
                <button
                  onClick={() => setModal({ open: true })}
                  className="mt-3 text-sm font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
                  style={{ color: SAGE }}>
                  Registrar primera venta →
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: SAGE }}>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70 w-20">Fecha</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">Producto</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/70 hidden sm:table-cell">Línea</th>
                      <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-white/70 hidden md:table-cell">Cant.</th>
                      <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-white/70 hidden md:table-cell">P. Unit.</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">Total</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/70 hidden lg:table-cell">Canal</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/70">Pago</th>
                      <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/70 hidden xl:table-cell">Estado</th>
                      <th className="px-3 py-3 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((v, i) => (
                      <tr key={v.id}
                        className={`border-b border-brand-border/40 transition-colors hover:bg-cream/50 ${i % 2 !== 0 ? 'bg-cream/20' : ''}`}>
                        <td className="px-4 py-3 text-xs text-brand-muted font-medium tabular-nums">
                          {new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-brand-body leading-tight">{v.producto}</p>
                          {v.notas && <p className="text-[11px] text-brand-muted mt-0.5 italic">{v.notas}</p>}
                        </td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: `${CAT_COLORS[v.categoria] ?? '#6B5E50'}20`,
                              color: CAT_COLORS[v.categoria] ?? '#6B5E50',
                            }}>
                            {v.categoria}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-brand-muted tabular-nums hidden md:table-cell">
                          {v.cantidad % 1 === 0 ? v.cantidad.toFixed(0) : v.cantidad}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-brand-muted tabular-nums hidden md:table-cell">
                          {fmt$(v.precio_unitario)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-bold tabular-nums" style={{ color: SAGE }}>{fmt$(v.total)}</span>
                        </td>
                        <td className="px-3 py-3 text-center hidden lg:table-cell">
                          <span className="text-[11px] text-brand-muted font-medium">{v.canal}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-base" title={v.metodo_pago || v.medio_pago}>
                          {METODO_ICONS[v.metodo_pago] ?? METODO_ICONS[v.medio_pago] ?? '💰'}
                        </td>
                        <td className="px-3 py-3 text-center hidden xl:table-cell">
                          <EstadoPago estado={v.estado_pago || 'pagado'} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setModal({ open: true, venta: v })}
                              className="p-1.5 rounded-lg text-brand-muted hover:text-brand-sage hover:bg-sage/10 transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(v.id)}
                              disabled={deleting === v.id}
                              className="p-1.5 rounded-lg text-brand-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {modal.open && (
        <VentaModal
          editVenta={modal.venta}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
