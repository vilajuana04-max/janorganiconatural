from datetime import date as DateType, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fpdf import FPDF

from app.database import get_db
from app.models.caja import CajaDiaria, CajaMovimiento

router = APIRouter(prefix="/caja-diaria", tags=["caja-diaria"])

NAVY_R,  NAVY_G,  NAVY_B  = 30,  43,  26   # #1E2B1A
CORAL_R, CORAL_G, CORAL_B = 196, 135, 90   # #C4875A

# ── Schemas ──────────────────────────────────────────────────────
class MovimientoIn(BaseModel):
    tipo:        str
    descripcion: str = ''
    monto:       float = 0
    categoria:   Optional[str] = None

class MovimientoUpdate(BaseModel):
    descripcion: Optional[str]   = None
    monto:       Optional[float] = None
    categoria:   Optional[str]   = None

class CajaUpdate(BaseModel):
    efectivo_del_dia:  Optional[float] = None
    tarjeta_provincia: Optional[float] = None
    tarjeta_nave:      Optional[float] = None
    tarjeta_frances:   Optional[float] = None
    tarjeta_comafi:    Optional[float] = None
    observaciones:     Optional[str]   = None
    cerrada:           Optional[bool]  = None


# ── Helpers ───────────────────────────────────────────────────────
def _fmt(n: float) -> str:
    return f"$ {float(n):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

# fpdf2 con Helvetica solo soporta Latin-1 (ISO 8859-1).
# Esta funcion reemplaza cualquier caracter fuera de ese rango con '?'
# para que jamas explote, sin importar lo que escribio el usuario.
_LATIN1_SUBS = {
    '—': '-',   # em dash —
    '–': '-',   # en dash -
    '‘': "'",   # comilla izq '
    '’': "'",   # comilla der '
    '“': '"',   # comilla doble izq "
    '”': '"',   # comilla doble der "
    '…': '...',  # puntos suspensivos
    '·': '.',   # punto medio
    '•': '*',   # bullet
}
def _safe(text: str) -> str:
    if not text:
        return ''
    for src, dst in _LATIN1_SUBS.items():
        text = text.replace(src, dst)
    return text.encode('latin-1', errors='replace').decode('latin-1')

MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

def _serialize_caja(c: CajaDiaria) -> dict:
    movs = [
        {
            "id":          m.id,
            "tipo":        m.tipo,
            "descripcion": m.descripcion or '',
            "monto":       float(m.monto),
            "categoria":   m.categoria or '',
        }
        for m in c.movimientos
    ]
    total_gastos   = sum(m["monto"] for m in movs if m["tipo"] == "gasto")
    total_transf   = sum(m["monto"] for m in movs if m["tipo"] == "transferencia")
    total_retiros  = sum(m["monto"] for m in movs if m["tipo"] == "retiro")
    total_link     = sum(m["monto"] for m in movs if m["tipo"] == "link")
    total_tarjetas = (
        float(c.tarjeta_provincia) + float(c.tarjeta_nave) +
        float(c.tarjeta_frances)   + float(c.tarjeta_comafi)
    )
    # efectivo_del_dia ya no se ingresa manualmente; se deriva del total de links
    total_del_dia = total_transf + total_link + total_tarjetas
    total_salidas = total_gastos + total_retiros

    return {
        "id":                 c.id,
        "fecha":              c.fecha.isoformat(),
        "sucursal":           c.sucursal,
        "efectivo_del_dia":   total_link,   # compat: expuesto como efectivo = link
        "tarjeta_provincia":  float(c.tarjeta_provincia),
        "tarjeta_nave":       float(c.tarjeta_nave),
        "tarjeta_frances":    float(c.tarjeta_frances),
        "tarjeta_comafi":     float(c.tarjeta_comafi),
        "observaciones":      c.observaciones or '',
        "cerrada":            c.cerrada,
        "movimientos":        movs,
        "total_gastos":       total_gastos,
        "total_transf":       total_transf,
        "total_retiros":      total_retiros,
        "total_link":         total_link,
        "total_tarjetas":     total_tarjetas,
        "total_del_dia":      total_del_dia,
        "total_salidas":      total_salidas,
    }


# ── PDF con fpdf2 — Landscape A4 ─────────────────────────────────
def _generate_caja_pdf(data: dict) -> bytes:
    y_parts   = data["fecha"].split("-")
    fecha_str = f"{y_parts[2]}/{y_parts[1]}/{y_parts[0]}"
    suc_label = "JAN Organico Natural"
    generado  = date.today().strftime("%d/%m/%Y")

    gastos  = [m for m in data["movimientos"] if m["tipo"] == "gasto"]
    transf  = [m for m in data["movimientos"] if m["tipo"] == "transferencia"]
    retiros = [m for m in data["movimientos"] if m["tipo"] == "retiro"]
    links   = [m for m in data["movimientos"] if m["tipo"] == "link"]

    # Landscape A4: 297 x 210 mm
    pdf = FPDF(orientation="L", format="A4")
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    W  = 267.0   # 297 - 30 (margenes 15 c/u)
    x0 = 15.0

    # ── Header ────────────────────────────────────────────────────
    pdf.set_y(15)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.set_x(x0)
    pdf.cell(W * 0.65, 10, "JAN ORGANICO NATURAL", ln=0)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.cell(W * 0.35, 10, "Cierre de Caja Diaria", ln=0, align="R")
    pdf.ln(10)
    pdf.set_x(x0)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(130, 130, 130)
    pdf.cell(W * 0.65, 4, "Mar del Plata  |  Sistema ERP v1.0", ln=0)
    pdf.cell(W * 0.35, 4, f"Generado: {generado}", ln=0, align="R")
    pdf.ln(4)
    # linea coral
    pdf.set_draw_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.set_line_width(0.8)
    pdf.line(x0, pdf.get_y(), x0 + W, pdf.get_y())
    pdf.ln(3)

    # ── Meta strip (navy, 4 columnas) ────────────────────────────
    strip_y = pdf.get_y()
    pdf.set_fill_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.rect(x0, strip_y, W, 14, "F")
    meta_items = [
        ("FECHA",    fecha_str),
        ("SUCURSAL", suc_label),
        ("ESTADO",   "CERRADA" if data["cerrada"] else "ABIERTA"),
        ("GENERADO", generado),
    ]
    cw_meta = W / 4
    for i, (lbl, val) in enumerate(meta_items):
        xi = x0 + cw_meta * i
        pdf.set_xy(xi + 3, strip_y + 2)
        pdf.set_font("Helvetica", "", 6)
        pdf.set_text_color(140, 140, 170)
        pdf.cell(cw_meta - 3, 4, lbl, ln=0)
        pdf.set_xy(xi + 3, strip_y + 7)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(cw_meta - 3, 5, val, ln=0)
    pdf.set_y(strip_y + 18)

    # ── Helper: dibujar una seccion con coordenadas fijas ─────────
    def draw_section(title, items, total, hdr_r, hdr_g, hdr_b,
                     x_off, y_off, col_width):
        # cabecera coloreada
        pdf.set_fill_color(hdr_r, hdr_g, hdr_b)
        pdf.set_xy(x_off, y_off)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(col_width, 8, f"  {title}", ln=0, fill=True)
        pdf.set_xy(x_off, y_off)
        pdf.cell(col_width - 2, 8, _fmt(total), ln=0, align="R", fill=True)
        y = y_off + 8
        # filas
        if not items:
            pdf.set_xy(x_off, y)
            pdf.set_text_color(160, 160, 160)
            pdf.set_font("Helvetica", "I", 7.5)
            pdf.cell(col_width, 6, "  Sin registros", border="LRB", ln=0)
            y += 6
        else:
            for idx, m in enumerate(items):
                bg = (250, 250, 252) if idx % 2 == 1 else (255, 255, 255)
                pdf.set_fill_color(*bg)
                desc = _safe(m["descripcion"] or "-")[:42]
                pdf.set_xy(x_off, y)
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(40, 40, 40)
                pdf.cell(col_width * 0.65, 6, f"  {desc}",
                         border="LB", fill=True, ln=0)
                pdf.set_xy(x_off + col_width * 0.65, y)
                pdf.set_font("Helvetica", "B", 8)
                pdf.cell(col_width * 0.35, 6, _fmt(m["monto"]),
                         border="RB", align="R", fill=True, ln=0)
                y += 6
        return y

    # ── Secciones en 2 columnas ───────────────────────────────────
    gap   = 5.0
    col_w = (W - gap) / 2
    x_l   = x0
    x_r   = x0 + col_w + gap

    # Fila 1: Gastos | Transferencias — misma y de arranque
    row1_y = pdf.get_y()
    yL = draw_section("GASTOS",         gastos, data["total_gastos"],
                      200, 70, 70,   x_l, row1_y, col_w)
    yR = draw_section("TRANSFERENCIAS", transf, data["total_transf"],
                      50, 100, 210,  x_r, row1_y, col_w)

    # Fila 2: Link de Pago | Retiro de Caja
    row2_y = max(yL, yR) + 5
    yL2 = draw_section("LINK DE PAGO", links, data["total_link"],
                       34, 197, 94,  x_l, row2_y, col_w)
    yR2 = draw_section("RETIRO DE CAJA", retiros, data["total_retiros"],
                       200, 150, 40, x_r, row2_y, col_w)

    # Fila 3: Tarjetas (izquierda)
    row3_y = max(yL2, yR2) + 5
    # dummy yL3 for alignment
    yL3 = row3_y

    # Tarjetas (filas fijas de terminales) — fila 3 lado izquierdo
    pdf.set_fill_color(110, 70, 200)
    pdf.set_xy(x_l, row3_y)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(col_w, 8, "  TARJETAS", ln=0, fill=True)
    pdf.set_xy(x_l, row3_y)
    pdf.cell(col_w - 2, 8, _fmt(data["total_tarjetas"]), ln=0, align="R", fill=True)
    yT = row3_y + 8
    for idx, (label, key) in enumerate([
            ("CTA. DNI",    "tarjeta_provincia"),
            ("MERCADO PAGO","tarjeta_nave"),
            ("NARANJA",     "tarjeta_frances")]):
        bg = (250, 250, 252) if idx % 2 == 1 else (255, 255, 255)
        pdf.set_fill_color(*bg)
        pdf.set_xy(x_l, yT)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(col_w * 0.55, 6, f"  {label}", border="LB", fill=True, ln=0)
        pdf.set_xy(x_l + col_w * 0.55, yT)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(col_w * 0.45, 6, _fmt(data[key]),
                 border="RB", align="R", fill=True, ln=0)
        yT += 6

    pdf.set_y(max(yL3, yT) + 6)

    # ── KPI: 4 boxes con borde superior de color ─────────────────
    kpi_y  = pdf.get_y()
    cw_kpi = W / 4
    kpi_items = [
        ("TRANSFERENCIAS",    data["total_transf"],        37,  99, 235),
        ("LINK DE PAGO",      data["total_link"],          34, 197,  94),
        ("TARJETAS",          data["total_tarjetas"],     124,  58, 237),
        ("GASTOS + RETIROS",  data["total_salidas"],      200,  50,  50),
    ]
    for i, (lbl, val, r, g, b) in enumerate(kpi_items):
        x = x0 + cw_kpi * i
        # borde superior coloreado
        pdf.set_draw_color(r, g, b)
        pdf.set_line_width(2.0)
        pdf.line(x, kpi_y, x + cw_kpi, kpi_y)
        # caja
        pdf.set_draw_color(215, 215, 215)
        pdf.set_line_width(0.3)
        pdf.rect(x, kpi_y, cw_kpi, 18)
        # etiqueta
        pdf.set_xy(x + 3, kpi_y + 3)
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_text_color(120, 120, 120)
        pdf.cell(cw_kpi - 6, 4, lbl, ln=0)
        # valor
        pdf.set_xy(x + 3, kpi_y + 9)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(r, g, b)
        prefix = "- " if "GASTO" in lbl else ""
        pdf.cell(cw_kpi - 6, 7, prefix + _fmt(val), ln=0)
    pdf.set_y(kpi_y + 23)

    # ── Total del Dia (banner navy) ───────────────────────────────
    tot_y = pdf.get_y()
    pdf.set_fill_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.rect(x0, tot_y, W, 16, "F")
    pdf.set_xy(x0 + 5, tot_y + 4)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(140, 140, 180)
    pdf.cell(W * 0.45, 8, "TOTAL DEL DIA", ln=0)
    pdf.set_xy(x0, tot_y + 2)
    pdf.set_font("Helvetica", "B", 19)
    pdf.set_text_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.cell(W - 5, 12, _fmt(data["total_del_dia"]), ln=0, align="R")
    pdf.ln(20)

    # ── Observaciones ────────────────────────────────────────────
    if data.get("observaciones"):
        pdf.set_x(x0)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(110, 110, 110)
        pdf.cell(W, 5, "OBSERVACIONES", ln=1)
        pdf.set_x(x0)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(50, 50, 50)
        pdf.multi_cell(W, 5, _safe(data.get("observaciones") or ""))
        pdf.ln(2)

    # ── Footer ───────────────────────────────────────────────────
    pdf.set_y(pdf.h - 13)
    pdf.set_draw_color(210, 210, 210)
    pdf.set_line_width(0.3)
    pdf.line(x0, pdf.get_y(), x0 + W, pdf.get_y())
    pdf.ln(2)
    pdf.set_x(x0)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(160, 160, 160)
    pdf.cell(W, 5,
             "JAN Organico Natural  |  Mar del Plata  |  Sistema ERP v1.0  |  Documento interno",
             align="C")

    return bytes(pdf.output())


# ═══════════════════════════════════════════════════════════════
# RUTAS: literales primero, paramétricas al final
# ═══════════════════════════════════════════════════════════════

# ── GET /caja-diaria/historial/{sucursal} ────────────────────────
@router.get("/historial/{sucursal}")
def get_historial(sucursal: str, db: Session = Depends(get_db)):
    cajas = (
        db.query(CajaDiaria)
        .filter(CajaDiaria.sucursal == sucursal)
        .order_by(CajaDiaria.fecha.desc())
        .limit(60)
        .all()
    )
    return [_serialize_caja(c) for c in cajas]


# ── GET /caja-diaria/pdf/{caja_id} ───────────────────────────────
@router.get("/pdf/{caja_id}")
def download_pdf(caja_id: int, db: Session = Depends(get_db)):
    caja = db.query(CajaDiaria).filter(CajaDiaria.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    try:
        data      = _serialize_caja(caja)
        pdf_bytes = _generate_caja_pdf(data)
    except Exception as exc:
        raise HTTPException(500, f"Error generando PDF: {exc}")
    fname = f"caja_{caja.sucursal}_{caja.fecha}.pdf"
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename={fname}"},
    )


# ── PUT /caja-diaria/movimientos/{mov_id} ────────────────────────
@router.put("/movimientos/{mov_id}")
def update_movimiento(mov_id: int, body: MovimientoUpdate, db: Session = Depends(get_db)):
    mov = db.query(CajaMovimiento).filter(CajaMovimiento.id == mov_id).first()
    if not mov:
        raise HTTPException(404, "Movimiento no encontrado")
    if body.descripcion is not None: mov.descripcion = body.descripcion
    if body.monto       is not None: mov.monto       = body.monto
    if body.categoria   is not None: mov.categoria   = body.categoria
    db.commit()
    return {"ok": True}


# ── DELETE /caja-diaria/movimientos/{mov_id} ─────────────────────
@router.delete("/movimientos/{mov_id}")
def delete_movimiento(mov_id: int, db: Session = Depends(get_db)):
    mov = db.query(CajaMovimiento).filter(CajaMovimiento.id == mov_id).first()
    if not mov:
        raise HTTPException(404, "Movimiento no encontrado")
    db.delete(mov)
    db.commit()
    return {"ok": True}


# ── GET /caja-diaria/{fecha}/{sucursal} ──────────────────────────
@router.get("/{fecha}/{sucursal}")
def get_or_create_caja(fecha: DateType, sucursal: str, db: Session = Depends(get_db)):
    caja = db.query(CajaDiaria).filter(
        CajaDiaria.fecha    == fecha,
        CajaDiaria.sucursal == sucursal,
    ).first()
    if not caja:
        caja = CajaDiaria(fecha=fecha, sucursal=sucursal)
        db.add(caja)
        db.commit()
        db.refresh(caja)
    return _serialize_caja(caja)


# ── PUT /caja-diaria/{caja_id} ────────────────────────────────────
@router.put("/{caja_id}")
def update_caja(caja_id: int, body: CajaUpdate, db: Session = Depends(get_db)):
    from app.models.expenses import LuroExpense

    caja = db.query(CajaDiaria).filter(CajaDiaria.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    if body.efectivo_del_dia  is not None: caja.efectivo_del_dia  = body.efectivo_del_dia
    if body.tarjeta_provincia is not None: caja.tarjeta_provincia = body.tarjeta_provincia
    if body.tarjeta_nave      is not None: caja.tarjeta_nave      = body.tarjeta_nave
    if body.tarjeta_frances   is not None: caja.tarjeta_frances   = body.tarjeta_frances
    if body.tarjeta_comafi    is not None: caja.tarjeta_comafi    = body.tarjeta_comafi
    if body.observaciones     is not None: caja.observaciones     = body.observaciones
    if body.cerrada           is not None: caja.cerrada           = body.cerrada

    # ── Sync gastos → Gastos Luro cuando se cierra la caja ─────
    if body.cerrada is True:
        # Borrar entradas previas de esta caja (idempotente)
        db.query(LuroExpense).filter(LuroExpense.caja_id == caja_id).delete()

        # Crear una LuroExpense por cada movimiento tipo 'gasto'
        fecha = caja.fecha
        month_name = MESES_ES[fecha.month - 1]
        gastos_movs = [m for m in caja.movimientos if m.tipo == 'gasto']
        for mov in gastos_movs:
            luro = LuroExpense(
                caja_id        = caja_id,
                month          = month_name,
                year           = fecha.year,
                expense_date   = fecha,
                categoria      = mov.categoria or 'Gastos Caja',
                subcategoria   = mov.descripcion or '',
                detail         = mov.descripcion or '',
                amount         = mov.monto,
                payment_method = 'efectivo',
                tipo_costo     = 'variable',
                pagado         = 'SI',
                paid_status    = True,
            )
            db.add(luro)

    db.commit()
    db.refresh(caja)
    return _serialize_caja(caja)


# ── POST /caja-diaria/{caja_id}/movimientos ───────────────────────
@router.post("/{caja_id}/movimientos", status_code=201)
def add_movimiento(caja_id: int, body: MovimientoIn, db: Session = Depends(get_db)):
    caja = db.query(CajaDiaria).filter(CajaDiaria.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    mov = CajaMovimiento(
        caja_id     = caja_id,
        tipo        = body.tipo,
        descripcion = body.descripcion,
        monto       = body.monto,
        categoria   = body.categoria,
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return {
        "id":          mov.id,
        "tipo":        mov.tipo,
        "descripcion": mov.descripcion,
        "monto":       float(mov.monto),
        "categoria":   mov.categoria or '',
    }
