import { Package } from 'lucide-react'

const SAGE = '#3D6B64'

export default function Productos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-head" style={{ color: SAGE }}>Productos</h1>
        <p className="text-brand-muted text-sm mt-1">Catálogo de productos JAN Orgánico Natural</p>
      </div>

      <div className="card flex flex-col items-center justify-center py-20 text-center gap-5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: `${SAGE}18` }}
        >
          <Package size={32} style={{ color: SAGE }} strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-bold font-head text-lg mb-1" style={{ color: SAGE }}>
            Catálogo de Productos
          </p>
          <p className="text-brand-muted text-sm max-w-xs">
            Próximamente: cargá todos los productos de JAN con nombre,
            categoría, precio de venta y stock disponible.
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
