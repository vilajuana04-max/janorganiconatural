import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check, Package, Search, Tag, DollarSign, Box } from 'lucide-react'
import { api, fmt$ } from '../api'

const SAGE  = '#3D6B64'
const AMBER = '#C4875A'

const CATEGORIAS = ['Velas', 'Home', 'Jabones', 'Shampoos', 'Cosméticos', 'Accesorios', 'Kits', 'Otro']

const CAT_COLORS: Record<string, string> = {
  Velas:       '#C4875A',
  Home:        '#3D6B64',
  Jabones:     '#8b5cf6',
  Shampoos:    '#0ea5e9',
  Cosméticos:  '#ec4899',
  Accesorios:  '#84cc16',
  Kits:        '#f59e0b',
  Otro:        '#6B5E50',
}

type Variable = { nombre: string; opciones: string[] }

type Producto = {
  id:          number
  nombre:      string
  descripcion: string
  codigo:      string
  foto_url:    string
  costo:       number | null
  precio:      number
  medidas:     string
  peso_gr:     number | null
  categoria:   string
  subcategoria:string
  variables:   string   // JSON string
  stock:       number
  activo:      boolean
  created_at:  string | null
}

const EMPTY_FORM = {
  nombre:       '',
  descripcion:  '',
  codigo:       '',
  foto_url:     '',
  costo:        '',
  precio:       '',
  medidas:      '',
  peso_gr:      '',
  categoria:    CATEGORIAS[0],
  subcategoria: '',
  variables:    [] as Variable[],
  stock:        '0',
}

// ── Variables editor ──────────────────────────────────────────────────────────
function VariablesEditor({
  variables,
  onChange,
}: {
  variables: Variable[]
  onChange: (v: Variable[]) => void
}) {
  function addVar() {
    onChange([...variables, { nombre: '', opciones: [''] }])
  }
  function removeVar(i: number) {
    onChange(variables.filter((_, idx) => idx !== i))
  }
  function setVarNombre(i: number, nombre: string) {
    const next = [...variables]
    next[i] = { ...next[i], nombre }
    onChange(next)
  }
  function setOpcion(vi: number, oi: number, val: string) {
    const next = [...variables]
    const ops = [...next[vi].opciones]
    ops[oi] = val
    next[vi] = { ...next[vi], opciones: ops }
    onChange(next)
  }
  function addOpcion(vi: number) {
    const next = [...variables]
    next[vi] = { ...next[vi], opciones: [...next[vi].opciones, ''] }
    onChange(next)
  }
  function removeOpcion(vi: number, oi: number) {
    const next = [...variables]
    next[vi] = { ...next[vi], opciones: next[vi].opciones.filter((_, idx) => idx !== oi) }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {variables.map((v, vi) => (
        <div key={vi} className="border border-brand-border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={v.nombre}
              onChange={e => setVarNombre(vi, e.target.value)}
              placeholder="Nombre de variable (ej: Color)"
              className="input flex-1 text-sm"
            />
            <button type="button" onClick={() => removeVar(vi)}
              className="text-red-400 hover:text-red-600 transition-colors p-1">
              <X size={14} />
            </button>
          </div>
          <div className="pl-2 space-y-1.5">
            {v.opciones.map((op, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="text"
                  value={op}
                  onChange={e => setOpcion(vi, oi, e.target.value)}
                  placeholder={`Opción ${oi + 1}`}
                  className="input flex-1 text-sm"
                />
                <button type="button" onClick={() => removeOpcion(vi, oi)}
                  className="text-brand-muted hover:text-red-400 transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => addOpcion(vi)}
              className="text-xs text-brand-muted hover:text-brand-body flex items-center gap-1 mt-1">
              <Plus size={11} /> Agregar opción
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addVar}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-dashed border-brand-border text-brand-muted hover:text-brand-body hover:border-sage/40 transition-all">
        <Plus size={12} /> Agregar variable (color, tamaño, etc.)
      </button>
    </div>
  )
}

// ── Modal de carga / edición ──────────────────────────────────────────────────
function ProductoModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Producto
  onSave: (data: typeof EMPTY_FORM) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<typeof EMPTY_FORM>(() => {
    if (!initial) return { ...EMPTY_FORM }
    let vars: Variable[] = []
    try { vars = JSON.parse(initial.variables || '[]') } catch {}
    return {
      nombre:       initial.nombre,
      descripcion:  initial.descripcion,
      codigo:       initial.codigo,
      foto_url:     initial.foto_url,
      costo:        initial.costo !== null ? String(initial.costo) : '',
      precio:       String(initial.precio),
      medidas:      initial.medidas,
      peso_gr:      initial.peso_gr !== null ? String(initial.peso_gr) : '',
      categoria:    initial.categoria,
      subcategoria: initial.subcategoria,
      variables:    vars,
      stock:        String(initial.stock),
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.precio || parseFloat(form.precio) <= 0) { setError('El precio debe ser mayor a 0.'); return }
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Package size={18} style={{ color: SAGE }} />
            <h2 className="font-bold font-head text-base" style={{ color: SAGE }}>
              {initial ? 'Editar producto' : 'Nuevo producto'}
            </h2>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-body transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Nombre */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Vela Nature lavanda 250g"
              className="input w-full text-sm" required />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
              Descripción <span className="font-normal normal-case">(opcional)</span>
            </label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Descripción del producto, ingredientes, usos..."
              rows={2}
              className="input w-full text-sm resize-none" />
          </div>

          {/* Categoría + Subcategoría */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                Categoría <span className="text-red-400">*</span>
              </label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                className="input w-full text-sm">
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                Subcategoría <span className="font-normal normal-case">(opcional)</span>
              </label>
              <input type="text" value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)}
                placeholder="Ej: Temporada, Grande..."
                className="input w-full text-sm" />
            </div>
          </div>

          {/* Código SKU + Foto URL */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                Código / SKU
              </label>
              <input type="text" value={form.codigo} onChange={e => set('codigo', e.target.value)}
                placeholder="Ej: VNL-001"
                className="input w-full text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                URL de foto
              </label>
              <input type="url" value={form.foto_url} onChange={e => set('foto_url', e.target.value)}
                placeholder="https://..."
                className="input w-full text-sm" />
            </div>
          </div>

          {/* Precio + Costo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                Precio de venta <span className="text-red-400">*</span>
              </label>
              <input type="number" min="0" step="1" value={form.precio}
                onChange={e => set('precio', e.target.value)}
                placeholder="$ 0"
                className="input w-full text-sm" required />
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                Costo
              </label>
              <input type="number" min="0" step="1" value={form.costo}
                onChange={e => set('costo', e.target.value)}
                placeholder="$ 0"
                className="input w-full text-sm" />
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
              Stock inicial
            </label>
            <input type="number" min="0" step="0.01" value={form.stock}
              onChange={e => set('stock', e.target.value)}
              className="input w-full text-sm" />
          </div>

          {/* Medidas + Peso */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                Medidas
              </label>
              <input type="text" value={form.medidas} onChange={e => set('medidas', e.target.value)}
                placeholder="Ej: 7x7x10 cm"
                className="input w-full text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
                Peso (gramos)
              </label>
              <input type="number" min="0" step="1" value={form.peso_gr}
                onChange={e => set('peso_gr', e.target.value)}
                placeholder="250"
                className="input w-full text-sm" />
            </div>
          </div>

          {/* Variables */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-2">
              Variables del producto
            </label>
            <VariablesEditor
              variables={form.variables}
              onChange={v => set('variables', v)}
            />
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
              {saving ? 'Guardando…' : 'Guardar producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tarjeta de producto ───────────────────────────────────────────────────────
function ProductoCard({
  p,
  onEdit,
  onDelete,
}: {
  p: Producto
  onEdit: (p: Producto) => void
  onDelete: (id: number) => void
}) {
  const color = CAT_COLORS[p.categoria] ?? '#6B5E50'
  const margen = p.costo && p.precio ? Math.round(((p.precio - p.costo) / p.precio) * 100) : null

  return (
    <div className="card hover:shadow-md transition-shadow group flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        {p.foto_url ? (
          <img src={p.foto_url} alt={p.nombre}
            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-brand-border" />
        ) : (
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18` }}>
            <Package size={22} style={{ color }} strokeWidth={1.5} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm text-brand-body leading-tight">{p.nombre}</h3>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={() => onEdit(p)}
                className="p-1.5 rounded-lg hover:bg-brand-border/50 text-brand-muted transition-colors">
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(p.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-brand-muted hover:text-red-500 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${color}18`, color }}>
              {p.categoria}
            </span>
            {p.subcategoria && (
              <span className="text-[10px] font-medium text-brand-muted">{p.subcategoria}</span>
            )}
            {p.codigo && (
              <span className="text-[10px] font-mono text-brand-muted bg-brand-border/40 px-1.5 py-0.5 rounded">
                {p.codigo}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Descripción */}
      {p.descripcion && (
        <p className="text-xs text-brand-muted leading-relaxed line-clamp-2">{p.descripcion}</p>
      )}

      {/* Precios */}
      <div className="flex items-center gap-3 pt-1 border-t border-brand-border/50">
        <div className="flex-1">
          <p className="text-[10px] text-brand-muted uppercase tracking-wide font-bold">Precio</p>
          <p className="text-base font-bold" style={{ color: SAGE }}>{fmt$(p.precio)}</p>
        </div>
        {p.costo !== null && (
          <div className="flex-1">
            <p className="text-[10px] text-brand-muted uppercase tracking-wide font-bold">Costo</p>
            <p className="text-sm font-semibold text-brand-muted">{fmt$(p.costo)}</p>
          </div>
        )}
        {margen !== null && (
          <div className="flex-1">
            <p className="text-[10px] text-brand-muted uppercase tracking-wide font-bold">Margen</p>
            <p className="text-sm font-bold" style={{ color: margen >= 50 ? '#16a34a' : AMBER }}>
              {margen}%
            </p>
          </div>
        )}
      </div>

      {/* Detalles extras */}
      <div className="flex flex-wrap gap-2 text-[10px] text-brand-muted">
        {p.stock > 0 && (
          <span className="flex items-center gap-1">
            <Box size={10} />Stock: {p.stock}
          </span>
        )}
        {p.medidas && (
          <span className="flex items-center gap-1">
            <Tag size={10} />{p.medidas}
          </span>
        )}
        {p.peso_gr !== null && (
          <span>{p.peso_gr}g</span>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading]     = useState(true)
  const [busqueda, setBusqueda]   = useState('')
  const [catFilter, setCatFilter] = useState<string>('Todos')
  const [modal, setModal]         = useState<{ open: boolean; producto?: Producto }>({ open: false })

  const load = useCallback(() => {
    setLoading(true)
    api.get<Producto[]>('/productos-jan/')
      .then(res => setProductos(Array.isArray(res) ? res : []))
      .catch(() => setProductos([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(form: typeof EMPTY_FORM) {
    const body = {
      nombre:       form.nombre.trim(),
      descripcion:  form.descripcion || null,
      codigo:       form.codigo || null,
      foto_url:     form.foto_url || null,
      costo:        form.costo ? parseFloat(form.costo) : null,
      precio:       parseFloat(form.precio),
      medidas:      form.medidas || null,
      peso_gr:      form.peso_gr ? parseFloat(form.peso_gr) : null,
      categoria:    form.categoria,
      subcategoria: form.subcategoria || null,
      variables:    JSON.stringify(form.variables),
      stock:        parseFloat(form.stock) || 0,
    }
    if (modal.producto) {
      await api.put(`/productos-jan/${modal.producto.id}`, body)
    } else {
      await api.post('/productos-jan/', body)
    }
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Desactivar este producto?')) return
    await api.delete(`/productos-jan/${id}`)
    load()
  }

  const productosFiltrados = productos.filter(p => {
    const matchBusqueda = !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = catFilter === 'Todos' || p.categoria === catFilter
    return matchBusqueda && matchCat
  })

  const cats = ['Todos', ...CATEGORIAS]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-head" style={{ color: SAGE }}>Productos</h1>
          <p className="text-brand-muted text-sm mt-1">
            {productos.length} {productos.length === 1 ? 'producto' : 'productos'} en catálogo
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 shadow-sm"
          style={{ background: SAGE }}>
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="input w-full pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {cats.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                catFilter === cat
                  ? 'text-white border-transparent'
                  : 'border-brand-border text-brand-muted hover:text-brand-body hover:border-sage/30',
              ].join(' ')}
              style={catFilter === cat ? { background: CAT_COLORS[cat] ?? SAGE, borderColor: CAT_COLORS[cat] ?? SAGE } : {}}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${SAGE}40`, borderTopColor: SAGE }} />
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: `${SAGE}18` }}>
            <Package size={32} style={{ color: SAGE }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-bold text-brand-body">
              {busqueda || catFilter !== 'Todos' ? 'Sin resultados' : 'Sin productos todavía'}
            </p>
            <p className="text-sm text-brand-muted mt-1">
              {busqueda || catFilter !== 'Todos'
                ? 'Probá con otro término o categoría.'
                : 'Agregá tu primer producto para empezar.'}
            </p>
          </div>
          {!busqueda && catFilter === 'Todos' && (
            <button
              onClick={() => setModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: SAGE }}>
              <Plus size={15} /> Agregar producto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {productosFiltrados.map(p => (
            <ProductoCard
              key={p.id}
              p={p}
              onEdit={prod => setModal({ open: true, producto: prod })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Summary bar */}
      {productos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total productos', value: String(productos.length),                  icon: Package,     color: SAGE  },
            { label: 'Categorías',      value: String(new Set(productos.map(p => p.categoria)).size), icon: Tag, color: AMBER },
            { label: 'Precio promedio', value: fmt$(Math.round(productos.reduce((s, p) => s + p.precio, 0) / productos.length)), icon: DollarSign, color: SAGE },
            { label: 'Con costo',       value: String(productos.filter(p => p.costo !== null).length), icon: Box, color: AMBER },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18` }}>
                <Icon size={18} style={{ color }} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs text-brand-muted font-medium">{label}</p>
                <p className="text-lg font-bold" style={{ color }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <ProductoModal
          initial={modal.producto}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
