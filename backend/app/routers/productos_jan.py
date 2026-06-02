from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.models.productos_jan import ProductoJAN

router = APIRouter(prefix="/productos-jan", tags=["Productos JAN"])

CATEGORIAS = [
    "Velas", "Home", "Jabones", "Shampoos", "Cosméticos",
    "Accesorios", "Kits", "Otro",
]


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProductoIn(BaseModel):
    nombre:       str
    descripcion:  Optional[str] = None
    codigo:       Optional[str] = None
    foto_url:     Optional[str] = None
    costo:        Optional[float] = None
    precio:       float
    medidas:      Optional[str] = None
    peso_gr:      Optional[float] = None
    categoria:    str
    subcategoria: Optional[str] = None
    variables:    Optional[str] = '[]'   # JSON string: [{"nombre":"Color","opciones":["Rojo","Azul"]}]
    stock:        Optional[float] = 0
    activo:       Optional[bool] = True


class ProductoUpdate(BaseModel):
    nombre:       Optional[str]   = None
    descripcion:  Optional[str]   = None
    codigo:       Optional[str]   = None
    foto_url:     Optional[str]   = None
    costo:        Optional[float] = None
    precio:       Optional[float] = None
    medidas:      Optional[str]   = None
    peso_gr:      Optional[float] = None
    categoria:    Optional[str]   = None
    subcategoria: Optional[str]   = None
    variables:    Optional[str]   = None
    stock:        Optional[float] = None
    activo:       Optional[bool]  = None


# ── Serializer ────────────────────────────────────────────────────────────────

def _serialize(p: ProductoJAN) -> dict:
    return {
        "id":          p.id,
        "nombre":      p.nombre,
        "descripcion": p.descripcion or "",
        "codigo":      p.codigo or "",
        "foto_url":    p.foto_url or "",
        "costo":       float(p.costo) if p.costo is not None else None,
        "precio":      float(p.precio),
        "medidas":     p.medidas or "",
        "peso_gr":     float(p.peso_gr) if p.peso_gr is not None else None,
        "categoria":   p.categoria,
        "subcategoria":p.subcategoria or "",
        "variables":   p.variables or "[]",
        "stock":       float(p.stock) if p.stock is not None else 0,
        "activo":      p.activo,
        "created_at":  p.created_at.isoformat() if p.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_productos(
    q:         Optional[str]  = None,
    categoria: Optional[str]  = None,
    activo:    bool           = True,
    db:        Session        = Depends(get_db),
):
    query = db.query(ProductoJAN).filter(ProductoJAN.activo == activo)
    if q:
        query = query.filter(ProductoJAN.nombre.ilike(f"%{q}%"))
    if categoria:
        query = query.filter(ProductoJAN.categoria == categoria)
    productos = query.order_by(ProductoJAN.nombre).all()
    return [_serialize(p) for p in productos]


@router.get("/categorias")
def get_categorias():
    return CATEGORIAS


@router.get("/{producto_id}")
def get_producto(producto_id: int, db: Session = Depends(get_db)):
    p = db.query(ProductoJAN).filter(ProductoJAN.id == producto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return _serialize(p)


@router.post("/", status_code=201)
def create_producto(body: ProductoIn, db: Session = Depends(get_db)):
    try:
        p = ProductoJAN(
            nombre       = body.nombre.strip(),
            descripcion  = body.descripcion,
            codigo       = body.codigo.strip() if body.codigo else None,
            foto_url     = body.foto_url,
            costo        = body.costo,
            precio       = body.precio,
            medidas      = body.medidas,
            peso_gr      = body.peso_gr,
            categoria    = body.categoria,
            subcategoria = body.subcategoria,
            variables    = body.variables or '[]',
            stock        = body.stock or 0,
            activo       = True,
        )
        db.add(p)
        db.commit()
        db.refresh(p)
        return _serialize(p)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.put("/{producto_id}")
def update_producto(producto_id: int, body: ProductoUpdate, db: Session = Depends(get_db)):
    p = db.query(ProductoJAN).filter(ProductoJAN.id == producto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    try:
        if body.nombre       is not None: p.nombre       = body.nombre.strip()
        if body.descripcion  is not None: p.descripcion  = body.descripcion
        if body.codigo       is not None: p.codigo       = body.codigo.strip()
        if body.foto_url     is not None: p.foto_url     = body.foto_url
        if body.costo        is not None: p.costo        = body.costo
        if body.precio       is not None: p.precio       = body.precio
        if body.medidas      is not None: p.medidas      = body.medidas
        if body.peso_gr      is not None: p.peso_gr      = body.peso_gr
        if body.categoria    is not None: p.categoria    = body.categoria
        if body.subcategoria is not None: p.subcategoria = body.subcategoria
        if body.variables    is not None: p.variables    = body.variables
        if body.stock        is not None: p.stock        = body.stock
        if body.activo       is not None: p.activo       = body.activo

        db.commit()
        db.refresh(p)
        return _serialize(p)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"[DB] {type(e).__name__}: {str(e)}")


@router.delete("/{producto_id}", status_code=204)
def delete_producto(producto_id: int, db: Session = Depends(get_db)):
    p = db.query(ProductoJAN).filter(ProductoJAN.id == producto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    # Soft delete
    p.activo = False
    db.commit()
