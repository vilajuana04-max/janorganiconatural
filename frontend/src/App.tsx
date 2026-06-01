import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'

import Dashboard        from './pages/Dashboard'
import Ventas           from './pages/Ventas'
import Compras          from './pages/Compras'
import RRHH             from './pages/RRHH'
import Gastos           from './pages/Gastos'
import FlujoCaja        from './pages/FlujoCaja'
import Vencimientos     from './pages/Vencimientos'
import GastosPersonales from './pages/GastosPersonales'
import CajaDiaria       from './pages/CajaDiaria'
import Comisiones        from './pages/Comisiones'
import PuntoEquilibrio  from './pages/PuntoEquilibrio'
import Costos           from './pages/Costos'
import Productos        from './pages/Productos'
import Stock            from './pages/Stock'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Public ── */}
        <Route path="/login" element={<Login />} />

        {/* ── Protected (any logged-in user) ── */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ventas"
          element={
            <ProtectedRoute>
              <Layout>
                <Ventas />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/compras"
          element={
            <ProtectedRoute>
              <Layout>
                <Compras />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Caja Diaria — todos los roles ── */}
        <Route
          path="/caja-diaria"
          element={
            <ProtectedRoute>
              <Layout>
                <CajaDiaria />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Admin only ── */}
        <Route
          path="/rrhh"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <RRHH />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/gastos"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <Gastos />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/flujocaja"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <FlujoCaja />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vencimientos"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <Vencimientos />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/gastos-personales"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <GastosPersonales />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/comisiones"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <Comisiones />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/punto-equilibrio"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <PuntoEquilibrio />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/costos"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <Costos />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Productos & Stock (admin) ── */}
        <Route
          path="/productos"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <Productos />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <ProtectedRoute requiredRole="admin">
              <Layout>
                <Stock />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Legacy redirects ── */}
        <Route path="/sueldos"    element={<Navigate to="/rrhh" replace />} />
        <Route path="/vacaciones" element={<Navigate to="/rrhh" replace />} />

        {/* ── Catch-all ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
