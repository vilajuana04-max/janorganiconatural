import { useEffect, useState, useCallback } from 'react'
import { X, Check, ChevronDown, ChevronRight, AlertCircle, Download, Calendar, CreditCard, FileText } from 'lucide-react'
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

// ── Helpers de fechas ─────────────────────────────────────────────────────────
function fmtFecha(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

// Parsear historial de pagos desde el campo notas
function parsearPagos(notas: string): { tipo: string; monto?: number; nota: string }[] {
  if (!notas) return []
  return notas
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const parcialMatch = s.match(/^Pago parcial \$([\d.]+):\s*(.*)$/)
      const canceladoMatch = s.match(/^Cancelado:\s*(.*)$/)
      if (parcialMatch) return { tipo: 'parcial', monto: parseFloat(parcialMatch[1]), nota: parcialMatch[2] }
      if (canceladoMatch) return { tipo: 'cancelado', nota: canceladoMatch[1] }
      return { tipo: 'nota', nota: s }
    })
}

// ── Exportar CSV ──────────────────────────────────────────────────────────────
function exportarCSV(resumen: ResumenResponse) {
  const encabezado = [
    'Cliente',
    'Venta #',
    'Fecha Venta',
    'Monto Original',
    'Monto Pendiente',
    'Estado',
    'Fecha Cancelación / Pago',
    'Historial Pagos',
  ]

  const filas: string[][] = []
  for (const cliente of resumen.clientes) {
    for (const deuda of cliente.deudas) {
      const pagos = parsearPagos(deuda.notas)
      const historial = pagos
        .map(p => p.tipo === 'parcial' ? `Parcial $${p.monto}` : p.tipo === 'cancelado' ? 'Cancelado' : p.nota)
        .join(' → ')
      filas.push([
        cliente.nombre,
        String(deuda.venta_id),
        fmtFecha(deuda.fecha_venta),
        String(deuda.monto_original),
        String(deuda.monto_pendiente),
        deuda.estado,
        deuda.fecha_cancelacion ? fmtFecha(deuda.fecha_cancelacion) : '',
        historial,
      ])
    }
  }

  // Resumen final
  filas.push([])
  filas.push(['TOTAL PENDIENTE GLOBAL', '', '', '', String(resumen.total_pendiente_global), '', '', ''])

  const csvContent =
    [encabezado, ...filas]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cuenta-corriente-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Exportar PDF por cliente ──────────────────────────────────────────────────
function exportarPDFCliente(cliente: ClienteResumen) {
  const fechaExport = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const filaDeuda = (d: CCEntry) => {
    const estadoColor = d.estado === 'cancelado' ? '#16a34a' : d.estado === 'parcial' ? '#d97706' : '#ca8a04'
    const estadoLabel = d.estado === 'cancelado' ? 'Cancelado' : d.estado === 'parcial' ? 'Parcial' : 'Pendiente'
    const pagos = parsearPagos(d.notas)

    const historialHTML = pagos.length > 0
      ? `<div class="historial">
          ${pagos.map(p => `
            <div class="pago-item">
              <span class="pago-dot" style="color:${p.tipo === 'cancelado' ? '#16a34a' : '#d97706'}">
                ${p.tipo === 'cancelado' ? '✓' : '→'}
              </span>
              <span>
                ${p.tipo === 'parcial' ? `<strong>Pago parcial: $${p.monto?.toLocaleString('es-AR')}</strong>` : ''}
                ${p.tipo === 'cancelado' ? '<strong>Deuda cancelada</strong>' : ''}
                ${p.nota ? `<em> — ${p.nota}</em>` : ''}
                ${p.tipo === 'cancelado' && d.fecha_cancelacion ? ` (${fmtFecha(d.fecha_cancelacion)})` : ''}
              </span>
            </div>`).join('')}
        </div>`
      : ''

    return `
      <tr>
        <td>
          <div class="venta-id">Venta #${d.venta_id}</div>
          <div class="fecha-venta">
            📅 Fecha de venta: ${fmtFecha(d.fecha_venta)}
            ${d.fecha_cancelacion ? `&nbsp;&nbsp;✓ Pago: ${fmtFecha(d.fecha_cancelacion)}` : ''}
          </div>
          ${historialHTML}
        </td>
        <td class="money">${fmt$(d.monto_original)}</td>
        <td class="money" style="color:${d.monto_original !== d.monto_pendiente ? '#16a34a' : '#6b7280'}">
          ${d.monto_original !== d.monto_pendiente ? fmt$(d.monto_original - d.monto_pendiente) : '—'}
        </td>
        <td class="money" style="color:${estadoColor}; font-weight:700">${fmt$(d.monto_pendiente)}</td>
        <td><span class="badge" style="color:${estadoColor}; border-color:${estadoColor}">${estadoLabel}</span></td>
      </tr>`
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>CC — ${cliente.nombre}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: #1a1a1a;
      padding: 32px 40px;
      background: #fff;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 2px solid #3D6B64;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 800;
      color: #3D6B64;
      letter-spacing: -0.3px;
    }
    .brand-sub {
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-right {
      text-align: right;
      font-size: 10px;
      color: #6b7280;
    }
    .header-right strong {
      display: block;
      font-size: 13px;
      color: #1a1a1a;
      font-weight: 700;
      margin-bottom: 2px;
    }

    /* ── Bloque cliente ── */
    .cliente-block {
      background: #f5efe6;
      border-left: 4px solid #3D6B64;
      border-radius: 0 8px 8px 0;
      padding: 14px 18px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cliente-nombre {
      font-size: 16px;
      font-weight: 800;
      color: #1E2B1A;
    }
    .cliente-label {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }
    .total-block {
      text-align: right;
    }
    .total-monto {
      font-size: 22px;
      font-weight: 900;
      color: #C4875A;
      font-variant-numeric: tabular-nums;
    }
    .total-label {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    /* ── Resumen KPI ── */
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .kpi {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .kpi-label {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 15px;
      font-weight: 800;
      color: #3D6B64;
    }

    /* ── Tabla ── */
    .section-title {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead tr {
      background: #1E2B1A;
    }
    thead th {
      color: white;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 8px 10px;
      text-align: left;
    }
    thead th.money { text-align: right; }
    tbody tr { border-bottom: 1px solid #f0ede8; }
    tbody tr:nth-child(even) { background: #faf7f4; }
    tbody td {
      padding: 10px 10px;
      vertical-align: top;
      line-height: 1.5;
    }
    .venta-id {
      font-weight: 700;
      font-size: 11px;
      color: #1a1a1a;
    }
    .fecha-venta {
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
    }
    .money { text-align: right; font-variant-numeric: tabular-nums; }
    .badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 99px;
      border: 1px solid;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .historial {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed #e5e7eb;
    }
    .pago-item {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      font-size: 10px;
      color: #374151;
      margin-bottom: 3px;
    }
    .pago-dot { flex-shrink: 0; }

    /* ── Footer ── */
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #9ca3af;
    }

    @media print {
      body { padding: 20px 24px; }
      @page { margin: 10mm 12mm; size: A4; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-name">JAN Orgánico Natural</div>
      <div class="brand-sub">Sistema ERP · Mar del Plata</div>
    </div>
    <div class="header-right">
      <strong>Estado de Cuenta Corriente</strong>
      Fecha de emisión: ${fechaExport}
    </div>
  </div>

  <!-- Cliente + Total -->
  <div class="cliente-block">
    <div>
      <div class="cliente-label">Cliente</div>
      <div class="cliente-nombre">${cliente.nombre}</div>
    </div>
    <div class="total-block">
      <div class="cliente-label">Saldo total pendiente</div>
      <div class="total-monto">${fmt$(cliente.total_pendiente)}</div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Operaciones abiertas</div>
      <div class="kpi-value">${cliente.cantidad_deudas}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Monto total vendido (CC)</div>
      <div class="kpi-value" style="color:#1E2B1A">
        ${fmt$(cliente.deudas.reduce((s, d) => s + d.monto_original, 0))}
      </div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total pagado hasta hoy</div>
      <div class="kpi-value" style="color:#16a34a">
        ${fmt$(cliente.deudas.reduce((s, d) => s + (d.monto_original - d.monto_pendiente), 0))}
      </div>
    </div>
  </div>

  <!-- Tabla de transacciones -->
  <div class="section-title">Detalle de operaciones</div>
  <table>
    <thead>
      <tr>
        <th>Venta / Detalle</th>
        <th class="money">Monto original</th>
        <th class="money">Pagado</th>
        <th class="money">Pendiente</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${cliente.deudas.map(filaDeuda).join('')}
      <tr style="background:#f5efe6; font-weight:800">
        <td><strong>TOTAL</strong></td>
        <td class="money">${fmt$(cliente.deudas.reduce((s, d) => s + d.monto_original, 0))}</td>
        <td class="money" style="color:#16a34a">
          ${fmt$(cliente.deudas.reduce((s, d) => s + (d.monto_original - d.monto_pendiente), 0))}
        </td>
        <td class="money" style="color:#C4875A; font-size:13px">${fmt$(cliente.total_pendiente)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <!-- Footer -->
  <div class="footer">
    <span>JAN Orgánico Natural · Estado de cuenta generado automáticamente</span>
    <span>${fechaExport}</span>
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Habilitá las ventanas emergentes para generar el PDF.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 400)
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

  const montoNum      = parseFloat(monto) || 0
  const restante      = Math.max(0, entry.monto_pendiente - montoNum)
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
            <CreditCard size={18} style={{ color: SAGE }} />
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
              <span className="text-xs text-brand-muted">Monto original</span>
              <span className="text-sm tabular-nums text-brand-muted">{fmt$(entry.monto_original)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-muted">Fecha de venta</span>
              <span className="text-xs font-medium text-brand-body flex items-center gap-1">
                <Calendar size={10} />
                {fmtFecha(entry.fecha_venta)}
              </span>
            </div>
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

// ── Timeline de pagos ─────────────────────────────────────────────────────────
function HistorialPagos({ notas, fechaCancelacion }: { notas: string; fechaCancelacion: string | null }) {
  const pagos = parsearPagos(notas)
  if (pagos.length === 0) return null

  return (
    <div className="mt-2.5 pl-3 border-l-2 space-y-1.5" style={{ borderColor: `${SAGE}30` }}>
      {pagos.map((p, i) => (
        <div key={i} className="text-[11px] flex items-start gap-1.5">
          <span className="mt-0.5 flex-shrink-0" style={{ color: p.tipo === 'cancelado' ? '#16a34a' : AMBER }}>
            {p.tipo === 'cancelado' ? '✓' : '→'}
          </span>
          <span className="text-brand-muted">
            {p.tipo === 'parcial' && <><span className="font-bold text-brand-body">{fmt$(p.monto!)}</span> pagado</>}
            {p.tipo === 'cancelado' && <span className="font-bold text-green-700">Deuda cancelada</span>}
            {p.nota && <span className="ml-1 opacity-70">— {p.nota}</span>}
            {p.tipo === 'cancelado' && fechaCancelacion && (
              <span className="ml-1 opacity-70">({fmtFecha(fechaCancelacion)})</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Fila de deuda ─────────────────────────────────────────────────────────────
function DeudaRow({
  deuda,
  clienteNombre,
  onPago,
}: {
  deuda: CCEntry
  clienteNombre: string
  onPago: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const tienePagos = parsearPagos(deuda.notas).length > 0

  return (
    <div className="border-b border-brand-border/20 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-cream/20 transition-colors">

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-brand-body">
            Venta #{deuda.venta_id}
          </p>
          {/* Fechas */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-[11px] text-brand-muted flex items-center gap-1">
              <Calendar size={10} />
              Venta: {fmtFecha(deuda.fecha_venta)}
            </span>
            {deuda.fecha_cancelacion && (
              <span className="text-[11px] text-green-600 flex items-center gap-1">
                <Check size={10} />
                Pago: {fmtFecha(deuda.fecha_cancelacion)}
              </span>
            )}
          </div>
          {/* Montos */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-[11px] text-brand-muted">
              Original: <span className="font-medium">{fmt$(deuda.monto_original)}</span>
            </span>
            {deuda.monto_pendiente !== deuda.monto_original && (
              <span className="text-[11px]" style={{ color: AMBER }}>
                Pagado: <span className="font-medium">{fmt$(deuda.monto_original - deuda.monto_pendiente)}</span>
              </span>
            )}
          </div>

          {/* Historial expandible */}
          {tienePagos && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-1.5 text-[11px] font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: SAGE }}>
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {expanded ? 'Ocultar historial' : 'Ver historial de pagos'}
            </button>
          )}
          {expanded && (
            <HistorialPagos notas={deuda.notas} fechaCancelacion={deuda.fecha_cancelacion} />
          )}
        </div>

        <EstadoBadge estado={deuda.estado} />

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold tabular-nums" style={{ color: AMBER }}>
            {fmt$(deuda.monto_pendiente)}
          </p>
          <p className="text-[10px] text-brand-muted">pendiente</p>
        </div>

        <button
          onClick={onPago}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: SAGE }}>
          <Check size={12} />
          Pago
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CuentaCorriente() {
  const [resumen, setResumen]     = useState<ResumenResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<Set<number>>(new Set())
  const [pagoModal, setPagoModal] = useState<{ entry: CCEntry; clienteNombre: string } | null>(null)
  const [filtro, setFiltro]       = useState<'todos' | 'pendiente' | 'parcial'>('todos')

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
          <h1 className="text-2xl font-bold font-head" style={{ color: SAGE }}>Saldo Cuenta Corriente</h1>
          <p className="text-brand-muted text-sm mt-0.5">Deudas pendientes de clientes</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtros */}
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

          {/* Botón exportar */}
          {resumen && resumen.clientes.length > 0 && (
            <button
              onClick={() => exportarCSV(resumen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-brand-border text-brand-muted hover:text-brand-body hover:border-sage/40 transition-all">
              <Download size={13} />
              Exportar CSV
            </button>
          )}
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

                    {/* ── Fila cliente (header expandible) ── */}
                    <div className="flex items-center">
                      <button
                        className="flex-1 flex items-center gap-4 px-5 py-4 hover:bg-cream/30 transition-colors text-left"
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

                      {/* Botón PDF por cliente */}
                      <button
                        onClick={e => { e.stopPropagation(); exportarPDFCliente(cliente) }}
                        title="Exportar PDF de este cliente"
                        className="flex-shrink-0 mx-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-brand-body hover:border-sage/40 transition-all text-[11px] font-semibold">
                        <FileText size={13} />
                        PDF
                      </button>
                    </div>

                    {/* ── Detalle de deudas ── */}
                    {isOpen && (
                      <div className="border-t border-brand-border/40">
                        {deudasFiltradas.map(deuda => (
                          <DeudaRow
                            key={deuda.id}
                            deuda={deuda}
                            clienteNombre={cliente.nombre}
                            onPago={() => setPagoModal({ entry: deuda, clienteNombre: cliente.nombre })}
                          />
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
