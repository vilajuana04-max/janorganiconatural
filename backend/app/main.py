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
    caja_diaria_router,
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
