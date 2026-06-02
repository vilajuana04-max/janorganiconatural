from sqlalchemy import Column, Integer, String, Numeric, Date, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class StockVarianteJAN(Base):
    """Un registro de stock para (producto, variante, tipo)."""
    __tablename__ = "stock_variantes_jan"

    id          = Column(Integer, primary_key=True, index=True)
    producto_id = Column(Integer, ForeignKey("productos_jan.id"), nullable=False)
    variante    = Column(String(100), default='', nullable=False)   # '' = sin variante
    tipo        = Column(String(20), nullable=False, default='listo')  # listo | armado | produccion
    cantidad    = Column(Numeric(10, 2), default=0)
    stock_minimo= Column(Numeric(10, 2), default=0)
    created_at  = Column(DateTime, server_default=func.now())

    producto = relationship("ProductoJAN")


class MovimientoStockJAN(Base):
    """Log auditado de cada cambio de stock."""
    __tablename__ = "movimientos_stock_jan"

    id             = Column(Integer, primary_key=True, index=True)
    producto_id    = Column(Integer, nullable=False)
    variante       = Column(String(100), default='', nullable=False)
    tipo_movimiento= Column(String(20), nullable=False)   # entrada | salida_venta | ajuste | transferencia
    tipo_stock     = Column(String(20), nullable=True)    # para entrada/ajuste: listo|armado|produccion
    desde_tipo     = Column(String(20), nullable=True)    # para transferencia
    hacia_tipo     = Column(String(20), nullable=True)    # para transferencia
    cantidad       = Column(Numeric(10, 2), nullable=False)
    referencia_id  = Column(Integer, nullable=True)       # venta_id si viene de venta
    notas          = Column(Text, nullable=True)
    fecha          = Column(Date, nullable=False)
    created_at     = Column(DateTime, server_default=func.now())
