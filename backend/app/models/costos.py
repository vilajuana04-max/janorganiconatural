from sqlalchemy import Column, Integer, String, Numeric, Text, Boolean
from app.database import Base


class InsumoJAN(Base):
    """Materias primas con precio actual por kg / litro / unidad."""
    __tablename__ = "insumos_jan"

    id      = Column(Integer, primary_key=True)
    nombre  = Column(String(150), unique=True, nullable=False)
    unidad  = Column(String(20), nullable=False)   # 'kg' | 'litro' | 'unidad'
    precio  = Column(Numeric(15, 2), default=0)    # precio actual por unidad
    activo  = Column(Boolean, default=True)


class RecetaJAN(Base):
    """
    Receta de un producto.
    ingredientes_json: lista JSON de {insumo_id, nombre, cantidad}
    El costo se calcula en runtime usando el precio actual del insumo.
    """
    __tablename__ = "recetas_jan"

    id                = Column(Integer, primary_key=True)
    nombre            = Column(String(150), nullable=False)
    categoria         = Column(String(50), nullable=False)   # Velas|Home|Jabones|Shampoos|Cosméticos
    ingredientes_json = Column(Text, default='[]')           # [{insumo_id, nombre, cantidad}]
    packaging_costo   = Column(Numeric(15, 2), default=0)    # costo fijo de packaging en $
    mult_mayor        = Column(Numeric(5, 2), default=1.80)  # precio mayorista = costo × mult
    mult_publico      = Column(Numeric(5, 2), default=2.50)  # precio público   = costo × mult
    notas             = Column(String(400), default='')
    activo            = Column(Boolean, default=True)
