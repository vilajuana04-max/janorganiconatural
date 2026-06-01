from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date
from pydantic import BaseModel
from decimal import Decimal

from app.database import get_db
from app.models.ventas_jan import VentaJAN

router = APIRouter(prefix="/ventas-jan", tags=["Ventas JAN"])

MONTHS = [
    "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
    "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE",
]


# ── Schemas ───────────────────────────────────────────────────────────────────

class VentaIn(BaseModel):
    fecha:           date
    producto:        str
    categoria:       str
    cantidad:        float
    precio_unitario: float
    canal:           str
    medio_pago:      str
    notas:           Optional[str] = ''

class VentaUpdate(BaseModel):
    fecha:           Optional[date]  = None
    producto:        Optional[str]   = None
    categoria:       Optional[str]   = None
    cantidad:        Optional[float] = None
    precio_unitario: Optional[float] = None
    canal:           Optional[str]   = None
    medio_pago:      Optional[str]   = None
    notas:           Optional[str]   = None


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
        "medio_pago":      v.medio_pago,
        "notas":           v.notas or '',
        "created_at":      v.created_at.isoformat() if v.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{year}/{month}")
def list_ventas(year: int, month: str, db: Session = Depends(get_db)):
    """Retorna todas las ventas del mes + resumen."""
    month_up = month.upper()
    rows = (
        db.query(VentaJAN)
        .filter(VentaJAN.year == year, VentaJAN.month == month_up)
        .order_by(VentaJAN.fecha.desc(), VentaJAN.created_at.desc())
        .all()
    )

    ventas = [_serialize(v) for v in rows]
    total_mes = sum(v["total"] for v in ventas)

    # Totales por medio de pago
    por_medio = {}
    for v in ventas:
        por_medio[v["medio_pago"]] = por_medio.get(v["medio_pago"], 0) + v["total"]

    # Totales por canal
    por_canal = {}
    for v in ventas:
        por_canal[v["canal"]] = por_canal.get(v["canal"], 0) + v["total"]

    # Totales por categoría
    por_categoria = {}
    for v in ventas:
        por_categoria[v["categoria"]] = por_categoria.get(v["categoria"], 0) + v["total"]

    return {
        "ventas":        ventas,
        "total_mes":     total_mes,
        "cantidad_ops":  len(ventas),
        "por_medio":     por_medio,
        "por_canal":     por_canal,
        "por_categoria": por_categoria,
    }


@router.post("/", status_code=201)
def create_venta(body: VentaIn, db: Session = Depends(get_db)):
    month_label = MONTHS[body.fecha.month - 1]
    total = round(body.cantidad * body.precio_unitario, 2)

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
        notas           = body.notas or '',
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _serialize(v)


@router.put("/{venta_id}")
def update_venta(venta_id: int, body: VentaUpdate, db: Session = Depends(get_db)):
    v = db.query(VentaJAN).filter(VentaJAN.id == venta_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if body.fecha           is not None: v.fecha = body.fecha; v.year = body.fecha.year; v.month = MONTHS[body.fecha.month - 1]
    if body.producto        is not None: v.producto = body.producto.strip()
    if body.categoria       is not None: v.categoria = body.categoria
    if body.cantidad        is not None: v.cantidad = body.cantidad
    if body.precio_unitario is not None: v.precio_unitario = body.precio_unitario
    if body.canal           is not None: v.canal = body.canal
    if body.medio_pago      is not None: v.medio_pago = body.medio_pago
    if body.notas           is not None: v.notas = body.notas

    # Recalcular total
    v.total = round(float(v.cantidad) * float(v.precio_unitario), 2)

    db.commit()
    db.refresh(v)
    return _serialize(v)


@router.delete("/{venta_id}", status_code=204)
def delete_venta(venta_id: int, db: Session = Depends(get_db)):
    v = db.query(VentaJAN).filter(VentaJAN.id == venta_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    db.delete(v)
    db.commit()


@router.get("/historial/meses")
def historial_meses(db: Session = Depends(get_db)):
    """Retorna los meses que tienen al menos una venta registrada."""
    rows = (
        db.query(VentaJAN.year, VentaJAN.month, func.sum(VentaJAN.total).label("total"), func.count(VentaJAN.id).label("ops"))
        .group_by(VentaJAN.year, VentaJAN.month)
        .order_by(VentaJAN.year.desc(), VentaJAN.month)
        .all()
    )
    return [{"year": r.year, "month": r.month, "total": float(r.total), "ops": r.ops} for r in rows]
