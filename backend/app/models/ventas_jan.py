from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime
from datetime import datetime
from app.database import Base


class VentaJAN(Base):
    __tablename__ = "ventas_jan"

    id              = Column(Integer, primary_key=True, index=True)
    fecha           = Column(Date, nullable=False)
    year            = Column(Integer, nullable=False)
    month           = Column(String(20), nullable=False)
    producto        = Column(String(200), nullable=False)
    categoria       = Column(String(50), nullable=False)
    cantidad        = Column(Numeric(10, 2), nullable=False, default=1)
    precio_unitario = Column(Numeric(15, 2), nullable=False)
    total           = Column(Numeric(15, 2), nullable=False)
    canal           = Column(String(50), nullable=False)
    medio_pago      = Column(String(50), nullable=True)    # campo legacy
    metodo_pago     = Column(String(30), nullable=True)    # Efectivo | Transferencia | Link de Pago | Tarjeta | Cuenta Corriente
    estado_pago     = Column(String(15), nullable=True, default="pagado")   # pagado | pendiente
    cliente_tipo    = Column(String(20), nullable=True, default="cliente_final")  # cliente_final | cliente_registrado
    cliente_id      = Column(Integer, nullable=True)
    notas           = Column(String(400), default='')
    created_at      = Column(DateTime, default=datetime.utcnow)
