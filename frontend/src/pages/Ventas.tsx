import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check, ShoppingBag, TrendingUp, UserCheck, User } from 'lucide-react'
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
  'Efectivo':       '💵',
  'Transferencia':  '🏦',
  'Link de Pago':   '🔗',
  'Tarjeta':        '💳',
  'Cuenta Corriente': '📒',
  // legacy
  'Cta. DNI':       '🏦',
  'Mercado Pago':   '💙',
  'Naranja':        '🟠',
}

type ClienteOption = { id: number; nombre_completo: string }

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
  ventas: Venta[]
  total_mes: number
  cantidad_ops: number
  por_medio: Record<string, number>
  por_canal: Record<string, number>
  por_categoria: Record<string, number>
}

const EMPTY_FORM = {
  fecha:           new Date().toISOString().slice(0, 10),
  producto:        '',
  categoria:       CATEGORIAS[0],
  cantidad:        '1',
  precio_unitario: '',
  canal:           CANALES[0],
  metodo_pago:     METODOS_PAGO[0],
  cliente_tipo:    'cliente_final' as 'cliente_final' | 'cliente_registrado',
  cliente_id:      null as number | null,
  notas:           '',
}

// ── Modal de carga / edición ──────────────────────────────────────────────────
function VentaModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<typeof EMPTY_FORM & { id: number }>
  onSave: (data: typeof EMPTY_FORM) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm]       = useState({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [busqueda, setBusqueda] = useState('')

  // Cargar lista de clientes cuando se selecciona cliente_registrado
  useEffect(() => {
    if (form.cliente_tipo === 'cliente_registrado' && clientes.length === 0) {
      api.get<{ clientes: ClienteOption[] }>('/clientes-jan/')
        .then(res => setClientes(res.clientes ?? []))
        .catch(() => {})
    }
  }, [form.cliente_tipo])

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const total = (parseFloat(form.cantidad) || 0) * (parseFloat(form.precio_unitario) || 0)

  const clientesFiltrados = clientes.filter(c =>
    c.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
  )

  const clienteSeleccionado = clientes.find(c => c.id === form.cliente_id)

  const isCCDisabled = form.cliente_tipo === 'cliente_final'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.producto.trim() || !form.precio_unitario) {
      setError('Completá producto y precio unitario.')
      return
    }
    if (form.cliente_tipo === 'cliente_registrado' && !form.cliente_id) {
      setError('Seleccioná un cliente registrado.')
      return
    }
    if (form.metodo_pago === 'Cuenta Corriente' && form.cliente_tipo !== 'cliente_registrado') {
      setError('Cuenta Corriente solo está disponible para clientes registrados.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} style={{ color: SAGE }} />
            <h2 className="font-bold font-head text-base" style={{ color: SAGE }}>
              {initial?.id ? 'Editar venta' : 'Nueva venta'}
            </h2>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-body transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Fecha + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                className="input w-full text-sm" required />
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">Categoría</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                className="input w-full text-sm">
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Producto */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">Producto</label>
            <input type="text" value={form.producto} onChange={e => set('producto', e.target.value)}
              placeholder="Ej: Vela lavanda 200g"
              className="input w-full text-sm" required />
          </div>

          {/* Cantidad + Precio unitario */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">Cantidad</label>
              <input type="number" min="0.01" step="0.01" value={form.cantidad}
                onChange={e => set('cantidad', e.target.value)}
                className="input w-full text-sm" required />
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">Precio unitario</label>
              <input type="number" min="0" step="1" value={form.precio_unitario}
                onChange={e => set('precio_unitario', e.target.value)}
                placeholder="$ 0"
                className="input w-full text-sm" required />
            </div>
          </div>

          {/* Total calculado */}
          {total > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: `${SAGE}12` }}>
              <span className="text-sm font-semibold text-brand-muted">Total</span>
              <span className="text-lg font-bold" style={{ color: SAGE }}>{fmt$(total)}</span>
            </div>
          )}

          {/* Canal */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">Canal de venta</label>
            <select value={form.canal} onChange={e => set('canal', e.target.value)}
              className="input w-full text-sm">
              {CANALES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Tipo de cliente */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-2">Tipo de cliente</label>
            <div className="flex gap-3">
              {[
                { val: 'cliente_final',      label: 'Cliente Final',      Icon: User },
                { val: 'cliente_registrado', label: 'Cliente Registrado', Icon: UserCheck },
              ].map(({ val, label, Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    set('cliente_tipo', val)
                    if (val === 'cliente_final') {
                      set('cliente_id', null)
                      // Si CC seleccionado, resetear a Efectivo
                      if (form.metodo_pago === 'Cuenta Corriente') set('metodo_pago', 'Efectivo')
                    }
                  }}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-bold transition-all',
                    form.cliente_tipo === val
                      ? 'border-current text-white'
                      : 'border-brand-border text-brand-muted hover:border-sage/40',
                  ].join(' ')}
                  style={form.cliente_tipo === val ? { background: SAGE, borderColor: SAGE } : {}}>
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de cliente registrado */}
          {form.cliente_tipo === 'cliente_registrado' && (
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
                  <button type="button" onClick={() => { set('cliente_id', null); setBusqueda('') }}
                    className="text-brand-muted hover:text-brand-body">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Escribí el nombre del cliente…"
                    className="input w-full text-sm"
                  />
                  {busqueda && clientesFiltrados.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-brand-border overflow-hidden max-h-40 overflow-y-auto">
                      {clientesFiltrados.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { set('cliente_id', c.id); setBusqueda('') }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-cream transition-colors font-medium text-brand-body">
                          {c.nombre_completo}
                        </button>
                      ))}
                    </div>
                  )}
                  {busqueda && clientesFiltrados.length === 0 && (
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
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-2">Método de pago</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {METODOS_PAGO.map(m => {
                const isCC = m === 'Cuenta Corriente'
                const disabled = isCC && isCCDisabled
                const selected = form.metodo_pago === m
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && set('metodo_pago', m)}
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
            <input type="text" value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Color, tamaño, cliente frecuente..."
              className="input w-full text-sm" />
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-brand-border rounded-xl py-2.5 text-sm font-semibold text-brand-muted hover:text-brand-body transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: SAGE }}>
              <Check size={15} />
              {saving ? 'Guardando…' : 'Guardar venta'}
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
  const [month, setMonth]     = useState(MONTHS[CURRENT_MONTH_IDX] ?? 'MAYO')
  const [year,  setYear]      = useState(CURRENT_YEAR)
  const [data,  setData]      = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<{ open: boolean; venta?: Venta }>({ open: false })
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get<Summary>(`/ventas-jan/${year}/${month}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [month, year])

  useEffect(() => { load() }, [load])

  async function handleSave(form: typeof EMPTY_FORM) {
    const body = {
      fecha:           form.fecha,
      producto:        form.producto,
      categoria:       form.categoria,
      cantidad:        parseFloat(form.cantidad),
      precio_unitario: parseFloat(form.precio_unitario),
      canal:           form.canal,
      metodo_pago:     form.metodo_pago,
      cliente_tipo:    form.cliente_tipo,
      cliente_id:      form.cliente_id,
      notas:           form.notas,
    }
    if (modal.venta) {
      await api.put(`/ventas-jan/${modal.venta.id}`, body)
    } else {
      await api.post('/ventas-jan/', body)
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

  const ventas = data?.ventas ?? []

  // Calcular totales por método de pago nuevo
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
            {/* Total del mes */}
            <div className="card p-5 col-span-2 md:col-span-1 border-l-4" style={{ borderLeftColor: SAGE }}>
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1">Total {month}</p>
              <p className="text-2xl font-bold font-head" style={{ color: SAGE }}>{fmt$(data?.total_mes ?? 0)}</p>
              <p className="text-xs text-brand-muted mt-1">{data?.cantidad_ops ?? 0} ventas cargadas</p>
            </div>

            {/* CC Pendiente */}
            <div className="card p-4 border-l-4" style={{ borderLeftColor: '#ca8a04' }}>
              <p className="text-[11px] font-bold tracking-[1.2px] uppercase text-brand-muted mb-1.5 flex items-center gap-1">
                <span>📒</span>
                <span>Cta. Corriente</span>
              </p>
              <p className="text-lg font-bold font-head tabular-nums" style={{ color: '#ca8a04' }}>
                {fmt$(ventas.filter(v => v.estado_pago === 'pendiente').reduce((s, v) => s + v.total, 0))}
              </p>
              <p className="text-xs text-brand-muted mt-0.5">
                {ventas.filter(v => v.estado_pago === 'pendiente').length} pendientes
              </p>
            </div>

            {/* Cobrado */}
            <div className="card p-4 border-l-4" style={{ borderLeftColor: AMBER }}>
              <p className="text-[11px] font-bold tracking-[1.2px] uppercase text-brand-muted mb-1.5 flex items-center gap-1">
                <span>✓</span>
                <span>Cobrado</span>
              </p>
              <p className="text-lg font-bold font-head tabular-nums" style={{ color: AMBER }}>
                {fmt$(ventas.filter(v => v.estado_pago === 'pagado').reduce((s, v) => s + v.total, 0))}
              </p>
              <p className="text-xs text-brand-muted mt-0.5">efectivo + transferencias</p>
            </div>
          </div>

          {/* ── Desglose por método de pago ── */}
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

          {/* ── Desglose por línea ── */}
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
                  <tfoot>
                    <tr style={{ background: `${SAGE}14` }}>
                      <td colSpan={5} className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: SAGE }}>
                        Total {month} {year}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold tabular-nums" style={{ color: SAGE }}>
                        {fmt$(data?.total_mes ?? 0)}
                      </td>
                      <td colSpan={4} className="px-4 py-3 text-right text-xs text-brand-muted">
                        {data?.cantidad_ops} operaciones
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {modal.open && (
        <VentaModal
          initial={modal.venta ? {
            id:              modal.venta.id,
            fecha:           modal.venta.fecha,
            producto:        modal.venta.producto,
            categoria:       modal.venta.categoria,
            cantidad:        String(modal.venta.cantidad),
            precio_unitario: String(modal.venta.precio_unitario),
            canal:           modal.venta.canal,
            metodo_pago:     modal.venta.metodo_pago || modal.venta.medio_pago || METODOS_PAGO[0],
            cliente_tipo:    (modal.venta.cliente_tipo as 'cliente_final' | 'cliente_registrado') || 'cliente_final',
            cliente_id:      modal.venta.cliente_id,
            notas:           modal.venta.notas,
          } : undefined}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
