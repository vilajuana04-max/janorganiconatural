from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date
from pydantic import BaseModel

from app.database import get_db
from app.models.cuenta_corriente_jan import CuentaCorrienteJAN
from app.models.clientes_jan import ClienteJAN

router = APIRouter(prefix="/cuenta-corriente-jan", tags=["Cuenta Corriente JAN"])


class PagoIn(BaseModel):
    monto_pago: float
    notas: Optional[str] = None


def _serialize(cc: CuentaCorrienteJAN, nombre_cliente: str = "") -> dict:
    return {
        "id":               cc.id,
        "cliente_id":       cc.cliente_id,
        "nombre_cliente":   nombre_cliente,
        "venta_id":         cc.venta_id,
        "monto_original":   float(cc.monto_original),
        "monto_pendiente":  float(cc.monto_pendiente),
        "estado":           cc.estado,
        "fecha_venta":      cc.fecha_venta.isoformat(),
        "fecha_cancelacion": cc.fecha_cancelacion.isoformat() if cc.fecha_cancelacion else None,
        "notas":            cc.notas or "",
    }


# ── Listado global de cuentas corrientes ──────────────────────────────────────

@router.get("/")
def list_cc(
    estado: Optional[str] = None,   # pendiente | parcial | cancelado | (vacío = todos activos)
    db: Session = Depends(get_db),
):
    query = db.query(CuentaCorrienteJAN)
    if estado:
        query = query.filter(CuentaCorrienteJAN.estado == estado)
    else:
        # Por defecto: solo los que tienen deuda
        query = query.filter(CuentaCorrienteJAN.estado.in_(["pendiente", "parcial"]))

    registros = query.order_by(CuentaCorrienteJAN.fecha_venta.desc()).all()

    # Enriquecer con nombre del cliente
    result = []
    for r in registros:
        cliente = db.query(ClienteJAN).filter(ClienteJAN.id == r.cliente_id).first()
        nombre = cliente.nombre_completo if cliente else "—"
        result.append(_serialize(r, nombre))

    # Resumen global
    total_pendiente = sum(r["monto_pendiente"] for r in result)

    return {
        "registros":       result,
        "total_pendiente": total_pendiente,
        "cantidad":        len(result),
    }


# ── Resumen por cliente (saldo agrupado + detalle de deudas) ──────────────────

@router.get("/resumen")
def resumen_por_cliente(db: Session = Depends(get_db)):
    # Traemos todos los registros abiertos de una vez
    registros = (
        db.query(CuentaCorrienteJAN)
        .filter(CuentaCorrienteJAN.estado.in_(["pendiente", "parcial"]))
        .order_by(CuentaCorrienteJAN.fecha_venta.desc())
        .all()
    )

    # Agrupamos por cliente
    por_cliente: dict = {}
    for r in registros:
        if r.cliente_id not in por_cliente:
            cliente = db.query(ClienteJAN).filter(ClienteJAN.id == r.cliente_id).first()
            por_cliente[r.cliente_id] = {
                "cliente_id":      r.cliente_id,
                "nombre":          cliente.nombre_completo if cliente else "—",
                "total_pendiente": 0.0,
                "cantidad_deudas": 0,
                "deudas":          [],
            }
        por_cliente[r.cliente_id]["total_pendiente"] += float(r.monto_pendiente)
        por_cliente[r.cliente_id]["cantidad_deudas"] += 1
        por_cliente[r.cliente_id]["deudas"].append(_serialize(r))

    clientes = sorted(por_cliente.values(), key=lambda x: x["total_pendiente"], reverse=True)
    total_global = sum(c["total_pendiente"] for c in clientes)

    return {
        "clientes":               clientes,
        "total_pendiente_global": total_global,
    }


# ── Registrar pago (parcial o total) ─────────────────────────────────────────

@router.put("/{cc_id}/pago")
def registrar_pago(cc_id: int, body: PagoIn, db: Session = Depends(get_db)):
    cc = db.query(CuentaCorrienteJAN).filter(CuentaCorrienteJAN.id == cc_id).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Registro de cuenta corriente no encontrado.")
    if cc.estado == "cancelado":
        raise HTTPException(status_code=400, detail="Este registro ya está cancelado.")
    if body.monto_pago <= 0:
        raise HTTPException(status_code=422, detail="El monto a pagar debe ser mayor a cero.")

    nuevo_pendiente = float(cc.monto_pendiente) - body.monto_pago

    if nuevo_pendiente <= 0:
        # Pago total (o sobrepago → queda en 0)
        cc.monto_pendiente   = 0
        cc.estado            = "cancelado"
        cc.fecha_cancelacion = date.today()
        if body.notas:
            cc.notas = (cc.notas or "") + f" | Cancelado: {body.notas}"
    else:
        # Pago parcial
        cc.monto_pendiente = round(nuevo_pendiente, 2)
        cc.estado          = "parcial"
        if body.notas:
            cc.notas = (cc.notas or "") + f" | Pago parcial ${body.monto_pago}: {body.notas}"

    db.commit()
    db.refresh(cc)

    cliente = db.query(ClienteJAN).filter(ClienteJAN.id == cc.cliente_id).first()
    return _serialize(cc, cliente.nombre_completo if cliente else "—")
