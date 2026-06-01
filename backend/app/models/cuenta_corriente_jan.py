from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey
from datetime import datetime
from app.database import Base


class CuentaCorrienteJAN(Base):
    __tablename__ = "cuenta_corriente_jan"

    id                = Column(Integer, primary_key=True, index=True)
    cliente_id        = Column(Integer, ForeignKey("clientes_jan.id"), nullable=False)
    venta_id          = Column(Integer, ForeignKey("ventas_jan.id"), nullable=False)
    monto_original    = Column(Numeric(15, 2), nullable=False)   # total original de la venta
    monto_pendiente   = Column(Numeric(15, 2), nullable=False)   # lo que resta pagar
    estado            = Column(String(15), nullable=False, default="pendiente")  # pendiente | parcial | cancelado
    fecha_venta       = Column(Date, nullable=False)
    fecha_cancelacion = Column(Date, nullable=True)
    notas             = Column(String(400), default="")
    created_at        = Column(DateTime, default=datetime.utcnow)
