from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.presupuestos_jan import PresupuestoJAN, PresupuestoItemJAN

router = APIRouter(prefix="/presupuestos-jan", tags=["Presupuestos JAN"])


# ── Schemas ───────────────────────────────────────────────────────

class ItemIn(BaseModel):
    descripcion:     str
    cantidad:        float = 1
    precio_unitario: float


class PresupuestoIn(BaseModel):
    cliente_nombre:  str
    cliente_empresa: Optional[str] = None
    fecha:           date
    descuento_tipo:  Optional[str] = None   # 'porcentaje' | 'fijo' | None
    descuento_valor: float = 0
    notas:           Optional[str] = None
    items:           List[ItemIn] = []


class EstadoIn(BaseModel):
    estado: str  # borrador | enviado | aprobado | rechazado


# ── Helpers ───────────────────────────────────────────────────────

def _calc_totals(items: List[ItemIn], descuento_tipo: Optional[str], descuento_valor: float):
    subtotal = sum(i.cantidad * i.precio_unitario for i in items)
    if descuento_tipo == 'porcentaje':
        descuento_monto = round(subtotal * descuento_valor / 100, 2)
    elif descuento_tipo == 'fijo':
        descuento_monto = min(descuento_valor, subtotal)
    else:
        descuento_monto = 0.0
    total = max(0, subtotal - descuento_monto)
    return subtotal, descuento_monto, total


def _serialize_item(item: PresupuestoItemJAN):
    return {
        "id":              item.id,
        "descripcion":     item.descripcion,
        "cantidad":        float(item.cantidad),
        "precio_unitario": float(item.precio_unitario),
        "subtotal":        float(item.subtotal),
    }


def _serialize(p: PresupuestoJAN):
    return {
        "id":              p.id,
        "numero":          p.numero or "",
        "cliente_nombre":  p.cliente_nombre,
        "cliente_empresa": p.cliente_empresa or "",
        "fecha":           p.fecha.isoformat() if p.fecha else "",
        "descuento_tipo":  p.descuento_tipo or "",
        "descuento_valor": float(p.descuento_valor or 0),
        "subtotal":        float(p.subtotal or 0),
        "descuento_monto": float(p.descuento_monto or 0),
        "total":           float(p.total or 0),
        "estado":          p.estado or "borrador",
        "notas":           p.notas or "",
        "created_at":      p.created_at.isoformat() if p.created_at else "",
        "items":           [_serialize_item(i) for i in (p.items or [])],
    }


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/")
def list_presupuestos(
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
):
    try:
        q = db.query(PresupuestoJAN)
        if estado:
            q = q.filter(PresupuestoJAN.estado == estado)
        presupuestos = q.order_by(PresupuestoJAN.id.desc()).all()
        return [_serialize(p) for p in presupuestos]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.get("/{presupuesto_id}")
def get_presupuesto(presupuesto_id: int, db: Session = Depends(get_db)):
    p = db.query(PresupuestoJAN).filter(PresupuestoJAN.id == presupuesto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return _serialize(p)


@router.post("/", status_code=201)
def create_presupuesto(body: PresupuestoIn, db: Session = Depends(get_db)):
    try:
        subtotal, descuento_monto, total = _calc_totals(
            body.items, body.descuento_tipo, body.descuento_valor
        )

        p = PresupuestoJAN(
            cliente_nombre  = body.cliente_nombre.strip(),
            cliente_empresa = (body.cliente_empresa or "").strip() or None,
            fecha           = body.fecha,
            descuento_tipo  = body.descuento_tipo or None,
            descuento_valor = body.descuento_valor,
            descuento_monto = descuento_monto,
            subtotal        = subtotal,
            total           = total,
            notas           = (body.notas or "").strip() or None,
            estado          = "borrador",
        )
        db.add(p)
        db.flush()  # get id

        # Auto-number
        p.numero = f"PRES-{p.id:04d}"

        # Items
        for item_in in body.items:
            item = PresupuestoItemJAN(
                presupuesto_id  = p.id,
                descripcion     = item_in.descripcion.strip(),
                cantidad        = item_in.cantidad,
                precio_unitario = item_in.precio_unitario,
                subtotal        = round(item_in.cantidad * item_in.precio_unitario, 2),
            )
            db.add(item)

        db.commit()
        db.refresh(p)
        return _serialize(p)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.put("/{presupuesto_id}")
def update_presupuesto(presupuesto_id: int, body: PresupuestoIn, db: Session = Depends(get_db)):
    try:
        p = db.query(PresupuestoJAN).filter(PresupuestoJAN.id == presupuesto_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

        subtotal, descuento_monto, total = _calc_totals(
            body.items, body.descuento_tipo, body.descuento_valor
        )

        p.cliente_nombre  = body.cliente_nombre.strip()
        p.cliente_empresa = (body.cliente_empresa or "").strip() or None
        p.fecha           = body.fecha
        p.descuento_tipo  = body.descuento_tipo or None
        p.descuento_valor = body.descuento_valor
        p.descuento_monto = descuento_monto
        p.subtotal        = subtotal
        p.total           = total
        p.notas           = (body.notas or "").strip() or None

        # Replace items
        for old_item in list(p.items):
            db.delete(old_item)
        db.flush()

        for item_in in body.items:
            item = PresupuestoItemJAN(
                presupuesto_id  = p.id,
                descripcion     = item_in.descripcion.strip(),
                cantidad        = item_in.cantidad,
                precio_unitario = item_in.precio_unitario,
                subtotal        = round(item_in.cantidad * item_in.precio_unitario, 2),
            )
            db.add(item)

        db.commit()
        db.refresh(p)
        return _serialize(p)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.patch("/{presupuesto_id}/estado")
def update_estado(presupuesto_id: int, body: EstadoIn, db: Session = Depends(get_db)):
    try:
        p = db.query(PresupuestoJAN).filter(PresupuestoJAN.id == presupuesto_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        valid = {"borrador", "enviado", "aprobado", "rechazado"}
        if body.estado not in valid:
            raise HTTPException(status_code=400, detail=f"Estado inválido. Valores válidos: {valid}")
        p.estado = body.estado
        db.commit()
        db.refresh(p)
        return _serialize(p)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.delete("/{presupuesto_id}", status_code=204)
def delete_presupuesto(presupuesto_id: int, db: Session = Depends(get_db)):
    try:
        p = db.query(PresupuestoJAN).filter(PresupuestoJAN.id == presupuesto_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        db.delete(p)
        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")
