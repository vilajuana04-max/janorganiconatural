from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
import re

from app.database import get_db
from app.models.clientes_jan import ClienteJAN
from app.models.cuenta_corriente_jan import CuentaCorrienteJAN
from app.models.ventas_jan import VentaJAN

router = APIRouter(prefix="/clientes-jan", tags=["Clientes JAN"])

# ── Validadores ───────────────────────────────────────────────────────────────

CONDICIONES_IVA = ["consumidor_final", "monotributista", "exento", "responsable_inscripto"]
CATEGORIAS_PRECIO = ["lista_1", "lista_2", "lista_3"]
TIPOS_CLIENTE = ["cliente_final", "cliente_mayorista"]


def doc_tipo_from_iva(condicion_iva: str) -> str:
    if condicion_iva == "consumidor_final":
        return "DNI"
    if condicion_iva == "responsable_inscripto":
        return "CUIT"
    return "CUIL"  # monotributista, exento


def validar_documento(tipo: str, numero: str) -> bool:
    digits = re.sub(r"[-.]", "", numero)
    if tipo == "DNI":
        return bool(re.match(r"^\d{7,8}$", digits))
    if tipo in ("CUIT", "CUIL"):
        return bool(re.match(r"^\d{11}$", digits))
    return False


def validar_telefono(tel: str) -> bool:
    return bool(re.match(r"^549\d{10}$", tel))


# ── Schemas ───────────────────────────────────────────────────────────────────

class ClienteIn(BaseModel):
    nombre_completo:   str
    direccion:         Optional[str] = None
    email:             Optional[str] = None
    condicion_iva:     str
    documento_numero:  str
    telefono:          Optional[str] = None
    categoria_precios: str
    tipo_cliente:      str
    notas:             Optional[str] = None

    @field_validator("condicion_iva")
    @classmethod
    def check_iva(cls, v):
        if v not in CONDICIONES_IVA:
            raise ValueError(f"condicion_iva debe ser uno de: {CONDICIONES_IVA}")
        return v

    @field_validator("categoria_precios")
    @classmethod
    def check_cat(cls, v):
        if v not in CATEGORIAS_PRECIO:
            raise ValueError(f"categoria_precios debe ser uno de: {CATEGORIAS_PRECIO}")
        return v

    @field_validator("tipo_cliente")
    @classmethod
    def check_tipo(cls, v):
        if v not in TIPOS_CLIENTE:
            raise ValueError(f"tipo_cliente debe ser uno de: {TIPOS_CLIENTE}")
        return v


class PagoCC(BaseModel):
    monto_pago: float
    notas: Optional[str] = None


# ── Serializers ───────────────────────────────────────────────────────────────

def _serialize_cliente(c: ClienteJAN, saldo: float = 0.0) -> dict:
    return {
        "id":               c.id,
        "numero_cliente":   c.numero_cliente or "",
        "nombre_completo":  c.nombre_completo,
        "direccion":        c.direccion,
        "email":            c.email,
        "condicion_iva":    c.condicion_iva,
        "documento_tipo":   c.documento_tipo,
        "documento_numero": c.documento_numero,
        "telefono":         c.telefono,
        "categoria_precios": c.categoria_precios,
        "tipo_cliente":     c.tipo_cliente,
        "notas":            c.notas or "",
        "activo":           c.activo,
        "created_at":       c.created_at.isoformat() if c.created_at else None,
        "saldo_pendiente":  saldo,
    }


def _serialize_cc(cc: CuentaCorrienteJAN, nombre_cliente: str = "") -> dict:
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _saldo_cliente(cliente_id: int, db: Session) -> float:
    result = db.query(func.sum(CuentaCorrienteJAN.monto_pendiente)).filter(
        CuentaCorrienteJAN.cliente_id == cliente_id,
        CuentaCorrienteJAN.estado.in_(["pendiente", "parcial"]),
    ).scalar()
    return float(result or 0)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_clientes(
    q: Optional[str] = None,
    activo: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(ClienteJAN).filter(ClienteJAN.activo == activo)
    if q:
        query = query.filter(ClienteJAN.nombre_completo.ilike(f"%{q}%"))
    clientes = query.order_by(ClienteJAN.nombre_completo).all()
    return [_serialize_cliente(c, _saldo_cliente(c.id, db)) for c in clientes]


@router.post("/", status_code=201)
def create_cliente(body: ClienteIn, db: Session = Depends(get_db)):
    doc_tipo = doc_tipo_from_iva(body.condicion_iva)
    if not validar_documento(doc_tipo, body.documento_numero):
        raise HTTPException(status_code=422, detail=f"Formato de {doc_tipo} inválido.")
    if body.telefono and not validar_telefono(body.telefono):
        raise HTTPException(status_code=422, detail="Teléfono debe tener formato 549XXXXXXXXXX (13 dígitos).")

    c = ClienteJAN(
        nombre_completo   = body.nombre_completo.strip(),
        direccion         = body.direccion,
        email             = body.email,
        condicion_iva     = body.condicion_iva,
        documento_tipo    = doc_tipo,
        documento_numero  = re.sub(r"[-.]", "", body.documento_numero),
        telefono          = body.telefono,
        categoria_precios = body.categoria_precios,
        tipo_cliente      = body.tipo_cliente,
        notas             = body.notas,
    )
    db.add(c)
    db.flush()  # get id before commit
    c.numero_cliente = f"CLI-{c.id:04d}"
    db.commit()
    db.refresh(c)
    return _serialize_cliente(c)


@router.get("/{cliente_id}")
def get_cliente(cliente_id: int, db: Session = Depends(get_db)):
    c = db.query(ClienteJAN).filter(ClienteJAN.id == cliente_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return _serialize_cliente(c, _saldo_cliente(c.id, db))


@router.put("/{cliente_id}")
def update_cliente(cliente_id: int, body: ClienteIn, db: Session = Depends(get_db)):
    c = db.query(ClienteJAN).filter(ClienteJAN.id == cliente_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    doc_tipo = doc_tipo_from_iva(body.condicion_iva)
    if not validar_documento(doc_tipo, body.documento_numero):
        raise HTTPException(status_code=422, detail=f"Formato de {doc_tipo} inválido.")
    if body.telefono and not validar_telefono(body.telefono):
        raise HTTPException(status_code=422, detail="Teléfono debe tener formato 549XXXXXXXXXX (13 dígitos).")

    c.nombre_completo   = body.nombre_completo.strip()
    c.direccion         = body.direccion
    c.email             = body.email
    c.condicion_iva     = body.condicion_iva
    c.documento_tipo    = doc_tipo
    c.documento_numero  = re.sub(r"[-.]", "", body.documento_numero)
    c.telefono          = body.telefono
    c.categoria_precios = body.categoria_precios
    c.tipo_cliente      = body.tipo_cliente
    c.notas             = body.notas
    db.commit()
    db.refresh(c)
    return _serialize_cliente(c, _saldo_cliente(c.id, db))


@router.delete("/{cliente_id}", status_code=204)
def deactivate_cliente(cliente_id: int, db: Session = Depends(get_db)):
    c = db.query(ClienteJAN).filter(ClienteJAN.id == cliente_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    c.activo = False
    db.commit()


# ── Historial de compras del cliente ─────────────────────────────────────────

@router.get("/{cliente_id}/historial")
def historial_cliente(cliente_id: int, db: Session = Depends(get_db)):
    ventas = (
        db.query(VentaJAN)
        .filter(VentaJAN.cliente_id == cliente_id)
        .order_by(VentaJAN.fecha.desc())
        .all()
    )
    return [
        {
            "id":            v.id,
            "fecha":         v.fecha.isoformat(),
            "month":         v.month,
            "year":          v.year,
            "producto":      v.producto,
            "categoria":     v.categoria,
            "cantidad":      float(v.cantidad),
            "precio_unitario": float(v.precio_unitario),
            "total":         float(v.total),
            "metodo_pago":   v.metodo_pago or v.medio_pago or "",
            "estado_pago":   v.estado_pago or "pagado",
            "canal":         v.canal,
        }
        for v in ventas
    ]


# ── Cuenta corriente del cliente ──────────────────────────────────────────────

@router.get("/{cliente_id}/cuenta-corriente")
def cuenta_corriente_cliente(cliente_id: int, db: Session = Depends(get_db)):
    registros = (
        db.query(CuentaCorrienteJAN)
        .filter(CuentaCorrienteJAN.cliente_id == cliente_id)
        .order_by(CuentaCorrienteJAN.fecha_venta.desc())
        .all()
    )
    saldo = _saldo_cliente(cliente_id, db)
    return {
        "saldo_pendiente": saldo,
        "registros": [_serialize_cc(r) for r in registros],
    }
