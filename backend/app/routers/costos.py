import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.costos import InsumoJAN, RecetaJAN

router = APIRouter(prefix="/costos", tags=["costos"])


# ── Schemas ──────────────────────────────────────────────────────

class InsumoUpdate(BaseModel):
    precio: float

class InsumoCreate(BaseModel):
    nombre: str
    unidad: str   # 'kg' | 'litro' | 'unidad'
    precio: float = 0

class IngredienteIn(BaseModel):
    insumo_id: int
    nombre:    str
    cantidad:  float

class RecetaUpsert(BaseModel):
    nombre:          str
    categoria:       str
    ingredientes:    List[IngredienteIn] = []
    packaging_costo: float = 0
    mult_mayor:      float = 1.80
    mult_publico:    float = 2.50
    notas:           str   = ''


# ── Helpers ───────────────────────────────────────────────────────

def _calcular_receta(receta: RecetaJAN, precios: dict) -> dict:
    """Devuelve la receta con costos calculados usando precios actuales."""
    ingredientes_raw = json.loads(receta.ingredientes_json or '[]')
    ingredientes_calc = []
    costo_ingredientes = 0.0

    for ing in ingredientes_raw:
        iid   = ing.get('insumo_id')
        precio_unit = float(precios.get(iid, 0))
        cantidad    = float(ing.get('cantidad', 0))
        subtotal    = round(precio_unit * cantidad, 2)
        costo_ingredientes += subtotal
        ingredientes_calc.append({
            'insumo_id':     iid,
            'nombre':        ing.get('nombre', ''),
            'cantidad':      cantidad,
            'precio_unit':   precio_unit,
            'subtotal':      subtotal,
        })

    packaging     = float(receta.packaging_costo or 0)
    costo_total   = round(costo_ingredientes + packaging, 2)
    mult_mayor    = float(receta.mult_mayor)
    mult_publico  = float(receta.mult_publico)
    precio_mayor  = round(costo_total * mult_mayor, 0)
    precio_publico = round(costo_total * mult_publico, 0)
    margen_pct    = round((precio_publico - costo_total) / precio_publico * 100, 1) if precio_publico else 0

    return {
        'id':              receta.id,
        'nombre':          receta.nombre,
        'categoria':       receta.categoria,
        'ingredientes':    ingredientes_calc,
        'packaging_costo': packaging,
        'costo_total':     costo_total,
        'mult_mayor':      mult_mayor,
        'mult_publico':    mult_publico,
        'precio_mayor':    precio_mayor,
        'precio_publico':  precio_publico,
        'margen_pct':      margen_pct,
        'notas':           receta.notas or '',
        'activo':          receta.activo,
    }


# ── Insumos ───────────────────────────────────────────────────────

@router.get("/insumos")
def get_insumos(db: Session = Depends(get_db)):
    insumos = db.query(InsumoJAN).filter(InsumoJAN.activo == True).order_by(InsumoJAN.nombre).all()
    return [{'id': i.id, 'nombre': i.nombre, 'unidad': i.unidad, 'precio': float(i.precio)} for i in insumos]


@router.post("/insumos", status_code=201)
def create_insumo(body: InsumoCreate, db: Session = Depends(get_db)):
    insumo = InsumoJAN(nombre=body.nombre.strip(), unidad=body.unidad, precio=body.precio)
    db.add(insumo)
    db.commit()
    db.refresh(insumo)
    return {'id': insumo.id, 'nombre': insumo.nombre, 'unidad': insumo.unidad, 'precio': float(insumo.precio)}


@router.put("/insumos/{insumo_id}")
def update_insumo(insumo_id: int, body: InsumoUpdate, db: Session = Depends(get_db)):
    insumo = db.query(InsumoJAN).filter(InsumoJAN.id == insumo_id).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado")
    insumo.precio = body.precio
    db.commit()
    return {'ok': True, 'precio': float(insumo.precio)}


@router.delete("/insumos/{insumo_id}")
def delete_insumo(insumo_id: int, db: Session = Depends(get_db)):
    insumo = db.query(InsumoJAN).filter(InsumoJAN.id == insumo_id).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado")
    insumo.activo = False
    db.commit()
    return {'ok': True}


# ── Recetas ───────────────────────────────────────────────────────

@router.get("/recetas")
def get_recetas(db: Session = Depends(get_db)):
    recetas  = db.query(RecetaJAN).filter(RecetaJAN.activo == True).order_by(RecetaJAN.categoria, RecetaJAN.nombre).all()
    insumos  = db.query(InsumoJAN).all()
    precios  = {i.id: float(i.precio) for i in insumos}
    return [_calcular_receta(r, precios) for r in recetas]


@router.post("/recetas", status_code=201)
def create_receta(body: RecetaUpsert, db: Session = Depends(get_db)):
    receta = RecetaJAN(
        nombre           = body.nombre,
        categoria        = body.categoria,
        ingredientes_json= json.dumps([i.model_dump() for i in body.ingredientes]),
        packaging_costo  = body.packaging_costo,
        mult_mayor       = body.mult_mayor,
        mult_publico     = body.mult_publico,
        notas            = body.notas,
    )
    db.add(receta)
    db.commit()
    db.refresh(receta)
    insumos = db.query(InsumoJAN).all()
    precios = {i.id: float(i.precio) for i in insumos}
    return _calcular_receta(receta, precios)


@router.put("/recetas/{receta_id}")
def update_receta(receta_id: int, body: RecetaUpsert, db: Session = Depends(get_db)):
    receta = db.query(RecetaJAN).filter(RecetaJAN.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")
    receta.nombre            = body.nombre
    receta.categoria         = body.categoria
    receta.ingredientes_json = json.dumps([i.model_dump() for i in body.ingredientes])
    receta.packaging_costo   = body.packaging_costo
    receta.mult_mayor        = body.mult_mayor
    receta.mult_publico      = body.mult_publico
    receta.notas             = body.notas
    db.commit()
    db.refresh(receta)
    insumos = db.query(InsumoJAN).all()
    precios = {i.id: float(i.precio) for i in insumos}
    return _calcular_receta(receta, precios)


@router.delete("/recetas/{receta_id}")
def delete_receta(receta_id: int, db: Session = Depends(get_db)):
    receta = db.query(RecetaJAN).filter(RecetaJAN.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")
    receta.activo = False
    db.commit()
    return {'ok': True}
