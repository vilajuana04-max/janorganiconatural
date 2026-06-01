const SAGE = '#3D6B64'

function BoxIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
      stroke={SAGE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}

export default function Stock() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-head" style={{ color: SAGE }}>Stock</h1>
        <p className="text-brand-muted text-sm mt-1">Control de inventario de materias primas y productos terminados</p>
      </div>

      <div className="card flex flex-col items-center justify-center py-20 text-center gap-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: `${SAGE}18` }}
        >
          <BoxIcon />
        </div>
        <div>
          <p className="font-bold font-head text-lg mb-1" style={{ color: SAGE }}>
            Control de Stock
          </p>
          <p className="text-brand-muted text-sm max-w-xs">
            Próximamente: seguimiento de stock de materias primas,
            packaging y productos terminados con alertas de reposición.
          </p>
        </div>
        <span
          className="text-[11px] font-bold uppercase tracking-[2px] px-3 py-1.5 rounded-full"
          style={{ background: `${SAGE}15`, color: SAGE }}
        >
          En desarrollo
        </span>
      </div>
    </div>
  )
}
