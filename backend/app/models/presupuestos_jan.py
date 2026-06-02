from sqlalchemy import Column, Integer, String, Numeric, Date, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class PresupuestoJAN(Base):
    __tablename__ = "presupuestos_jan"

    id               = Column(Integer, primary_key=True, index=True)
    numero           = Column(String(20), nullable=True, unique=True)
    cliente_nombre   = Column(String(200), nullable=False)
    cliente_empresa  = Column(String(200), nullable=True)
    fecha            = Column(Date, nullable=False)
    descuento_tipo   = Column(String(10), nullable=True)   # 'porcentaje' | 'fijo' | None
    descuento_valor  = Column(Numeric(15, 2), default=0)
    subtotal         = Column(Numeric(15, 2), default=0)
    descuento_monto  = Column(Numeric(15, 2), default=0)
    total            = Column(Numeric(15, 2), default=0)
    estado           = Column(String(20), default='borrador')  # borrador | enviado | aprobado | rechazado
    notas            = Column(Text, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())

    items = relationship(
        "PresupuestoItemJAN",
        back_populates="presupuesto",
        cascade="all, delete-orphan",
        order_by="PresupuestoItemJAN.id",
    )


class PresupuestoItemJAN(Base):
    __tablename__ = "presupuesto_items_jan"

    id               = Column(Integer, primary_key=True, index=True)
    presupuesto_id   = Column(Integer, ForeignKey("presupuestos_jan.id"), nullable=False)
    descripcion      = Column(String(500), nullable=False)
    cantidad         = Column(Numeric(10, 2), default=1)
    precio_unitario  = Column(Numeric(15, 2), nullable=False)
    subtotal         = Column(Numeric(15, 2), default=0)

    presupuesto = relationship("PresupuestoJAN", back_populates="items")
