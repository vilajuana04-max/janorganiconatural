from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime
from app.database import Base


class ClienteJAN(Base):
    __tablename__ = "clientes_jan"

    id               = Column(Integer, primary_key=True, index=True)
    nombre_completo  = Column(String(200), nullable=False)
    direccion        = Column(Text, nullable=True)
    email            = Column(String(200), nullable=True)
    condicion_iva    = Column(String(30), nullable=False)   # consumidor_final | monotributista | exento | responsable_inscripto
    documento_tipo   = Column(String(10), nullable=False)   # DNI | CUIT | CUIL
    documento_numero = Column(String(20), nullable=False)
    telefono         = Column(String(20), nullable=True)    # formato 549XXXXXXXXXX
    categoria_precios = Column(String(20), nullable=False)  # lista_1 | lista_2 | lista_3
    tipo_cliente     = Column(String(20), nullable=False)   # cliente_final | cliente_mayorista
    notas            = Column(Text, nullable=True)
    activo           = Column(Boolean, default=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
