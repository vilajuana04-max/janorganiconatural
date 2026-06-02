"""
Router de Stock JAN — Fase 1
GET  /stock-jan/              → lista todos los registros de stock con info de producto
POST /stock-jan/movimiento    → registra entrada | ajuste | transferencia
PUT  /stock-jan/{id}/minimo   → actualiza stock mínimo de alerta
GET  /stock-jan/alertas       → items con cantidad <= stock_minimo
GET  /stock-jan/movimientos   → historial de movimientos (opcional ?producto_id=)
"""
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.stock_jan import StockVarianteJAN, MovimientoStockJAN
from app.models.productos_jan import ProductoJAN

router = APIRouter(prefix="/stock-jan", tags=["Stock JAN"])

TIPOS_STOCK = {"listo", "armado", "produccion"}
TIPOS_MOV   = {"entrada", "ajuste", "transferencia"}


# ── Schemas ───────────────────────────────────────────────────────

class MovimientoIn(BaseModel):
    producto_id:     int
    variante:        str = ''
    tipo_movimiento: str           # entrada | ajuste | transferencia
    tipo_stock:      Optional[str] = None   # listo | armado | produccion (para entrada/ajuste)
    desde_tipo:      Optional[str] = None   # para transferencia
    hacia_tipo:      Optional[str] = None   # para transferencia
    cantidad:        float
    notas:           Optional[str] = None
    fecha:           Optional[date] = None


class MinimoIn(BaseModel):
    stock_minimo: float


# ── Helpers ───────────────────────────────────────────────────────

def _get_or_create_stock(db: Session, producto_id: int, variante: str, tipo: str) -> StockVarianteJAN:
    """Devuelve el registro de stock, creándolo si no existe."""
    entry = db.query(StockVarianteJAN).filter(
        StockVarianteJAN.producto_id == producto_id,
        StockVarianteJAN.variante    == variante,
        StockVarianteJAN.tipo        == tipo,
    ).first()
    if not entry:
        entry = StockVarianteJAN(
            producto_id = producto_id,
            variante    = variante,
            tipo        = tipo,
            cantidad    = 0,
            stock_minimo= 0,
        )
        db.add(entry)
        db.flush()
    return entry


def _serialize_entry(e: StockVarianteJAN) -> dict:
    p = e.producto
    return {
        "id":                  e.id,
        "producto_id":         e.producto_id,
        "producto_nombre":     p.nombre if p else "—",
        "producto_categoria":  p.categoria if p else "",
        "variante":            e.variante or "",
        "tipo":                e.tipo,
        "cantidad":            float(e.cantidad or 0),
        "stock_minimo":        float(e.stock_minimo or 0),
        "alerta":              float(e.cantidad or 0) <= float(e.stock_minimo or 0) and float(e.stock_minimo or 0) > 0,
    }


def _serialize_mov(m: MovimientoStockJAN) -> dict:
    return {
        "id":              m.id,
        "producto_id":     m.producto_id,
        "variante":        m.variante or "",
        "tipo_movimiento": m.tipo_movimiento,
        "tipo_stock":      m.tipo_stock or "",
        "desde_tipo":      m.desde_tipo or "",
        "hacia_tipo":      m.hacia_tipo or "",
        "cantidad":        float(m.cantidad),
        "referencia_id":   m.referencia_id,
        "notas":           m.notas or "",
        "fecha":           m.fecha.isoformat() if m.fecha else "",
        "created_at":      m.created_at.isoformat() if m.created_at else "",
    }


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/")
def list_stock(
    tipo:         Optional[str] = None,
    solo_alertas: bool = False,
    producto_id:  Optional[int] = None,
    db: Session = Depends(get_db),
):
    try:
        q = db.query(StockVarianteJAN)
        if tipo:
            q = q.filter(StockVarianteJAN.tipo == tipo)
        if producto_id:
            q = q.filter(StockVarianteJAN.producto_id == producto_id)

        entries = q.order_by(StockVarianteJAN.producto_id, StockVarianteJAN.variante).all()
        result = [_serialize_entry(e) for e in entries]

        if solo_alertas:
            result = [r for r in result if r["alerta"]]

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.get("/alertas")
def get_alertas(db: Session = Depends(get_db)):
    try:
        entries = db.query(StockVarianteJAN).all()
        alertas = [
            _serialize_entry(e) for e in entries
            if float(e.cantidad or 0) <= float(e.stock_minimo or 0) and float(e.stock_minimo or 0) > 0
        ]
        return alertas
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.get("/movimientos")
def list_movimientos(
    producto_id: Optional[int] = None,
    limit:       int = 100,
    db: Session = Depends(get_db),
):
    try:
        q = db.query(MovimientoStockJAN)
        if producto_id:
            q = q.filter(MovimientoStockJAN.producto_id == producto_id)
        movs = q.order_by(MovimientoStockJAN.created_at.desc()).limit(limit).all()
        return [_serialize_mov(m) for m in movs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.post("/movimiento", status_code=201)
def registrar_movimiento(body: MovimientoIn, db: Session = Depends(get_db)):
    try:
        # Validar producto
        producto = db.query(ProductoJAN).filter(ProductoJAN.id == body.producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        tipo_mov = body.tipo_movimiento.lower()
        if tipo_mov not in TIPOS_MOV:
            raise HTTPException(status_code=400, detail=f"tipo_movimiento inválido. Usar: {TIPOS_MOV}")

        hoy = body.fecha or date.today()

        if tipo_mov == "transferencia":
            # Validaciones
            if not body.desde_tipo or not body.hacia_tipo:
                raise HTTPException(status_code=400, detail="transferencia requiere desde_tipo y hacia_tipo")
            if body.desde_tipo not in TIPOS_STOCK or body.hacia_tipo not in TIPOS_STOCK:
                raise HTTPException(status_code=400, detail=f"tipos de stock válidos: {TIPOS_STOCK}")
            if body.desde_tipo == body.hacia_tipo:
                raise HTTPException(status_code=400, detail="desde_tipo y hacia_tipo deben ser distintos")
            if body.cantidad <= 0:
                raise HTTPException(status_code=400, detail="cantidad debe ser positiva")

            origen  = _get_or_create_stock(db, body.producto_id, body.variante, body.desde_tipo)
            destino = _get_or_create_stock(db, body.producto_id, body.variante, body.hacia_tipo)

            origen.cantidad  = float(origen.cantidad or 0) - body.cantidad
            destino.cantidad = float(destino.cantidad or 0) + body.cantidad

            # Log
            db.add(MovimientoStockJAN(
                producto_id     = body.producto_id,
                variante        = body.variante,
                tipo_movimiento = "transferencia",
                desde_tipo      = body.desde_tipo,
                hacia_tipo      = body.hacia_tipo,
                cantidad        = body.cantidad,
                notas           = body.notas,
                fecha           = hoy,
            ))

        else:  # entrada o ajuste
            tipo_stock = body.tipo_stock
            if not tipo_stock or tipo_stock not in TIPOS_STOCK:
                raise HTTPException(status_code=400, detail=f"tipo_stock requerido para entrada/ajuste. Válidos: {TIPOS_STOCK}")

            entry = _get_or_create_stock(db, body.producto_id, body.variante, tipo_stock)

            if tipo_mov == "entrada":
                if body.cantidad <= 0:
                    raise HTTPException(status_code=400, detail="cantidad debe ser positiva")
                entry.cantidad = float(entry.cantidad or 0) + body.cantidad
            elif tipo_mov == "ajuste":
                if body.cantidad < 0:
                    raise HTTPException(status_code=400, detail="ajuste no puede ser negativo (usá 0 para limpiar)")
                entry.cantidad = body.cantidad

            db.add(MovimientoStockJAN(
                producto_id     = body.producto_id,
                variante        = body.variante,
                tipo_movimiento = tipo_mov,
                tipo_stock      = tipo_stock,
                cantidad        = body.cantidad,
                notas           = body.notas,
                fecha           = hoy,
            ))

        db.commit()
        return {"ok": True, "mensaje": f"Movimiento '{tipo_mov}' registrado correctamente"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.put("/{stock_id}/minimo")
def set_stock_minimo(stock_id: int, body: MinimoIn, db: Session = Depends(get_db)):
    try:
        entry = db.query(StockVarianteJAN).filter(StockVarianteJAN.id == stock_id).first()
        if not entry:
            raise HTTPException(status_code=404, detail="Registro de stock no encontrado")
        if body.stock_minimo < 0:
            raise HTTPException(status_code=400, detail="stock_minimo no puede ser negativo")
        entry.stock_minimo = body.stock_minimo
        db.commit()
        db.refresh(entry)
        return _serialize_entry(entry)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


# ── Helper exportable para otros routers ──────────────────────────

def decrementar_stock_venta(
    db: Session,
    producto_id: int,
    variante: str,
    cantidad: float,
    venta_id: int,
    fecha: date,
) -> None:
    """
    Descuenta stock de 'listo para venta'. Si no hay entrada, crea registro en negativo.
    Se llama desde el router de ventas al crear una venta con producto del catálogo.
    """
    try:
        entry = _get_or_create_stock(db, producto_id, variante, "listo")
        entry.cantidad = float(entry.cantidad or 0) - cantidad

        db.add(MovimientoStockJAN(
            producto_id     = producto_id,
            variante        = variante,
            tipo_movimiento = "salida_venta",
            tipo_stock      = "listo",
            cantidad        = cantidad,
            referencia_id   = venta_id,
            notas           = f"Venta #{venta_id}",
            fecha           = fecha,
        ))
    except Exception:
        pass  # no bloquear la venta si falla el stock
