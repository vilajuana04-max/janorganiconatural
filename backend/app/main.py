import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app import models  # noqa: registers all ORM models
from app.routers import (
    auth_router,
    sales_router, purchases_router, payroll_router,
    vacations_router, expenses_router, dashboard_router, employees_router,
    receipts_router, cashflow_router, vencimientos_router, gastos_personales_router,
    caja_diaria_router, costos_router, ventas_jan_router,
)

Base.metadata.create_all(bind=engine)

# ── Migraciones de columnas nuevas (idempotentes) ────────────────
def _run_migrations():
    """Agrega columnas nuevas si aún no existen. Seguro de correr múltiples veces."""
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE caja_movimientos ADD COLUMN IF NOT EXISTS categoria VARCHAR(50);"
        ))
        db.execute(text(
            "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS caja_id INTEGER;"
        ))
        # Tabla ventas JAN (se crea via SQLAlchemy create_all, pero asegurar columnas)
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS ventas_jan (
                id              SERIAL PRIMARY KEY,
                fecha           DATE NOT NULL,
                year            INTEGER NOT NULL,
                month           VARCHAR(20) NOT NULL,
                producto        VARCHAR(200) NOT NULL,
                categoria       VARCHAR(50) NOT NULL,
                cantidad        NUMERIC(10,2) NOT NULL DEFAULT 1,
                precio_unitario NUMERIC(15,2) NOT NULL,
                total           NUMERIC(15,2) NOT NULL,
                canal           VARCHAR(50) NOT NULL,
                medio_pago      VARCHAR(50) NOT NULL,
                notas           VARCHAR(400) DEFAULT '',
                created_at      TIMESTAMP DEFAULT NOW()
            );
        """))
        db.commit()
    except Exception as e:
        print(f"[migration] Error: {e}")
    finally:
        db.close()

_run_migrations()

# ── Seed usuarios por defecto ────────────────────────────────────
def _seed_users():
    """Crea usuarios iniciales si no existen. Se ejecuta al arrancar."""
    from app.database import SessionLocal
    from app.models.users import User

    # Hash bcrypt de "Jan2025" (rounds=12)
    HASH_JAN2025  = "$2b$12$DM6fkHH4HVcp8sJ5X200MOt3bXu0UWZ8XqGBhc.kernSC8h/1mdM."

    DEFAULT_USERS = [
        ("Mariana", HASH_JAN2025, "admin"),
    ]

    db = SessionLocal()
    try:
        for username, pw_hash, role in DEFAULT_USERS:
            if not db.query(User).filter(User.username == username).first():
                db.add(User(username=username, password_hash=pw_hash, role=role))
                print(f"[seed] Usuario '{username}' creado.")
        db.commit()
    except Exception as e:
        print(f"[seed] Error: {e}")
    finally:
        db.close()

_seed_users()

# ── Seed insumos y recetas JAN ───────────────────────────────────
def _seed_costos():
    """Precarga insumos y recetas desde las planillas de Mariana. Idempotente."""
    import json
    from app.database import SessionLocal
    from app.models.costos import InsumoJAN, RecetaJAN

    INSUMOS = [
        # Surfactantes y bases
        ("SCI (Sodium Cocoyl Isethionate)", "kg",      6500),
        ("Betaina de coco",                 "kg",      1500),
        ("Glicerina vegetal",               "kg",      2000),
        ("Ácido esteárico vegetal",         "kg",      2000),
        ("BTMS",                            "kg",     12000),
        # Aceites vegetales
        ("Aceite de coco",                  "kg",      2500),
        ("Aceite de oliva",                 "litro",   1600),
        ("Aceite de palta",                 "kg",      4300),
        ("Aceite de jojoba",                "litro",   8500),
        ("Aceite de chía",                  "kg",      4800),
        ("Aceite de ricino",                "litro",   1700),
        ("Aceite de rosa mosqueta",         "litro",   2700),
        ("Aceite de neem",                  "litro",   2000),
        ("Aceite pepitas de uva",           "kg",      2000),
        # Mantecas
        ("Manteca de karité",               "kg",      6500),
        ("Manteca de cacao",                "kg",      6600),
        ("Manteca de mango",                "kg",      6800),
        # Hidrolatos y líquidos
        ("Hidrolato",                       "litro",    800),
        ("Hidrolato de lavanda",            "litro",   1000),
        ("Alcohol tridestilado",            "litro",   4300),
        ("Alcohol cetílico",                "kg",      3800),
        # Arcillas y polvos
        ("Arcilla rosa",                    "kg",      1100),
        ("Arcilla verde",                   "kg",       600),
        ("Arcilla roja",                    "kg",       600),
        ("Polvo de hibiscus",               "kg",      1000),
        ("Polvo de remolacha",              "kg",      8000),
        ("Matcha",                          "kg",     10000),
        ("Avena",                           "kg",      2000),
        ("Maicena",                         "kg",       100),
        # Vitaminas y activos
        ("Vitamina E",                      "kg",       100),
        # Bases jabones saponificados
        ("Soda cáustica",                   "kg",      1950),
        ("Mica / colorante",                "kg",       100),
        # Esencias y fragancias
        ("Esencia para velas",              "litro",  15000),
        ("Esencia para jabones",            "litro",  10000),
        ("Esencia para shampoos",           "litro",  33000),
        ("Esencia home / difusor",          "litro",   5000),
        ("Fragancia refill difusor",        "litro",   5340),
        # Para velas
        ("Cera de soja",                    "kg",      1200),
        ("Mejorador de cera",               "kg",      3500),
        # Para baños
        ("Sales de epsom",                  "kg",      1000),
        ("Sal del Himalaya",                "kg",      2000),
        ("Botánicos",                       "kg",      2000),
        # Packaging (precio por unidad)
        ("Envase vela nature (tapa madera)","unidad",   400),
        ("Envase vela basic",               "unidad",   150),
        ("Envase difusor 250ml",            "unidad",   250),
        ("Tapa de madera",                  "unidad",   150),
        ("Tapa de aluminio",                "unidad",   350),
        ("Pabilo",                          "unidad",    60),
        ("Varillas difusor",                "unidad",   180),
        ("Etiqueta",                        "unidad",    50),
        ("Caja kraft",                      "unidad",   150),
        ("Doy pack",                        "unidad",    60),
        ("Packaging general",               "unidad",    61),
        ("Espátula",                        "unidad",    35),
        ("Envase home spray",               "unidad",   300),
    ]

    db = SessionLocal()
    try:
        # Seed insumos
        for nombre, unidad, precio in INSUMOS:
            if not db.query(InsumoJAN).filter(InsumoJAN.nombre == nombre).first():
                db.add(InsumoJAN(nombre=nombre, unidad=unidad, precio=precio))
        db.commit()

        # Mapa nombre → id para armar las recetas
        nm = {i.nombre: i.id for i in db.query(InsumoJAN).all()}

        def ing(nombre, cantidad):
            return {"insumo_id": nm[nombre], "nombre": nombre, "cantidad": cantidad}

        RECETAS = [
            {
                "nombre":   "Vela Nature (tapa madera 250g)",
                "categoria":"Velas",
                "ings": [
                    ing("Cera de soja", 0.200), ing("Mejorador de cera", 0.005),
                    ing("Esencia para velas", 0.022), ing("Pabilo", 1),
                    ing("Envase vela nature (tapa madera)", 1), ing("Etiqueta", 1),
                    ing("Tapa de madera", 1),
                ],
                "pkg": 0, "mm": 1.20, "mp": 2.10,
            },
            {
                "nombre":   "Vela Basic (250g)",
                "categoria":"Velas",
                "ings": [
                    ing("Cera de soja", 0.115), ing("Mejorador de cera", 0.002),
                    ing("Esencia para velas", 0.013), ing("Pabilo", 1),
                    ing("Envase vela basic", 1), ing("Etiqueta", 1), ing("Caja kraft", 1),
                ],
                "pkg": 0, "mm": 1.46, "mp": 2.39,
            },
            {
                "nombre":   "Vela Nature Aluminio (250g)",
                "categoria":"Velas",
                "ings": [
                    ing("Cera de soja", 0.200), ing("Mejorador de cera", 0.005),
                    ing("Esencia para velas", 0.022), ing("Pabilo", 1),
                    ing("Envase vela nature (tapa madera)", 1), ing("Etiqueta", 1),
                    ing("Tapa de aluminio", 1),
                ],
                "pkg": 0, "mm": 1.35, "mp": 2.40,
            },
            {
                "nombre":   "Difusor con varillas (250ml)",
                "categoria":"Home",
                "ings": [
                    ing("Fragancia refill difusor", 0.150), ing("Varillas difusor", 1),
                    ing("Envase difusor 250ml", 1), ing("Etiqueta", 1),
                    ing("Packaging general", 1),
                ],
                "pkg": 0, "mm": 1.56, "mp": 1.94,
            },
            {
                "nombre":   "Home Spray / Bruma (250ml)",
                "categoria":"Home",
                "ings": [
                    ing("Alcohol tridestilado", 0.130),
                    ing("Esencia home / difusor", 0.050),
                    ing("Envase home spray", 1), ing("Etiqueta", 1),
                    ing("Packaging general", 1),
                ],
                "pkg": 0, "mm": 1.78, "mp": 2.17,
            },
            {
                "nombre":   "Refill Difusor / Home (Doy Pack)",
                "categoria":"Home",
                "ings": [
                    ing("Fragancia refill difusor", 0.150),
                    ing("Doy pack", 1), ing("Etiqueta", 1),
                ],
                "pkg": 0, "mm": 1.40, "mp": 1.80,
            },
            {
                "nombre":   "Jabón Saponificado (x barra, lote 15 u.)",
                "categoria":"Jabones",
                "ings": [
                    ing("Aceite de coco",    0.023), ing("Aceite de oliva",   0.060),
                    ing("Manteca de karité", 0.005), ing("Manteca de cacao",  0.003),
                    ing("Soda cáustica",     0.013), ing("Esencia para jabones", 0.003),
                    ing("Mica / colorante",  0.007), ing("Etiqueta", 1),
                ],
                "pkg": 30, "mm": 1.40, "mp": 2.00,
                "notas": "Cantidades por barra (lote típico de 15 barras).",
            },
            {
                "nombre":   "Jabón Batido",
                "categoria":"Jabones",
                "ings": [
                    ing("Glicerina vegetal",       0.035),
                    ing("Ácido esteárico vegetal", 0.005),
                    ing("Betaina de coco",         0.045),
                    ing("SCI (Sodium Cocoyl Isethionate)", 0.035),
                    ing("Manteca de karité",       0.004),
                    ing("Mica / colorante",        0.004),
                    ing("Esencia para jabones",    0.004),
                    ing("Espátula", 1), ing("Etiqueta", 1),
                ],
                "pkg": 185, "mm": 1.98, "mp": 2.99,
                "notas": "Envase + packaging incluidos en el costo fijo de packaging.",
            },
            {
                "nombre":   "Shampoo Sólido — Normal",
                "categoria":"Shampoos",
                "ings": [
                    ing("SCI (Sodium Cocoyl Isethionate)", 0.050),
                    ing("Betaina de coco",   0.010), ing("Hidrolato",         0.100),
                    ing("Aceite de chía",    0.005), ing("Manteca de karité", 0.005),
                    ing("Aceite de coco",    0.005), ing("Arcilla rosa",      0.010),
                    ing("Vitamina E",        0.001), ing("Esencia para shampoos", 0.001),
                ],
                "pkg": 20, "mm": 2.50, "mp": 3.50,
            },
            {
                "nombre":   "Shampoo Sólido — Cabellos Grasos",
                "categoria":"Shampoos",
                "ings": [
                    ing("SCI (Sodium Cocoyl Isethionate)", 0.050),
                    ing("Arcilla verde",     0.010), ing("Hidrolato",         0.005),
                    ing("Betaina de coco",   0.001), ing("Aceite pepitas de uva", 0.010),
                    ing("Matcha",            0.010), ing("Vitamina E",        0.001),
                    ing("Esencia para shampoos", 0.001),
                ],
                "pkg": 20, "mm": 2.50, "mp": 3.50,
            },
            {
                "nombre":   "Shampoo Sólido — Cabellos Secos (extra hidratación)",
                "categoria":"Shampoos",
                "ings": [
                    ing("SCI (Sodium Cocoyl Isethionate)", 0.050),
                    ing("Betaina de coco",    0.015), ing("Hidrolato",          0.005),
                    ing("Manteca de cacao",   0.010), ing("Aceite de oliva",    0.010),
                    ing("Aceite de palta",    0.005), ing("Vitamina E",         0.001),
                    ing("Esencia para shampoos", 0.001),
                ],
                "pkg": 20, "mm": 2.50, "mp": 3.50,
            },
            {
                "nombre":   "Shampoo Sólido — Hibiscus",
                "categoria":"Shampoos",
                "ings": [
                    ing("SCI (Sodium Cocoyl Isethionate)", 0.050),
                    ing("Arcilla rosa",        0.010), ing("Hidrolato",           0.015),
                    ing("Polvo de remolacha",  0.001), ing("Polvo de hibiscus",   0.001),
                    ing("Aceite de palta",     0.007), ing("Aceite de jojoba",    0.007),
                    ing("Esencia para shampoos", 0.001),
                ],
                "pkg": 40, "mm": 2.0, "mp": 3.0,
            },
            {
                "nombre":   "Acondicionador Sólido",
                "categoria":"Cosméticos",
                "ings": [
                    ing("BTMS",              0.004), ing("Alcohol cetílico",   0.030),
                    ing("Aceite de palta",   0.100), ing("Aceite de jojoba",   0.100),
                    ing("Aceite de coco",    0.100), ing("Vitamina E",         0.100),
                    ing("Betaina de coco",   0.100), ing("Esencia para shampoos", 0.001),
                ],
                "pkg": 150, "mm": 2.00, "mp": 3.00,
                "notas": "Cantidades estimadas para un lote. Ajustar según producción.",
            },
        ]

        for r in RECETAS:
            if not db.query(RecetaJAN).filter(RecetaJAN.nombre == r["nombre"]).first():
                db.add(RecetaJAN(
                    nombre            = r["nombre"],
                    categoria         = r["categoria"],
                    ingredientes_json = json.dumps(r["ings"]),
                    packaging_costo   = r["pkg"],
                    mult_mayor        = r["mm"],
                    mult_publico      = r["mp"],
                    notas             = r.get("notas", ""),
                ))
        db.commit()
        print("[seed] Insumos y recetas JAN OK.")
    except Exception as e:
        print(f"[seed costos] Error: {e}")
    finally:
        db.close()

_seed_costos()

# ── CORS ────────────────────────────────────────────────────────
# En producción, solo el frontend de Vercel/Render puede conectarse.
# En desarrollo, se permiten localhost.
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]

if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

# Permite cualquier subdominio de vercel.app y onrender.com para previews
ALLOWED_ORIGIN_REGEX = (
    r"https://(.*\.vercel\.app|.*\.onrender\.com|janorganiconatural.*\.vercel\.app)"
)

app = FastAPI(
    title       = "JAN Orgánico Natural ERP API",
    description = "Sistema ERP para JAN Orgánico Natural — Mar del Plata",
    version     = "1.0.0",
    docs_url    = "/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url   = None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins       = ALLOWED_ORIGINS,
    allow_origin_regex  = ALLOWED_ORIGIN_REGEX,
    allow_credentials   = True,
    allow_methods       = ["*"],
    allow_headers       = ["*"],
)

app.include_router(auth_router)
app.include_router(sales_router)
app.include_router(purchases_router)
app.include_router(payroll_router)
app.include_router(vacations_router)
app.include_router(expenses_router)
app.include_router(dashboard_router)
app.include_router(employees_router)
app.include_router(receipts_router)
app.include_router(cashflow_router)
app.include_router(vencimientos_router)
app.include_router(gastos_personales_router)
app.include_router(caja_diaria_router)
app.include_router(costos_router)
app.include_router(ventas_jan_router)


@app.get("/")
def root():
    return {
        "status":  "ok",
        "app":     "JAN Orgánico Natural ERP",
        "version": "1.0.0",
        "env":     os.getenv("ENVIRONMENT", "development"),
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
