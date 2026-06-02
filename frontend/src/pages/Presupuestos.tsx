import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  Plus, Search, X, FileText, Check, Send, XCircle,
  ChevronDown, Trash2, Edit3, RotateCcw, Package,
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? 'https://jan-erp.onrender.com'

/* ── JAN contact info (actualizar si cambia) ───────────────────── */
const JAN_TELEFONO  = '(223) 516-5421'
const JAN_INSTAGRAM = '@jan.organiconatural'
const JAN_EMAIL     = 'jan.organiconatural@gmail.com'

/* ── Paleta ────────────────────────────────────────────────────── */
const NAVY  = '#1E2B1A'
const CORAL = '#C4875A'
const SAGE  = '#3D6B64'
const CREAM = '#F5EFE6'

/* ── Types ─────────────────────────────────────────────────────── */
interface Item {
  id?:             number
  _localId:        string
  descripcion:     string
  cantidad:        number
  precio_unitario: number
  subtotal:        number
  fromCatalog:     boolean
}

interface Presupuesto {
  id:              number
  numero:          string
  cliente_nombre:  string
  cliente_empresa: string
  fecha:           string
  descuento_tipo:  string
  descuento_valor: number
  subtotal:        number
  descuento_monto: number
  total:           number
  estado:          string
  notas:           string
  items:           {
    id: number
    descripcion: string
    cantidad: number
    precio_unitario: number
    subtotal: number
  }[]
}

interface Producto {
  id:     number
  nombre: string
  precio: number
  codigo: string
}

type Estado = 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
type DescuentoTipo = '' | 'porcentaje' | 'fijo'

/* ── Helpers ───────────────────────────────────────────────────── */
const fmt = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })

const fmtDate = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const todayISO = () => new Date().toISOString().split('T')[0]

let _localCounter = 0
const newLocalId = () => `local-${++_localCounter}`

function addBusinessDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d.toISOString().split('T')[0]
}

const ESTADO_CONFIG: Record<Estado, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  borrador:  { label: 'Borrador',  color: '#6B7280', bg: '#F3F4F6', icon: <Edit3 size={11} /> },
  enviado:   { label: 'Enviado',   color: '#2563EB', bg: '#EFF6FF', icon: <Send size={11} /> },
  aprobado:  { label: 'Aprobado',  color: '#16A34A', bg: '#F0FDF4', icon: <Check size={11} /> },
  rechazado: { label: 'Rechazado', color: '#DC2626', bg: '#FEF2F2', icon: <XCircle size={11} /> },
}

/* ── Estado Badge ──────────────────────────────────────────────── */
function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado as Estado] ?? ESTADO_CONFIG.borrador
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

/* ── Estado Selector (dropdown) ────────────────────────────────── */
function EstadoSelector({ presupuesto, onUpdated }: { presupuesto: Presupuesto; onUpdated: (p: Presupuesto) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const change = async (estado: string) => {
    setOpen(false)
    try {
      const res = await fetch(`${API}/presupuestos-jan/${presupuesto.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ estado }),
      })
      if (!res.ok) throw new Error(await res.text())
      onUpdated(await res.json())
    } catch (e) {
      alert('Error al cambiar estado')
    }
  }

  const opciones = Object.entries(ESTADO_CONFIG).filter(([k]) => k !== presupuesto.estado)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        title="Cambiar estado"
      >
        <EstadoBadge estado={presupuesto.estado} />
        <ChevronDown size={12} style={{ color: '#9CA3AF' }} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-7 z-50 rounded-xl shadow-xl border border-black/5 overflow-hidden min-w-[140px]"
          style={{ background: 'white' }}
        >
          {opciones.map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => change(k)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold hover:bg-gray-50 transition-colors text-left"
              style={{ color: cfg.color }}
            >
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Item Row en el modal ───────────────────────────────────────── */
function ItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: Item
  onUpdate: (partial: Partial<Item>) => void
  onRemove: () => void
}) {
  const [q, setQ]               = useState('')
  const [results, setResults]   = useState<Producto[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((val: string) => {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) { setResults([]); setShowDrop(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/productos-jan/?q=${encodeURIComponent(val)}`, { credentials: 'omit' })
        const data: Producto[] = await res.json()
        setResults(data)
        setShowDrop(data.length > 0)
      } catch { setResults([]) }
    }, 280)
  }, [])

  const selectProduct = (p: Producto) => {
    onUpdate({ descripcion: p.nombre, precio_unitario: p.precio, fromCatalog: true })
    setQ('')
    setShowDrop(false)
  }

  if (item.fromCatalog && item.descripcion) {
    return (
      <div
        className="flex items-center gap-2 p-2 rounded-lg border"
        style={{ borderColor: `${SAGE}30`, background: `${SAGE}08` }}
      >
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${SAGE}20`, color: SAGE }}>
          CAT
        </span>
        <span className="flex-1 text-[13px] font-medium text-gray-700 truncate">{item.descripcion}</span>

        {/* cantidad */}
        <input
          type="number" min="1" step="1"
          value={item.cantidad}
          onChange={e => onUpdate({ cantidad: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-14 text-center border rounded-lg px-1 py-1 text-[13px] font-semibold focus:outline-none"
          style={{ borderColor: '#E5E7EB' }}
        />

        {/* precio */}
        <input
          type="number" min="0" step="100"
          value={item.precio_unitario}
          onChange={e => onUpdate({ precio_unitario: parseFloat(e.target.value) || 0 })}
          className="w-28 text-right border rounded-lg px-2 py-1 text-[13px] font-semibold focus:outline-none"
          style={{ borderColor: '#E5E7EB' }}
        />

        <span className="w-24 text-right text-[13px] font-bold" style={{ color: SAGE }}>
          {fmt(item.cantidad * item.precio_unitario)}
        </span>

        <button
          onClick={() => onUpdate({ descripcion: '', fromCatalog: false })}
          className="text-gray-300 hover:text-red-400 transition-colors ml-1"
        >
          <RotateCcw size={13} />
        </button>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
      {/* Descripcion */}
      <div className="relative flex-1">
        <input
          type="text"
          placeholder="Buscar catálogo o escribir descripción…"
          value={item.fromCatalog ? item.descripcion : (item.descripcion || q)}
          onChange={e => {
            onUpdate({ descripcion: e.target.value, fromCatalog: false })
            search(e.target.value)
          }}
          className="w-full border rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1"
          style={{ borderColor: '#E5E7EB', '--tw-ring-color': CORAL } as React.CSSProperties}
        />
        {showDrop && (
          <div
            className="absolute top-full left-0 right-0 z-40 mt-1 rounded-xl shadow-xl border border-black/5 overflow-hidden max-h-48 overflow-y-auto"
            style={{ background: 'white' }}
          >
            {results.map(p => (
              <button
                key={p.id}
                onMouseDown={() => selectProduct(p)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-50 text-left gap-2"
              >
                <span className="text-[12px] font-medium text-gray-700 truncate flex-1">{p.nombre}</span>
                <span className="text-[12px] font-bold shrink-0" style={{ color: CORAL }}>
                  {fmt(p.precio)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cantidad */}
      <input
        type="number" min="1" step="1"
        value={item.cantidad}
        onChange={e => onUpdate({ cantidad: Math.max(1, parseInt(e.target.value) || 1) })}
        className="w-14 text-center border rounded-lg px-1 py-1.5 text-[13px] font-semibold focus:outline-none"
        style={{ borderColor: '#E5E7EB' }}
      />

      {/* Precio */}
      <input
        type="number" min="0" step="100"
        value={item.precio_unitario || ''}
        placeholder="Precio"
        onChange={e => onUpdate({ precio_unitario: parseFloat(e.target.value) || 0 })}
        className="w-28 text-right border rounded-lg px-2 py-1.5 text-[13px] font-semibold focus:outline-none"
        style={{ borderColor: '#E5E7EB' }}
      />

      {/* Subtotal */}
      <span className="w-24 text-right text-[13px] font-bold pt-2 shrink-0" style={{ color: SAGE }}>
        {fmt(item.cantidad * item.precio_unitario)}
      </span>

      <button onClick={onRemove} className="text-gray-300 hover:text-red-400 transition-colors mt-1.5">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/* ── Modal crear/editar ─────────────────────────────────────────── */
function PresupuestoModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Presupuesto
  onClose: () => void
  onSaved: (p: Presupuesto) => void
}) {
  const isEdit = !!initial

  const [clienteNombre,  setClienteNombre]  = useState(initial?.cliente_nombre  ?? '')
  const [clienteEmpresa, setClienteEmpresa] = useState(initial?.cliente_empresa ?? '')
  const [fecha,          setFecha]          = useState(initial?.fecha ?? todayISO())
  const [notas,          setNotas]          = useState(initial?.notas ?? '')
  const [descTipo,       setDescTipo]       = useState<DescuentoTipo>((initial?.descuento_tipo as DescuentoTipo) ?? '')
  const [descValor,      setDescValor]      = useState(initial?.descuento_valor ?? 0)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')

  const [items, setItems] = useState<Item[]>(() => {
    if (initial?.items?.length) {
      return initial.items.map(i => ({
        id:             i.id,
        _localId:       newLocalId(),
        descripcion:    i.descripcion,
        cantidad:       i.cantidad,
        precio_unitario:i.precio_unitario,
        subtotal:       i.subtotal,
        fromCatalog:    false,
      }))
    }
    return [{
      _localId: newLocalId(), descripcion: '', cantidad: 1,
      precio_unitario: 0, subtotal: 0, fromCatalog: false,
    }]
  })

  const addItem = () =>
    setItems(p => [...p, { _localId: newLocalId(), descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0, fromCatalog: false }])

  const updateItem = (localId: string, partial: Partial<Item>) =>
    setItems(p => p.map(i => i._localId === localId ? { ...i, ...partial } : i))

  const removeItem = (localId: string) =>
    setItems(p => p.filter(i => i._localId !== localId))

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descuento = descTipo === 'porcentaje'
    ? subtotal * descValor / 100
    : descTipo === 'fijo'
      ? Math.min(descValor, subtotal)
      : 0
  const total = Math.max(0, subtotal - descuento)

  const handleSave = async () => {
    if (!clienteNombre.trim()) { setError('El nombre de cliente es requerido'); return }
    const validItems = items.filter(i => i.descripcion.trim() && i.precio_unitario > 0)
    if (!validItems.length) { setError('Agregá al menos un ítem con descripción y precio'); return }

    setSaving(true)
    setError('')
    try {
      const body = {
        cliente_nombre:  clienteNombre.trim(),
        cliente_empresa: clienteEmpresa.trim(),
        fecha,
        descuento_tipo:  descTipo || null,
        descuento_valor: descValor,
        notas:           notas.trim(),
        items: validItems.map(i => ({
          descripcion:     i.descripcion.trim(),
          cantidad:        i.cantidad,
          precio_unitario: i.precio_unitario,
        })),
      }
      const url    = isEdit ? `${API}/presupuestos-jan/${initial!.id}` : `${API}/presupuestos-jan/`
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved(await res.json())
    } catch (e: unknown) {
      setError(`Error al guardar: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'white' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: NAVY }}>
          <div>
            <p className="text-white font-bold text-lg font-head">
              {isEdit ? `Editar ${initial!.numero}` : 'Nuevo Presupuesto'}
            </p>
            <p className="text-white/40 text-[11px] tracking-wide uppercase font-body">
              JAN Orgánico Natural
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold tracking-wide uppercase mb-1" style={{ color: SAGE }}>
                Nombre del cliente *
              </label>
              <input
                type="text"
                value={clienteNombre}
                onChange={e => setClienteNombre(e.target.value)}
                placeholder="Ej: María García"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#E5E7EB', '--tw-ring-color': CORAL } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold tracking-wide uppercase mb-1" style={{ color: SAGE }}>
                Empresa / Razón social
              </label>
              <input
                type="text"
                value={clienteEmpresa}
                onChange={e => setClienteEmpresa(e.target.value)}
                placeholder="Opcional"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#E5E7EB', '--tw-ring-color': CORAL } as React.CSSProperties}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold tracking-wide uppercase mb-1" style={{ color: SAGE }}>
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#E5E7EB', '--tw-ring-color': CORAL } as React.CSSProperties}
              />
            </div>
            <div className="flex items-end">
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
                Válido hasta: <span className="font-semibold text-gray-600">{fmtDate(addBusinessDays(fecha, 7))}</span>
                <br />
                <span className="text-[10px]">(7 días hábiles)</span>
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold tracking-wide uppercase" style={{ color: SAGE }}>
                Ítems
              </label>
              {/* Column headers */}
              <div className="flex gap-2 text-[10px] font-bold uppercase text-gray-400 pr-8">
                <span className="w-14 text-center">Cant.</span>
                <span className="w-28 text-right">Precio unit.</span>
                <span className="w-24 text-right">Subtotal</span>
              </div>
            </div>
            <div className="space-y-2">
              {items.map(item => (
                <ItemRow
                  key={item._localId}
                  item={item}
                  onUpdate={partial => updateItem(item._localId, partial)}
                  onRemove={() => removeItem(item._localId)}
                />
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:bg-amber-50"
              style={{ color: CORAL, borderColor: `${CORAL}60` }}
            >
              <Plus size={13} /> Agregar ítem
            </button>
          </div>

          {/* Descuento */}
          <div>
            <label className="block text-[11px] font-bold tracking-wide uppercase mb-2" style={{ color: SAGE }}>
              Descuento <span className="text-gray-400 normal-case font-normal">(opcional)</span>
            </label>
            <div className="flex gap-2 items-center">
              <select
                value={descTipo}
                onChange={e => { setDescTipo(e.target.value as DescuentoTipo); setDescValor(0) }}
                className="border rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#E5E7EB' }}
              >
                <option value="">Sin descuento</option>
                <option value="porcentaje">% Porcentaje</option>
                <option value="fijo">$ Monto fijo</option>
              </select>
              {descTipo && (
                <input
                  type="number" min="0"
                  value={descValor}
                  onChange={e => setDescValor(parseFloat(e.target.value) || 0)}
                  className="w-28 border rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: '#E5E7EB' }}
                  placeholder={descTipo === 'porcentaje' ? '10' : '5000'}
                />
              )}
              {descTipo && (
                <span className="text-sm font-semibold text-red-500">
                  − {fmt(descuento)}
                </span>
              )}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold tracking-wide uppercase mb-1" style={{ color: SAGE }}>
              Notas internas
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Condiciones de pago, aclaraciones, etc."
              className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
              style={{ borderColor: '#E5E7EB' }}
            />
          </div>

          {/* Totales */}
          <div className="rounded-xl p-4 space-y-1.5" style={{ background: CREAM }}>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Descuento ({descTipo === 'porcentaje' ? `${descValor}%` : 'fijo'})</span>
                <span>− {fmt(descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t pt-1.5 mt-1.5">
              <span style={{ color: NAVY }}>TOTAL</span>
              <span style={{ color: SAGE }}>{fmt(total)}</span>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: CORAL }}
          >
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear presupuesto'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── PDF Export ─────────────────────────────────────────────────── */
function exportarPDF(p: Presupuesto) {
  const fechaVenc = addBusinessDays(p.fecha, 7)
  const lineas = p.items.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:13px;">${i.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:13px;text-align:center;">${i.cantidad % 1 === 0 ? i.cantidad : i.cantidad}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:13px;text-align:right;">${Number(i.precio_unitario).toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0})}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;font-size:13px;text-align:right;font-weight:600;">${Number(i.subtotal).toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0})}</td>
    </tr>
  `).join('')

  const descuentoRow = p.descuento_monto > 0 ? `
    <tr>
      <td colspan="3" style="padding:6px 12px;text-align:right;font-size:13px;color:#DC2626;">Descuento${p.descuento_tipo === 'porcentaje' ? ` (${p.descuento_valor}%)` : ' (monto fijo)'}:</td>
      <td style="padding:6px 12px;text-align:right;font-size:13px;color:#DC2626;font-weight:600;">− ${Number(p.descuento_monto).toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0})}</td>
    </tr>` : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Presupuesto ${p.numero}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background:#fff; color:#1E2B1A; }
    @page { size: A4; margin: 18mm 18mm 22mm 18mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    .page { max-width: 780px; margin: 0 auto; padding: 32px; }

    /* HEADER */
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; margin-bottom:24px; border-bottom:2px solid #C4875A; }
    .brand-name { font-size:22px; font-weight:800; color:#1E2B1A; letter-spacing:1px; text-transform:uppercase; }
    .brand-sub  { font-size:11px; color:#C4875A; letter-spacing:2px; text-transform:uppercase; margin-top:2px; font-weight:600; }
    .brand-contact { font-size:11px; color:#6B7280; margin-top:8px; line-height:1.7; }
    .pres-info  { text-align:right; }
    .pres-num   { font-size:20px; font-weight:800; color:#C4875A; }
    .pres-fecha { font-size:12px; color:#6B7280; margin-top:4px; }

    /* CLIENTE */
    .client-box { background:#F5EFE6; border-radius:12px; padding:16px 20px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:flex-start; }
    .client-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#3D6B64; margin-bottom:4px; }
    .client-name  { font-size:15px; font-weight:700; color:#1E2B1A; }
    .client-emp   { font-size:12px; color:#6B7280; margin-top:2px; }
    .validez      { text-align:right; font-size:11px; color:#6B7280; }
    .validez strong { display:block; font-size:13px; color:#1E2B1A; font-weight:700; }

    /* TABLA */
    table { width:100%; border-collapse:collapse; margin-bottom:8px; }
    thead tr { background:#1E2B1A; }
    thead th { padding:10px 12px; color:white; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; text-align:left; }
    thead th:last-child, thead th:nth-child(2), thead th:nth-child(3) { text-align:right; }
    thead th:nth-child(2) { text-align:center; }
    tbody tr:nth-child(even) { background:#FAFAF9; }
    tfoot tr { background:#F5EFE6; }
    tfoot td { padding:10px 12px; font-size:14px; font-weight:800; color:#1E2B1A; }

    /* TOTAL */
    .total-section { display:flex; justify-content:flex-end; margin-top:4px; }
    .total-box { background:#1E2B1A; color:white; border-radius:12px; padding:14px 20px; min-width:220px; }
    .total-row { display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; opacity:0.7; }
    .total-final { display:flex; justify-content:space-between; font-size:18px; font-weight:800; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.2); }
    .total-final span:last-child { color:#C4875A; }

    /* FOOTER */
    .footer { margin-top:32px; padding-top:16px; border-top:1px solid #E5E7EB; display:flex; justify-content:space-between; align-items:center; }
    .footer-validez { background:#FFF8F3; border:1px solid #C4875A40; border-radius:8px; padding:10px 16px; font-size:12px; color:#92400E; font-weight:600; }
    .footer-contacto { font-size:11px; color:#6B7280; text-align:right; line-height:1.8; }
    .footer-contacto strong { color:#1E2B1A; }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="brand-name">JAN Orgánico Natural</div>
      <div class="brand-sub">Cosmética y Aromas Artesanales</div>
      <div class="brand-contact">
        📞 ${JAN_TELEFONO}<br>
        Instagram: ${JAN_INSTAGRAM}<br>
        ${JAN_EMAIL}
      </div>
    </div>
    <div class="pres-info">
      <div class="pres-num">${p.numero}</div>
      <div class="pres-fecha">Fecha: ${fmtDate(p.fecha)}</div>
    </div>
  </div>

  <!-- CLIENTE -->
  <div class="client-box">
    <div>
      <div class="client-label">Presupuesto para</div>
      <div class="client-name">${p.cliente_nombre}</div>
      ${p.cliente_empresa ? `<div class="client-emp">${p.cliente_empresa}</div>` : ''}
    </div>
    <div class="validez">
      <div class="client-label">Válido hasta</div>
      <strong>${fmtDate(fechaVenc)}</strong>
      <div style="font-size:10px;margin-top:2px;">7 días hábiles</div>
    </div>
  </div>

  <!-- TABLA DE ÍTEMS -->
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th style="text-align:center;">Cant.</th>
        <th style="text-align:right;">Precio unit.</th>
        <th style="text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${lineas}
    </tbody>
  </table>

  <!-- TOTALES -->
  <div class="total-section">
    <div class="total-box">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${Number(p.subtotal).toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0})}</span>
      </div>
      ${p.descuento_monto > 0 ? `
      <div class="total-row" style="color:#FCA5A5;">
        <span>Descuento</span>
        <span>− ${Number(p.descuento_monto).toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0})}</span>
      </div>` : ''}
      <div class="total-final">
        <span>TOTAL</span>
        <span>${Number(p.total).toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0})}</span>
      </div>
    </div>
  </div>

  ${p.notas ? `<div style="margin-top:20px;padding:12px 16px;background:#F9F9F8;border-radius:8px;border-left:3px solid #C4875A;font-size:12px;color:#6B7280;"><strong style="color:#1E2B1A;display:block;margin-bottom:4px;">Notas:</strong>${p.notas}</div>` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-validez">
      ⏳ Este presupuesto es válido por <strong>7 días hábiles</strong> desde la fecha de emisión.
    </div>
    <div class="footer-contacto">
      <strong>JAN Orgánico Natural</strong><br>
      ${JAN_TELEFONO} · ${JAN_INSTAGRAM}<br>
      Mar del Plata, Buenos Aires
    </div>
  </div>

</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Habilitá las ventanas emergentes para exportar el PDF'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 500)
}

/* ── Presupuesto Card ───────────────────────────────────────────── */
function PresupuestoCard({
  p,
  onEdit,
  onUpdated,
  onDeleted,
}: {
  p: Presupuesto
  onEdit: () => void
  onUpdated: (upd: Presupuesto) => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar ${p.numero}?`)) return
    setDeleting(true)
    try {
      await fetch(`${API}/presupuestos-jan/${p.id}`, { method: 'DELETE', credentials: 'omit' })
      onDeleted()
    } catch { alert('Error al eliminar') } finally { setDeleting(false) }
  }

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md"
      style={{ background: 'white', borderColor: '#E5E7EB' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[13px] font-bold" style={{ color: CORAL }}>{p.numero}</span>
            <EstadoSelector presupuesto={p} onUpdated={onUpdated} />
          </div>
          <p className="font-bold text-gray-800 mt-0.5 truncate">{p.cliente_nombre}</p>
          {p.cliente_empresa && (
            <p className="text-[12px] text-gray-400 truncate">{p.cliente_empresa}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-lg" style={{ color: SAGE }}>{fmt(p.total)}</p>
          <p className="text-[11px] text-gray-400">{fmtDate(p.fecha)}</p>
        </div>
      </div>

      {/* Items preview */}
      {p.items.length > 0 && (
        <div className="text-[11px] text-gray-400 space-y-0.5">
          {p.items.slice(0, 2).map(i => (
            <div key={i.id} className="flex justify-between gap-2">
              <span className="truncate">{i.cantidad % 1 === 0 ? Math.floor(i.cantidad) : i.cantidad}× {i.descripcion}</span>
              <span className="shrink-0">{fmt(i.subtotal)}</span>
            </div>
          ))}
          {p.items.length > 2 && (
            <span className="text-gray-300">+ {p.items.length - 2} ítem{p.items.length - 2 > 1 ? 's' : ''} más</span>
          )}
        </div>
      )}

      {/* Descuento pill */}
      {p.descuento_monto > 0 && (
        <div className="text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full w-fit">
          Desc. − {fmt(p.descuento_monto)}
          {p.descuento_tipo === 'porcentaje' ? ` (${p.descuento_valor}%)` : ''}
        </div>
      )}

      {/* Notas */}
      {p.notas && (
        <p className="text-[11px] text-gray-400 italic truncate">{p.notas}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-gray-50">
        <button
          onClick={() => exportarPDF(p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors hover:opacity-80"
          style={{ background: `${NAVY}10`, color: NAVY }}
          title="Exportar PDF"
        >
          <FileText size={13} /> PDF
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors hover:opacity-80"
          style={{ background: `${CORAL}10`, color: CORAL }}
        >
          <Edit3 size={13} /> Editar
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

/* ── Main page ─────────────────────────────────────────────────── */
export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterEstado, setFilterEstado] = useState<string>('todos')
  const [showModal,    setShowModal]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<Presupuesto | undefined>()

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/presupuestos-jan/`, { credentials: 'omit' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPresupuestos(Array.isArray(data) ? data : [])
    } catch { setPresupuestos([]) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSaved = (p: Presupuesto) => {
    setPresupuestos(prev => {
      const idx = prev.findIndex(x => x.id === p.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = p; return n }
      return [p, ...prev]
    })
    setShowModal(false)
    setEditTarget(undefined)
  }

  const handleUpdated = (p: Presupuesto) =>
    setPresupuestos(prev => prev.map(x => x.id === p.id ? p : x))

  const handleDeleted = (id: number) =>
    setPresupuestos(prev => prev.filter(x => x.id !== id))

  const openNew  = () => { setEditTarget(undefined); setShowModal(true) }
  const openEdit = (p: Presupuesto) => { setEditTarget(p); setShowModal(true) }

  const filtered = presupuestos.filter(p => {
    const matchEstado = filterEstado === 'todos' || p.estado === filterEstado
    const q = search.toLowerCase()
    const matchSearch = !q
      || p.numero.toLowerCase().includes(q)
      || p.cliente_nombre.toLowerCase().includes(q)
      || p.cliente_empresa.toLowerCase().includes(q)
    return matchEstado && matchSearch
  })

  /* Stats */
  const total       = presupuestos.length
  const aprobados   = presupuestos.filter(p => p.estado === 'aprobado')
  const enviados    = presupuestos.filter(p => p.estado === 'enviado').length
  const valorAprobado = aprobados.reduce((s, p) => s + p.total, 0)

  const TABS: { key: string; label: string }[] = [
    { key: 'todos',     label: 'Todos'     },
    { key: 'borrador',  label: 'Borradores' },
    { key: 'enviado',   label: 'Enviados'  },
    { key: 'aprobado',  label: 'Aprobados' },
    { key: 'rechazado', label: 'Rechazados' },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-head" style={{ color: NAVY }}>Presupuestos</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-body">Cotizaciones y propuestas comerciales · JAN Orgánico Natural</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: CORAL }}
        >
          <Plus size={16} /> Nuevo presupuesto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total',          value: total,                  color: NAVY,  sub: 'presupuestos' },
          { label: 'Enviados',       value: enviados,               color: '#2563EB', sub: 'pendientes resp.' },
          { label: 'Aprobados',      value: aprobados.length,       color: SAGE,  sub: 'este historial' },
          { label: 'Valor aprobado', value: fmt(valorAprobado),     color: CORAL, sub: 'acumulado' },
        ].map(s => (
          <div key={s.label}
            className="rounded-2xl px-4 py-3 border"
            style={{ background: 'white', borderColor: '#E5E7EB' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{s.label}</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {TABS.map(t => {
            const cfg = ESTADO_CONFIG[t.key as Estado]
            const isActive = filterEstado === t.key
            return (
              <button
                key={t.key}
                onClick={() => setFilterEstado(t.key)}
                className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                style={isActive
                  ? { background: t.key === 'todos' ? NAVY : cfg?.bg ?? NAVY, color: t.key === 'todos' ? 'white' : cfg?.color ?? 'white', border: '1.5px solid transparent' }
                  : { background: 'white', color: '#9CA3AF', border: '1.5px solid #E5E7EB' }
                }
              >
                {t.label}
                {t.key !== 'todos' && (
                  <span className="ml-1 opacity-60">
                    {presupuestos.filter(p => p.estado === t.key).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="relative sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Buscar cliente o número…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-1 w-64"
            style={{ borderColor: '#E5E7EB', '--tw-ring-color': CORAL } as React.CSSProperties}
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando presupuestos…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3 text-gray-400">
          <Package size={36} strokeWidth={1} />
          <p className="font-semibold">
            {search || filterEstado !== 'todos' ? 'Sin resultados para ese filtro' : 'Todavía no hay presupuestos'}
          </p>
          {!search && filterEstado === 'todos' && (
            <button
              onClick={openNew}
              className="text-sm font-semibold px-4 py-2 rounded-xl mt-1"
              style={{ background: `${CORAL}15`, color: CORAL }}
            >
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <PresupuestoCard
              key={p.id}
              p={p}
              onEdit={() => openEdit(p)}
              onUpdated={handleUpdated}
              onDeleted={() => handleDeleted(p.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PresupuestoModal
          initial={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(undefined) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
