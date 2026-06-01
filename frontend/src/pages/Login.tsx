import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn } from 'lucide-react'

const NAVY  = '#1E2B1A'
const CORAL = '#3D6B64'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: NAVY }}
    >
      {/* Card */}
      <div className="w-full max-w-sm">

        {/* Brand header */}
        <div className="text-center mb-10">
          <p
            className="text-[11px] font-bold tracking-[3px] uppercase mb-2"
            style={{ color: CORAL }}
          >
            JAN Orgánico Natural
          </p>
          <h1 className="text-white text-3xl font-bold leading-tight mb-1">
            Sistema ERP
          </h1>
          <p className="text-white/30 text-[11px] tracking-[1.5px] uppercase">
            Mar del Plata · 2026
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Username */}
          <div>
            <label className="block text-white/50 text-[11px] font-bold tracking-[1.5px] uppercase mb-1.5">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="Ej: Gustavo"
              className="w-full rounded-xl px-4 py-3 text-white text-sm font-medium placeholder:text-white/20
                         outline-none transition-all duration-200
                         focus:ring-2"
              style={{
                background:  'rgba(255,255,255,0.06)',
                border:      '1px solid rgba(255,255,255,0.10)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = CORAL; e.currentTarget.style.boxShadow = `0 0 0 2px ${CORAL}33` }}
              onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-white/50 text-[11px] font-bold tracking-[1.5px] uppercase mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 pr-12 text-white text-sm font-medium placeholder:text-white/20
                           outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border:     '1px solid rgba(255,255,255,0.10)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = CORAL; e.currentTarget.style.boxShadow = `0 0 0 2px ${CORAL}33` }}
                onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-red-300"
                 style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold
                       tracking-wide uppercase text-white transition-all duration-200
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: CORAL }}
          >
            {loading ? (
              <span className="animate-pulse">Ingresando…</span>
            ) : (
              <>
                <LogIn size={16} />
                Ingresar
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-white/15 text-[10px] tracking-wide uppercase mt-8">
          v1.0 · Sistema interno · Acceso restringido
        </p>
      </div>
    </div>
  )
}
