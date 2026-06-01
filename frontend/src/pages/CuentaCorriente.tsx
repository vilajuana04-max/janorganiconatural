import { useEffect, useState, useCallback } from 'react'
import { BookOpen, X, Check, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { api, fmt$ } from '../api'

const SAGE  = '#3D6B64'
const AMBER = '#C4875A'

type CCEntry = {
  id: number
  cliente_id: number
  venta_id: number
  monto_original: number
  monto_pendiente: number
  estado: 'pendiente' | 'parcial' | 'cancelado'
  fecha_venta: string
  fecha_cancelacion: string | null
  notas: string
  // populated by resumen endpoint
  producto?: string
  categoria?: string
}

type ClienteResumen = {
  cliente_id: number
  nombre: string
  total_pendiente: number
  cantidad_deudas: number
  deudas: CCEntry[]
}

type ResumenResponse = {
  clientes: ClienteResumen[]
  total_pendiente_global: number
}

// ── Modal de pago ─────────────────────────────────────────────────────────────
function PagoModal({
  entry,
  clienteNombre,
  onSave,
  onClose,
}: {
  entry: CCEntry
  clienteNombre: string
  onSave: (ccId: number, monto: number, notas: string) => Promise<void>
  onClose: () => void
}) {
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const montoNum  = parseFloat(monto) || 0
  const restante  = Math.max(0, entry.monto_pendiente - montoNum)
  const esCancelacion = montoNum >= entry.monto_pendiente

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (montoNum <= 0) { setError('Ingresá un monto válido.'); return }
    if (montoNum > entry.monto_pendiente) { setError(`El máximo es ${fmt$(entry.monto_pendiente)}.`); return }
    setSaving(true)
    setError('')
    try {
      await onSave(entry.id, montoNum, notas)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el pago.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(30,43,26,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <BookOpen size={18} style={{ color: SAGE }} />
            <h2 className="font-bold font-head text-base" style={{ color: SAGE }}>Registrar pago</h2>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-body">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Info del cliente y deuda */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: `${SAGE}0D` }}>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">Cliente</p>
            <p className="font-semibold text-brand-body">{clienteNombre}</p>
            <div className="flex items-center justify-between pt-1 border-t border-brand-border/40">
              <span className="text-xs text-brand-muted">Deuda pendiente</span>
              <span className="font-bold tabular-nums" style={{ color: AMBER }}>{fmt$(entry.monto_pendiente)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-muted">Deuda original</span>
              <span className="text-sm tabular-nums text-brand-muted">{fmt$(entry.monto_original)}</span>
            </div>
            {entry.producto && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-muted">Venta</span>
                <span className="text-xs text-brand-body">{entry.producto}</span>
              </div>
            )}
          </div>

          {/* Monto a pagar */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
              Monto a pagar
            </label>
            <input
              type="number" min="0.01" step="1"
              value={monto} onChange={e => setMonto(e.target.value)}
              placeholder={`Máx. ${fmt$(entry.monto_pendiente)}`}
              className="input w-full text-sm" autoFocus
            />
            {/* Botón cancelar total */}
            <button type="button"
              onClick={() => setMonto(String(entry.monto_pendiente))}
              className="mt-1.5 text-[11px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: SAGE }}>
              Pagar todo ({fmt$(entry.monto_pendiente)})
            </button>
          </div>

          {/* Preview saldo restante */}
          {montoNum > 0 && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${esCancelacion ? 'bg-green-50' : 'bg-amber-50'}`}>
              <span className="text-xs font-semibold text-brand-muted">
                {esCancelacion ? '✓ Cancela la deuda' : 'Saldo restante'}
              </span>
              <span className={`text-base font-bold tabular-nums ${esCancelacion ? 'text-green-600' : 'text-amber-600'}`}>
                {esCancelacion ? 'Deuda saldada' : fmt$(restante)}
              </span>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1.5">
              Notas <span className="font-normal normal-case">(opcional)</span>
            </label>
            <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: Pago parcial en efectivo"
              className="input w-full text-sm" />
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-brand-border rounded-xl py-2.5 text-sm font-semibold text-brand-muted">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: SAGE }}>
              <Check size={15} />
              {saving ? 'Guardando…' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Badge de estado ───────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pendiente: { bg: '#fef9c3', color: '#ca8a04', label: '⏳ Pendiente' },
    parcial:   { bg: '#fef3c7', color: '#d97706', label: '⚡ Parcial'   },
    cancelado: { bg: '#dcfce7', color: '#16a34a', label: '✓ Cancelado'  },
  }
  const s = map[estado] ?? { bg: '#f3f4f6', color: '#6b7280', label: estado }
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CuentaCorriente() {
  const [resumen, setResumen]       = useState<ResumenResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<Set<number>>(new Set())
  const [pagoModal, setPagoModal]   = useState<{ entry: CCEntry; clienteNombre: string } | null>(null)
  const [filtro, setFiltro]         = useState<'todos' | 'pendiente' | 'parcial'>('todos')

  const load = useCallback(() => {
    setLoading(true)
    api.get<ResumenResponse>('/cuenta-corriente-jan/resumen')
      .then(setResumen)
      .catch(() => setResumen(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handlePago(ccId: number, monto: number, notas: string) {
    await api.put(`/cuenta-corriente-jan/${ccId}/pago`, { monto_pago: monto, notas })
    load()
  }

  const clientes = resumen?.clientes ?? []

  const clientesFiltrados = clientes.filter(c => {
    if (filtro === 'todos') return c.total_pendiente > 0
    return c.deudas.some(d => d.estado === filtro)
  })

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-head" style={{ color: SAGE }}>Cuenta Corriente</h1>
          <p className="text-brand-muted text-sm mt-0.5">Deudas pendientes de clientes</p>
        </div>
        <div className="flex items-center gap-2">
          {(['todos', 'pendiente', 'parcial'] as const).map(f => (
            <button key={f}
              onClick={() => setFiltro(f)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                filtro === f
                  ? 'text-white border-transparent'
                  : 'border-brand-border text-brand-muted hover:text-brand-body',
              ].join(' ')}
              style={filtro === f ? { background: SAGE } : {}}>
              {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes' : 'Parciales'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card py-16 text-center text-brand-muted text-sm animate-pulse">
          Cargando cuenta corriente…
        </div>
      ) : (
        <>
          {/* ── KPI global ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-5 border-l-4" style={{ borderLeftColor: AMBER }}>
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1">
                Total Pendiente
              </p>
              <p className="text-2xl font-bold font-head tabular-nums" style={{ color: AMBER }}>
                {fmt$(resumen?.total_pendiente_global ?? 0)}
              </p>
            </div>
            <div className="card p-5 border-l-4" style={{ borderLeftColor: SAGE }}>
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1">
                Clientes con Deuda
              </p>
              <p className="text-2xl font-bold font-head" style={{ color: SAGE }}>
                {clientes.filter(c => c.total_pendiente > 0).length}
              </p>
            </div>
            <div className="card p-5 border-l-4" style={{ borderLeftColor: '#ca8a04' }}>
              <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-brand-muted mb-1">
                Operaciones Abiertas
              </p>
              <p className="text-2xl font-bold font-head" style={{ color: '#ca8a04' }}>
                {clientes.reduce((s, c) => s + c.cantidad_deudas, 0)}
              </p>
            </div>
          </div>

          {/* ── Lista de clientes con CC ── */}
          {clientesFiltrados.length === 0 ? (
            <div className="card py-16 text-center">
              <AlertCircle size={36} className="mx-auto mb-3 opacity-20" style={{ color: SAGE }} />
              <p className="text-brand-muted text-sm font-medium">
                {filtro === 'todos'
                  ? 'No hay deudas pendientes 🎉'
                  : `No hay deudas en estado "${filtro}"`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientesFiltrados.map(cliente => {
                const isOpen = expanded.has(cliente.cliente_id)
                const deudasFiltradas = filtro === 'todos'
                  ? cliente.deudas
                  : cliente.deudas.filter(d => d.estado === filtro)

                return (
                  <div key={cliente.cliente_id} className="card p-0 overflow-hidden">

                    {/* ── Fila cliente ── */}
                    <button
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-cream/30 transition-colors text-left"
                      onClick={() => toggleExpand(cliente.cliente_id)}>

                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: SAGE }}>
                        {cliente.nombre.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-brand-body text-sm leading-tight truncate">
                          {cliente.nombre}
                        </p>
                        <p className="text-[11px] text-brand-muted mt-0.5">
                          {cliente.cantidad_deudas} {cliente.cantidad_deudas === 1 ? 'deuda' : 'deudas'} abiertas
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-bold tabular-nums" style={{ color: AMBER }}>
                          {fmt$(cliente.total_pendiente)}
                        </p>
                        <p className="text-[10px] text-brand-muted">pendiente</p>
                      </div>

                      <div className="ml-2 flex-shrink-0">
                        {isOpen
                          ? <ChevronDown size={16} className="text-brand-muted" />
                          : <ChevronRight size={16} className="text-brand-muted" />}
                      </div>
                    </button>

                    {/* ── Detalle de deudas ── */}
                    {isOpen && (
                      <div className="border-t border-brand-border/40">
                        {deudasFiltradas.map(deuda => (
                          <div key={deuda.id}
                            className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-brand-border/20 last:border-b-0 hover:bg-cream/20 transition-colors">

                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-brand-body">
                                {deuda.producto ?? `Venta #${deuda.venta_id}`}
                              </p>
                              <p className="text-[11px] text-brand-muted mt-0.5">
                                {new Date(deuda.fecha_venta + 'T12:00:00').toLocaleDateString('es-AR', {
                                  day: '2-digit', month: '2-digit', year: '2-digit',
                                })}
                                {' · '}Original: {fmt$(deuda.monto_original)}
                              </p>
                            </div>

                            <EstadoBadge estado={deuda.estado} />

                            <div className="text-right">
                              <p className="text-sm font-bold tabular-nums" style={{ color: AMBER }}>
                                {fmt$(deuda.monto_pendiente)}
                              </p>
                              <p className="text-[10px] text-brand-muted">pendiente</p>
                            </div>

                            <button
                              onClick={() => setPagoModal({ entry: deuda, clienteNombre: cliente.nombre })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                              style={{ background: SAGE }}>
                              <Check size={12} />
                              Pago
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modal de pago ── */}
      {pagoModal && (
        <PagoModal
          entry={pagoModal.entry}
          clienteNombre={pagoModal.clienteNombre}
          onSave={handlePago}
          onClose={() => setPagoModal(null)}
        />
      )}
    </div>
  )
}
