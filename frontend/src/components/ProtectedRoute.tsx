import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserRole } from '../context/AuthContext'

interface Props {
  children:      React.ReactNode
  requiredRole?: UserRole   // if omitted, any logged-in user can access
}

function SessionLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/40 text-xs tracking-widest uppercase">JAN Orgánico Natural</p>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Restoring session from localStorage → show spinner instead of blank screen
  if (loading) return <SessionLoader />

  // Not logged in → send to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // caja_diaria: solo puede estar en /caja-diaria
  if (user.role === 'caja_diaria' && location.pathname !== '/caja-diaria') {
    return <Navigate to="/caja-diaria" replace />
  }

  // Logged in but not enough permissions → send to /
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
