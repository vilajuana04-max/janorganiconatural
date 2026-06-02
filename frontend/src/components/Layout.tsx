import React, { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, FlaskConical,
  Menu, X, ChevronDown, Wallet, LogOut, BookOpen, Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAVY  = '#1E2B1A'
const CORAL = '#C4875A'

/* ── Estructura de navegación ──────────────────────────────────── */
const FINANZAS_ITEMS = [
  { to: '/compras',           label: 'Compras'          },
  { to: '/gastos',            label: 'Gastos JAN'       },
  { to: '/gastos-personales', label: 'Gastos Pers.'     },
  { to: '/flujocaja',         label: 'Flujo de Caja'    },
  { to: '/vencimientos',      label: 'Vencimientos'     },
  { to: '/punto-equilibrio',  label: 'Pto. Equilibrio'  },
]
const CLIENTES_ITEMS = [
  { to: '/clientes',          label: 'Base de datos'    },
  { to: '/cuenta-corriente',  label: 'Saldo CC'         },
]
const COMERCIAL_ITEMS = [
  { to: '/ventas',        label: 'Ventas'        },
  { to: '/compras',       label: 'Compras'       },
  { to: '/productos',     label: 'Productos'     },
  { to: '/presupuestos',  label: 'Presupuestos'  },
]
const PRODUCCION_ITEMS = [
  { to: '/costos', label: 'Costos' },
  { to: '/stock',  label: 'Stock'  },
]

const FINANZAS_PATHS   = FINANZAS_ITEMS.map(i => i.to)
const CLIENTES_PATHS   = CLIENTES_ITEMS.map(i => i.to)
const COMERCIAL_PATHS  = COMERCIAL_ITEMS.map(i => i.to)
const PRODUCCION_PATHS = PRODUCCION_ITEMS.map(i => i.to)

/* ── SubItem link ────────────────────────────────────────────── */
function SubItem({ to, label, onClose }: { to: string; label: string; onClose?: () => void }) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={[
        'flex items-center pl-14 pr-7 py-2 text-[11px] font-semibold font-body',
        'border-l-[3px] transition-all duration-150 tracking-wide',
        isActive
          ? 'text-white bg-white/5'
          : 'text-white/35 border-l-transparent hover:text-white/70 hover:bg-white/5',
      ].join(' ')}
      style={{ borderLeftColor: isActive ? CORAL : 'transparent' }}>
      {label}
    </NavLink>
  )
}

/* ── Section group (colapsable) ──────────────────────────────── */
function SectionGroup({
  num, icon: Icon, label, items, onClose, paths,
}: {
  num: string
  icon: React.ElementType
  label: string
  items: { to: string; label: string }[]
  onClose?: () => void
  paths: string[]
}) {
  const location = useLocation()
  const isActive = paths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  const [open, setOpen] = useState(isActive)

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          'w-full flex items-center gap-3 px-7 py-3 text-sm font-semibold font-body',
          'border-l-[3px] transition-all duration-200 tracking-wide',
          isActive
            ? 'text-white bg-white/5'
            : 'text-white/40 border-l-transparent hover:text-white/80 hover:bg-white/5',
        ].join(' ')}
        style={{ borderLeftColor: isActive ? CORAL : 'transparent' }}>
        <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>{num}</span>
        <Icon size={16} strokeWidth={2} />
        <span className="tracking-[1px] uppercase text-[12px] flex-1 text-left">{label}</span>
        <ChevronDown
          size={14}
          className="transition-transform duration-200 shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.6 }}
        />
      </button>
      {open && (
        <div className="pb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {items.map(item => (
            <SubItem key={item.to} to={item.to} label={item.label} onClose={onClose} />
          ))}
        </div>
      )}
    </>
  )
}

/* ── Sidebar content (shared desktop/mobile) ─────────────────── */
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location   = useLocation()
  const navigate   = useNavigate()
  const { user, logout } = useAuth()
  const isAdmin      = user?.role === 'admin'
  const isCajaDiaria = user?.role === 'caja_diaria'

  const navLinkClass = (isActive: boolean) => [
    'flex items-center gap-3 px-7 py-3 text-sm font-semibold font-body',
    'border-l-[3px] transition-all duration-200 tracking-wide',
    isActive
      ? 'text-white border-l-coral bg-white/5'
      : 'text-white/40 border-l-transparent hover:text-white/80 hover:bg-white/5',
  ].join(' ')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-7 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <p style={{ color: CORAL }}
          className="text-[11px] font-bold tracking-[3px] uppercase font-body mb-1">
          JAN Orgánico Natural
        </p>
        <p className="text-white text-lg font-bold leading-tight font-head">
          Sistema ERP
        </p>
        <p className="text-white/30 text-[11px] tracking-[1.5px] uppercase mt-1.5 font-body">
          Mar del Plata · 2026
        </p>

        {/* User chip */}
        {user && (
          <div className="mt-4 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ background: CORAL }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-[11px] font-semibold leading-none truncate">
                {user.username}
              </p>
              <p className="text-white/30 text-[10px] tracking-wide uppercase mt-0.5">
                {user.role === 'admin' ? 'Administradora' : user.role === 'caja_diaria' ? 'Caja Diaria' : 'Acceso Caja'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 overflow-y-auto">

        {/* ── 01 Dashboard — oculto para caja_diaria ── */}
        {!isCajaDiaria && (
          <NavLink to="/" end onClick={onClose}
            className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
            <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>01</span>
            <LayoutDashboard size={16} strokeWidth={2} />
            <span className="tracking-[1px] uppercase text-[12px]">Dashboard</span>
          </NavLink>
        )}

        {/* ── 02 Caja Diaria — visible para todos ── */}
        <NavLink to="/caja-diaria" onClick={onClose}
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => ({ borderLeftColor: isActive ? CORAL : 'transparent' })}>
          <span className="font-body text-[10px] font-bold tracking-[1.5px]" style={{ color: CORAL }}>02</span>
          <BookOpen size={16} strokeWidth={2} />
          <span className="tracking-[1px] uppercase text-[12px]">Caja Diaria</span>
        </NavLink>

        {/* ── Secciones admin ── */}
        {isAdmin && (
          <>
            {/* Separador */}
            <div className="mx-7 my-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            {/* 03 Finanzas */}
            <SectionGroup
              num="03"
              icon={Wallet}
              label="Finanzas"
              items={FINANZAS_ITEMS}
              paths={FINANZAS_PATHS}
              onClose={onClose}
            />

            {/* 04 Clientes */}
            <SectionGroup
              num="04"
              icon={Users}
              label="Clientes"
              items={CLIENTES_ITEMS}
              paths={CLIENTES_PATHS}
              onClose={onClose}
            />

            {/* 05 Comercial */}
            <SectionGroup
              num="05"
              icon={ShoppingCart}
              label="Comercial"
              items={COMERCIAL_ITEMS}
              paths={COMERCIAL_PATHS}
              onClose={onClose}
            />

            {/* 06 Producción */}
            <SectionGroup
              num="06"
              icon={FlaskConical}
              label="Producción"
              items={PRODUCCION_ITEMS}
              paths={PRODUCCION_PATHS}
              onClose={onClose}
            />
          </>
        )}
      </nav>

      {/* Footer — logout */}
      <div className="px-7 py-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-white/30 hover:text-white/70 transition-colors text-[11px] font-body tracking-wide uppercase w-full"
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

/* ── Layout principal ────────────────────────────────────────── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex" style={{ background: '#F5EFE6' }}>

      {/* ── SIDEBAR DESKTOP ── */}
      <aside
        className="hidden md:flex flex-col w-60 flex-shrink-0 sticky top-0 h-screen overflow-y-auto"
        style={{ background: NAVY }}>
        <SidebarContent />
      </aside>

      {/* ── MOBILE HAMBURGER ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
        style={{ background: CORAL }}>
        <Menu size={20} color="white" />
      </button>

      {/* ── MOBILE DRAWER ── */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)} />
          <aside
            className="md:hidden fixed top-0 left-0 h-full w-64 z-50 overflow-y-auto flex flex-col"
            style={{ background: NAVY }}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="md:hidden h-16" />
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>

    </div>
  )
}

