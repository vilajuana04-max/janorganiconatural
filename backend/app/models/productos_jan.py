from sqlalchemy import Column, Integer, String, Numeric, Boolean, Text, DateTime
from datetime import datetime
from app.database import Base


class ProductoJAN(Base):
    __tablename__ = "productos_jan"

    id           = Column(Integer, primary_key=True, index=True)
    nombre       = Column(String(200), nullable=False)
    descripcion  = Column(Text, nullable=True)
    codigo       = Column(String(50), nullable=True)       # SKU / código interno
    foto_url     = Column(String(500), nullable=True)
    costo        = Column(Numeric(15, 2), nullable=True)
    precio       = Column(Numeric(15, 2), nullable=False)
    medidas      = Column(String(100), nullable=True)      # "10x5x3 cm"
    peso_gr      = Column(Numeric(10, 1), nullable=True)   # gramos
    categoria    = Column(String(50), nullable=False)
    subcategoria = Column(String(50), nullable=True)
    variables    = Column(Text, nullable=True, default='[]')  # JSON array de variantes
    stock        = Column(Numeric(10, 2), nullable=True, default=0)
    activo       = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
