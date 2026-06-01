from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date
from pydantic import BaseModel

from app.database import get_db
from app.models.ventas_jan import VentaJAN
from app.models.cuenta_corriente_jan import CuentaCorrienteJAN

router = APIRouter(prefix="/ventas-jan", tags=["Ventas JAN"])

MONTHS = [
    "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
    "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE",
]

METODOS_PAGO = ["Efectivo", "Transferencia", "Link de Pago", "Tarjeta", "Cuenta Corriente"]


# ── Schemas ───────────────────────────────────────────────────────────────────

class VentaIn(BaseModel):
    fecha:           date
    producto:        str
    categoria:       str
    cantidad:        float
    precio_unitario: float
    canal:           str
    medio_pago:      Optional[str] = None    # campo legacy (terminales)
    metodo_pago:     Optional[str] = None    # nuevo campo
    notas:           Optional[str] = ''
    cliente_tipo:    Optional[str] = 'cliente_final'   # cliente_final | cliente_registrado
    cliente_id:      Optional[int] = None


class VentaUpdate(BaseModel):
    fecha:           Optional[date]  = None
    producto:        Optional[str]   = None
    categoria:       Optional[str]   = None
    cantidad:        Optional[float] = None
    precio_unitario: Optional[float] = None
    canal:           Optional[str]   = None
    medio_pago:      Optional[str]   = None
    metodo_pago:     Optional[str]   = None
    notas:           Optional[str]   = None
    cliente_tipo:    Optional[str]   = None
    cliente_id:      Optional[int]   = None


def _serialize(v: VentaJAN) -> dict:
    return {
        "id":              v.id,
        "fecha":           v.fecha.isoformat(),
        "year":            v.year,
        "month":           v.month,
        "producto":        v.producto,
        "categoria":       v.categoria,
        "cantidad":        float(v.cantidad),
        "precio_unitario": float(v.precio_unitario),
        "total":           float(v.total),
        "canal":           v.canal,
        "medio_pago":      v.medio_pago or "",
        "metodo_pago":     v.metodo_pago or v.medio_pago or "",
        "estado_pago":     v.estado_pago or "pagado",
        "cliente_tipo":    v.cliente_tipo or "cliente_final",
        "cliente_id":      v.cliente_id,
        "notas":           v.notas or '',
        "created_at":      v.created_at.isoformat() if v.created_at else None,
    }


def _es_cuenta_corriente(v: VentaJAN) -> bool:
    return (
        (v.metodo_pago == "Cuenta Corriente") and
        (v.cliente_tipo == "cliente_registrado") and
        (v.cliente_id is not None)
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/historial/meses")
def historial_meses(db: Session = Depends(get_db)):
    rows = (
        db.query(
            VentaJAN.year, VentaJAN.month,
            func.sum(VentaJAN.total).label("total"),
            func.count(VentaJAN.id).label("ops"),
        )
        .group_by(VentaJAN.year, VentaJAN.month)
        .order_by(VentaJAN.year.desc(), VentaJAN.month)
        .all()
    )
    return [{"year": r.year, "month": r.month, "total": float(r.total), "ops": r.ops} for r in rows]


@router.get("/{year}/{month}")
def list_ventas(year: int, month: str, db: Session = Depends(get_db)):
    month_up = month.upper()
    rows = (
        db.query(VentaJAN)
        .filter(VentaJAN.year == year, VentaJAN.month == month_up)
        .order_by(VentaJAN.fecha.desc(), VentaJAN.created_at.desc())
        .all()
    )

    ventas = [_serialize(v) for v in rows]
    total_mes = sum(v["total"] for v in ventas)

    por_metodo: dict = {}
    for v in ventas:
        key = v["metodo_pago"] or "Sin especificar"
        por_metodo[key] = por_metodo.get(key, 0) + v["total"]

    por_canal: dict = {}
    for v in ventas:
        por_canal[v["canal"]] = por_canal.get(v["canal"], 0) + v["total"]

    por_categoria: dict = {}
    for v in ventas:
        por_categoria[v["categoria"]] = por_categoria.get(v["categoria"], 0) + v["total"]

    return {
        "ventas":        ventas,
        "total_mes":     total_mes,
        "cantidad_ops":  len(ventas),
        "por_medio":     por_metodo,   # alias por compatibilidad frontend
        "por_canal":     por_canal,
        "por_categoria": por_categoria,
    }


@router.post("/", status_code=201)
def create_venta(body: VentaIn, db: Session = Depends(get_db)):
    try:
        month_label = MONTHS[body.fecha.month - 1]
        total = round(body.cantidad * body.precio_unitario, 2)

        if body.metodo_pago == "Cuenta Corriente" and body.cliente_tipo != "cliente_registrado":
            raise HTTPException(
                status_code=422,
                detail="Cuenta Corriente solo está disponible para clientes registrados."
            )

        es_cc = (body.metodo_pago == "Cuenta Corriente" and
                 body.cliente_tipo == "cliente_registrado" and
                 body.cliente_id is not None)

        v = VentaJAN(
            fecha           = body.fecha,
            year            = body.fecha.year,
            month           = month_label,
            producto        = body.producto.strip(),
            categoria       = body.categoria,
            cantidad        = body.cantidad,
            precio_unitario = body.precio_unitario,
            total           = total,
            canal           = body.canal,
            medio_pago      = body.medio_pago,
            metodo_pago     = body.metodo_pago,
            estado_pago     = "pendiente" if es_cc else "pagado",
            cliente_tipo    = body.cliente_tipo or "cliente_final",
            cliente_id      = body.cliente_id,
            notas           = body.notas or '',
        )
        db.add(v)
        db.flush()

        if es_cc:
            cc = CuentaCorrienteJAN(
                cliente_id      = body.cliente_id,
                venta_id        = v.id,
                monto_original  = total,
                monto_pendiente = total,
                estado          = "pendiente",
                fecha_venta     = body.fecha,
            )
            db.add(cc)

        db.commit()
        db.refresh(v)
        return _serialize(v)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Devolvemos el error como HTTPException para que FastAPI
        # lo serialice correctamente con headers CORS incluidos
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.put("/{venta_id}")
def update_venta(venta_id: int, body: VentaUpdate, db: Session = Depends(get_db)):
    v = db.query(VentaJAN).filter(VentaJAN.id == venta_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if body.fecha           is not None:
        v.fecha = body.fecha
        v.year  = body.fecha.year
        v.month = MONTHS[body.fecha.month - 1]
    if body.producto        is not None: v.producto = body.producto.strip()
    if body.categoria       is not None: v.categoria = body.categoria
    if body.cantidad        is not None: v.cantidad = body.cantidad
    if body.precio_unitario is not None: v.precio_unitario = body.precio_unitario
    if body.canal           is not None: v.canal = body.canal
    if body.medio_pago      is not None: v.medio_pago = body.medio_pago
    if body.metodo_pago     is not None: v.metodo_pago = body.metodo_pago
    if body.notas           is not None: v.notas = body.notas
    if body.cliente_tipo    is not None: v.cliente_tipo = body.cliente_tipo
    if body.cliente_id      is not None: v.cliente_id = body.cliente_id

    v.total = round(float(v.cantidad) * float(v.precio_unitario), 2)

    db.commit()
    db.refresh(v)
    return _serialize(v)


@router.delete("/{venta_id}", status_code=204)
def delete_venta(venta_id: int, db: Session = Depends(get_db)):
    v = db.query(VentaJAN).filter(VentaJAN.id == venta_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    # Eliminar CC asociada si existe
    db.query(CuentaCorrienteJAN).filter(CuentaCorrienteJAN.venta_id == venta_id).delete()
    db.delete(v)
    db.commit()
