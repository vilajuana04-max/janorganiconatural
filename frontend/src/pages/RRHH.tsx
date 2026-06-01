import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileDown, RefreshCw, Plus, Lock, Trash2,
  Upload, CheckCircle, Clock, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

const NAVY  = '#3D6B64'
const CORAL = '#C4875A'
const ALL_YEARS = [2024, 2025, 2026, 2027]
const BRANCHES  = [
  { id: 1, name: 'LURO',         union: 'Madereros' },
  { id: 2, name: 'INDEPENDENCIA', union: 'SEC 12'   },
]

/* ── Tipos ──────────────────────────────────────────────────── */
type Tab = 'vacaciones' | 'sueldos' | 'recibos' | 'calendario' | 'dashboard' | 'ajustes'

type VacRecord = {
  id: number; year: number; employee_id: number; employee_name: string
  branch_name: string; days_entitled: number; days_taken: number
  pending_prev_year: number; total_available: number; pending_current: number
  description: string | null
}
type Employee = {
  id: number; name: string; branch_id: number; branch_name: string
  hire_date: string
  months_of_service: number        // ROUNDDOWN(YEARFRAC*12, 0) — col C Excel
  years_of_service: number         // months/12              — col D Excel
  vacation_days_entitled: number   // IF(años<5,14,…)        — col E Excel
}
type VacLog = {
  id: number; registered_date: string | null; year: number; employee_id: number
  employee_name: string | null; date_from: string; date_to: string
  days: number; status: string; approved_by: string | null; notes: string | null
}
type Receipt = {
  id: number; employee_id: number; employee_name: string; branch_name: string
  year: number; month: string; filename: string; uploaded_at: string | null
}


/* ─────────────────────────────────────────────────────────────
   PÁGINA PRINCIPAL
───────────────────────────────────────────────────────────── */
export default function RRHH() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'vacaciones') as Tab

  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true })

  const TABS: { id: Tab; label: string; subtitle: string }[] = [
    { id: 'vacaciones', label: 'Vacaciones', subtitle: 'Dias tomados y disponibles' },
    { id: 'calendario', label: 'Calendario', subtitle: 'Superposicion visual'       },
    { id: 'sueldos',    label: 'Sueldos',    subtitle: 'Liquidacion mensual'        },
    { id: 'recibos',    label: 'Recibos',    subtitle: 'PDFs por empleado'          },
    { id: 'dashboard',  label: 'Dashboard',  subtitle: 'Metricas de personal'       },
    { id: 'ajustes',    label: 'Ajustes',    subtitle: 'Empleados y configuracion'  },
  ]
  const current = TABS.find(t => t.id === tab) ?? TABS[0]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1 font-body">
            JAN Orgánico Natural · ERP
          </p>
          <h1 className="text-2xl font-bold text-white font-head">Recursos Humanos</h1>
          <p className="text-white/50 text-sm font-body">{current.subtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-brand-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold font-body transition-all"
            style={tab === t.id
              ? { background: NAVY, color: 'white' }
              : { color: '#888580' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'vacaciones' && <VacacionesTab />}
      {tab === 'calendario' && <CalendarioTab />}
      {tab === 'sueldos'    && <SueldosTab />}
      {tab === 'recibos'    && <RecibosTab />}
      {tab === 'dashboard'  && <DashboardTab />}
      {tab === 'ajustes'    && <AjustesTab />}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 1: VACACIONES
───────────────────────────────────────────────────────────── */
function VacacionesTab() {
  const [year,      setYear]      = useState(CURRENT_YEAR)
  const [records,   setRecords]   = useState<VacRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [logs,      setLogs]      = useState<VacLog[]>([])
  const [editing,   setEditing]   = useState<Record<number, { taken: string; entitled: string; desc: string }>>({})
  const [saving,    setSaving]    = useState<number | null>(null)
  const [showLogForm, setShowLogForm] = useState(false)

  const emptyLog = { employee_id: '', date_from: '', date_to: '', days: '', notes: '', approved_by: '' }
  const [logForm, setLogForm] = useState(emptyLog)

  const load = useCallback(() => {
    api.get<VacRecord[]>(`/vacations/?year=${year}`).then(setRecords).catch(() => setRecords([]))
    api.get<VacLog[]>(`/vacations/log?year=${year}`).then(setLogs).catch(() => setLogs([]))
  }, [year])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get<Employee[]>('/employees/').then(setEmployees).catch(() => setEmployees([]))
  }, [])

  const initYear = async () => {
    await api.post(`/vacations/init-year/${year}`, {})
    load()
  }

  const saveRecord = async (id: number) => {
    const edit = editing[id]
    if (!edit) return
    setSaving(id)
    try {
      // PUT body matches VacationRecordUpdate schema del backend
      // (espejo de la hoja Excel: celdas editables C=entitled, D=taken, H=description)
      await api.put(`/vacations/${id}`, {
        days_taken:    parseInt(edit.taken)    || 0,
        days_entitled: parseInt(edit.entitled) || 0,
        description:   edit.desc || null,
      })
      load()
      setEditing(prev => { const n = { ...prev }; delete n[id]; return n })
    } finally { setSaving(null) }
  }

  const addLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logForm.employee_id || !logForm.date_from || !logForm.date_to) return
    try {
      await api.post('/vacations/log', {
        year, employee_id: parseInt(logForm.employee_id),
        date_from: logForm.date_from, date_to: logForm.date_to,
        days: parseInt(logForm.days) || 0,
        notes: logForm.notes || null, approved_by: logForm.approved_by || null,
      })
      setLogForm(emptyLog); setShowLogForm(false); load()
    } catch (err: any) { alert('Error: ' + err.message) }
  }

  const approveLog = async (id: number) => {
    const by = prompt('¿Quién aprueba?', 'Administración')
    if (!by) return
    await api.put(`/vacations/log/${id}/approve?approved_by=${encodeURIComponent(by)}`, {})
    load()
  }

  const handlePdf = async () => {
    try { await api.pdf(`/vacations/pdf/${year}`, `vacaciones_${year}.pdf`) }
    catch (err: any) { alert('Error PDF: ' + err.message) }
  }

  // Totales — usan valores en vivo (edit state si hay cambios pendientes)
  const totals = records.reduce((acc, r) => {
    const edit      = editing[r.id]
    const entitled  = edit ? (parseInt(edit.entitled) || 0) : (r.days_entitled    ?? 0)
    const taken     = edit ? (parseInt(edit.taken)    || 0) : (r.days_taken       ?? 0)
    const prev      = r.pending_prev_year ?? 0
    const available = entitled + prev
    const pending   = available - taken
    return {
      entitled:  acc.entitled  + entitled,
      taken:     acc.taken     + taken,
      prev:      acc.prev      + prev,
      available: acc.available + available,
      pending:   acc.pending   + pending,
    }
  }, { entitled: 0, taken: 0, prev: 0, available: 0, pending: 0 })

  const setEdit = (r: VacRecord, field: 'taken' | 'entitled' | 'desc', val: string) =>
    setEditing(prev => ({
      ...prev,
      [r.id]: {
        taken:    field === 'taken'    ? val : (prev[r.id]?.taken    ?? String(r.days_taken)),
        entitled: field === 'entitled' ? val : (prev[r.id]?.entitled ?? String(r.days_entitled ?? 0)),
        desc:     field === 'desc'     ? val : (prev[r.id]?.desc     ?? r.description ?? ''),
      }
    }))

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-brand-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none">
            {ALL_YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={initYear}
            className="flex items-center gap-2 border border-brand-border text-brand-muted hover:bg-brand-off-white px-3 py-2 rounded-lg text-sm font-body">
            <RefreshCw size={14} /> Inicializar {year}
          </button>
          <button onClick={handlePdf}
            className="flex items-center gap-2 border border-brand-border text-brand-muted hover:bg-brand-off-white px-3 py-2 rounded-lg text-sm font-body">
            <FileDown size={14} /> PDF
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-brand-muted text-sm font-body mb-4">No hay registros para {year}.</p>
          <button onClick={initYear}
            style={{ background: CORAL }}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold mx-auto hover:opacity-90">
            <RefreshCw size={14} /> Inicializar {year}
          </button>
        </div>
      ) : (
        <>
          {/* ── SECCIÓN 1: Situación Actual ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ background: CORAL }} className="px-5 py-3">
              <p className="text-white text-sm font-bold tracking-wide font-head">
                SITUACION ACTUAL — {year}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead style={{ background: '#f5ede9' }}>
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-brand-border w-8"
                      style={{ color: CORAL }}>N°</th>
                    {['Empleado','Vac. Corresponde','Vac. Tomadas','Pend. Año Ant.','Total Disponible',`Pendientes ${year}`,'Sucursal','Descripción',''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border"
                        style={{ color: NAVY }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const edit    = editing[r.id]
                    const isDirty = !!edit

                    // ── Cálculo en vivo — igual que fórmulas Excel ──────────
                    // Col C: Vac. Corresponde (editable)
                    const liveEntitled  = edit ? (parseInt(edit.entitled) || 0) : (r.days_entitled  ?? 0)
                    // Col D: Vac. Tomadas (editable)
                    const liveTaken     = edit ? (parseInt(edit.taken)    || 0) : (r.days_taken     ?? 0)
                    // Col E: Pendientes año ant. (automático — VLOOKUP año anterior)
                    const livePrev      = r.pending_prev_year ?? 0
                    // Col F: Total Disponible = C + E  (fórmula Excel: =C+E)
                    const liveAvailable = liveEntitled + livePrev
                    // Col G: Pendientes año actual = F - D  (fórmula Excel: =F-D)
                    const livePending   = liveAvailable - liveTaken

                    const isBranchIndep = r.branch_name === 'INDEPENDENCIA'
                    return (
                      <tr key={r.id}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                        style={{ borderLeft: `3px solid ${isBranchIndep ? CORAL : NAVY}` }}>
                        <td className="px-3 py-2 text-[10px] font-bold text-center font-body"
                          style={{ color: CORAL }}>{i + 1}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-800 font-body">
                          <div className="flex items-center gap-1.5">
                            {livePending === 0
                              ? <CheckCircle size={12} className="text-green-500 shrink-0" />
                              : <Clock size={12} className="text-amber-500 shrink-0" />}
                            {r.employee_name}
                          </div>
                        </td>
                        {/* Col C — Vac. Corresponde editable */}
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" min={0}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-center w-14 focus:outline-none focus:border-coral font-body"
                            value={edit?.entitled ?? r.days_entitled}
                            onChange={e => setEdit(r, 'entitled', e.target.value)} />
                        </td>
                        {/* Col D — Vac. Tomadas editable */}
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" min={0}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-center w-14 focus:outline-none focus:border-coral font-body"
                            value={edit?.taken ?? r.days_taken}
                            onChange={e => setEdit(r, 'taken', e.target.value)} />
                        </td>
                        {/* Col E — Pendientes año ant. (solo lectura, VLOOKUP año anterior) */}
                        <td className="px-4 py-2 text-xs text-center text-brand-muted font-body">{livePrev}</td>
                        {/* Col F — Total Disponible = C+E  (recalcula en vivo) */}
                        <td className="px-4 py-2 text-xs text-center font-bold font-body"
                          style={{ background: '#fef9c3' }}>
                          <span className="text-amber-800 font-bold">{liveAvailable}</span>
                        </td>
                        {/* Col G — Pendientes = F-D  (recalcula en vivo) */}
                        <td className="px-4 py-2 text-xs text-center font-body"
                          style={{ background: livePending > 0 ? '#fef3c7' : '#dcfce7' }}>
                          <span className={`font-bold ${livePending > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                            {livePending}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs font-semibold font-body"
                          style={{ color: isBranchIndep ? CORAL : NAVY }}>
                          {isBranchIndep ? 'Indep.' : 'Luro'}
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" placeholder="Fechas tomadas…"
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-full min-w-36 focus:outline-none focus:border-coral font-body"
                            value={edit?.desc ?? r.description ?? ''}
                            onChange={e => setEdit(r, 'desc', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {isDirty && (
                            <button disabled={saving === r.id} onClick={() => saveRecord(r.id)}
                              style={{ background: CORAL }}
                              className="text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-90">
                              {saving === r.id ? '…' : 'OK'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: NAVY }}>
                    <td className="px-3 py-2.5 text-white/40 text-[10px] text-center font-body">—</td>
                    <td className="px-4 py-2.5 text-white text-xs font-bold uppercase tracking-widest">TOTALES {year}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: CORAL }}>{totals.entitled}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold text-white">{totals.taken}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold text-white">{totals.prev}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: '#fde68a' }}>{totals.available}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: totals.pending > 0 ? '#fde68a' : '#86efac' }}>{totals.pending}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── SECCIÓN 2b: Resumen Anual ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ background: NAVY }} className="px-5 py-3">
              <p className="text-white text-sm font-bold tracking-wide font-head">
                RESUMEN ANUAL DE VACACIONES — {year}
              </p>
            </div>
            {/* Summary card */}
            {(() => {
              const empConPendiente = records.filter(r => {
                const edit      = editing[r.id]
                const entitled  = edit ? (parseInt(edit.entitled) || 0) : (r.days_entitled    ?? 0)
                const taken     = edit ? (parseInt(edit.taken)    || 0) : (r.days_taken       ?? 0)
                const prev      = r.pending_prev_year ?? 0
                const available = entitled + prev
                const pending   = available - taken
                return pending > 0
              })
              return (
                <div className="px-5 py-3 border-b border-brand-border" style={{ background: '#fef9c3' }}>
                  <p className="text-[12px] font-semibold text-amber-800 font-body">
                    Total pendiente: <strong>{totals.pending} dias</strong> en{' '}
                    <strong>{empConPendiente.length}</strong> empleado{empConPendiente.length !== 1 ? 's' : ''}
                    {totals.prev > 0 && (
                      <span className="ml-3 text-amber-700">
                        · {totals.prev} dias arrastrados del año anterior
                      </span>
                    )}
                  </p>
                </div>
              )
            })()}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead style={{ background: '#f0eeeb' }}>
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-brand-border w-8"
                      style={{ color: CORAL }}>N°</th>
                    {['Empleado','Sucursal','Dias Correspondientes','Dias Tomados','Pendiente Año Ant.','Pendiente ' + year].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border"
                        style={{ color: NAVY }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const edit      = editing[r.id]
                    const entitled  = edit ? (parseInt(edit.entitled) || 0) : (r.days_entitled    ?? 0)
                    const taken     = edit ? (parseInt(edit.taken)    || 0) : (r.days_taken       ?? 0)
                    const prev      = r.pending_prev_year ?? 0
                    const available = entitled + prev
                    const pending   = available - taken
                    const isBranchIndep = r.branch_name === 'INDEPENDENCIA'
                    const hasPrevPending = prev > 0
                    return (
                      <tr key={r.id}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                        style={{ borderLeft: `3px solid ${isBranchIndep ? CORAL : NAVY}` }}>
                        <td className="px-3 py-2 text-[10px] font-bold text-center font-body"
                          style={{ color: CORAL }}>{i + 1}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-800 font-body">{r.employee_name}</td>
                        <td className="px-4 py-2 text-xs font-semibold font-body"
                          style={{ color: isBranchIndep ? CORAL : NAVY }}>
                          {isBranchIndep ? 'Indep.' : 'Luro'}
                        </td>
                        <td className="px-4 py-2 text-xs text-center font-body">{entitled}</td>
                        <td className="px-4 py-2 text-xs text-center font-body">{taken}</td>
                        <td className="px-4 py-2 text-xs text-center font-body"
                          style={{ background: hasPrevPending ? '#fef3c7' : undefined }}>
                          <span className={hasPrevPending ? 'font-bold text-amber-800' : 'text-brand-muted'}>
                            {prev > 0 ? prev : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-center font-body"
                          style={{ background: pending > 0 ? '#fef3c7' : '#dcfce7' }}>
                          <span className={`font-bold ${pending > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                            {pending}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: NAVY }}>
                    <td className="px-3 py-2.5 text-white/40 text-[10px] text-center font-body">—</td>
                    <td className="px-4 py-2.5 text-white text-xs font-bold uppercase tracking-widest" colSpan={2}>TOTALES {year}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: CORAL }}>{totals.entitled}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold text-white">{totals.taken}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: '#fde68a' }}>{totals.prev}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: totals.pending > 0 ? '#fde68a' : '#86efac' }}>{totals.pending}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── SECCIÓN 3: Solicitudes ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ background: NAVY }} className="px-5 py-3.5 flex items-center justify-between">
              <p className="text-white text-sm font-bold tracking-wide font-head">
                DETALLE DE SOLICITUDES Y VACACIONES APROBADAS — {year}
              </p>
              <button onClick={() => setShowLogForm(!showLogForm)}
                style={{ background: CORAL }}
                className="flex items-center gap-2 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90">
                <Plus size={13} /> Nueva solicitud
              </button>
            </div>

            {showLogForm && (
              <form onSubmit={addLog}
                className="px-5 py-4 border-b border-brand-border grid grid-cols-2 md:grid-cols-6 gap-3"
                style={{ background: '#f5ede9' }}>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Empleado *</label>
                  <select required
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.employee_id}
                    onChange={e => setLogForm(f => ({ ...f, employee_id: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Desde *</label>
                  <input type="date" required
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.date_from}
                    onChange={e => setLogForm(f => ({ ...f, date_from: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Hasta *</label>
                  <input type="date" required
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.date_to}
                    onChange={e => setLogForm(f => ({ ...f, date_to: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Días</label>
                  <input type="number" min={1}
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.days}
                    onChange={e => setLogForm(f => ({ ...f, days: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Notas</label>
                  <input type="text" placeholder="Opcional"
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.notes}
                    onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex items-end gap-2">
                  <button type="submit"
                    style={{ background: CORAL }}
                    className="text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 h-fit">
                    Guardar
                  </button>
                  <button type="button" onClick={() => setShowLogForm(false)}
                    className="text-brand-muted px-3 py-1.5 rounded-lg text-xs border border-brand-border hover:bg-gray-50 h-fit">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead style={{ background: '#f8f7f5' }}>
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-brand-border w-8"
                      style={{ color: NAVY }}>N°</th>
                    {['Fecha Registro','Empleado','Desde','Hasta','Días','Estado','Aprobado Por','Notas',''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border"
                        style={{ color: NAVY }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="px-3 py-2 text-[10px] font-bold text-center text-brand-muted font-body">{i + 1}</td>
                      <td className="px-4 py-2 text-xs text-brand-muted font-body">
                        {l.registered_date
                          ? new Date(l.registered_date).toLocaleDateString('es-AR')
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs font-semibold font-body text-gray-800">{l.employee_name ?? '—'}</td>
                      <td className="px-4 py-2 text-xs font-body text-gray-600">{l.date_from?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-2 text-xs font-body text-gray-600">{l.date_to?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-center font-body font-bold">{l.days}</td>
                      <td className="px-4 py-2 text-xs"
                        style={{ background: l.status === 'Aprobado' ? '#dcfce7' : '#fef3c7' }}>
                        <span className={`text-[10px] font-bold font-body ${
                          l.status === 'Aprobado' ? 'text-green-800' : 'text-amber-800'
                        }`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-brand-muted font-body">{l.approved_by ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-brand-muted font-body">{l.notes ?? '—'}</td>
                      <td className="px-2 py-2 text-right">
                        {l.status !== 'Aprobado' && (
                          <button onClick={() => approveLog(l.id)}
                            className="text-green-600 hover:text-green-800 text-[10px] font-semibold font-body px-2 py-1 rounded border border-green-200 hover:bg-green-50">
                            Aprobar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Empty rows to always show at least 8 rows */}
                  {Array.from({ length: Math.max(0, 8 - logs.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className={(logs.length + i) % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="px-3 py-2.5 text-[10px] text-center text-gray-200 font-body">{logs.length + i + 1}</td>
                      <td colSpan={9} className="px-4 py-2.5 border-b border-gray-50" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 2: CALENDARIO — Gantt de vacaciones
───────────────────────────────────────────────────────────── */
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_NAMES   = ['D','L','M','X','J','V','S']

// Paleta determinista por empleado (misma lógica que proveedores en Compras)
function empColor(name: string): string {
  const PALETTE = [
    '#C4875A','#1E2B1A','#3b82f6','#10b981','#8b5cf6',
    '#f59e0b','#ef4444','#06b6d4','#84cc16','#ec4899','#6366f1',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = Math.imul(31, h) + name.charCodeAt(i) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function CalendarioTab() {
  const [year,      setYear]      = useState(CURRENT_YEAR)
  const [monthIdx,  setMonthIdx]  = useState(CURRENT_MONTH_IDX)
  const [logs,      setLogs]      = useState<VacLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => {
    api.get<VacLog[]>(`/vacations/log?year=${year}`).then(setLogs).catch(() => setLogs([]))
  }, [year])
  useEffect(() => {
    api.get<Employee[]>('/employees/').then(setEmployees).catch(() => setEmployees([]))
  }, [])

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()

  // Verifica si un empleado tiene vacación aprobada en un día puntual
  const getLog = (empId: number, day: number): VacLog | undefined => {
    const d = new Date(year, monthIdx, day)
    return logs.find(l => {
      if (l.employee_id !== empId || !l.date_from || !l.date_to) return false
      const from = new Date(String(l.date_from).slice(0, 10))
      const to   = new Date(String(l.date_to).slice(0, 10))
      return d >= from && d <= to
    })
  }

  // Días que tienen AL MENOS 2 empleados en vacación (superposición)
  const overlapDays = new Set(
    Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(day =>
      employees.filter(e => getLog(e.id, day)).length >= 2
    )
  )

  const prevMonth = () => {
    if (monthIdx === 0) { setMonthIdx(11); setYear(y => y - 1) }
    else setMonthIdx(m => m - 1)
  }
  const nextMonth = () => {
    if (monthIdx === 11) { setMonthIdx(0); setYear(y => y + 1) }
    else setMonthIdx(m => m + 1)
  }

  // Empleados que tienen algún log en el mes visible
  const activeEmps = employees.filter(emp =>
    Array.from({ length: daysInMonth }, (_, i) => i + 1).some(d => getLog(emp.id, d))
  )
  // Resto de empleados (sin log en este mes)
  const inactiveEmps = employees.filter(emp => !activeEmps.includes(emp))

  const renderGrid = (emps: Employee[], dimmed = false) => (
    emps.map(emp => {
      const color = empColor(emp.name)
      const isIndep = emp.branch_name === 'INDEPENDENCIA'
      return (
        <tr key={emp.id} className="hover:bg-gray-50/60 transition-colors">
          {/* Empleado */}
          <td className="px-3 py-1.5 text-xs font-semibold font-body whitespace-nowrap sticky left-0 bg-white z-10 border-r border-brand-border"
            style={{ borderLeft: `3px solid ${isIndep ? CORAL : NAVY}`, opacity: dimmed ? 0.35 : 1 }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-gray-700">{emp.name}</span>
              <span className="text-[10px] font-normal" style={{ color: isIndep ? CORAL : NAVY }}>
                {isIndep ? 'Indep.' : 'Luro'}
              </span>
            </div>
          </td>
          {/* Días */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const log = getLog(emp.id, day)
            const dow = new Date(year, monthIdx, day).getDay() // 0=Dom, 6=Sáb
            const isWeekend = dow === 0 || dow === 6
            const isOverlap = overlapDays.has(day) && !!log
            return (
              <td key={day}
                title={log ? `${emp.name}: ${String(log.date_from).slice(0,10)} → ${String(log.date_to).slice(0,10)} (${log.days} días)` : undefined}
                className="p-0 text-center"
                style={{
                  minWidth: '26px',
                  background: log
                    ? isOverlap ? '#fde68a' : color   // amarillo si hay superposición
                    : isWeekend ? '#f8f7f5' : 'white',
                  opacity: dimmed && !log ? 0.25 : 1,
                }}>
                {log && (
                  <div className="w-full h-6 flex items-center justify-center">
                    {isOverlap && <span className="text-[8px] font-bold text-amber-700">!</span>}
                  </div>
                )}
                {!log && <div className="w-full h-6" />}
              </td>
            )
          })}
        </tr>
      )
    })
  )

  return (
    <div className="space-y-5">
      {/* Controles de mes */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-brand-border rounded-xl shadow-sm px-1 py-1">
          <button onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-brand-muted transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-sm font-bold font-head min-w-36 text-center" style={{ color: NAVY }}>
            {MONTH_NAMES[monthIdx]} {year}
          </span>
          <button onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-brand-muted transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        {/* Leyenda */}
        <div className="flex items-center gap-4 bg-white border border-brand-border rounded-xl px-4 py-2 shadow-sm text-xs font-body">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded" style={{ background: CORAL }} />
            <span className="text-brand-muted">En vacaciones</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-amber-200" />
            <span className="text-brand-muted">Superposición !</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-gray-100" />
            <span className="text-brand-muted">Fin de semana</span>
          </div>
        </div>
      </div>

      {/* Grid Gantt */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: NAVY }} className="px-5 py-3 flex items-center justify-between">
          <p className="text-white text-sm font-bold font-head">
            CALENDARIO — {MONTH_NAMES[monthIdx].toUpperCase()} {year}
          </p>
          {overlapDays.size > 0 && (
            <span className="text-xs font-semibold font-body bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full">
              {overlapDays.size} día{overlapDays.size > 1 ? 's' : ''} con superposicion
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: `${180 + daysInMonth * 26}px` }}>
            <thead>
              <tr style={{ background: '#f5ede9' }}>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest border-b border-r border-brand-border sticky left-0 z-10 min-w-44"
                  style={{ color: NAVY, background: '#f5ede9' }}>
                  Empleado
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const dow = new Date(year, monthIdx, day).getDay()
                  const isWeekend = dow === 0 || dow === 6
                  const isOverlap = overlapDays.has(day)
                  return (
                    <th key={day}
                      className="py-1 text-center border-b border-brand-border font-body"
                      style={{
                        minWidth: '26px',
                        color: isOverlap ? '#b45309' : isWeekend ? '#aaa' : NAVY,
                        background: isOverlap ? '#fef9c3' : '#f5ede9',
                        fontWeight: isOverlap ? 800 : 600,
                      }}>
                      <div className="text-[10px]">{day}</div>
                      <div style={{ color: isWeekend ? '#ccc' : CORAL, fontSize: '8px' }}>
                        {DAY_NAMES[dow]}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {activeEmps.length > 0
                ? renderGrid(activeEmps)
                : (
                  <tr>
                    <td colSpan={daysInMonth + 1}
                      className="px-5 py-10 text-center text-brand-muted font-body text-sm">
                      No hay vacaciones registradas en {MONTH_NAMES[monthIdx]} {year}.
                      <br />
                      <span className="text-xs">Agregá solicitudes desde la pestaña Vacaciones.</span>
                    </td>
                  </tr>
                )
              }
              {/* Separador si hay empleados sin vacaciones */}
              {activeEmps.length > 0 && inactiveEmps.length > 0 && (
                <tr>
                  <td colSpan={daysInMonth + 1}
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-muted border-t border-b border-brand-border font-body"
                    style={{ background: '#f8f7f5' }}>
                    Sin vacaciones este mes
                  </td>
                </tr>
              )}
              {inactiveEmps.length > 0 && renderGrid(inactiveEmps, true)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen del mes */}
      {activeEmps.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {activeEmps.map(emp => {
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
              .filter(d => getLog(emp.id, d)).length
            const color = empColor(emp.name)
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-brand-border px-4 py-3 shadow-sm"
                style={{ borderLeft: `4px solid ${color}` }}>
                <p className="text-xs font-semibold font-body text-gray-700 truncate">{emp.name}</p>
                <p className="text-2xl font-bold font-head mt-0.5" style={{ color }}>
                  {days}
                </p>
                <p className="text-[10px] text-brand-muted font-body">días en {MONTH_NAMES[monthIdx]}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 3: SUELDOS — réplica exacta del Excel Luro/Independencia
   Fórmulas:
     Total bruto    = Deposito × 2  (o horas × $xhora, o manual)
     Plus en $      = Total bruto × (Plus − 1)
     Total percibido= (Total bruto × Plus) − Adelantos − Deposito
───────────────────────────────────────────────────────────── */
type SueldosVista = 'luro' | 'independencia' | 'ambas' | 'historial'

function SueldosTab() {
  const [month,          setMonth]          = useState(MONTHS[CURRENT_MONTH_IDX])
  const [year]                              = useState(CURRENT_YEAR)
  const [periods,        setPeriods]        = useState<any[]>([])
  const [historyPeriods, setHistoryPeriods] = useState<any[]>([])
  const [creating,       setCreating]       = useState(false)
  const [vista,          setVista]          = useState<SueldosVista>('luro')
  const [histExpanded,   setHistExpanded]   = useState<number | null>(null)
  // Estado de edición local — actualiza los cálculos sin esperar al servidor
  const [localEdits, setLocalEdits] = useState<Record<number, Record<string, any>>>({})

  const load = useCallback(() => {
    api.get<any[]>(`/payroll/periods?year=${year}`).then(setPeriods)
    // No limpiar localEdits acá: si el usuario está tipando en otro campo
    // mientras se guarda el anterior, los valores locales se perderían.
    // localEdits se resetea solo cuando cambia el mes (useEffect de month).
  }, [year])

  const loadHistory = useCallback(() => {
    api.get<any[]>('/payroll/periods').then(setHistoryPeriods)
  }, [])

  // Limpiar edits locales solo cuando cambia el mes seleccionado
  useEffect(() => { setLocalEdits({}) }, [month])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (vista === 'historial') loadHistory() }, [vista, loadHistory])

  const getPeriod = (branchId: number) =>
    periods.find(p => p.branch_id === branchId && p.month === month && p.year === year)

  /* Devuelve el item fusionado con las ediciones locales en curso */
  const merged = (item: any) => ({ ...item, ...(localEdits[item.id] ?? {}) })

  /* Actualiza un campo en el estado local INMEDIATAMENTE (para cálculos en vivo) */
  const setField = (itemId: number, field: string, val: any) =>
    setLocalEdits(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), [field]: val },
    }))

  const createPeriod = async (branchId: number) => {
    setCreating(true)
    try {
      await api.post(`/payroll/periods?month=${month}&year=${year}&branch_id=${branchId}`, {})
      load()
    } finally { setCreating(false) }
  }

  /* Guarda al servidor cuando el usuario sale del campo (onBlur) */
  const saveItem = async (itemId: number, item: any) => {
    const m = merged(item)
    await api.put(`/payroll/items/${itemId}`, {
      employee_id:        m.employee_id,
      inasistencias_desc: m.inasistencias_desc || null,
      adelanto:           parseFloat(m.adelanto)       || 0,
      deposito_banco:     parseFloat(m.deposito_banco) || 0,
      horas:              m.horas        ? parseFloat(m.horas)        : null,
      precio_hora:        m.precio_hora  ? parseFloat(m.precio_hora)  : null,
      plus_factor:        m.plus_factor  ? parseFloat(m.plus_factor)  : null,
      bruto_manual:       m.bruto_manual ? parseFloat(m.bruto_manual) : null,
      comision:           m.comision     ? parseFloat(m.comision)     : null,
      comision_desc:      m.comision_desc || null,
    })
    load()
  }

  const closePeriod = async (periodId: number) => {
    if (!confirm('¿Cerrar esta liquidación? No se podrán hacer cambios.')) return
    await api.post(`/payroll/periods/${periodId}/close`, {})
    load()
  }

  /* ── Generación de PDF client-side (sin depender del servidor) ── */
  const fmtARS = (n: number) =>
    `$ ${Math.round(n).toLocaleString('es-AR')}`

  const pdfCSS = `
    @page { margin: 1cm; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #222; margin: 0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `

  /* ── Construye el HTML de un recibo individual — formato exacto de las tarjetas ── */
  const buildPayslipCard = (item: any, branchName: string) => {
    const m    = merged(item)
    const h    = parseFloat(m.horas)        || 0
    const ph   = parseFloat(m.precio_hora)  || 0
    const bm   = parseFloat(m.bruto_manual) || 0
    const dep  = parseFloat(m.deposito_banco) || 0
    const adel = parseFloat(m.adelanto)     || 0
    const pf   = parseFloat(m.plus_factor)  || 0
    const com  = parseFloat(m.comision)     || 0
    const comLabel = m.comision_desc || 'Comisión'
    const plusP = calcPlusP(m)
    const bruto = calcBruto(m)
    const perc  = calcPerc(m)

    const isHours  = h > 0 && ph > 0
    const isManual = bm !== 0
    const isStd    = !isHours && !isManual

    const $ = (n: number) => fmtARS(n)
    const ln = (label: string, val: string, style = '') =>
      `<tr><td class="lbl" style="${style}">${label}</td><td class="val" style="${style}">${val}</td></tr>`

    /* ── Líneas de ingresos ── */
    let incomeRows = ''
    if (isHours) {
      incomeRows += ln('Horas', h.toLocaleString('es-AR'))
      incomeRows += ln('Valor', $(ph))
    } else if (isManual) {
      incomeRows += ln('Sueldo', $(bm))
    } else {
      incomeRows += ln('Sueldo', $(dep * 2))
    }
    if (com > 0)  incomeRows += ln(comLabel, $(com))
    if (plusP > 0) incomeRows += ln('Plus', $(plusP))

    /* ── ¿Mostrar fila "total"? Solo si hay más de un concepto de ingreso ── */
    const showTotal = plusP > 0 || com > 0 || isHours
    const totalRow  = showTotal ? ln('total', $(bruto), 'font-weight:bold;border-top:2px solid #ccc;padding-top:6px') : ''

    /* ── Líneas de deducciones ── */
    let deductRows = ''
    if (isStd && dep > 0) deductRows += ln('Depósito', $(dep))
    deductRows += ln('Adelanto', adel > 0 ? $(adel) : '$ —')

    /* ── Inasistencias ── */
    const inaRow = m.inasistencias_desc
      ? `<tr><td class="lbl" style="color:#b91c1c;font-size:8pt" colspan="2">Inasistencias: ${m.inasistencias_desc}</td></tr><tr><td colspan="2" style="padding:2px"></td></tr>`
      : ''

    return `
<div class="card">
  <div class="hdr">
    <div class="co">SUR MADERAS</div>
    <div class="doc">RECIBO DE SUELDO &nbsp;·&nbsp; ${branchName}</div>
    <div class="emp">${m.employee_name}</div>
    <div class="per">${month} ${year}</div>
  </div>
  <table class="tbl">
    ${inaRow}
    ${incomeRows}
    ${totalRow}
    <tr><td colspan="2" class="sep"></td></tr>
    ${deductRows}
    <tr><td colspan="2" class="sep"></td></tr>
    <tr class="perc-row">
      <td class="lbl">Percibido</td>
      <td class="val">${$(perc)}</td>
    </tr>
  </table>
  <div class="firmas">
    <div class="firma">Firma empleado</div>
    <div class="firma">Fecha</div>
  </div>
</div>`
  }

  const PAYSLIP_CSS = `
${pdfCSS}
.card{border:1px solid #d1cec9;border-radius:4px;overflow:hidden;width:300px;margin:16px auto;page-break-inside:avoid;font-size:9.5pt}
.hdr{background:#1E2B1A;color:#fff;padding:12px 14px}
.co{font-size:11pt;font-weight:bold;letter-spacing:1px}
.doc{font-size:7.5pt;color:rgba(255,255,255,.45);margin-top:1px}
.emp{font-size:12pt;font-weight:bold;color:#C4875A;margin-top:6px}
.per{font-size:8pt;color:rgba(255,255,255,.4);margin-top:2px}
.tbl{width:100%;border-collapse:collapse;padding:0 14px}
.tbl td{padding:4px 14px}
.lbl{color:#444;width:65%}
.val{text-align:right;font-weight:600;color:#111;width:35%}
.sep{height:1px;background:#e5e2dd;padding:0}
.perc-row .lbl{font-weight:bold;font-size:11pt;color:#1E2B1A;padding-top:7px;padding-bottom:7px}
.perc-row .val{font-weight:bold;font-size:11pt;color:#C4875A;padding-top:7px;padding-bottom:7px}
.firmas{display:flex;gap:12px;padding:10px 14px 12px;border-top:1px solid #e5e2dd}
.firma{flex:1;border-top:1px solid #aaa;padding-top:3px;font-size:7pt;color:#888;text-align:center}
`

  /* Recibo individual de un empleado */
  const printPayslip = (item: any, branchName: string) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Recibo — ${merged(item).employee_name}</title>
<style>${PAYSLIP_CSS}</style></head><body>
${buildPayslipCard(item, branchName)}
<script>window.onload=function(){window.print()}</script>
</body></html>`
    const win = window.open('', '_blank', 'width=480,height=720')
    if (win) { win.document.write(html); win.document.close() }
  }

  /* Planilla completa de una sucursal (todos los empleados) */
  const printPlanilla = (period: any, branchName: string) => {
    if (!period) return
    const items: any[] = period.items ?? []
    const totBruto = items.reduce((a: number, i: any) => a + calcBruto(merged(i)), 0)
    const totPerc  = items.reduce((a: number, i: any) => a + calcPerc(merged(i)),  0)

    const rows = items.map((item, idx) => {
      const m = merged(item)
      const pct = factorToPct(m.plus_factor)
      const com = parseFloat(m.comision) || 0
      return `<tr style="background:${idx%2===0?'#fff':'#fafaf8'}">
        <td style="text-align:center;color:#C4875A;font-weight:bold">${idx+1}</td>
        <td>${m.employee_name}</td>
        <td>${m.inasistencias_desc||'—'}</td>
        <td style="text-align:right">${parseFloat(m.adelanto)>0?fmtARS(parseFloat(m.adelanto)):'—'}</td>
        <td style="text-align:right">${parseFloat(m.deposito_banco)>0?fmtARS(parseFloat(m.deposito_banco)):'—'}</td>
        <td style="text-align:right">${com>0?fmtARS(com):'—'}</td>
        <td style="text-align:center">${pct?pct+'%':'—'}</td>
        <td style="text-align:right">${calcPlusP(m)>0?fmtARS(calcPlusP(m)):'—'}</td>
        <td style="text-align:right;background:#FFFBEB;color:#92400E;font-weight:bold">${fmtARS(calcBruto(m))}</td>
        <td style="text-align:right;background:#ECFDF5;color:#065F46;font-weight:bold">${fmtARS(calcPerc(m))}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Sueldos ${branchName} ${month} ${year}</title>
<style>${pdfCSS}
h1{color:#1E2B1A;font-size:14pt;margin-bottom:4px}
p{color:#666;font-size:9pt;margin:0 0 12px}
table{width:100%;border-collapse:collapse}
th{background:#1E2B1A;color:#fff;padding:6px 8px;font-size:8pt;text-align:left}
td{padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt}
.tot td{background:#1E2B1A;color:#fff;font-weight:bold}
</style></head><body>
<h1>Liquidación de Sueldos — ${branchName}</h1>
<p>${month} ${year}</p>
<table>
<thead><tr>
  <th>N°</th><th>Empleado</th><th>Inasistencias</th>
  <th style="text-align:right">Adelantos</th><th style="text-align:right">Dep. Banco</th>
  <th style="text-align:right">Comisión</th><th style="text-align:center">Plus</th>
  <th style="text-align:right">Plus $</th>
  <th style="text-align:right;background:#92400E">Total Bruto</th>
  <th style="text-align:right;background:#065F46">Total Percibido</th>
</tr></thead>
<tbody>${rows}
<tr class="tot">
  <td colspan="8">TOTALES</td>
  <td style="text-align:right">${fmtARS(totBruto)}</td>
  <td style="text-align:right">${fmtARS(totPerc)}</td>
</tr></tbody></table>
<script>window.onload=function(){window.print()}</script>
</body></html>`
    const win = window.open('', '_blank', 'width=1000,height=700')
    if (win) { win.document.write(html); win.document.close() }
  }

  /* Todos los recibos de una sucursal en una sola ventana */
  const printAllPayslips = (period: any, branchName: string) => {
    if (!period) return
    const items: any[] = period.items ?? []
    const cards = items.map(item => buildPayslipCard(item, branchName)).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Recibos ${branchName} ${month} ${year}</title>
<style>${PAYSLIP_CSS}</style></head><body>
${cards}
<script>window.onload=function(){window.print()}</script>
</body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  const VISTA_BTNS: { id: SueldosVista; label: string }[] = [
    { id: 'luro',          label: 'Luro'          },
    { id: 'independencia', label: 'Independencia' },
    { id: 'ambas',         label: 'Ambas'         },
    { id: 'historial',     label: 'Historial'     },
  ]

  const calcBruto = (m: any): number => {
    const pf     = parseFloat(m.plus_factor)  || 0
    const factor = pf > 1 ? pf : 1.0
    const com    = parseFloat(m.comision)      || 0
    // 1. Por horas — sin plus, más comisión si hay
    const h  = parseFloat(m.horas)        || 0
    const ph = parseFloat(m.precio_hora)  || 0
    if (h > 0 && ph > 0) return h * ph + com
    // 2. Sueldo base manual (Patricia) — plus sobre la base, más comisión
    const bm = parseFloat(m.bruto_manual) || 0
    if (bm !== 0) return bm * factor + com
    // 3. Estándar — dep×2 siempre, factor aplica el plus, más comisión
    const dep = parseFloat(m.deposito_banco) || 0
    return dep * 2 * factor + com
  }

  const calcPlusP = (m: any): number => {
    const pf = parseFloat(m.plus_factor) || 0
    if (pf <= 1) return 0
    // Por horas: sin plus
    const h  = parseFloat(m.horas)       || 0
    const ph = parseFloat(m.precio_hora) || 0
    if (h > 0 && ph > 0) return 0
    // Sueldo base manual: plus sobre la base (sin comisión)
    const bm = parseFloat(m.bruto_manual) || 0
    if (bm !== 0) return bm * (pf - 1)
    // Estándar: plus sobre dep × 2 (sin comisión)
    const dep = parseFloat(m.deposito_banco) || 0
    return dep * 2 * (pf - 1)
  }

  const calcPerc = (m: any): number => {
    const bruto   = calcBruto(m)
    const adelanto = parseFloat(m.adelanto) || 0
    // Por horas o sueldo base: solo se resta el adelanto
    const h  = parseFloat(m.horas)        || 0
    const ph = parseFloat(m.precio_hora)  || 0
    const bm = parseFloat(m.bruto_manual) || 0
    if ((h > 0 && ph > 0) || bm !== 0) return bruto - adelanto
    // Estándar: se restan depósito y adelanto
    const dep = parseFloat(m.deposito_banco) || 0
    return bruto - dep - adelanto
  }

  /* Convierte factor almacenado (1.30) → porcentaje para mostrar (30) */
  const factorToPct = (pf: any): string => {
    const f = parseFloat(pf) || 0
    return f > 1 ? String(Math.round((f - 1) * 100)) : ''
  }

  /* ── Render single-branch full table ── */
  const renderBranchTable = (branchId: number, branchName: string) => {
    const period   = getPeriod(branchId)
    const items    = period?.items ?? []
    const isClosed = period?.status === 'CLOSED'

    // Totals usando items mergeados con ediciones locales
    const totBruto = items.reduce((a: number, i: any) => a + calcBruto(merged(i)), 0)
    const totPlusP = items.reduce((a: number, i: any) => a + calcPlusP(merged(i)), 0)
    const totPerc  = items.reduce((a: number, i: any) => a + calcPerc(merged(i)),  0)

    const TH = ({ children, right = false, style = {}, title }: { children: React.ReactNode; right?: boolean; style?: React.CSSProperties; title?: string }) => (
      <th title={title} className={`px-2.5 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b border-gray-200 ${right ? 'text-right' : 'text-left'}`}
        style={{ color: NAVY, background: '#f0eeeb', ...style }}>
        {children}
      </th>
    )

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Branch header */}
        <div style={{ background: branchId === 1 ? NAVY : CORAL }}
          className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-white text-sm font-bold font-head tracking-wide">{branchName}</p>
            <p className="text-white/55 text-[11px] font-body">
              {branchId === 1 ? 'Convenio Madereros' : 'Convenio SEC 12'} · {month} {year}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!period && (
              <button onClick={() => createPeriod(branchId)} disabled={creating}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                <Plus size={12} /> Abrir Mes
              </button>
            )}
            {period && !isClosed && (
              <button onClick={() => closePeriod(period.id)}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                <Lock size={12} /> Cerrar
              </button>
            )}
            {period && (
              <>
                <button onClick={() => printPlanilla(period, branchName)}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                  <FileDown size={12} /> Planilla PDF
                </button>
                <button onClick={() => printAllPayslips(period, branchName)}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                  <FileDown size={12} /> Todos los recibos
                </button>
              </>
            )}
          </div>
        </div>

        {period ? (
          <div className="overflow-x-auto">
            {/*
              Columnas exactas del Excel:
              Luro:  Empleado | Inasistencias | Adelantos | Deposito | Horas | $×Hora | Plus | Plus $ | Total Bruto | Total Percibido
              Indep: Empleado | Inasistencias | Adelantos | Deposito | Horas |         Plus | Plus $ | Total Bruto | Total Percibido
            */}
            <table className="w-full min-w-[960px] text-sm border-collapse">
              <thead>
                <tr>
                  <TH style={{ width: 28, textAlign: 'center' }}>N°</TH>
                  <TH>Empleado</TH>
                  <TH>Inasistencias</TH>
                  <TH right>Adelantos</TH>
                  <TH right>Dep. Banco</TH>
                  <TH right style={{ width: 70 }}>Horas</TH>
                  {branchId === 1 && <TH right style={{ width: 80 }}>$ × Hora</TH>}
                  <TH right style={{ width: 90 }} title="Sueldo base fijo (Patricia). El plus se aplica sobre este monto.">Sueldo Base</TH>
                  <TH right style={{ width: 100 }} title="Comisión, incentivo o horas extra. La descripción aparece en el recibo.">Comisión</TH>
                  <TH right style={{ width: 60 }} title="Porcentaje de plus sobre el bruto (ej: 30 = 30%)">Plus %</TH>
                  <TH right style={{ background: '#FFF8E1', color: '#92400E' }}>Plus $</TH>
                  <TH right style={{ background: '#FFF3CD', color: '#92400E' }}>Total Bruto</TH>
                  <TH right style={{ background: '#D1FAE5', color: '#065F46' }}>Total Percibido</TH>
                  <TH style={{ width: 32 }}>{''}</TH>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => {
                  const m         = merged(item)   // item + ediciones locales en curso
                  const liveBruto = calcBruto(m)
                  const livePlusP = calcPlusP(m)
                  const livePerc  = calcPerc(m)
                  return (
                    <tr key={item.id} style={{ background: i % 2 === 0 ? 'white' : '#fafaf8' }}>
                      {/* N° */}
                      <td className="px-2 py-1.5 text-center text-[11px] font-bold font-body" style={{ color: CORAL }}>{i + 1}</td>
                      {/* Empleado */}
                      <td className="px-3 py-1.5 text-xs font-semibold font-body text-gray-800 whitespace-nowrap">{m.employee_name}</td>
                      {/* Inasistencias — texto libre */}
                      <td className="px-2 py-1.5">
                        <TextInput disabled={isClosed} value={m.inasistencias_desc} placeholder="—"
                          onChange={v => setField(item.id, 'inasistencias_desc', v || null)}
                          onBlur={_v => saveItem(item.id, item)} />
                      </td>
                      {/* Adelantos */}
                      <td className="px-2 py-1.5">
                        <NumInput disabled={isClosed} value={m.adelanto}
                          onChange={v => setField(item.id, 'adelanto', v)}
                          onBlur={_v => saveItem(item.id, item)} />
                      </td>
                      {/* Deposito banco */}
                      <td className="px-2 py-1.5">
                        <NumInput disabled={isClosed} value={m.deposito_banco}
                          onChange={v => setField(item.id, 'deposito_banco', v)}
                          onBlur={_v => saveItem(item.id, item)} />
                      </td>
                      {/* Horas */}
                      <td className="px-2 py-1.5">
                        <NumInput disabled={isClosed} value={m.horas} step={0.5}
                          onChange={v => setField(item.id, 'horas', v)}
                          onBlur={_v => saveItem(item.id, item)} />
                      </td>
                      {/* $ × Hora — solo Luro */}
                      {branchId === 1 && (
                        <td className="px-2 py-1.5">
                          <NumInput disabled={isClosed} value={m.precio_hora}
                            onChange={v => setField(item.id, 'precio_hora', v)}
                            onBlur={_v => saveItem(item.id, item)} />
                        </td>
                      )}
                      {/* Sueldo Base — para empleados con sueldo fijo (Patricia) */}
                      <td className="px-2 py-1.5">
                        <NumInput disabled={isClosed} value={m.bruto_manual}
                          onChange={v => setField(item.id, 'bruto_manual', v)}
                          onBlur={_v => saveItem(item.id, item)} />
                      </td>
                      {/* Comisión — monto + etiqueta para el recibo (stacked) */}
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col gap-0.5">
                          <NumInput disabled={isClosed} value={m.comision}
                            onChange={v => setField(item.id, 'comision', v)}
                            onBlur={_v => saveItem(item.id, item)} />
                          {(parseFloat(m.comision) > 0 || m.comision_desc) && (
                            <TextInput disabled={isClosed}
                              value={m.comision_desc} placeholder="Desc. recibo"
                              onChange={v => setField(item.id, 'comision_desc', v || null)}
                              onBlur={_v => saveItem(item.id, item)} />
                          )}
                        </div>
                      </td>
                      {/* Plus % — el usuario ingresa 30 (= 30%), guardamos factor 1.30 */}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-0.5">
                          <NumInput
                            disabled={isClosed}
                            value={factorToPct(m.plus_factor)}
                            step={5}
                            integer
                            onChange={v => {
                              const pct = parseFloat(v)
                              setField(item.id, 'plus_factor',
                                !isNaN(pct) && pct > 0 ? (1 + pct / 100) : null)
                            }}
                            onBlur={_v => saveItem(item.id, item)}
                          />
                          <span className="text-[10px] text-gray-400 select-none">%</span>
                        </div>
                      </td>
                      {/* Plus $ — calculado en vivo */}
                      <td className="px-3 py-1.5 text-xs text-right font-body whitespace-nowrap"
                        style={{ background: '#FFFDE7', color: '#78350F' }}>
                        {livePlusP > 0 ? fmt$(livePlusP) : '—'}
                      </td>
                      {/* Total bruto — calculado en vivo, fondo amarillo */}
                      <td className="px-3 py-1.5 text-xs text-right font-bold font-body whitespace-nowrap"
                        style={{ background: '#FFFBEB', color: '#92400E' }}>
                        {fmt$(liveBruto)}
                      </td>
                      {/* Total percibido — calculado en vivo, fondo verde */}
                      <td className="px-3 py-1.5 text-xs text-right font-bold font-body whitespace-nowrap"
                        style={{ background: '#ECFDF5', color: '#065F46' }}>
                        {fmt$(livePerc)}
                      </td>
                      {/* PDF recibo individual — client-side */}
                      <td className="px-2 py-1.5 text-center">
                        <button title="Imprimir recibo individual"
                          onClick={() => printPayslip(item, branchName)}
                          className="text-gray-300 transition-colors"
                          onMouseOver={e => (e.currentTarget.style.color = CORAL)}
                          onMouseOut={e => (e.currentTarget.style.color = '#d1d5db')}>
                          <FileDown size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {/* Fila TOTALES */}
                <tr style={{ background: NAVY }}>
                  <td colSpan={branchId === 1 ? 10 : 9}
                    className="px-3 py-2.5 text-white text-[11px] font-bold uppercase tracking-widest">
                    TOTALES
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: '#FCD34D' }}>
                    {totPlusP > 0 ? fmt$(totPlusP) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: '#FCD34D' }}>
                    {fmt$(totBruto)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-green-300">
                    {fmt$(totPerc)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>

            <p className="px-4 py-2 text-[10px] text-gray-400 font-body border-t border-gray-100">
              Estándar: Bruto = Dep.×2 + Plus$ · Plus$ = Dep.×2×(Plus%) · Percibido = Bruto − Dep. − Adelantos ·
              Sueldo base: Bruto = Base + Plus$ · Percibido = Bruto − Adelantos ·
              Por horas: Bruto = Horas × $×Hora · Percibido = Bruto − Adelantos
            </p>
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-gray-400 text-sm font-body">
            No hay liquidación para {month} {year}.{' '}
            <button onClick={() => createPeriod(branchId)} className="font-semibold hover:underline" style={{ color: CORAL }}>
              Abrir mes
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ── "Ambas" — PLANILLA SUELDOS consolidada ── */
  const renderAmbasView = () => {
    const periodLuro  = getPeriod(1)
    const periodIndep = getPeriod(2)
    const allItems = [
      ...(periodLuro?.items  ?? []).map((i: any) => ({ ...i, _branch: 'LURO'          })),
      ...(periodIndep?.items ?? []).map((i: any) => ({ ...i, _branch: 'INDEPENDENCIA' })),
    ]
    const totBruto = allItems.reduce((a, i) => a + calcBruto(merged(i)), 0)
    const totPlusP = allItems.reduce((a, i) => a + calcPlusP(merged(i)), 0)
    const totPerc  = allItems.reduce((a, i) => a + calcPerc(merged(i)),  0)

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: NAVY }} className="px-5 py-3">
          <p className="text-white text-sm font-bold font-head tracking-wide">PLANILLA SUELDOS — AMBAS SUCURSALES</p>
          <p className="text-white/50 text-[11px] font-body">{month} {year}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm border-collapse">
            <thead>
              <tr style={{ background: '#f0eeeb' }}>
                {[
                  { label: 'N°',         cls: 'w-8 text-center'  },
                  { label: 'Empleado',   cls: 'text-left'         },
                  { label: 'Sucursal',   cls: 'text-left'         },
                  { label: 'Dep. Banco', cls: 'text-right'        },
                  { label: 'Plus',       cls: 'text-right'        },
                  { label: 'Plus $',     cls: 'text-right'        },
                  { label: 'Total Bruto',cls: 'text-right'        },
                  { label: 'Percibido',  cls: 'text-right'        },
                  { label: '',           cls: 'w-8'               },
                ].map(({ label, cls }) => (
                  <th key={label} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b border-gray-200 ${cls}`}
                    style={{ color: NAVY, background: '#f0eeeb' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allItems.map((item, i) => {
                const m = merged(item)
                return (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? 'white' : '#fafaf8' }}>
                    <td className="px-3 py-2 text-center text-[11px] font-bold font-body" style={{ color: CORAL }}>{i + 1}</td>
                    <td className="px-3 py-2 text-xs font-semibold font-body text-gray-800 whitespace-nowrap">{m.employee_name}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                        style={{ background: m._branch === 'LURO' ? NAVY : CORAL }}>
                        {m._branch}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-body text-gray-600 whitespace-nowrap">
                      {parseFloat(m.deposito_banco) > 0 ? fmt$(m.deposito_banco) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-body text-gray-600 whitespace-nowrap">
                      {factorToPct(m.plus_factor) ? `+${factorToPct(m.plus_factor)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-body whitespace-nowrap" style={{ color: '#78350F' }}>
                      {calcPlusP(m) > 0 ? fmt$(calcPlusP(m)) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-bold font-body whitespace-nowrap"
                      style={{ background: '#FFFBEB', color: '#92400E' }}>
                      {fmt$(calcBruto(m))}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-bold font-body whitespace-nowrap"
                      style={{ background: '#ECFDF5', color: '#065F46' }}>
                      {fmt$(calcPerc(m))}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button title="Imprimir recibo"
                        onClick={() => printPayslip(item, m._branch === 'LURO' ? 'LURO' : 'INDEPENDENCIA')}
                        className="text-gray-300 transition-colors"
                        onMouseOver={e => (e.currentTarget.style.color = CORAL)}
                        onMouseOut={e => (e.currentTarget.style.color = '#d1d5db')}>
                        <FileDown size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {allItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm font-body">
                    No hay liquidaciones abiertas para {month} {year}.
                  </td>
                </tr>
              )}
              {allItems.length > 0 && (
                <tr style={{ background: NAVY }}>
                  <td colSpan={5} className="px-3 py-2.5 text-white text-[11px] font-bold uppercase tracking-widest">TOTAL GENERAL</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: '#FCD34D' }}>{totPlusP > 0 ? fmt$(totPlusP) : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: '#FCD34D' }}>{fmt$(totBruto)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-green-300">{fmt$(totPerc)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Controls: month selector + vista switcher */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-body focus:outline-none bg-white shadow-sm">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <span className="text-sm text-gray-500 font-body">{year}</span>

        {/* Vista selector */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 shadow-sm ml-auto">
          {VISTA_BTNS.map(({ id, label }) => (
            <button key={id} onClick={() => setVista(id)}
              className="px-4 py-2 text-xs font-semibold font-body transition-all"
              style={vista === id
                ? { background: NAVY, color: 'white' }
                : { background: 'white', color: '#666' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {vista === 'luro'          && renderBranchTable(1, 'LURO')}
      {vista === 'independencia' && renderBranchTable(2, 'INDEPENDENCIA')}
      {vista === 'ambas'         && renderAmbasView()}
      {vista === 'historial'     && renderHistorial()}

      {/* Panel Resumen de Pagos — visible en todas las vistas excepto historial */}
      {vista !== 'historial' && renderResumenPagos()}
    </div>
  )

  /* ── Resumen de Pagos (banco + efectivo) ── */
  function renderResumenPagos() {
    // Unir items de ambas sucursales para el mes seleccionado
    const luroPeriod  = getPeriod(1)
    const indepPeriod = getPeriod(2)
    const allItems: any[] = [
      ...(luroPeriod?.items  ?? []),
      ...(indepPeriod?.items ?? []),
    ]
    if (allItems.length === 0) return null

    const empName = (item: any) => (item.employee_name ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

    // ── Banco ────────────────────────────────────────────────────────────
    // Usar deposito_banco para la mayoría; total_percibido para Avila.
    // Excluir explícitamente a Vivas.
    const isBankEmployee = (n: string) =>
      n.includes('vazquez') ||
      (n.includes('vila') && n.includes('cecilia')) ||
      (n.includes('viejo') && n.includes('marcelo')) ||
      n.includes('lalli') ||
      n.includes('ponasso') ||
      n.includes('salinas') ||
      n.includes('avila')

    const bankItems = allItems.filter(item => isBankEmployee(empName(item)))

    const bankLines = bankItems.map(item => {
      const m = merged(item)
      const n = empName(item)
      const usesPercibido = n.includes('avila')
      const amount = usesPercibido ? calcPerc(m) : (parseFloat(m.deposito_banco) || 0)
      return { name: item.employee_name, amount, note: usesPercibido ? 'percibido' : 'depósito' }
    })
    const bankTotal = bankLines.reduce((s, l) => s + l.amount, 0)

    // ── Efectivo ─────────────────────────────────────────────────────────
    // Usar total_percibido para todos.
    const isCashEmployee = (n: string) =>
      n.includes('vazquez') ||
      (n.includes('vila') && n.includes('cecilia')) ||
      (n.includes('viejo') && n.includes('marcelo')) ||
      n.includes('lalli') ||
      n.includes('scatizzi') ||
      n.includes('zicavo') ||
      n.includes('rojo')

    const cashItems = allItems.filter(item => isCashEmployee(empName(item)))

    const cashLines = cashItems.map(item => {
      const m = merged(item)
      return { name: item.employee_name, amount: calcPerc(m) }
    })
    const cashTotal = cashLines.reduce((s, l) => s + l.amount, 0)

    const LineItem = ({ label, amount, note }: { label: string; amount: number; note?: string }) => (
      <div className="flex items-baseline justify-between py-1 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-500 font-body flex items-center gap-1.5">
          {label}
          {note && <span className="text-[9px] text-gray-300 italic">{note}</span>}
        </span>
        <span className="text-xs font-semibold text-gray-700 font-body tabular-nums">{fmtARS(amount)}</span>
      </div>
    )

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div style={{ background: NAVY }} className="px-5 py-3">
          <p className="text-white text-sm font-bold font-head tracking-wide">
            RESUMEN DE PAGOS — {month} {year}
          </p>
          <p className="text-white/45 text-[11px] font-body mt-0.5">
            Montos necesarios para liquidar el mes
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">

          {/* Banco */}
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 font-body mb-1">
              Necesario en Banco
            </p>
            <p className="text-2xl font-bold font-head mb-4" style={{ color: NAVY }}>
              {fmtARS(bankTotal)}
            </p>
            <div className="space-y-0.5">
              {bankLines.map((l, i) => (
                <LineItem key={i} label={l.name} amount={l.amount} note={l.note} />
              ))}
              {bankLines.length === 0 && (
                <p className="text-xs text-gray-400 font-body">Sin datos para este mes.</p>
              )}
            </div>
          </div>

          {/* Efectivo */}
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 font-body mb-1">
              Necesario en Efectivo
            </p>
            <p className="text-2xl font-bold font-head mb-4" style={{ color: CORAL }}>
              {fmtARS(cashTotal)}
            </p>
            <div className="space-y-0.5">
              {cashLines.map((l, i) => (
                <LineItem key={i} label={l.name} amount={l.amount} />
              ))}
              {cashLines.length === 0 && (
                <p className="text-xs text-gray-400 font-body">Sin datos para este mes.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    )
  }

  /* ── Vista Historial ── */
  function renderHistorial() {
    const MONTH_ORDER = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
    // Agrupar por año desc
    const byYear: Record<number, any[]> = {}
    historyPeriods.forEach(p => {
      if (!byYear[p.year]) byYear[p.year] = []
      byYear[p.year].push(p)
    })
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

    if (years.length === 0) return (
      <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm shadow-sm">
        No hay períodos registrados todavía.
      </div>
    )

    return (
      <div className="space-y-4">
        {years.map(yr => (
          <div key={yr} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ background: NAVY }} className="px-5 py-3">
              <p className="text-white font-bold font-head text-sm tracking-wide">{yr}</p>
            </div>
            <div className="p-4 space-y-3">
              {byYear[yr]
                .sort((a, b) => MONTH_ORDER.indexOf(b.month) - MONTH_ORDER.indexOf(a.month))
                .map(period => {
                  const isOpen = histExpanded === period.id
                  const brutoTotal = (period.items ?? []).reduce((s: number, i: any) => s + (i.total_bruto ?? 0), 0)
                  const percTotal  = (period.items ?? []).reduce((s: number, i: any) => s + (i.total_percibido ?? 0), 0)
                  const branchColor = period.branch_id === 1 ? NAVY : CORAL
                  return (
                    <div key={period.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* Header de período */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setHistExpanded(isOpen ? null : period.id)}>
                        <span className="px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                          style={{ background: branchColor }}>
                          {period.branch_name}
                        </span>
                        <span className="text-sm font-semibold font-body text-gray-800">
                          {period.month} {period.year}
                        </span>
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${period.status === 'CLOSED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {period.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                        </span>
                        <span className="ml-auto text-xs text-gray-500 font-body">
                          Bruto: <strong style={{ color: '#92400E' }}>{fmtARS(brutoTotal)}</strong>
                          &nbsp;·&nbsp;
                          Percibido: <strong style={{ color: '#065F46' }}>{fmtARS(percTotal)}</strong>
                        </span>
                        <span className="text-gray-400 text-xs ml-2">{isOpen ? '^' : 'v'}</span>
                      </div>
                      {/* Detalle expandible */}
                      {isOpen && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr style={{ background: '#f0eeeb' }}>
                                {['Empleado','Adelanto','Dep. Banco','Comisión','Plus %','Plus $','Total Bruto','Percibido',''].map(h => (
                                  <th key={h} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left border-b border-gray-200"
                                    style={{ color: NAVY }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(period.items ?? []).map((item: any, i: number) => (
                                <tr key={item.id} style={{ background: i % 2 === 0 ? 'white' : '#fafaf8' }}>
                                  <td className="px-3 py-2 font-semibold text-gray-800">{item.employee_name}</td>
                                  <td className="px-3 py-2 text-right">{parseFloat(item.adelanto)>0?fmtARS(parseFloat(item.adelanto)):'—'}</td>
                                  <td className="px-3 py-2 text-right">{parseFloat(item.deposito_banco)>0?fmtARS(parseFloat(item.deposito_banco)):'—'}</td>
                                  <td className="px-3 py-2 text-right">{parseFloat(item.comision)>0?fmtARS(parseFloat(item.comision)):'—'}</td>
                                  <td className="px-3 py-2 text-right">{factorToPct(item.plus_factor)?factorToPct(item.plus_factor)+'%':'—'}</td>
                                  <td className="px-3 py-2 text-right">{item.plus_pesos>0?fmtARS(item.plus_pesos):'—'}</td>
                                  <td className="px-3 py-2 text-right font-bold" style={{ background:'#FFFBEB',color:'#92400E' }}>{fmtARS(item.total_bruto)}</td>
                                  <td className="px-3 py-2 text-right font-bold" style={{ background:'#ECFDF5',color:'#065F46' }}>{fmtARS(item.total_percibido)}</td>
                                  <td className="px-2 py-2 text-center">
                                    <button title="Imprimir recibo" onClick={() => printPayslip(item, period.branch_name)}
                                      className="text-gray-300 hover:text-coral transition-colors"
                                      onMouseOver={e=>(e.currentTarget.style.color=CORAL)}
                                      onMouseOut={e=>(e.currentTarget.style.color='#d1d5db')}>
                                      <FileDown size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
                            <button onClick={() => printAllPayslips(period, period.branch_name)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                              style={{ background: CORAL }}>
                              <FileDown size={12} /> Todos los recibos
                            </button>
                            <button onClick={() => printPlanilla(period, period.branch_name)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                              style={{ background: NAVY }}>
                              <FileDown size={12} /> Planilla PDF
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    )
  }
}

/* ─────────────────────────────────────────────────────────────
   TAB 3: RECIBOS DE SUELDO
───────────────────────────────────────────────────────────── */
function RecibosTab() {
  const [year,      setYear]      = useState(CURRENT_YEAR)
  const [month,     setMonth]     = useState(MONTHS[CURRENT_MONTH_IDX])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [receipts,  setReceipts]  = useState<Receipt[]>([])
  const [uploading, setUploading] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<number | null>(null)

  const load = useCallback(() => {
    api.get<Receipt[]>(`/receipts/?year=${year}&month=${month}`)
      .then(setReceipts).catch(() => setReceipts([]))
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get<Employee[]>('/employees/').then(setEmployees).catch(() => setEmployees([]))
  }, [])

  const triggerUpload = (employeeId: number) => {
    uploadTarget.current = employeeId
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const empId = uploadTarget.current
    if (!file || !empId) return

    setUploading(empId)
    try {
      const fd = new FormData()
      fd.append('employee_id', String(empId))
      fd.append('year',        String(year))
      fd.append('month',       month)
      fd.append('file',        file)
      await api.upload('/receipts/upload', fd)
      load()
    } catch (err: any) {
      alert('Error al subir: ' + err.message)
    } finally {
      setUploading(null)
      uploadTarget.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deleteReceipt = async (id: number) => {
    if (!confirm('¿Eliminar este recibo?')) return
    await api.delete(`/receipts/${id}`)
    load()
  }

  const downloadReceipt = async (id: number, filename: string) => {
    try {
      await api.pdf(`/receipts/${id}/download`, filename)
    } catch (err: any) {
      alert('Error al descargar: ' + err.message)
    }
  }

  const getReceipt = (empId: number) =>
    receipts.find(r => r.employee_id === empId)

  const luro  = employees.filter(e => e.branch_name === 'LURO')
  const indep = employees.filter(e => e.branch_name === 'INDEPENDENCIA')

  const EmployeeRow = ({ emp }: { emp: Employee }) => {
    const receipt = getReceipt(emp.id)
    return (
      <tr className="bg-white border-t border-brand-border hover:bg-gray-50/60 transition-colors">
        <td className="px-5 py-3 text-sm font-semibold font-body text-gray-800">{emp.name}</td>
        <td className="px-4 py-3">
          {receipt ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500 shrink-0" />
              <span className="text-xs text-green-700 font-semibold font-body truncate max-w-40">
                {receipt.filename}
              </span>
            </div>
          ) : (
            <span className="text-xs text-brand-muted font-body flex items-center gap-1.5">
              <Clock size={12} className="text-amber-400" />
              Sin recibo
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-brand-muted font-body">
          {receipt?.uploaded_at
            ? new Date(receipt.uploaded_at).toLocaleDateString('es-AR')
            : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {receipt ? (
              <>
                <button
                  onClick={() => downloadReceipt(receipt.id, receipt.filename)}
                  className="flex items-center gap-1 text-xs font-semibold font-body px-2.5 py-1.5 rounded-lg border border-brand-border hover:bg-gray-50 text-gray-600">
                  <FileDown size={12} /> Ver PDF
                </button>
                <button
                  onClick={() => triggerUpload(emp.id)}
                  disabled={uploading === emp.id}
                  className="flex items-center gap-1 text-xs font-semibold font-body px-2.5 py-1.5 rounded-lg border hover:bg-blue-50 text-blue-600 border-blue-200">
                  <Upload size={12} /> Reemplazar
                </button>
                <button
                  onClick={() => deleteReceipt(receipt.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                  <Trash2 size={13} />
                </button>
              </>
            ) : (
              <button
                onClick={() => triggerUpload(emp.id)}
                disabled={uploading === emp.id}
                style={{ background: uploading === emp.id ? '#ccc' : CORAL }}
                className="flex items-center gap-1.5 text-white text-xs font-semibold font-body px-3 py-1.5 rounded-lg hover:opacity-90">
                {uploading === emp.id
                  ? <><span className="animate-pulse">Subiendo…</span></>
                  : <><Upload size={12} /> Subir recibo</>}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  const pct = employees.length > 0
    ? Math.round((receipts.length / employees.length) * 100)
    : 0

  return (
    <div className="space-y-5">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="application/pdf"
        className="hidden" onChange={handleFileChange} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-brand-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none">
          {ALL_YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="border border-brand-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>

        {/* Progress badge */}
        <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 shadow-sm border border-brand-border">
          <div className="w-20 bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all" style={{ background: CORAL, width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold font-body" style={{ color: CORAL }}>
            {receipts.length}/{employees.length} recibos
          </span>
        </div>
      </div>

      {/* LURO */}
      {luro.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div style={{ background: NAVY }} className="px-5 py-3">
            <p className="text-white text-xs font-bold uppercase tracking-widest font-body">
              Luro · {month} {year}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f7f5' }}>
              <tr>
                {['Empleado', 'Estado', 'Subido el', ''].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border font-body"
                    style={{ color: NAVY }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {luro.map(emp => <EmployeeRow key={emp.id} emp={emp} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* INDEPENDENCIA */}
      {indep.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div style={{ background: CORAL }} className="px-5 py-3">
            <p className="text-white text-xs font-bold uppercase tracking-widest font-body">
              Independencia · {month} {year}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f7f5' }}>
              <tr>
                {['Empleado', 'Estado', 'Subido el', ''].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border font-body"
                    style={{ color: CORAL }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indep.map(emp => <EmployeeRow key={emp.id} emp={emp} />)}
            </tbody>
          </table>
        </div>
      )}

      {employees.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-brand-muted font-body text-sm">
          No hay empleados activos en el sistema.
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 5: DASHBOARD — Metricas de personal
───────────────────────────────────────────────────────────── */
function DashboardTab() {
  const fmtARS = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')

  const [allPeriods,   setAllPeriods]   = useState<any[]>([])
  const [allEmployees, setAllEmployees] = useState<any[]>([])

  useEffect(() => {
    api.get<any[]>('/payroll/periods').then(setAllPeriods).catch(() => setAllPeriods([]))
    api.get<any[]>('/employees/').then(setAllEmployees).catch(() => setAllEmployees([]))
  }, [])

  // Helper to compute bruto and percibido from an item (mirrors SueldosTab logic)
  const calcBruto = (m: any): number => {
    const pf = parseFloat(m.plus_factor) || 0
    const factor = pf > 1 ? pf : 1.0
    const com = parseFloat(m.comision) || 0
    const h  = parseFloat(m.horas) || 0
    const ph = parseFloat(m.precio_hora) || 0
    if (h > 0 && ph > 0) return h * ph + com
    const bm = parseFloat(m.bruto_manual) || 0
    if (bm !== 0) return bm * factor + com
    const dep = parseFloat(m.deposito_banco) || 0
    return dep * 2 * factor + com
  }
  const calcPerc = (m: any): number => {
    const bruto   = calcBruto(m)
    const adelanto = parseFloat(m.adelanto) || 0
    const h  = parseFloat(m.horas) || 0
    const ph = parseFloat(m.precio_hora) || 0
    const bm = parseFloat(m.bruto_manual) || 0
    if ((h > 0 && ph > 0) || bm !== 0) return bruto - adelanto
    const dep = parseFloat(m.deposito_banco) || 0
    return bruto - dep - adelanto
  }

  // Find periods for current and previous month
  const currentMonthName = MONTHS[CURRENT_MONTH_IDX]
  const prevMonthIdx     = CURRENT_MONTH_IDX === 0 ? 11 : CURRENT_MONTH_IDX - 1
  const prevMonthName    = MONTHS[prevMonthIdx]
  const prevYear         = CURRENT_MONTH_IDX === 0 ? CURRENT_YEAR - 1 : CURRENT_YEAR

  const currentPeriods = allPeriods.filter(p => p.month === currentMonthName && p.year === CURRENT_YEAR)
  const prevPeriods    = allPeriods.filter(p => p.month === prevMonthName    && p.year === prevYear)

  const currentItems: any[] = currentPeriods.flatMap(p => (p.items ?? []).map((i: any) => ({ ...i, _branch: p.branch_name })))
  const prevItems:    any[] = prevPeriods.flatMap(p    => (p.items ?? []).map((i: any) => ({ ...i, _branch: p.branch_name })))

  const totalMasaActual = currentItems.reduce((s, i) => s + calcPerc(i), 0)
  const totalMasaPrev   = prevItems.reduce((s, i) => s + calcPerc(i), 0)
  const variacion       = totalMasaPrev > 0 ? ((totalMasaActual - totalMasaPrev) / totalMasaPrev) * 100 : 0
  const avgSueldo       = currentItems.length > 0 ? currentItems.reduce((s, i) => s + calcBruto(i), 0) / currentItems.length : 0
  const totalAdelantos  = currentItems.reduce((s, i) => s + (parseFloat(i.adelanto) || 0), 0)

  // Per-employee evolution
  type EmpStat = {
    id: number; name: string; branch: string
    brutoActual: number; brutoPrev: number
    percActual: number
    varAbs: number; varPct: number
  }

  const empStats: EmpStat[] = currentItems.map(item => {
    const prevItem = prevItems.find((p: any) => p.employee_id === item.employee_id)
    const brutoActual = calcBruto(item)
    const brutoPrev   = prevItem ? calcBruto(prevItem) : 0
    const percActual  = calcPerc(item)
    const varAbs      = brutoActual - brutoPrev
    const varPct      = brutoPrev > 0 ? (varAbs / brutoPrev) * 100 : 0
    return {
      id: item.employee_id,
      name: item.employee_name,
      branch: item._branch,
      brutoActual,
      brutoPrev,
      percActual,
      varAbs,
      varPct,
    }
  })

  // Ranking top 5 by bruto
  const ranking = [...empStats].sort((a, b) => b.brutoActual - a.brutoActual).slice(0, 5)

  // Por sucursal
  const luroItems  = currentItems.filter(i => i._branch === 'LURO')
  const indepItems = currentItems.filter(i => i._branch === 'INDEPENDENCIA')
  const branchStats = [
    {
      name: 'LURO', color: NAVY,
      bruto: luroItems.reduce((s, i) => s + calcBruto(i), 0),
      perc:  luroItems.reduce((s, i) => s + calcPerc(i),  0),
      count: luroItems.length,
    },
    {
      name: 'INDEPENDENCIA', color: CORAL,
      bruto: indepItems.reduce((s, i) => s + calcBruto(i), 0),
      perc:  indepItems.reduce((s, i) => s + calcPerc(i),  0),
      count: indepItems.length,
    },
  ]

  const Card = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-widest font-body mb-1">{label}</p>
      <p className="text-2xl font-bold font-head" style={{ color: color ?? NAVY }}>{value}</p>
      {sub && <p className="text-[11px] text-brand-muted font-body mt-0.5">{sub}</p>}
    </div>
  )

  if (allPeriods.length === 0 && allEmployees.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center text-brand-muted font-body text-sm">
        Cargando datos...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          label="Masa salarial (percibido)"
          value={fmtARS(totalMasaActual)}
          sub={currentMonthName + ' ' + CURRENT_YEAR}
          color={NAVY}
        />
        <Card
          label="Variacion vs mes anterior"
          value={(variacion >= 0 ? '+' : '') + variacion.toFixed(1) + '%'}
          sub={prevMonthName + ' → ' + currentMonthName}
          color={variacion >= 0 ? '#16a34a' : '#dc2626'}
        />
        <Card
          label="Promedio sueldo bruto"
          value={fmtARS(avgSueldo)}
          sub={currentItems.length + ' empleados activos'}
          color={CORAL}
        />
        <Card
          label="Total adelantos del mes"
          value={fmtARS(totalAdelantos)}
          sub="Suma de todos los adelantos"
          color="#78350F"
        />
      </div>

      {/* Evolucion por empleado */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: NAVY }} className="px-5 py-3">
          <p className="text-white text-sm font-bold font-head tracking-wide">
            EVOLUCION POR EMPLEADO — {prevMonthName} → {currentMonthName}
          </p>
        </div>
        {empStats.length === 0 ? (
          <div className="px-5 py-10 text-center text-brand-muted font-body text-sm">
            No hay liquidaciones para {currentMonthName} {CURRENT_YEAR}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm border-collapse">
              <thead style={{ background: '#f0eeeb' }}>
                <tr>
                  {['Empleado','Sucursal','Bruto actual','Bruto ant.','Variacion $','Variacion %','Percibido actual'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-gray-200 font-body"
                      style={{ color: NAVY }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empStats.map((e, i) => (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#fafaf8' }}>
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-800 font-body">{e.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                        style={{ background: e.branch === 'LURO' ? NAVY : CORAL }}>
                        {e.branch}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold font-body" style={{ color: '#92400E' }}>
                      {fmtARS(e.brutoActual)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right font-body text-gray-500">
                      {e.brutoPrev > 0 ? fmtARS(e.brutoPrev) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold font-body"
                      style={{ color: e.varAbs >= 0 ? '#16a34a' : '#dc2626' }}>
                      {e.brutoPrev > 0 ? (e.varAbs >= 0 ? '+' : '') + fmtARS(e.varAbs) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right font-body"
                      style={{ color: e.varPct >= 0 ? '#16a34a' : '#dc2626' }}>
                      {e.brutoPrev > 0 ? (e.varPct >= 0 ? '+' : '') + e.varPct.toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold font-body"
                      style={{ background: '#ECFDF5', color: '#065F46' }}>
                      {fmtARS(e.percActual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ranking + Masa por sucursal in a grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ranking top 5 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div style={{ background: CORAL }} className="px-5 py-3">
            <p className="text-white text-sm font-bold font-head tracking-wide">RANKING SUELDOS (TOP 5)</p>
            <p className="text-white/60 text-[11px] font-body">{currentMonthName} {CURRENT_YEAR} — por bruto</p>
          </div>
          <div className="p-4 space-y-2">
            {ranking.length === 0 && (
              <p className="text-center text-brand-muted font-body text-sm py-4">Sin datos</p>
            )}
            {ranking.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: i === 0 ? CORAL : NAVY }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 font-body truncate">{e.name}</p>
                  <p className="text-[10px] text-brand-muted font-body">{e.branch}</p>
                </div>
                <span className="text-xs font-bold font-body" style={{ color: '#92400E' }}>
                  {fmtARS(e.brutoActual)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Masa salarial por sucursal */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div style={{ background: NAVY }} className="px-5 py-3">
            <p className="text-white text-sm font-bold font-head tracking-wide">MASA SALARIAL POR SUCURSAL</p>
            <p className="text-white/60 text-[11px] font-body">{currentMonthName} {CURRENT_YEAR}</p>
          </div>
          <div className="p-4 space-y-4">
            {branchStats.map(b => (
              <div key={b.name} className="rounded-xl border border-gray-100 p-4"
                style={{ borderLeft: `4px solid ${b.color}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-body" style={{ color: b.color }}>{b.name}</span>
                  <span className="text-[10px] text-brand-muted font-body">{b.count} empleados</span>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-[10px] text-brand-muted font-body">Total Bruto</p>
                    <p className="text-sm font-bold font-body" style={{ color: '#92400E' }}>{fmtARS(b.bruto)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-muted font-body">Total Percibido</p>
                    <p className="text-sm font-bold font-body" style={{ color: '#065F46' }}>{fmtARS(b.perc)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 6: AJUSTES — Gestion de empleados
───────────────────────────────────────────────────────────── */
type EmployeeExtended = {
  id: number; name: string; branch_id: number; branch_name: string
  hire_date: string; is_active: boolean
  months_of_service: number; years_of_service: number; vacation_days_entitled: number
  cuil?: string; position?: string; phone?: string; email_address?: string
  payroll_type?: string; default_plus_pct?: number; notes?: string
}

const PAYROLL_TYPE_LABELS: Record<string, string> = {
  standard: 'Deposito banco x2',
  manual:   'Sueldo base fijo',
  hourly:   'Por horas',
}

const emptyEmployee = {
  name: '', branch_id: 1, hire_date: '', cuil: '', position: '', phone: '',
  email_address: '', payroll_type: 'standard', default_plus_pct: '', notes: '', is_active: true,
}

function AjustesTab() {
  const [employees, setEmployees] = useState<EmployeeExtended[]>([])
  const [editing,   setEditing]   = useState<number | 'new' | null>(null)
  const [form,      setForm]      = useState<typeof emptyEmployee>(emptyEmployee)
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(() => {
    api.get<EmployeeExtended[]>('/employees/all').then(setEmployees).catch(() => {
      // fallback to standard list if /all not available yet
      api.get<EmployeeExtended[]>('/employees/').then(setEmployees).catch(() => setEmployees([]))
    })
  }, [])

  useEffect(() => { load() }, [load])

  const startNew = () => {
    setForm(emptyEmployee)
    setEditing('new')
  }

  const startEdit = (emp: EmployeeExtended) => {
    setForm({
      name:             emp.name,
      branch_id:        emp.branch_id,
      hire_date:        emp.hire_date?.slice(0, 10) ?? '',
      cuil:             emp.cuil ?? '',
      position:         emp.position ?? '',
      phone:            emp.phone ?? '',
      email_address:    emp.email_address ?? '',
      payroll_type:     emp.payroll_type ?? 'standard',
      default_plus_pct: emp.default_plus_pct != null ? String(emp.default_plus_pct) : '',
      notes:            emp.notes ?? '',
      is_active:        emp.is_active,
    } as any)
    setEditing(emp.id)
  }

  const cancel = () => { setEditing(null); setForm(emptyEmployee) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name:             form.name,
        branch_id:        Number(form.branch_id),
        hire_date:        form.hire_date,
        cuil:             form.cuil  || null,
        position:         form.position  || null,
        phone:            form.phone     || null,
        email_address:    form.email_address || null,
        payroll_type:     form.payroll_type ?? 'standard',
        default_plus_pct: form.default_plus_pct !== '' ? Number(form.default_plus_pct) : null,
        notes:            form.notes    || null,
        is_active:        (form as any).is_active ?? true,
      }
      if (editing === 'new') {
        await api.post('/employees/', payload)
      } else {
        await api.put(`/employees/${editing}`, payload)
      }
      cancel()
      load()
    } catch (err: any) {
      alert('Error: ' + (err.message ?? 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (id: number) => {
    if (!confirm('Desactivar empleado? Esto no lo elimina del sistema.')) return
    await api.delete(`/employees/${id}`)
    load()
  }

  const reactivate = async (emp: EmployeeExtended) => {
    if (!confirm('Reactivar este empleado?')) return
    setSaving(true)
    try {
      await api.put(`/employees/${emp.id}`, {
        name:             emp.name,
        branch_id:        emp.branch_id,
        hire_date:        emp.hire_date?.slice(0, 10),
        cuil:             emp.cuil || null,
        position:         emp.position || null,
        phone:            emp.phone || null,
        email_address:    emp.email_address || null,
        payroll_type:     emp.payroll_type ?? 'standard',
        default_plus_pct: emp.default_plus_pct ?? null,
        notes:            emp.notes || null,
        is_active:        true,
      })
      load()
    } finally { setSaving(false) }
  }

  const InputCls = "border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none w-full font-body"
  const LabelCls = "text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body"

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-600 font-body">{employees.length} empleados en total</p>
        <button onClick={startNew}
          className="text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body"
          style={{ background: NAVY }}>
          + Nuevo Empleado
        </button>
      </div>

      {/* New employee form */}
      {editing === 'new' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div style={{ background: CORAL }} className="px-5 py-3">
            <p className="text-white text-sm font-bold font-head">NUEVO EMPLEADO</p>
          </div>
          <form onSubmit={save} className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={LabelCls}>Nombre *</label>
              <input required className={InputCls} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={LabelCls}>Sucursal *</label>
              <select required className={InputCls} value={form.branch_id}
                onChange={e => setForm(f => ({ ...f, branch_id: Number(e.target.value) }))}>
                {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LabelCls}>Fecha de ingreso *</label>
              <input required type="date" className={InputCls} value={form.hire_date}
                onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
            </div>
            <div>
              <label className={LabelCls}>CUIL</label>
              <input className={InputCls} value={form.cuil}
                onChange={e => setForm(f => ({ ...f, cuil: e.target.value }))} />
            </div>
            <div>
              <label className={LabelCls}>Cargo</label>
              <input className={InputCls} value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
            </div>
            <div>
              <label className={LabelCls}>Telefono</label>
              <input className={InputCls} value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className={LabelCls}>Email</label>
              <input type="email" className={InputCls} value={form.email_address}
                onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))} />
            </div>
            <div>
              <label className={LabelCls}>Tipo de nomina</label>
              <select className={InputCls} value={form.payroll_type}
                onChange={e => setForm(f => ({ ...f, payroll_type: e.target.value }))}>
                <option value="standard">Deposito banco x2</option>
                <option value="manual">Sueldo base fijo</option>
                <option value="hourly">Por horas</option>
              </select>
            </div>
            <div>
              <label className={LabelCls}>Plus % por defecto (0-50)</label>
              <input type="number" min={0} max={50} className={InputCls} value={form.default_plus_pct}
                onChange={e => setForm(f => ({ ...f, default_plus_pct: e.target.value as any }))} />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className={LabelCls}>Notas internas</label>
              <textarea className={InputCls + ' resize-none h-16'} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={cancel}
                className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold font-body">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body"
                style={{ background: saving ? '#ccc' : CORAL }}>
                {saving ? 'Guardando...' : 'Crear Empleado'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employees table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: NAVY }} className="px-5 py-3">
          <p className="text-white text-sm font-bold font-head tracking-wide">EMPLEADOS — ACTIVOS E INACTIVOS</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm border-collapse">
            <thead style={{ background: '#f0eeeb' }}>
              <tr>
                {['N°','Nombre','Sucursal','Cargo','Tipo Nomina','Antiguedad','CUIL','Estado',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-gray-200 font-body"
                    style={{ color: NAVY }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => {
                const isEditing = editing === emp.id
                const isIndep   = emp.branch_name === 'INDEPENDENCIA'
                const meses     = emp.months_of_service ?? 0
                const anos      = Math.floor(meses / 12)
                return (
                  <React.Fragment key={emp.id}>
                    <tr style={{
                      background: !emp.is_active ? '#fafafa' : i % 2 === 0 ? 'white' : '#fafaf8',
                      opacity: emp.is_active ? 1 : 0.6,
                      borderLeft: `3px solid ${isIndep ? CORAL : NAVY}`,
                    }}>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-center font-body" style={{ color: CORAL }}>{i + 1}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-gray-800 font-body">{emp.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                          style={{ background: isIndep ? CORAL : NAVY }}>
                          {isIndep ? 'Indep.' : 'Luro'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 font-body">{emp.position ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 font-body">
                        {PAYROLL_TYPE_LABELS[emp.payroll_type ?? 'standard'] ?? emp.payroll_type ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 font-body">
                        {anos > 0 ? `${anos} año${anos !== 1 ? 's' : ''}` : `${meses} meses`}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 font-body">{emp.cuil ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {emp.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => isEditing ? cancel() : startEdit(emp)}
                            className="border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg text-xs font-semibold font-body">
                            {isEditing ? 'Cerrar' : 'Editar'}
                          </button>
                          {emp.is_active ? (
                            <button onClick={() => deactivate(emp.id)}
                              className="border border-red-200 text-red-500 px-2.5 py-1 rounded-lg text-xs font-semibold font-body">
                              Desactivar
                            </button>
                          ) : (
                            <button onClick={() => reactivate(emp)}
                              className="border border-green-200 text-green-600 px-2.5 py-1 rounded-lg text-xs font-semibold font-body">
                              Reactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Inline edit row */}
                    {isEditing && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <form onSubmit={save}
                            className="px-5 py-4 border-b border-brand-border grid grid-cols-2 md:grid-cols-4 gap-3"
                            style={{ background: '#f5ede9' }}>
                            <div>
                              <label className={LabelCls}>Nombre *</label>
                              <input required className={InputCls} value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div>
                              <label className={LabelCls}>Sucursal *</label>
                              <select required className={InputCls} value={form.branch_id}
                                onChange={e => setForm(f => ({ ...f, branch_id: Number(e.target.value) }))}>
                                {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={LabelCls}>Fecha de ingreso *</label>
                              <input required type="date" className={InputCls} value={form.hire_date}
                                onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
                            </div>
                            <div>
                              <label className={LabelCls}>CUIL</label>
                              <input className={InputCls} value={form.cuil}
                                onChange={e => setForm(f => ({ ...f, cuil: e.target.value }))} />
                            </div>
                            <div>
                              <label className={LabelCls}>Cargo</label>
                              <input className={InputCls} value={form.position}
                                onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
                            </div>
                            <div>
                              <label className={LabelCls}>Telefono</label>
                              <input className={InputCls} value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                            </div>
                            <div>
                              <label className={LabelCls}>Email</label>
                              <input type="email" className={InputCls} value={form.email_address}
                                onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))} />
                            </div>
                            <div>
                              <label className={LabelCls}>Tipo de nomina</label>
                              <select className={InputCls} value={form.payroll_type}
                                onChange={e => setForm(f => ({ ...f, payroll_type: e.target.value }))}>
                                <option value="standard">Deposito banco x2</option>
                                <option value="manual">Sueldo base fijo</option>
                                <option value="hourly">Por horas</option>
                              </select>
                            </div>
                            <div>
                              <label className={LabelCls}>Plus % por defecto</label>
                              <input type="number" min={0} max={50} className={InputCls} value={form.default_plus_pct}
                                onChange={e => setForm(f => ({ ...f, default_plus_pct: e.target.value as any }))} />
                            </div>
                            <div>
                              <label className={LabelCls}>Estado</label>
                              <select className={InputCls} value={String((form as any).is_active)}
                                onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' } as any))}>
                                <option value="true">Activo</option>
                                <option value="false">Inactivo</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className={LabelCls}>Notas internas</label>
                              <textarea className={InputCls + ' resize-none h-16'} value={form.notes}
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                            <div className="col-span-2 md:col-span-4 flex gap-2 justify-end">
                              <button type="button" onClick={cancel}
                                className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold font-body">
                                Cancelar
                              </button>
                              <button type="submit" disabled={saving}
                                className="text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body"
                                style={{ background: saving ? '#ccc' : CORAL }}>
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-brand-muted font-body text-sm">
                    No hay empleados registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tabla Antigüedad y Vacaciones por Convenio ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: CORAL }} className="px-5 py-3">
          <p className="text-white text-sm font-bold tracking-wide font-head">
            ANTIGUEDAD Y VACACIONES POR CONVENIO
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead style={{ background: '#f5ede9' }}>
              <tr>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-brand-border w-8"
                  style={{ color: CORAL }}>N°</th>
                {['Empleado', 'Fecha Ingreso', 'Meses', 'Años', 'Vac/Año (días)', 'Sucursal'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border"
                    style={{ color: CORAL }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.filter(e => e.is_active).map((emp, i) => {
                const meses   = emp.months_of_service ?? 0
                const anos    = (meses / 12).toFixed(2)
                const isIndep = emp.branch_name === 'INDEPENDENCIA'
                return (
                  <tr key={emp.id}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                    style={{ borderLeft: `3px solid ${isIndep ? CORAL : NAVY}` }}>
                    <td className="px-3 py-2.5 text-[10px] font-bold text-center font-body"
                      style={{ color: CORAL }}>{i + 1}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-800 font-body">{emp.name}</td>
                    <td className="px-4 py-2.5 text-xs text-brand-muted font-body">
                      {new Date(emp.hire_date).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-center font-body">{meses}</td>
                    <td className="px-4 py-2.5 text-xs text-center font-body">{anos}</td>
                    <td className="px-4 py-2.5 text-xs text-center font-body" style={{ background: '#fef9c3' }}>
                      <span className="text-amber-800 font-bold">{emp.vacation_days_entitled} días</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold font-body" style={{ color: isIndep ? CORAL : NAVY }}>
                      {isIndep ? 'Indep.' : 'Luro'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-brand-border" style={{ background: '#fef9c3' }}>
          <p className="text-[11px] text-amber-800 font-body font-semibold">
            Formula convenio: &lt; 5 años = 14 días &nbsp;·&nbsp; 5 a 10 años = 21 días &nbsp;·&nbsp; &gt;= 10 años = 28 días
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Helpers compartidos
───────────────────────────────────────────────────────────── */
function NumInput({ value, onBlur, onChange, disabled, integer = false, step = 1 }: {
  value: any
  onBlur:   (v: string) => void
  onChange?: (v: string) => void   // ← para actualizar cálculos en tiempo real
  disabled?: boolean
  integer?:  boolean
  step?:     number
}) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <input type="number" step={step}
      className="border border-gray-200 rounded-lg py-1 px-1.5 text-xs text-right w-20 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed font-body"
      disabled={disabled} value={v}
      onChange={e => { setV(e.target.value); onChange?.(e.target.value) }}
      onBlur={() => onBlur(v)}
    />
  )
}

/* TextInput reutilizable (fuera de SueldosTab para no remontarse en cada render) */
function TextInput({ value, onBlur, onChange, disabled, placeholder }: {
  value: string | null; onBlur: (v: string) => void; onChange?: (v: string) => void
  disabled?: boolean; placeholder?: string
}) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <input type="text" placeholder={placeholder ?? ''}
      className="border border-gray-200 rounded-lg py-1 px-1.5 text-[11px] w-24 focus:outline-none disabled:opacity-40 font-body"
      disabled={disabled} value={v}
      onChange={e => { setV(e.target.value); onChange?.(e.target.value) }}
      onBlur={() => onBlur(v)} />
  )
}
