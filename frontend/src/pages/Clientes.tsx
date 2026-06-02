import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check, User, ShoppingBag, CreditCard, ChevronRight, Search, AlertCircle } from 'lucide-react'
import { api, fmt$ } from '../api'

const SAGE  = '#3D6B64'
const AMBER = '#C4875A'

// ── Catálogos ─────────────────────────────────────────────────────────────────
const CONDICIONES_IVA = [
  { value: 'consumidor_final',      label: 'Consumidor Final',      doc: 'DNI'  },
  { value: 'monotributista',        label: 'Monotributista',        doc: 'CUIL' },
  { value: 'exento',               label: 'Exento',               doc: 'CUIL' },
  { value: 'responsable_inscripto', label: 'Responsable Inscripto', doc: 'CUIT' },
]
const CATEGORIAS_PRECIO = [
  { value: 'lista_1', label: 'Lista 1 — Consumidor Final' },
  { value: 'lista_2', label: 'Lista 2 — Mayorista'        },
  { value: 'lista_3', label: 'Lista 3 — Distribuidor'     },
]
const TIPOS_CLIENTE = [
  { value: 'cliente_final',    label: 'Cliente Final'    },
  { value: 'cliente_mayorista', label: 'Cliente Mayorista' },
]
const IVA_LABELS: Record<string, string> = {
  consumidor_final:      'CF',
  monotributista:        'MT',
  exento:               'EX',
  responsable_inscripto: 'RI',
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Cliente = {
  id: number
  numero_cliente?: string
  nombre_completo: string
  direccion?: string
  email?: string
  condicion_iva: string
  documento_tipo: string
  documento_numero: string
  telefono?: string
  categoria_precios: string
  tipo_cliente: string
  notas?: string
  activo: boolean
  saldo_pendiente: number
}

type CCRegistro = {
  id: number
  venta_id: number
  monto_original: number
  monto_pendiente: number
  estado: string
  fecha_venta: string
  fecha_cancelacion?: string
  notas: string
}

type Compra = {
  id: number
  fecha: string
  producto: string
  categoria: string
  total: number
  metodo_pago: string
  estado_pago: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDocTipo(iva: string) {
  return CONDICIONES_IVA.find(c => c.value === iva)?.doc ?? 'DNI'
}
function validarDocumento(tipo: string, num: string): boolean {
  const digits = num.replace(/[-.\s]/g, '')
  if (tipo === 'DNI')  return /^\d{7,8}$/.test(digits)
  return /^\d{11}$/.test(digits)
}
function validarTelefono(tel: string): boolean {
  return /^549\d{10}$/.test(tel)
}
function formatDoc(tipo: string, num: string): string {
  if (tipo === 'CUIT' || tipo === 'CUIL') {
    const d = num.replace(/\D/g, '')
    if (d.length === 11) return `${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`
  }
  return num
}

// ── Formulario vacío ──────────────────────────────────────────────────────────
const EMPTY: Omit<Cliente, 'id' | 'activo' | 'saldo_pendiente'> = {
  nombre_completo:  '',
  direccion:        '',
  email:            '',
  condicion_iva:    'consumidor_final',
  documento_tipo:   'DNI',
  documento_numero: '',
  telefono:         '',
  categoria_precios: 'lista_1',
  tipo_cliente:     'cliente_final',
  notas:            '',
}

// ── Modal de Cliente ──────────────────────────────────────────────────────────
function ClienteModal({ initial, onSave, onClose }: {
  initial?: Cliente
  onSave: (data: typeof EMPTY) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<typeof EMPTY>(initial ? {
    nombre_completo:  initial.nombre_completo,
    direccion:        initial.direccion ?? '',
    email:            initial.email ?? '',
    condicion_iva:    initial.condicion_iva,
    documento_tipo:   initial.documento_tipo,
    documento_numero: initial.documento_numero,
    telefono:         initial.telefono ?? '',
    categoria_precios: initial.categoria_precios,
    tipo_cliente:     initial.tipo_cliente,
    notas:            initial.notas ?? '',
  } : { ...EMPTY })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'condicion_iva') next.documento_tipo = getDocTipo(v)
      return next
    })
    setErrors(e => ({ ...e, [k]: '' }))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.nombre_completo.trim()) errs.nombre_completo = 'Requerido'
    if (!validarDocumento(form.documento_tipo, form.documento_numero))
      errs.documento_numero = `Formato de ${form.documento_tipo} inválido`
    if (form.telefono && !validarTelefono(form.telefono))
      errs.telefono = 'Formato: 549XXXXXXXXXX (13 dígitos)'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Email inválido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setErrors({ _global: err instanceof Error ? err.message : 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const docTipo = getDocTipo(form.condicion_iva)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-8 overflow-y-auto"
      style={{ background: 'rgba(30,43,26,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <User size={18} style={{ color: SAGE }} />
            <h2 className="font-bold font-head text-base" style={{ color: SAGE }}>
              {initial ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-body"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="form-label">Nombre completo *</label>
            <input value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)}
              className={`input w-full text-sm ${errors.nombre_completo ? 'border-red-400' : ''}`}
              placeholder="Ej: García, Laura Beatriz" />
            {errors.nombre_completo && <p className="text-red-500 text-xs mt-1">{errors.nombre_completo}</p>}
          </div>

          {/* Condición IVA + Documento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Condición IVA *</label>
              <select value={form.condicion_iva} onChange={e => set('condicion_iva', e.target.value)} className="input w-full text-sm">
                {CONDICIONES_IVA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">{docTipo} *</label>
              <input value={form.documento_numero} onChange={e => set('documento_numero', e.target.value)}
                className={`input w-full text-sm ${errors.documento_numero ? 'border-red-400' : ''}`}
                placeholder={docTipo === 'DNI' ? '12345678' : '20-12345678-9'} />
              {errors.documento_numero && <p className="text-red-500 text-xs mt-1">{errors.documento_numero}</p>}
            </div>
          </div>

          {/* Teléfono + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Teléfono</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                className={`input w-full text-sm ${errors.telefono ? 'border-red-400' : ''}`}
                placeholder="5492235203420" />
              {errors.telefono
                ? <p className="text-red-500 text-xs mt-1">{errors.telefono}</p>
                : <p className="text-brand-muted text-[10px] mt-1">Formato: 549 + 10 dígitos</p>}
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className={`input w-full text-sm ${errors.email ? 'border-red-400' : ''}`}
                placeholder="nombre@email.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="form-label">Dirección</label>
            <input value={form.direccion} onChange={e => set('direccion', e.target.value)}
              className="input w-full text-sm" placeholder="Calle 123, Mar del Plata" />
          </div>

          {/* Tipo cliente + Categoría precios */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tipo de cliente *</label>
              <select value={form.tipo_cliente} onChange={e => set('tipo_cliente', e.target.value)} className="input w-full text-sm">
                {TIPOS_CLIENTE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Lista de precios *</label>
              <select value={form.categoria_precios} onChange={e => set('categoria_precios', e.target.value)} className="input w-full text-sm">
                {CATEGORIAS_PRECIO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="form-label">Notas internas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              rows={2} className="input w-full text-sm resize-none"
              placeholder="Preferencias, historia del cliente..." />
          </div>

          {errors._global && (
            <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle size={14} /> {errors._global}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-brand-border rounded-xl py-2.5 text-sm font-semibold text-brand-muted hover:text-brand-body transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: SAGE }}>
              <Check size={15} />
              {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de pago CC ─────────────────────────────────────────────────────────
function PagoModal({ registro, onPago, onClose }: {
  registro: CCRegistro
  onPago: (ccId: number, monto: number, notas: string) => Promise<void>
  onClose: () => void
}) {
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(monto)
    if (!val || val <= 0) { setError('Ingresá un monto válido'); return }
    setSaving(true)
    try {
      await onPago(registro.id, val, notas)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar pago')
    } finally {
      setSaving(false)
    }
  }

  const restante = registro.monto_pendiente - (parseFloat(monto) || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(30,43,26,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="font-bold font-head text-base" style={{ color: SAGE }}>Registrar pago</h2>
          <button onClick={onClose}><X size={18} className="text-brand-muted" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl p-3 space-y-1" style={{ background: `${SAGE}10` }}>
            <div className="flex justify-between text-xs text-brand-muted">
              <span>Deuda original</span>
              <span className="font-semibold">{fmt$(registro.monto_original)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span style={{ color: SAGE }}>Pendiente actual</span>
              <span style={{ color: AMBER }}>{fmt$(registro.monto_pendiente)}</span>
            </div>
          </div>

          <div>
            <label className="form-label">Monto a pagar *</label>
            <input type="number" min="0.01" step="1" value={monto}
              onChange={e => setMonto(e.target.value)}
              className="input w-full text-sm" placeholder="$ 0" autoFocus />
          </div>

          {parseFloat(monto) > 0 && (
            <div className="text-xs text-brand-muted flex justify-between px-1">
              <span>Saldo restante después del pago:</span>
              <span className={`font-bold ${restante <= 0 ? 'text-green-600' : ''}`} style={restante > 0 ? { color: AMBER } : {}}>
                {restante <= 0 ? '✓ Cancelado' : fmt$(restante)}
              </span>
            </div>
          )}

          <div>
            <label className="form-label">Notas (opcional)</label>
            <input value={notas} onChange={e => setNotas(e.target.value)}
              className="input w-full text-sm" placeholder="Transferencia, efectivo en feria..." />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-brand-border rounded-xl py-2.5 text-sm font-semibold text-brand-muted">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: SAGE }}>
              <Check size={15} /> {saving ? 'Guardando…' : 'Confirmar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Panel lateral de detalle de cliente ───────────────────────────────────────
function ClientePanel({ cliente, onEdit, onClose, onRefresh, defaultTab }: {
  cliente: Cliente
  onEdit: () => void
  onClose: () => void
  onRefresh: () => void
  defaultTab?: 'datos' | 'historial' | 'cc'
}) {
  const [tab, setTab] = useState<'datos' | 'historial' | 'cc'>(defaultTab ?? (cliente.saldo_pendiente > 0 ? 'cc' : 'datos'))
  const [historial, setHistorial] = useState<Compra[]>([])
  const [cc, setCC] = useState<{ saldo_pendiente: number; registros: CCRegistro[] } | null>(null)
  const [pagoModal, setPagoModal] = useState<CCRegistro | null>(null)

  useEffect(() => {
    if (tab === 'historial') {
      api.get<Compra[]>(`/clientes-jan/${cliente.id}/historial`).then(setHistorial).catch(() => {})
    }
    if (tab === 'cc') {
      api.get<{ saldo_pendiente: number; registros: CCRegistro[] }>(`/clientes-jan/${cliente.id}/cuenta-corriente`)
        .then(setCC).catch(() => {})
    }
  }, [tab, cliente.id])

  async function handlePago(ccId: number, monto: number, notas: string) {
    await api.put(`/cuenta-corriente-jan/${ccId}/pago`, { monto_pago: monto, notas })
    const updated = await api.get<{ saldo_pendiente: number; registros: CCRegistro[] }>(
      `/clientes-jan/${cliente.id}/cuenta-corriente`
    )
    setCC(updated)
    onRefresh()
    setPagoModal(null)
  }

  const ESTADO_CC: Record<string, { label: string; cls: string }> = {
    pendiente: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    parcial:   { label: 'Parcial',   cls: 'bg-blue-50 text-blue-700 border border-blue-200'   },
    cancelado: { label: 'Cancelado', cls: 'bg-green-50 text-green-700 border border-green-200' },
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end"
        style={{ background: 'rgba(30,43,26,0.3)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}>
        <div className="bg-white h-full w-full max-w-lg shadow-2xl flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="px-6 py-4 border-b border-brand-border flex items-start justify-between flex-shrink-0"
            style={{ background: SAGE }}>
            <div>
              <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold">
                {CONDICIONES_IVA.find(c => c.value === cliente.condicion_iva)?.label}
              </p>
              <h2 className="text-white font-bold text-lg font-head leading-tight">{cliente.nombre_completo}</h2>
              <p className="text-white/60 text-xs mt-0.5">
                {cliente.numero_cliente && <span className="font-mono font-bold text-white/80 mr-1.5">{cliente.numero_cliente}</span>}
                {cliente.documento_tipo}: {formatDoc(cliente.documento_tipo, cliente.documento_numero)}
                {cliente.telefono && ` · ${cliente.telefono}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white">
                <Pencil size={14} />
              </button>
              <button onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Saldo chip */}
          {cliente.saldo_pendiente > 0 && (
            <div className="px-6 py-3 flex items-center justify-between flex-shrink-0"
              style={{ background: `${AMBER}15`, borderBottom: `1px solid ${AMBER}30` }}>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: AMBER }}>
                Saldo en cuenta corriente
              </span>
              <span className="text-base font-bold" style={{ color: AMBER }}>
                {fmt$(cliente.saldo_pendiente)}
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-brand-border flex-shrink-0">
            {(['datos', 'historial', 'cc'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${tab === t ? 'border-b-2' : 'text-brand-muted hover:text-brand-body'}`}
                style={tab === t ? { color: SAGE, borderBottomColor: SAGE } : {}}>
                {t === 'datos' ? 'Datos' : t === 'historial' ? 'Compras' : 'Cta. Cte.'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">

            {tab === 'datos' && (
              <div className="space-y-3 text-sm">
                {[
                  ['Lista de precios', CATEGORIAS_PRECIO.find(c => c.value === cliente.categoria_precios)?.label ?? '-'],
                  ['Tipo de cliente', TIPOS_CLIENTE.find(t => t.value === cliente.tipo_cliente)?.label ?? '-'],
                  ['Email', cliente.email || '—'],
                  ['Dirección', cliente.direccion || '—'],
                  ['Notas', cliente.notas || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-start py-2 border-b border-brand-border/40">
                    <span className="text-brand-muted font-medium text-xs uppercase tracking-wide">{k}</span>
                    <span className="text-brand-body font-semibold text-right max-w-[60%]">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === 'historial' && (
              <div className="space-y-2">
                {historial.length === 0
                  ? <p className="text-brand-muted text-sm text-center py-10">Sin compras registradas</p>
                  : historial.map(c => (
                    <div key={c.id} className="rounded-xl p-3 border border-brand-border hover:bg-cream/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-brand-body leading-tight">{c.producto}</p>
                          <p className="text-xs text-brand-muted mt-0.5">
                            {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')} · {c.metodo_pago}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: SAGE }}>{fmt$(c.total)}</p>
                          {c.estado_pago === 'pendiente' && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">PENDIENTE</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {tab === 'cc' && (
              <div className="space-y-3">
                {/* Saldo total */}
                <div className="rounded-xl p-4 text-center" style={{ background: cc?.saldo_pendiente ? `${AMBER}15` : `${SAGE}10` }}>
                  <p className="text-xs text-brand-muted uppercase tracking-wide mb-1">Saldo total pendiente</p>
                  <p className="text-2xl font-bold font-head" style={{ color: cc?.saldo_pendiente ? AMBER : SAGE }}>
                    {fmt$(cc?.saldo_pendiente ?? 0)}
                  </p>
                  {!cc?.saldo_pendiente && <p className="text-xs text-green-600 font-semibold mt-1">✓ Sin deuda</p>}
                </div>

                {/* Lista de registros */}
                {(cc?.registros ?? []).length === 0
                  ? <p className="text-brand-muted text-sm text-center py-6">Sin movimientos en cuenta corriente</p>
                  : (cc?.registros ?? []).map(r => (
                    <div key={r.id} className="rounded-xl border border-brand-border p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-brand-muted">
                            Venta #{r.venta_id} · {new Date(r.fecha_venta + 'T12:00:00').toLocaleDateString('es-AR')}
                          </p>
                          <p className="text-sm font-semibold text-brand-body mt-0.5">
                            Original: {fmt$(r.monto_original)}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_CC[r.estado]?.cls ?? ''}`}>
                          {ESTADO_CC[r.estado]?.label ?? r.estado}
                        </span>
                      </div>

                      {r.estado !== 'cancelado' && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold" style={{ color: AMBER }}>
                            Pendiente: {fmt$(r.monto_pendiente)}
                          </span>
                          <button
                            onClick={() => setPagoModal(r)}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl text-white"
                            style={{ background: SAGE }}>
                            Registrar pago
                          </button>
                        </div>
                      )}
                      {r.estado === 'cancelado' && r.fecha_cancelacion && (
                        <p className="text-xs text-green-600">
                          ✓ Cancelado el {new Date(r.fecha_cancelacion + 'T12:00:00').toLocaleDateString('es-AR')}
                        </p>
                      )}
                      {r.notas && <p className="text-xs text-brand-muted italic">{r.notas}</p>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {pagoModal && (
        <PagoModal
          registro={pagoModal}
          onPago={handlePago}
          onClose={() => setPagoModal(null)}
        />
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState<{ open: boolean; cliente?: Cliente }>({ open: false })
  const [detalle, setDetalle]   = useState<{ cliente: Cliente; tab?: 'datos' | 'historial' | 'cc' } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get<Cliente[]>('/clientes-jan/')
      .then(setClientes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clientes.filter(c =>
    c.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
    c.documento_numero.includes(search)
  )

  const totalSaldo = clientes.reduce((s, c) => s + (c.saldo_pendiente || 0), 0)

  async function handleSave(data: typeof EMPTY) {
    if (modal.cliente) {
      await api.put(`/clientes-jan/${modal.cliente.id}`, data)
    } else {
      await api.post('/clientes-jan/', data)
    }
    load()
    if (detalle && modal.cliente?.id === detalle.cliente.id) {
      const updated = await api.get<Cliente>(`/clientes-jan/${detalle.cliente.id}`)
      setDetalle({ cliente: updated, tab: detalle.tab })
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Desactivar este cliente?')) return
    await api.delete(`/clientes-jan/${id}`)
    load()
    if (detalle?.cliente.id === id) setDetalle(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-head" style={{ color: SAGE }}>Clientes</h1>
          <p className="text-brand-muted text-sm mt-0.5">Base de datos de clientes JAN</p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm"
          style={{ background: SAGE }}>
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-1">Total clientes</p>
          <p className="text-2xl font-bold font-head" style={{ color: SAGE }}>{clientes.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-1">Mayoristas</p>
          <p className="text-2xl font-bold font-head" style={{ color: SAGE }}>
            {clientes.filter(c => c.tipo_cliente === 'cliente_mayorista').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-1">Saldo CC pendiente</p>
          <p className="text-2xl font-bold font-head" style={{ color: totalSaldo > 0 ? AMBER : SAGE }}>
            {fmt$(totalSaldo)}
          </p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input w-full pl-10 text-sm" placeholder="Buscar por nombre o documento…" />
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-brand-muted text-sm animate-pulse">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <User size={36} className="mx-auto mb-3 opacity-20" style={{ color: SAGE }} />
            <p className="text-brand-muted text-sm">
              {search ? 'Sin resultados para esa búsqueda' : 'Sin clientes registrados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: SAGE }}>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">Nombre</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/70 hidden sm:table-cell">IVA</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70 hidden md:table-cell">Documento</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/70 hidden lg:table-cell">Lista</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">Saldo CC</th>
                  <th className="px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}
                    onClick={() => setDetalle({ cliente: c })}
                    className={`border-b border-brand-border/40 cursor-pointer transition-colors hover:bg-cream/50 ${i % 2 !== 0 ? 'bg-cream/20' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-brand-body">{c.nombre_completo}</p>
                      <p className="text-xs text-brand-muted">
                        {c.numero_cliente && <span className="font-mono mr-1.5" style={{ color: SAGE }}>{c.numero_cliente}</span>}
                        {c.tipo_cliente === 'cliente_mayorista' ? 'Mayorista' : 'Final'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${SAGE}20`, color: SAGE }}>
                        {IVA_LABELS[c.condicion_iva] ?? c.condicion_iva}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="text-xs text-brand-muted">{c.documento_tipo}: </span>
                      <span className="text-xs font-medium">{formatDoc(c.documento_tipo, c.documento_numero)}</span>
                    </td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                      <span className="text-xs text-brand-muted">
                        {c.categoria_precios.replace('lista_', 'L')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.saldo_pendiente > 0 ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-bold" style={{ color: AMBER }}>{fmt$(c.saldo_pendiente)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); setDetalle({ cliente: c, tab: 'cc' }) }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white transition-opacity hover:opacity-80"
                            style={{ background: AMBER }}>
                            Registrar pago
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-green-600 font-semibold">✓ Sin deuda</span>
                      )}
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal({ open: true, cliente: c })}
                          className="p-1.5 rounded-lg text-brand-muted hover:text-sage hover:bg-sage/10 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg text-brand-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={14} className="text-brand-muted ml-1" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modal.open && (
        <ClienteModal
          initial={modal.cliente}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}

      {/* Panel de detalle */}
      {detalle && (
        <ClientePanel
          cliente={detalle.cliente}
          defaultTab={detalle.tab}
          onEdit={() => setModal({ open: true, cliente: detalle.cliente })}
          onClose={() => setDetalle(null)}
          onRefresh={load}
        />
      )}
    </div>
  )
}
